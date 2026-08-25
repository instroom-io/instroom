import "server-only"

// ─── Automatic post detection engine ─────────────────────────────────────────
// For each enabled influencer, polls THAT INFLUENCER'S OWN account feed, keeps
// the posts carrying a configured hashtag/mention, and imports them.
//
// Invariants:
//   • Nothing runs for a brand without an active add-on (checked per brand).
//   • Nothing spends a provider request without quota (checked per request).
//   • A post is never imported twice (unique index + pre-check).
//   • A failure for one influencer never aborts the others.
//   • A post is only ever attributed to the influencer who published it.
//
// ── Why this polls accounts, not hashtags ────────────────────────────────────
// It used to call searchPostsByHashtag() for each configured term. That endpoint
// is GLOBAL: /instagram/hashtag/posts returns whoever most recently used the
// tag. The only acceptance test was matchPost(), which checks that the caption
// contains a monitored term — it never checked WHO published the post. So any
// stranger's post carrying #yourbrand was imported and attributed to whichever
// influencer happened to have that tag configured, and every influencer sharing
// a tag received the same borrowed posts.
//
// The account endpoints are addressed to one account (Instagram by resolved
// numeric user_id, TikTok by username), so they cannot return another person's
// post. The configured hashtags/mentions still decide which of that influencer's
// posts count — they are now filters over their own feed rather than the search
// target. Authorship is then re-verified locally before any import.
//
// Callers: app/api/post-tracker/detection/run/route.ts (the "Check now" button)
// and app/api/cron/post-detection/route.ts (kept, but currently unscheduled —
// see that file). Safe to call concurrently: the caller holds the
// MonitoringLock.

import { prisma, withUtf8mb4 } from "@/lib/prisma"
import {
  fetchAccountPosts,
  normaliseHandle,
  isEnsembleConfigured,
  type EnsemblePlatform,
  type EnsemblePost,
} from "@/lib/ensembledata"
import { getAddonStatus } from "./addon"
import { consumeApiQuota, consumePostQuota, getQuota, remainingPostImports } from "./quota"
import { mapClosedToPipelineFields } from "@/lib/post-tracker-status"

const LOG = "[post-detection]"

/** Platforms queried when a setting doesn't name its own. */
export const MONITORED_PLATFORMS: EnsemblePlatform[] = ["instagram", "tiktok"]

/** Don't re-poll an influencer more often than this. */
export const MIN_POLL_INTERVAL_MS = 5 * 60 * 1000

/** Posts requested per provider call — small, to stretch the testing quota. */
const RESULTS_PER_QUERY = 10

/**
 * Monitoring window: how far back a post may be published and still be imported.
 *
 * There is no per-setting window column, so this is the intended default in one
 * place — same pattern as MIN_POLL_INTERVAL_MS above.
 *
 * Why it exists: a provider feed can reach years back, and without a window a
 * pass that had already deduped the genuinely recent posts would keep importing
 * old ones as if they were new. A post outside the window is never imported.
 */
const MAX_POST_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type MonitorSummary = {
  brandsConsidered: number
  influencersPolled: number
  apiCalls: number
  postsFound: number
  postsImported: number
  skipped: string[]
  errors: string[]
}

function parseList(value: string | null | undefined): string[] {
  if (!value) return []
  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((v) => v.replace(/^[#@]/, "").trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

function parsePlatforms(value: string | null | undefined): EnsemblePlatform[] {
  const wanted = parseList(value)
  if (wanted.length === 0) return MONITORED_PLATFORMS
  return MONITORED_PLATFORMS.filter((p) => wanted.includes(p))
}

/** Does this post actually reference one of the monitored terms? */
function matchPost(
  post: EnsemblePost,
  hashtags: string[],
  mentions: string[]
): { hashtag: string | null; mention: string | null } | null {
  const postTags = post.hashtags.map((h) => h.toLowerCase())
  const postMentions = post.mentions.map((m) => m.toLowerCase())
  const caption = (post.caption ?? "").toLowerCase()

  // Caption fallback covers providers that return the text but no parsed
  // entities — without it a genuine match would be dropped.
  const hashtag =
    hashtags.find((t) => postTags.includes(t) || caption.includes(`#${t}`)) ?? null
  const mention =
    mentions.find((m) => postMentions.includes(m) || caption.includes(`@${m}`)) ?? null

  if (!hashtag && !mention) return null
  return { hashtag, mention }
}

/**
 * Is this post actually published by the influencer being polled?
 *
 * The account endpoint already guarantees it, so this is defence in depth
 * against a provider payload that mixes in anything else (a suggested post, a
 * reshare, a changed response shape). A post whose author is present and does
 * NOT match the influencer's handle is refused — it belongs to somebody else.
 *
 * When the payload carries no author at all the post is accepted: the request
 * was addressed to this account's feed, and the missing field is the provider
 * omitting data rather than evidence of different authorship. Every such case is
 * logged so it stays visible.
 */
function isAuthoredBy(post: EnsemblePost, handle: string): boolean {
  const author = normaliseHandle(post.author)
  if (!author) {
    console.log(
      `${LOG} post ${post.postUrl} carries no author field — accepted on the strength of the ` +
        `account-scoped request for @${handle}`
    )
    return true
  }
  return author === handle
}

/**
 * The influencer's own social account, as recorded in the app.
 *
 * `Influencer.handle` + `Influencer.platform` is the only account data the app
 * holds (they are unique together), and it is what the rest of the product shows
 * as the influencer's account. Nothing here invents or defaults a handle: an
 * influencer without one is reported, not searched.
 */
async function resolveInfluencerAccount(brandInfluencerId: string, brandId: string): Promise<
  | { ok: true; handle: string; platform: EnsemblePlatform | null; rawPlatform: string }
  | { ok: false; error: string }
> {
  // Scoped by brand as well as id — the same guard the API routes use, so a
  // setting row pointing outside its brand can never pull another brand's data.
  const row = await prisma.brandInfluencer.findFirst({
    where: { id: brandInfluencerId, brand_id: brandId },
    select: { influencer: { select: { handle: true, platform: true } } },
  })

  if (!row?.influencer) {
    return { ok: false, error: "influencer record not found for this brand — nothing to monitor" }
  }

  const handle = normaliseHandle(row.influencer.handle)
  if (!handle) {
    return {
      ok: false,
      error: "no social account handle recorded for this influencer — add their handle to enable detection",
    }
  }

  const rawPlatform = (row.influencer.platform ?? "").trim()
  const platform = MONITORED_PLATFORMS.find((p) => p === rawPlatform.toLowerCase()) ?? null
  return { ok: true, handle, platform, rawPlatform }
}

/**
 * Poll one influencer. Returns counters; never throws — a provider or DB error
 * is recorded against this influencer and the caller moves on.
 */
/**
 * Populate the influencer's post fields from a detected post and move the card
 * to Posted, using the same mapping a manual drag writes.
 *
 * Three rules, none of them new:
 *
 *   * A MANUAL Post URL is never overwritten. `post_url` already holding
 *     something means a human typed or dropped it, and the client side already
 *     refuses to replace it (handleDetectedPost in
 *     app/dashboard/post-tracker/page.tsx). This mirrors that server-side, so a
 *     background pass cannot do what the UI forbids.
 *   * The transition goes through mapClosedToPipelineFields("Posted", …), the
 *     same function the manual PATCH route and the Shopify sync call, so an
 *     automatic move and a human move write identical field shapes.
 *   * `posted_at` prefers the post's own published date over "now", so the
 *     timeline reflects when the influencer actually posted.
 *
 * updateMany, not update: it is a single scoped write with no read-back, and it
 * lets the `post_url IS NULL` condition do the "don't overwrite" check in the
 * database rather than in a read-then-write that could race a manual save.
 */
async function applyDetectionToInfluencer(
  brandInfluencerId: string,
  brandId: string,
  post: EnsemblePost
): Promise<void> {
  const current = await prisma.brandInfluencer.findUnique({
    where: { id: brandInfluencerId },
    select: { post_url: true, shipped_at: true, delivered_at: true, posted_at: true, content_posted: true },
  })
  if (!current) return

  // Already carries a URL — manual entry, or an earlier detection. Leave it.
  if (current.post_url && current.post_url.trim()) {
    console.log(`${LOG} ${brandInfluencerId} already has a post URL — detection not applied`)
    return
  }

  const fields = mapClosedToPipelineFields("Posted", {
    shipped_at:   current.shipped_at,
    delivered_at: current.delivered_at,
    // Prefer the post's own timestamp; the mapping falls back to now().
    posted_at:    post.publishedAt ?? current.posted_at,
  })

  // The post_url guard is part of the WHERE, so a manual save landing between
  // the read above and this write wins rather than being clobbered.
  const result = await prisma.brandInfluencer.updateMany({
    where: {
      id: brandInfluencerId,
      brand_id: brandId,
      OR: [{ post_url: null }, { post_url: "" }],
    },
    data: {
      ...fields,
      post_url: post.postUrl,
      // Only what the provider actually returned — a missing metric is left at
      // whatever the record already holds rather than being zeroed.
      ...(post.likeCount    != null ? { likes_count:    post.likeCount } : {}),
      ...(post.commentCount != null ? { comments_count: post.commentCount } : {}),
      // engagement_count is interactions, so likes + comments — NOT views.
      // Written only when the provider returned both, since a sum with a
      // missing half would understate it and read as a real figure.
      ...(post.likeCount != null && post.commentCount != null
        ? { engagement_count: post.likeCount + post.commentCount }
        : {}),
    },
  })

  if (result.count === 0) {
    console.log(`${LOG} ${brandInfluencerId} gained a post URL mid-write — detection not applied`)
    return
  }
  console.log(`${LOG} ${brandInfluencerId} moved to Posted from detection ${post.postUrl}`)
}

async function pollInfluencer(
  setting: {
    /** Null when this influencer has no bookkeeping row yet. */
    id: string | null
    brand_id: string
    brand_influencer_id: string
    /** Legacy per-influencer values — fallback only, see `brandConfig`. */
    hashtags: string | null
    mentions: string | null
    platforms: string | null
  },
  /**
   * What the BRAND configured, which is the source of truth now that detection
   * is a brand-level feature. The same hashtags and mentions are used for every
   * influencer handle the brand monitors.
   */
  brandConfig: { hashtags: string; mentions: string }
): Promise<{ apiCalls: number; found: number; imported: number; error?: string }> {
  // Brand config wins; the per-influencer columns are read only when the brand
  // has none, so brands set up before those columns existed keep working.
  const hashtags = parseList(brandConfig.hashtags || setting.hashtags)
  const mentions = parseList(brandConfig.mentions || setting.mentions)
  const platforms = parsePlatforms(setting.platforms)

  console.log(
    `${LOG} influencer ${setting.brand_influencer_id}: hashtags=[${hashtags.join(", ") || "none"}] ` +
      `mentions=[${mentions.join(", ") || "none"}] platforms=[${platforms.join(", ")}]`
  )

  /**
   * Record this pass's outcome against the influencer.
   *
   * Upsert by brand_influencer_id (which is @unique), not update by id: the
   * target list is derived from BrandInfluencer now, so an influencer that has
   * just reached Delivered has no bookkeeping row yet and one update() would
   * throw P2025 before its first poll ever ran.
   */
  const recordPass = (last_error: string | null) =>
    prisma.postDetectionSetting
      .upsert({
        where: { brand_influencer_id: setting.brand_influencer_id },
        create: {
          brand_influencer_id: setting.brand_influencer_id,
          brand_id: setting.brand_id,
          last_synced_at: new Date(),
          last_error,
        },
        update: { last_synced_at: new Date(), last_error },
      })
      .catch(() => {})

  /** Record the reason and stop, without spending a provider request. */
  const abort = async (msg: string) => {
    console.warn(`${LOG} influencer ${setting.brand_influencer_id}: ${msg}`)
    await recordPass(msg)
    return { apiCalls: 0, found: 0, imported: 0, error: msg }
  }

  if (hashtags.length === 0 && mentions.length === 0) {
    return abort("no hashtags or mentions configured — nothing to search")
  }

  // ── The search target: this influencer's own account ──────────────────────
  const account = await resolveInfluencerAccount(setting.brand_influencer_id, setting.brand_id)
  if (!account.ok) {
    // Same shape as the missing-terms case above: recorded on the setting and
    // surfaced to the UI, with no broad search as a consolation.
    return abort(account.error)
  }

  if (!account.platform) {
    return abort(
      `influencer's platform "${account.rawPlatform || "unknown"}" is not supported for detection ` +
        `(supported: ${MONITORED_PLATFORMS.join(", ")})`
    )
  }

  // A platform allow-list on the setting can narrow this, never widen it: the
  // influencer has exactly one recorded account, so that platform is the ceiling.
  if (!platforms.includes(account.platform)) {
    return abort(
      `influencer's account is on ${account.platform}, which this setting's platform filter ` +
        `[${platforms.join(", ")}] excludes — nothing to search`
    )
  }

  console.log(
    `${LOG} influencer ${setting.brand_influencer_id}: polling ONLY @${account.handle} on ${account.platform}`
  )

  const run = await prisma.monitoringRun.create({
    data: {
      brand_id: setting.brand_id,
      brand_influencer_id: setting.brand_influencer_id,
      status: "running",
    },
  })

  let apiCalls = 0
  let found = 0
  let imported = 0
  const errors: string[] = []

  try {
    // ONE query: this influencer's own account feed. The configured terms are
    // applied to the result rather than issued as separate global searches, so
    // the request count no longer scales with the number of terms — and no
    // request can reach another account's posts.
    const queries: { platform: EnsemblePlatform; handle: string }[] = [
      { platform: account.platform, handle: account.handle },
    ]

    for (const q of queries) {
      const label = `@${q.handle} on ${q.platform}`
      const reserved = await consumeApiQuota(setting.brand_id, 1)
      if (!reserved) {
        const msg = "Daily API quota reached"
        console.warn(`${LOG} ${msg} for brand ${setting.brand_id} — stopping this influencer.`)
        errors.push(msg)
        break
      }
      console.log(
        `${LOG} quota consumed: API ${reserved.apiRequests}/${reserved.apiLimit}, ` +
          `posts ${reserved.postsImported}/${reserved.postLimit}`
      )

      // The window is passed INTO the provider request layer so pagination can
      // stop as soon as the feed drops out of it, rather than fetching pages of
      // old posts and discarding them here.
      const notBefore = new Date(Date.now() - MAX_POST_AGE_MS)

      const res = await fetchAccountPosts(q.platform, q.handle, RESULTS_PER_QUERY, { notBefore })

      // Reconcile: retries inside the client may have cost more than the one
      // request reserved above, so charge the difference.
      apiCalls += res.apiCalls
      if (res.apiCalls > 1) await consumeApiQuota(setting.brand_id, res.apiCalls - 1)

      if (!res.ok) {
        errors.push(`${label} — ${res.error}`)
        continue
      }

      let unmatched = 0
      let outOfWindow = 0
      let wrongAuthor = 0
      // res.data arrives newest-first (sorted on the provider timestamp), so the
      // newest eligible posts are considered before older ones and the import
      // quota is spent on the freshest content.
      for (const post of res.data) {
        // Attribution gate — FIRST, before matching, quota or import. A post is
        // only ever recorded against the influencer who published it.
        if (!isAuthoredBy(post, q.handle)) {
          wrongAuthor++
          console.warn(
            `${LOG} REFUSED ${post.postUrl} — published by @${normaliseHandle(post.author)}, ` +
              `not by @${q.handle}. Not attributed to influencer ${setting.brand_influencer_id}.`
          )
          continue
        }

        const match = matchPost(post, hashtags, mentions)
        if (!match) {
          unmatched++
          continue
        }

        // Second line of defence — the client already filters, but an undated or
        // out-of-window post must never consume the import quota.
        if (!post.publishedAt || post.publishedAt < notBefore) {
          outOfWindow++
          console.log(
            `${LOG} SKIP (outside ${MAX_POST_AGE_MS / 86400000}d window) ${post.platform} ${post.postUrl} ` +
              `published=${post.publishedAt?.toISOString() ?? "unknown"}`
          )
          continue
        }
        found++

        // Re-read quota per post: another influencer in this same pass may have
        // consumed the remaining allowance.
        if (remainingPostImports(await getQuota(setting.brand_id)) <= 0) {
          errors.push("Daily post import limit reached")
          break
        }

        try {
          // The unique index on (brand_influencer_id, post_url) is the real
          // guard; `create` + P2002 catch means a concurrent pass inserting the
          // same post is a no-op rather than a duplicate.
          // withUtf8mb4: this host's init_connect pins every new connection to
          // utf8mb3, so a caption containing an emoji fails with MySQL 3988.
          // The wrapper pins one connection with SET NAMES utf8mb4 and runs the
          // insert on it — same create(), same data, nothing sanitised.
          await withUtf8mb4((tx) => tx.detectedPost.create({
            data: {
              brand_influencer_id: setting.brand_influencer_id,
              brand_id: setting.brand_id,
              platform: post.platform,
              post_url: post.postUrl,
              matched_hashtag: match.hashtag,
              matched_mention: match.mention,
              external_id: post.externalId,
              author: post.author,
              caption: post.caption,
              published_at: post.publishedAt,
              hashtags: post.hashtags.join(",") || null,
              mentions: post.mentions.join(",") || null,
              like_count: post.likeCount,
              comment_count: post.commentCount,
              view_count: post.viewCount,
              share_count: post.shareCount,
            },
          }))
          imported++
          await consumePostQuota(setting.brand_id, 1)
          // Carry the detection into the influencer's own record, so the Post
          // Tracker card actually moves. Recording a DetectedPost row was all
          // this did before: the post appeared under "Recently detected posts"
          // but Post URL stayed empty and the card stayed in Delivered until
          // somebody dragged the post onto the field by hand.
          await applyDetectionToInfluencer(setting.brand_influencer_id, setting.brand_id, post)
          console.log(`${LOG} IMPORTED published=${post.publishedAt?.toISOString()} ${post.platform} ${post.postUrl} (matched ${match.hashtag ? `#${match.hashtag}` : `@${match.mention}`})`)
        } catch (err) {
          const code = (err as { code?: string })?.code
          if (code === "P2002") {
            // Already imported — expected on every re-poll, not an error.
            console.log(`${LOG} duplicate, skipped: ${post.postUrl}`)
            continue
          }
          // A genuine DB failure must be visible, not folded into "no posts".
          console.error(`${LOG} DB IMPORT FAILED for ${post.postUrl}:`, err)
          throw err
        }
      }

      if (outOfWindow > 0) {
        console.log(`${LOG} ${label} — ${outOfWindow} matching post(s) skipped as older than the monitoring window`)
      }

      if (wrongAuthor > 0) {
        console.warn(`${LOG} ${label} — ${wrongAuthor} post(s) refused because another account published them`)
      }

      if (unmatched > 0) {
        console.log(
          `${LOG} ${label} — ${unmatched} of this influencer's own post(s) carried none of the monitored ` +
            `terms [${[...hashtags.map((h) => `#${h}`), ...mentions.map((m) => `@${m}`)].join(", ")}], so they were not imported`
        )
      }
    }

    const error = errors.length ? errors.join("; ").slice(0, 1000) : null
    await prisma.$transaction([
      prisma.monitoringRun.update({
        where: { id: run.id },
        data: {
          status: error ? (imported > 0 ? "partial" : "failed") : "success",
          api_calls: apiCalls,
          posts_found: found,
          posts_imported: imported,
          error,
          finished_at: new Date(),
        },
      }),
    ])
    // Outside the transaction: recordPass swallows its own failure (bookkeeping
    // must never fail a pass), which makes it a plain promise rather than the
    // PrismaPromise $transaction requires.
    await recordPass(error ?? null)

    return { apiCalls, found, imported, error: error ?? undefined }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown monitoring error"
    console.error(`${LOG} influencer ${setting.brand_influencer_id} failed: ${message}`)
    await prisma.monitoringRun
      .update({
        where: { id: run.id },
        data: {
          status: "failed",
          api_calls: apiCalls,
          posts_found: found,
          posts_imported: imported,
          error: message.slice(0, 1000),
          finished_at: new Date(),
        },
      })
      .catch(() => {})
    await recordPass(message.slice(0, 1000))
    return { apiCalls, found, imported, error: message }
  }
}

/**
 * One monitoring pass over every enabled influencer whose brand has an active
 * add-on and remaining quota.
 */
export async function runMonitoringPass(options?: { brandId?: string; force?: boolean }): Promise<MonitorSummary> {
  const summary: MonitorSummary = {
    brandsConsidered: 0,
    influencersPolled: 0,
    apiCalls: 0,
    postsFound: 0,
    postsImported: 0,
    skipped: [],
    errors: [],
  }

  const startedAt = Date.now()
  console.log(
    `${LOG} ===== PASS START ${new Date().toISOString()} ` +
      `brandId=${options?.brandId ?? "(all)"} force=${options?.force ? "yes" : "no"} =====`
  )

  if (!isEnsembleConfigured()) {
    const msg = "EnsembleData API token is not configured (set ENSEMBLEDATA_TOKEN or ENSEMBLE_TOKEN)"
    summary.errors.push(msg)
    console.error(`${LOG} ABORTED — ${msg}`)
    // Persist the abort so the failure is visible in the database and not only
    // in whichever log stream happened to be attached at the time.
    if (options?.brandId) {
      await prisma.monitoringRun
        .create({
          data: {
            brand_id: options.brandId,
            status: "failed",
            error: msg,
            finished_at: new Date(),
          },
        })
        .catch(() => {})
    }
    return summary
  }

  const staleBefore = new Date(Date.now() - MIN_POLL_INTERVAL_MS)

  // ── Who gets polled ─────────────────────────────────────────────────────
  // Detection is a PAID BRAND-LEVEL feature, not a per-influencer opt-in. So
  // the target list is derived, not configured: every influencer a brand has at
  // Delivered or beyond, for every brand whose add-on is active. Nobody has to
  // switch anything on per influencer, and nothing is missed because a toggle
  // was forgotten.
  //
  // Stage 7 = Delivered, 8 = Posted (lib/post-tracker-status.ts). Below that —
  // For Order Creation (5), In-Transit (6) — the product has not arrived, so
  // there is no post to find and polling would spend the brand's API allowance
  // proving it.
  //
  // PostDetectionSetting is still read, but only for what it is now: per-handle
  // BOOKKEEPING. `last_synced_at` paces the poll interval and `last_error`
  // carries the last failure. Its legacy `hashtags`/`mentions` are used as a
  // fallback so brands configured before the brand-level columns existed keep
  // working with no data migration.
  const candidateRows = await prisma.brandInfluencer.findMany({
    where: {
      stage: { gte: 7 },
      ...(options?.brandId ? { brand_id: options.brandId } : {}),
    },
    select: { id: true, brand_id: true },
  })

  if (candidateRows.length === 0) {
    console.log(`${LOG} no influencers at Delivered or beyond — nothing to poll`)
  }

  // Bookkeeping rows for those influencers, in one query.
  const bookkeeping = candidateRows.length
    ? await prisma.postDetectionSetting.findMany({
        where: { brand_influencer_id: { in: candidateRows.map((r) => r.id) } },
        select: {
          id: true,
          brand_influencer_id: true,
          hashtags: true,
          mentions: true,
          platforms: true,
          last_synced_at: true,
        },
      })
    : []
  const bookByInfluencer = new Map(bookkeeping.map((b) => [b.brand_influencer_id, b]))

  // The poll interval still applies: an influencer polled within
  // MIN_POLL_INTERVAL_MS is skipped unless force=true.
  const settings = candidateRows
    .filter((row) => {
      if (options?.force) return true
      const last = bookByInfluencer.get(row.id)?.last_synced_at
      return !last || last < staleBefore
    })
    .map((row) => {
      const book = bookByInfluencer.get(row.id)
      return {
        // Null when this influencer has no bookkeeping row yet — pollInfluencer
        // upserts by brand_influencer_id, so it does not need one to exist.
        id: book?.id ?? null,
        brand_id: row.brand_id,
        brand_influencer_id: row.id,
        // Legacy per-influencer values, used only as a fallback below.
        hashtags: book?.hashtags ?? null,
        mentions: book?.mentions ?? null,
        platforms: book?.platforms ?? null,
        last_synced_at: book?.last_synced_at ?? null,
      }
    })
    // Oldest first, so a long backlog is worked through fairly.
    .sort((a, b) => (a.last_synced_at?.getTime() ?? 0) - (b.last_synced_at?.getTime() ?? 0))

  console.log(
    `${LOG} ${settings.length} influencer(s) due for polling` +
      (settings.length === 0 && candidateRows.length > 0
        ? ` — all ${candidateRows.length} at Delivered+ were polled within the last ` +
          `${MIN_POLL_INTERVAL_MS / 60000} minutes (pass force=true to override).`
        : "")
  )

  // Group by brand so the add-on and quota checks happen once per brand rather
  // than once per influencer.
  const byBrand = new Map<string, typeof settings>()
  for (const s of settings) {
    const list = byBrand.get(s.brand_id) ?? []
    list.push(s)
    byBrand.set(s.brand_id, list)
  }

  for (const [brandId, brandSettings] of byBrand) {
    summary.brandsConsidered++

    // getAddonStatus, not isAddonActive: the same row carries the gate AND the
    // brand's hashtags/mentions, so one read answers both. The add-on being
    // active is what enables detection for every Delivered influencer of this
    // brand — there is no per-influencer switch.
    const addon = await getAddonStatus(brandId)
    if (!addon.active) {
      summary.skipped.push(`${brandId}: add-on not active`)
      continue
    }

    // Nothing to match on. Skipped before any provider request, since a pass
    // with no hashtag and no mention can only ever return nothing.
    if (!addon.hashtags.trim() && !addon.mentions.trim()) {
      const anyLegacy = brandSettings.some((x) => (x.hashtags ?? "").trim() || (x.mentions ?? "").trim())
      if (!anyLegacy) {
        summary.skipped.push(`${brandId}: no hashtags or mentions configured`)
        continue
      }
    }

    const quota = await getQuota(brandId)
    if (quota.apiExhausted) {
      summary.skipped.push(`${brandId}: daily API quota reached`)
      continue
    }
    if (quota.postsExhausted) {
      summary.skipped.push(`${brandId}: daily post import limit reached`)
      continue
    }

    for (const setting of brandSettings) {
      const result = await pollInfluencer(setting, {
        hashtags: addon.hashtags,
        mentions: addon.mentions,
      })
      summary.influencersPolled++
      summary.apiCalls += result.apiCalls
      summary.postsFound += result.found
      summary.postsImported += result.imported
      if (result.error) summary.errors.push(`${setting.brand_influencer_id}: ${result.error}`)

      // Stop early once this brand is out of allowance — the remaining
      // influencers will be picked up on the next pass.
      const after = await getQuota(brandId)
      if (after.apiExhausted || after.postsExhausted) {
        summary.skipped.push(`${brandId}: quota reached mid-pass`)
        break
      }
    }
  }

  console.log(
    `${LOG} ===== PASS COMPLETE in ${Date.now() - startedAt}ms — brands=${summary.brandsConsidered} ` +
      `influencers=${summary.influencersPolled} apiCalls=${summary.apiCalls} found=${summary.postsFound} ` +
      `imported=${summary.postsImported} skipped=${summary.skipped.length} errors=${summary.errors.length} =====`
  )
  // Never finish "successfully" without saying why nothing happened.
  if (summary.apiCalls === 0) {
    console.warn(
      `${LOG} NO API REQUESTS WERE MADE. Reasons collected: ` +
        `${[...summary.skipped, ...summary.errors].join(" | ") || "no enabled settings were due for polling"}`
    )
  }
  for (const s of summary.skipped) console.warn(`${LOG} skipped — ${s}`)
  for (const e of summary.errors) console.error(`${LOG} error — ${e}`)

  return summary
}

/* ── Distributed lock ─────────────────────────────────────────────────────── */
// Prevents overlapping passes across serverless instances or a manual trigger
// racing the cron. Expiry is what makes it crash-safe: a dead holder's lock is
// reclaimed instead of wedging the job forever.

const LOCK_KEY = "post-detection"
const LOCK_TTL_MS = 10 * 60 * 1000

export async function acquireMonitoringLock(holder: string): Promise<boolean> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS)

  try {
    await prisma.monitoringLock.create({
      data: { key: LOCK_KEY, locked_at: now, expires_at: expiresAt, holder },
    })
    return true
  } catch {
    // Row exists. Take it over only if the current holder's lease has expired.
    const result = await prisma.monitoringLock.updateMany({
      where: { key: LOCK_KEY, expires_at: { lt: now } },
      data: { locked_at: now, expires_at: expiresAt, holder },
    })
    return result.count > 0
  }
}

export async function releaseMonitoringLock(holder: string): Promise<void> {
  // Scoped to this holder so a slow run can't release a lock someone else took
  // over after its lease expired.
  await prisma.monitoringLock.deleteMany({ where: { key: LOCK_KEY, holder } }).catch(() => {})
}

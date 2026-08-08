import "server-only"

// ─── Automatic post detection engine ─────────────────────────────────────────
// Polls EnsembleData for each enabled influencer, matches results against the
// configured hashtags/mentions, and imports new posts into the Post Tracker.
//
// Invariants:
//   • Nothing runs for a brand without an active add-on (checked per brand).
//   • Nothing spends a provider request without quota (checked per request).
//   • A post is never imported twice (unique index + pre-check).
//   • A failure for one influencer never aborts the others.
//
// Called by app/api/cron/post-detection/route.ts. Safe to call concurrently:
// the caller holds the MonitoringLock.

import { prisma } from "@/lib/prisma"
import {
  searchPostsByHashtag,
  searchPostsByMention,
  isEnsembleConfigured,
  type EnsemblePlatform,
  type EnsemblePost,
} from "@/lib/ensembledata"
import { isAddonActive } from "./addon"
import { consumeApiQuota, consumePostQuota, getQuota, remainingPostImports } from "./quota"

const LOG = "[post-detection]"

/** Platforms queried when a setting doesn't name its own. */
export const MONITORED_PLATFORMS: EnsemblePlatform[] = ["instagram", "tiktok"]

/** Don't re-poll an influencer more often than this. */
export const MIN_POLL_INTERVAL_MS = 5 * 60 * 1000

/** Posts requested per provider call — small, to stretch the testing quota. */
const RESULTS_PER_QUERY = 10

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
 * Poll one influencer. Returns counters; never throws — a provider or DB error
 * is recorded against this influencer and the caller moves on.
 */
async function pollInfluencer(setting: {
  id: string
  brand_id: string
  brand_influencer_id: string
  hashtags: string | null
  mentions: string | null
  platforms: string | null
}): Promise<{ apiCalls: number; found: number; imported: number; error?: string }> {
  const hashtags = parseList(setting.hashtags)
  const mentions = parseList(setting.mentions)
  const platforms = parsePlatforms(setting.platforms)

  console.log(
    `${LOG} influencer ${setting.brand_influencer_id}: hashtags=[${hashtags.join(", ") || "none"}] ` +
      `mentions=[${mentions.join(", ") || "none"}] platforms=[${platforms.join(", ")}]`
  )

  if (hashtags.length === 0 && mentions.length === 0) {
    const msg = "no hashtags or mentions configured — nothing to search"
    console.warn(`${LOG} influencer ${setting.brand_influencer_id}: ${msg}`)
    await prisma.postDetectionSetting
      .update({ where: { id: setting.id }, data: { last_synced_at: new Date(), last_error: msg } })
      .catch(() => {})
    return { apiCalls: 0, found: 0, imported: 0, error: msg }
  }

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
    // One query per (platform, term). Each is quota-checked immediately before
    // it runs so a long list can't overshoot the daily cap mid-loop.
    const queries: { platform: EnsemblePlatform; kind: "hashtag" | "mention"; term: string }[] = []
    for (const platform of platforms) {
      for (const term of hashtags) queries.push({ platform, kind: "hashtag", term })
      for (const term of mentions) queries.push({ platform, kind: "mention", term })
    }

    for (const q of queries) {
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

      const res =
        q.kind === "hashtag"
          ? await searchPostsByHashtag(q.platform, q.term, RESULTS_PER_QUERY)
          : await searchPostsByMention(q.platform, q.term, RESULTS_PER_QUERY)

      // Reconcile: retries inside the client may have cost more than the one
      // request reserved above, so charge the difference.
      apiCalls += res.apiCalls
      if (res.apiCalls > 1) await consumeApiQuota(setting.brand_id, res.apiCalls - 1)

      if (!res.ok) {
        errors.push(`${q.platform}/${q.kind}:${q.term} — ${res.error}`)
        continue
      }

      let unmatched = 0
      for (const post of res.data) {
        const match = matchPost(post, hashtags, mentions)
        if (!match) {
          unmatched++
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
          await prisma.detectedPost.create({
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
          })
          imported++
          await consumePostQuota(setting.brand_id, 1)
          console.log(`${LOG} IMPORTED ${post.platform} ${post.postUrl} (matched ${match.hashtag ? `#${match.hashtag}` : `@${match.mention}`})`)
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

      if (unmatched > 0) {
        console.warn(
          `${LOG} ${q.platform}/${q.kind}:${q.term} — ${unmatched} post(s) returned but did not contain any ` +
            `monitored term. Provider hashtag feeds are approximate; captions are re-checked locally.`
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
      prisma.postDetectionSetting.update({
        where: { id: setting.id },
        data: { last_synced_at: new Date(), last_error: error },
      }),
    ])

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
    await prisma.postDetectionSetting
      .update({ where: { id: setting.id }, data: { last_synced_at: new Date(), last_error: message.slice(0, 1000) } })
      .catch(() => {})
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

  const settings = await prisma.postDetectionSetting.findMany({
    where: {
      enabled: true,
      ...(options?.brandId ? { brand_id: options.brandId } : {}),
      ...(options?.force
        ? {}
        : { OR: [{ last_synced_at: null }, { last_synced_at: { lt: staleBefore } }] }),
    },
    select: {
      id: true,
      brand_id: true,
      brand_influencer_id: true,
      hashtags: true,
      mentions: true,
      platforms: true,
    },
    orderBy: { last_synced_at: "asc" },
  })

  console.log(
    `${LOG} ${settings.length} enabled setting(s) due for polling` +
      (settings.length === 0
        ? ` — nothing to do. Either no influencer has monitoring enabled, or all were polled within the last ` +
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

    if (!(await isAddonActive(brandId))) {
      summary.skipped.push(`${brandId}: add-on not active`)
      continue
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
      const result = await pollInfluencer(setting)
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

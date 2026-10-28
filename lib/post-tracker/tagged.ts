import "server-only"

// ─── Instagram tagged-posts detection ────────────────────────────────────────
// Finds influencer posts by asking "which posts TAG the brand's Instagram
// account?" instead of reading every influencer's feed for a caption match.
//
//   1. ONE call per brand: the brand account's tagged-posts feed (newest first).
//   2. Each post's author is matched to the brand's own influencers — only those
//      whose card is Delivered, or Posted and not yet Completed. A stranger who
//      tags the brand matches nobody and costs nothing further.
//   3. Only a match spends a second call (post details), for the publish date,
//      metrics and media. Posts published before the order shipped are ignored.
//   4. The post is recorded (DetectedPost, source "tagged"), its media copied to
//      Cloudinary, and the card updated at the end of the pass, oldest post
//      first: a Delivered card moves to Posted, a Posted card fills its next
//      empty deliverable — or gains a new one when every slot is taken.
//
// This catches posts that tag the brand (photo tag or collab) without naming it
// in the caption, which caption matching misses, and its cost scales with the
// number of matching posts rather than with the number of influencers.
//
// Called once per brand from runMonitoringPass, which holds the MonitoringLock
// and has already checked the add-on and quota.

import { prisma, withUtf8mb4 } from "@/lib/prisma"
import {
  fetchTaggedPosts,
  fetchInstagramPostDetails,
  resolveInstagramUserId,
  normaliseHandle,
  parsePostUrl,
} from "@/lib/ensembledata"
import type { AddonStatus } from "./addon"
import { consumeApiQuota, consumePostQuota, getQuota, remainingApiRequests, remainingPostImports } from "./quota"
import { archivePostMedia } from "./media"
import { syncDetectedPostsToCard } from "./apply"

const LOG = "[post-detection:tagged]"

/**
 * The newest N posts tagging the brand are read per pass — one request, as in
 * the original n8n flow. Posts already recorded are skipped without a details
 * call, so a re-run only spends on genuinely new matches.
 */
const TAGGED_POSTS_PER_PASS = 8

/** How far back already-recorded posts are loaded to recognise "seen before". */
const KNOWN_POSTS_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000

export type TaggedTarget = {
  brandInfluencerId: string
  /** Normalised Instagram handle of the influencer. */
  handle: string
  /** Posts published before this don't count (detectionWindowStart). */
  trackingSince: Date
}

export type TaggedPassResult = {
  apiCalls: number
  found: number
  imported: number
  errors: string[]
}

export async function runTaggedPass(
  brandId: string,
  addon: AddonStatus,
  targets: TaggedTarget[]
): Promise<TaggedPassResult> {
  const result: TaggedPassResult = { apiCalls: 0, found: 0, imported: 0, errors: [] }
  const brandHandle = normaliseHandle(addon.instagramUsername)

  const run = await prisma.monitoringRun.create({
    data: { brand_id: brandId, brand_influencer_id: null, status: "running" },
  })

  /** Charge provider calls the client made beyond what was reserved. */
  const charge = async (used: number, reserved: number) => {
    result.apiCalls += used
    if (used > reserved) await consumeApiQuota(brandId, used - reserved)
  }

  try {
    console.log(
      `${LOG} brand ${brandId}: @${brandHandle} — matching against ${targets.length} influencer(s) ` +
        `[${targets.map((t) => `@${t.handle}`).join(", ")}]`
    )

    // ── 1. The brand account's numeric id (cached after the first lookup) ────
    let userId = addon.instagramUserId
    if (!userId) {
      if (!(await consumeApiQuota(brandId, 1))) throw new Error("Daily API quota reached")
      const resolved = await resolveInstagramUserId(brandHandle)
      await charge(resolved.apiCalls, 1)
      if (!resolved.ok) throw new Error(`Could not find the brand's Instagram account @${brandHandle}: ${resolved.error}`)
      userId = resolved.data
      await prisma.postTrackerAddon.update({
        where: { brand_id: brandId },
        data: { instagram_user_id: userId },
      })
    }

    // ── 2. Posts that tag the brand, stopping at ones already recorded ───────
    const known = await prisma.detectedPost.findMany({
      where: {
        brand_id: brandId,
        platform: "instagram",
        source: "tagged",
        detected_at: { gte: new Date(Date.now() - KNOWN_POSTS_LOOKBACK_MS) },
      },
      select: { post_url: true },
    })
    const knownCodes = new Set<string>()
    for (const k of known) {
      const parsed = parsePostUrl(k.post_url)
      if (parsed?.platform === "instagram") knownCodes.add(parsed.code)
    }

    if (remainingApiRequests(await getQuota(brandId)) <= 0 || !(await consumeApiQuota(brandId, 1))) {
      throw new Error("Daily API quota reached")
    }
    const feed = await fetchTaggedPosts(userId, {
      maxPages: 1,
      chunkSize: TAGGED_POSTS_PER_PASS,
      stopAt: knownCodes,
    })
    await charge(feed.apiCalls, 1)
    if (!feed.ok) throw new Error(`Tagged posts request failed: ${feed.error}`)

    // ── 3. Match authors to this brand's influencers ─────────────────────────
    const byHandle = new Map(targets.map((t) => [t.handle, t]))
    let unmatched = 0
    let outOfWindow = 0

    for (const ref of feed.data) {
      const target = byHandle.get(normaliseHandle(ref.author))
      if (!target) {
        unmatched++
        continue
      }

      // Already on this influencer — nothing to spend a details call on.
      const exists = await prisma.detectedPost.findFirst({
        where: { brand_influencer_id: target.brandInfluencerId, post_url: ref.postUrl },
        select: { id: true },
      })
      if (exists) continue

      if (remainingPostImports(await getQuota(brandId)) <= 0) {
        result.errors.push("Daily post import limit reached")
        break
      }
      if (!(await consumeApiQuota(brandId, 1))) {
        result.errors.push("Daily API quota reached")
        break
      }

      const details = await fetchInstagramPostDetails(ref.shortcode)
      await charge(details.apiCalls, 1)
      if (!details.ok) {
        result.errors.push(`@${target.handle} ${ref.postUrl} — ${details.error}`)
        continue
      }
      const { post, media } = details.data

      // Defence in depth: the feed said who posted it; the details must agree.
      const author = normaliseHandle(post.author)
      if (author && author !== target.handle) {
        console.warn(`${LOG} REFUSED ${ref.postUrl} — details say @${author}, feed said @${target.handle}`)
        continue
      }

      // Only posts made after the order shipped are about this collaboration.
      if (!post.publishedAt || post.publishedAt < target.trackingSince) {
        outOfWindow++
        console.log(
          `${LOG} SKIP ${ref.postUrl} — published ${post.publishedAt?.toISOString() ?? "unknown"}, ` +
            `before tracking started ${target.trackingSince.toISOString()}`
        )
        continue
      }
      result.found++

      let detectedId: string
      try {
        // withUtf8mb4: captions routinely carry emoji, which this host's
        // utf8mb3 connections reject (see lib/prisma.ts).
        const created = await withUtf8mb4((tx) =>
          tx.detectedPost.create({
            data: {
              brand_influencer_id: target.brandInfluencerId,
              brand_id: brandId,
              platform: "instagram",
              post_url: ref.postUrl,
              matched_hashtag: null,
              matched_mention: brandHandle,
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
              source: "tagged",
              media_type: media.type,
            },
            select: { id: true },
          })
        )
        detectedId = created.id
      } catch (err) {
        if ((err as { code?: string })?.code === "P2002") continue // a concurrent pass got it first
        throw err
      }
      result.imported++
      await consumePostQuota(brandId, 1)

      const archived = await archivePostMedia({
        brandId,
        handle: target.handle,
        shortcode: ref.shortcode,
        media,
      })
      if (archived?.stored.length) {
        await prisma.detectedPost.update({ where: { id: detectedId }, data: { media: archived.stored } })
      }
      if (archived?.failed) {
        result.errors.push(`${ref.postUrl} — ${archived.failed} media item(s) could not be archived`)
      }

      console.log(`${LOG} IMPORTED ${ref.postUrl} for @${target.handle} (${media.type})`)
    }

    // ── Write to the cards, oldest post first ───────────────────────────────
    // Also backfills posts detected earlier that never reached the card (e.g.
    // while it had no free deliverable slot). Slot order = publish order.
    for (const target of targets) {
      await syncDetectedPostsToCard(target.brandInfluencerId, brandId, target.trackingSince)
    }

    console.log(
      `${LOG} brand ${brandId}: ${feed.data.length} new tagged post(s), ${unmatched} by non-tracked accounts, ` +
        `${outOfWindow} before shipping, ${result.imported} imported, ${result.apiCalls} api call(s)`
    )
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Unknown tagged-posts error")
    console.error(`${LOG} brand ${brandId} failed: ${result.errors[result.errors.length - 1]}`)
  }

  const error = result.errors.length ? result.errors.join("; ").slice(0, 1000) : null
  await prisma.monitoringRun
    .update({
      where: { id: run.id },
      data: {
        status: error ? (result.imported > 0 ? "partial" : "failed") : "success",
        api_calls: result.apiCalls,
        posts_found: result.found,
        posts_imported: result.imported,
        error,
        finished_at: new Date(),
      },
    })
    .catch(() => {})
  await prisma.postTrackerAddon
    .update({
      where: { brand_id: brandId },
      data: { tagged_last_synced_at: new Date(), tagged_last_error: error },
    })
    .catch(() => {})

  return result
}

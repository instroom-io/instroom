import "server-only"

// ─── TikTok keyword detection ────────────────────────────────────────────────
// TikTok has no "posts that tag this account" feed, so the n8n TikTok flow
// searches for the BRAND'S KEYWORD instead (e.g. "lotgenootje") and keeps the
// videos whose author is one of the brand's influencers. This runs that flow in
// two phases, sharing one import step:
//
//   1. Keyword search — ONE request per brand: /tt/keyword/full-search for the
//      keyword, last 7 days, newest first, exact match. Results already carry
//      author, publish time, views/likes/comments and video URLs. Authors are
//      matched to the brand's TikTok influencers; strangers cost nothing more.
//   2. Own-feed check — for each tracked TikTok influencer, their own recent
//      videos (/tt/user/posts), keeping those whose caption names the keyword
//      (#lotgenootje, @lotgenootje, or the word itself). Needed because the
//      keyword index lags: a video posted 21 Oct was in the account feed but not
//      yet searchable a day later. +1 request per tracked influencer.
//
// Tracked = card is Delivered, or Posted and not yet Completed. A video counts
// only if published after the order shipped (detectionWindowStart). Each
// imported video is recorded (DetectedPost), archived to Cloudinary and written
// to the card by syncDetectedPostsToCard — Delivered → Posted, or the next
// empty deliverable, or a new one when every slot is taken (the n8n
// "Post Link1…5 / Date Posted1…5" slots).
//
// Called once per brand from runMonitoringPass, which holds the MonitoringLock
// and has already checked the add-on and quota.

import { prisma, withUtf8mb4 } from "@/lib/prisma"
import {
  searchTikTokByKeyword,
  fetchTikTokUserVideos,
  normaliseHandle,
  type TikTokVideo,
} from "@/lib/ensembledata"
import type { AddonStatus } from "./addon"
import { consumeApiQuota, consumePostQuota, getQuota, remainingApiRequests, remainingPostImports } from "./quota"
import { archiveTikTokVideo } from "./media"
import { syncDetectedPostsToCard } from "./apply"

const LOG = "[post-detection:tiktok]"

/** Days of keyword results read per pass. Same cost as 1 day. */
const KEYWORD_SEARCH_DAYS = 7

export type KeywordTarget = {
  brandInfluencerId: string
  /** Normalised TikTok handle (unique_id) of the influencer. */
  handle: string
  /** Posts published before this don't count (detectionWindowStart). */
  trackingSince: Date
}

export type KeywordPassResult = {
  apiCalls: number
  found: number
  imported: number
  errors: string[]
}

/** "@Lotgenootje" / "#lotgenootje" / "Lotgenootje" → "lotgenootje". */
export function normaliseKeyword(keyword: string): string {
  return keyword.trim().replace(/^[#@]+/, "").toLowerCase()
}

/** Does this video's caption name the brand keyword (as text, #tag or @mention)? */
function mentionsKeyword(video: TikTokVideo, keyword: string): boolean {
  const caption = (video.post.caption ?? "").toLowerCase()
  return (
    caption.includes(keyword) ||
    video.post.hashtags.some((h) => h.toLowerCase() === keyword) ||
    video.post.mentions.some((m) => m.toLowerCase() === keyword)
  )
}

export async function runTikTokKeywordPass(
  brandId: string,
  addon: AddonStatus,
  targets: KeywordTarget[]
): Promise<KeywordPassResult> {
  const result: KeywordPassResult = { apiCalls: 0, found: 0, imported: 0, errors: [] }
  const keyword = normaliseKeyword(addon.tiktokKeyword)
  const byHandle = new Map(targets.map((t) => [t.handle, t]))

  const run = await prisma.monitoringRun.create({
    data: { brand_id: brandId, brand_influencer_id: null, status: "running" },
  })

  /** Reserve one provider request; false = daily quota is spent. */
  const reserve = async () =>
    remainingApiRequests(await getQuota(brandId)) > 0 && Boolean(await consumeApiQuota(brandId, 1))
  /** Charge retries beyond the reserved request. */
  const charge = async (used: number) => {
    result.apiCalls += used
    if (used > 1) await consumeApiQuota(brandId, used - 1)
  }

  /** Record one matched video. Returns false when the run must stop (quota). */
  const importVideo = async (target: KeywordTarget, video: TikTokVideo, source: string): Promise<boolean> => {
    const { post } = video
    const exists = await prisma.detectedPost.findFirst({
      where: { brand_influencer_id: target.brandInfluencerId, post_url: post.postUrl },
      select: { id: true },
    })
    if (exists) return true

    if (!post.publishedAt || post.publishedAt < target.trackingSince) {
      console.log(
        `${LOG} SKIP ${post.postUrl} — published ${post.publishedAt?.toISOString() ?? "unknown"}, ` +
          `before tracking started ${target.trackingSince.toISOString()}`
      )
      return true
    }
    result.found++

    if (remainingPostImports(await getQuota(brandId)) <= 0) {
      result.errors.push("Daily post import limit reached")
      return false
    }

    let detectedId: string
    try {
      // withUtf8mb4: TikTok captions are full of emoji (see lib/prisma.ts).
      const created = await withUtf8mb4((tx) =>
        tx.detectedPost.create({
          data: {
            brand_influencer_id: target.brandInfluencerId,
            brand_id: brandId,
            platform: "tiktok",
            post_url: post.postUrl,
            matched_hashtag: null,
            matched_mention: keyword,
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
            source,
            media_type: "video",
          },
          select: { id: true },
        })
      )
      detectedId = created.id
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") return true // a concurrent pass got it first
      throw err
    }
    result.imported++
    await consumePostQuota(brandId, 1)

    const archived = await archiveTikTokVideo({
      brandId,
      handle: target.handle,
      videoId: post.externalId ?? detectedId,
      urls: video.videoUrls,
    })
    if (archived?.stored.length) {
      await prisma.detectedPost.update({ where: { id: detectedId }, data: { media: archived.stored } })
    }
    if (archived?.failed) result.errors.push(`${post.postUrl} — video could not be archived`)

    console.log(`${LOG} IMPORTED (${source}) ${post.postUrl} for @${target.handle} (region ${video.region ?? "?"})`)
    return true
  }

  try {
    console.log(
      `${LOG} brand ${brandId}: keyword "${keyword}" — ${targets.length} influencer(s) ` +
        `[${targets.map((t) => `@${t.handle}`).join(", ")}]`
    )

    // ── Phase 1: keyword search (one request for the whole brand) ───────────
    let stop = false
    if (!(await reserve())) throw new Error("Daily API quota reached")
    const search = await searchTikTokByKeyword(keyword, { periodDays: KEYWORD_SEARCH_DAYS })
    await charge(search.apiCalls)
    if (!search.ok) {
      // Not fatal: the own-feed check below still runs.
      result.errors.push(`TikTok keyword search failed: ${search.error}`)
    } else {
      let unmatched = 0
      for (const video of search.data) {
        const target = byHandle.get(normaliseHandle(video.post.author))
        if (!target) {
          unmatched++
          continue
        }
        if (!(await importVideo(target, video, "keyword"))) {
          stop = true
          break
        }
      }
      console.log(`${LOG} keyword search: ${search.data.length} video(s), ${unmatched} by non-tracked accounts`)
    }

    // ── Phase 2: each tracked influencer's own feed (real-time) ─────────────
    for (const target of stop ? [] : targets) {
      if (!(await reserve())) {
        result.errors.push("Daily API quota reached before every influencer's feed was checked")
        break
      }
      const feed = await fetchTikTokUserVideos(target.handle)
      await charge(feed.apiCalls)
      if (!feed.ok) {
        result.errors.push(`@${target.handle} feed — ${feed.error}`)
        continue
      }
      const matching = feed.data.filter(
        (v) => normaliseHandle(v.post.author) === target.handle && mentionsKeyword(v, keyword)
      )
      console.log(`${LOG} @${target.handle} feed: ${feed.data.length} video(s), ${matching.length} mention "${keyword}"`)
      for (const video of matching) {
        if (!(await importVideo(target, video, "keyword-feed"))) {
          stop = true
          break
        }
      }
      if (stop) break
    }

    // ── Write to the cards, oldest post first ───────────────────────────────
    // Also backfills posts detected earlier that never reached the card (e.g.
    // while it had no free deliverable slot). Slot order = publish order.
    for (const target of targets) {
      await syncDetectedPostsToCard(target.brandInfluencerId, brandId, target.trackingSince)
    }

    console.log(`${LOG} brand ${brandId}: ${result.imported} imported, ${result.apiCalls} api call(s)`)
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Unknown TikTok keyword error")
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
      data: { keyword_last_synced_at: new Date(), keyword_last_error: error },
    })
    .catch(() => {})

  return result
}

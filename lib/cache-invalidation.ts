// lib/cache-invalidation.ts
//
// One place that knows which cached entries a pipeline-shaped mutation affects.
//
// Influencer List, Pipeline, Post Tracker, Brand Partners and Analytics are all
// projections of the SAME persisted rows (BrandInfluencer.approval_status,
// contact_status, stage, order_status, content_posted). Approving an influencer
// or moving a stage therefore changes what every one of those pages should show
// — but each reads its own cache entry, so without this the other pages kept
// serving their previous payload until the TTL expired.
//
// Marking those entries stale (data is KEPT, so nothing blanks out) means the
// next visit renders immediately and revalidates in the background, picking up
// the new state without a manual refresh.
//
// This is not a second cache: it is a thin helper over lib/data-cache's own
// invalidateCache, listing only the keys a given mutation can actually change.

"use client"

import { invalidateCache } from "@/lib/data-cache"

/**
 * Every cached view derived from a brand's BrandInfluencer rows.
 *
 * The analytics key is a prefix: that route is cached per filter combination
 * (`/api/analytics?brandId=…&platform=…`), and a stage change affects all of
 * them for this brand.
 */
function derivedBrandKeys(brandId: string): string[] {
  return [
    `/api/brand/${brandId}/influencers`, // Influencer List
    `/api/brand/${brandId}/pipeline`,    // Pipeline board
    `/api/brand/${brandId}/closed`,      // Post Tracker
    `/api/analytics?brandId=${brandId}`, // Analytics (prefix — all filter sets)
    `brand-partners:${brandId}`,         // Brand Partners (partner + campaign view)
  ]
}

/**
 * Call after any write that changes an influencer's approval, contact status,
 * stage, order status or post state.
 *
 * `except` lets a caller skip the entry it has just updated optimistically —
 * the Pipeline board, for instance, already wrote the new card position into
 * its own entry and must not have it marked stale on top of that.
 */
export function invalidateInfluencerDerivedCaches(
  brandId: string | null | undefined,
  except: string[] = []
): void {
  if (!brandId) return
  for (const key of derivedBrandKeys(brandId)) {
    if (except.includes(key)) continue
    invalidateCache(key)
  }
}

/** Cache key for a brand's Pipeline entry — for use with `except`. */
export const pipelineCacheKey = (brandId: string) => `/api/brand/${brandId}/pipeline`
/** Cache key for a brand's Post Tracker entry — for use with `except`. */
export const closedCacheKey = (brandId: string) => `/api/brand/${brandId}/closed`
/** Cache key for a brand's Influencer List entry — for use with `except`. */
export const influencersCacheKey = (brandId: string) => `/api/brand/${brandId}/influencers`

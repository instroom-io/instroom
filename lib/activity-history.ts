// lib/activity-history.ts
//
// One loader for an influencer's History tab, shared by every profile drawer
// (Influencer List, Pipeline, Post Tracker, Brand Partners).
//
// Each drawer used to fetch the history only when its History tab was clicked,
// and again on every click. Now a drawer prefetches it as it opens, the result
// is cached per influencer, and the tab renders the cached copy at once while a
// stale one refreshes in the background.

import { fetchCached, getCachedData } from "@/lib/data-cache"

/** History is re-read after this long, so new activity shows up promptly. */
const HISTORY_TTL_MS = 15_000
/** An unreachable backend fails the tab instead of loading forever. */
const HISTORY_TIMEOUT_MS = 10_000

export const historyKey = (brandId: string, biId: string) => `/api/brand/${brandId}/influencers/${biId}/activity`

export function loadHistory<T>(brandId: string, biId: string): Promise<T[]> {
  return fetchCached<T[]>(
    historyKey(brandId, biId),
    async () => {
      const r = await fetch(historyKey(brandId, biId), { signal: AbortSignal.timeout(HISTORY_TIMEOUT_MS) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return ((await r.json()).logs ?? []) as T[]
    },
    { ttl: HISTORY_TTL_MS }
  )
}

export function getCachedHistory<T>(brandId?: string, biId?: string): T[] | undefined {
  return brandId && biId ? getCachedData<T[]>(historyKey(brandId, biId)) : undefined
}

/** Start loading as a drawer opens, so History is ready when it is clicked. */
export function prefetchHistory(brandId?: string, biId?: string) {
  if (brandId && biId) loadHistory(brandId, biId).catch(() => {})
}

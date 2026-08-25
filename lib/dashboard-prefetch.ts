// lib/dashboard-prefetch.ts
//
// Warms every dashboard module's cache entry as soon as the dashboard mounts,
// so opening a page renders from data that is already there instead of starting
// its first request at that moment.
//
// This is NOT a second cache or a new data layer. Every entry below is written
// through lib/data-cache's own `fetchCached`, under the exact key the owning
// page already reads, holding the exact value that page's own fetcher would
// have produced — the shaping functions are imported from the hooks rather than
// re-implemented here, which is what keeps the prefetched value and the
// hook-produced value from drifting apart.
//
// Two properties of `fetchCached` are what make this work without touching the
// pages themselves:
//
//   * in-flight dedupe — a page that mounts WHILE its prefetch is still running
//     joins that same promise instead of issuing a second request;
//   * TTL — `useCachedFetch` skips its mount fetch entirely when the entry is
//     present and not stale (`if (!force && cache.has(key) && !isStale(...))`).
//
// So no page needed a "was this prefetched?" flag: the cache already answers it.

"use client"

import {
  fetchCached,
  hasCachedData,
  isStale,
  isFetching,
  inFlightCount,
  DEFAULT_TTL,
} from "@/lib/data-cache"
import { fetchInfluencerPayload } from "@/hooks/useInfluencerData"
import { fetchPipelineRows } from "@/hooks/usePipelineData"
import { fetchClosedRows } from "@/hooks/useClosedData"
import { pipelineCacheKey } from "@/lib/cache-invalidation"

/**
 * The Analytics key for a brand with no filters applied — the entry the page
 * reads on first open. Other filter combinations are their own entries and are
 * fetched when the user actually picks them; prefetching every combination
 * would be a request per permutation.
 *
 * Kept in the same shape the page builds (app/dashboard/analytics/page.tsx),
 * including key order, since the query string IS the cache key.
 */
function defaultAnalyticsKey(brandId: string): string {
  const query = new URLSearchParams({
    brandId,
    platform: "all",
    niche: "all",
    location: "all",
    dateRange: "all",
  }).toString()
  return `/api/analytics?${query}`
}

// ── Pacing ───────────────────────────────────────────────────────────────────
// Background work only, so every value here is chosen to keep it out of the
// user's way rather than to finish quickly. Nothing waits on this queue.

/** Longest wait for an idle moment before a task runs anyway. */
const IDLE_TIMEOUT_MS = 2_000
/** How often to re-check whether the app has gone quiet. */
const QUIET_POLL_MS = 250
/** Give up waiting for quiet after this, so a busy app cannot starve the queue. */
const QUIET_WAIT_CAP_MS = 10_000

/** A prefetch entry: the cache key, and how to produce the value it holds. */
type PrefetchTask = { key: string; run: () => Promise<unknown> }

/**
 * A prefetch must never overwrite work already in progress or a fresh entry.
 *
 * `fetchCached` handles the in-flight case on its own, and skipping a fresh
 * entry here means a prefetch triggered by a re-render (or a brand switch back
 * to a brand already loaded) costs nothing. A STALE entry is refreshed — that
 * is the same stale-while-revalidate behaviour the pages already have.
 */
function shouldFetch(key: string): boolean {
  return !hasCachedData(key) || isStale(key, DEFAULT_TTL)
}

/**
 * Queue every dashboard module's initial fetch, to be run one at a time.
 *
 * Returns immediately — nothing waits on this. Each task settles independently:
 * a module whose request is slow or fails does not fail the others, and a
 * failure here is not surfaced to the user, since the owning page still owns its
 * own loading and error state and fetches for itself when opened.
 *
 * See `runProgressively` for why these are no longer started together.
 *
 * Safe to call repeatedly; see `shouldFetch`.
 */
export function prefetchDashboard(brandId: string | null | undefined): () => void {
  if (!brandId) return () => {}

  // ── Order matters ─────────────────────────────────────────────────────────
  // One at a time, so this list IS the priority order.
  //
  // The three small shared entries go first: they are cheap, and Pipeline, Post
  // Tracker and Inbox are all GATED on the subscription answer, so warming it
  // early is what removes their skeleton. Then the pages themselves, in the
  // order they are actually reached from the influencer flow. Analytics is last
  // — it is the heaviest query in the app (rows plus three groupBys) and the
  // least likely next click, so it should never delay anything ahead of it.
  const tasks: PrefetchTask[] = [
    // Subscription status — what gates Pipeline, Post Tracker and Inbox. Warmed
    // so a gated page resolves on mount instead of showing its skeleton first.
    {
      key: `/api/subscription/status?brandId=${brandId}`,
      run: async () => {
        const res = await fetch(`/api/subscription/status?brandId=${brandId}`)
        if (!res.ok) throw new Error(`Failed to check subscription (${res.status})`)
        return await res.json()
      },
    },
    // Brand capabilities — one shared entry, read by several pages at once to
    // decide whether approval controls are enabled.
    {
      key: "/api/brands/me",
      run: async () => {
        const res = await fetch("/api/brands/me")
        if (!res.ok) throw new Error(`Failed to fetch brands (${res.status})`)
        return await res.json()
      },
    },
    // Niches and locations — needed by the modals on several pages.
    {
      key: `/api/brand/${brandId}/taxonomy`,
      run: async () => {
        const [nichesData, locationsData] = await Promise.all([
          fetch(`/api/brand/${brandId}/niches`).then((r) => r.json()),
          fetch(`/api/brand/${brandId}/locations`).then((r) => r.json()),
        ])
        return {
          niches: nichesData.niches ?? [],
          locations: locationsData.locations ?? [],
        }
      },
    },
    // Influencer List
    {
      key: `/api/brand/${brandId}/influencers`,
      run: () => fetchInfluencerPayload(brandId),
    },
    // Pipeline board
    {
      key: pipelineCacheKey(brandId),
      run: () => fetchPipelineRows(brandId),
    },
    // Post Tracker
    {
      key: `/api/brand/${brandId}/closed`,
      run: () => fetchClosedRows(brandId),
    },
    // Analytics, unfiltered. No mapping to keep in step — the page stores the
    // response's `data` array as-is.
    {
      key: defaultAnalyticsKey(brandId),
      run: async () => {
        const res = await fetch(defaultAnalyticsKey(brandId))
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        const json = await res.json()
        return json.data ?? []
      },
    },
  ]

  // NOT prefetched, deliberately:
  //   * Gmail / Outlook threads — every call goes out to Google or Microsoft,
  //     counts against that provider's quota, and is the slowest request in the
  //     app. Prefetching it would spend the user's provider budget on a page
  //     they may never open, and it fails outright when no mailbox is connected.
  //   * Brand Partners — its page loads through local state rather than
  //     `useCachedFetch` (see the note in dashboard-prefetch's caller), so a
  //     warmed entry would not stop its own request. Handled at the page.
  //   * Billing / settings — opened rarely, and not part of the influencer flow.

  return runProgressively(tasks)
}

/** Idle callback, where the browser has one. Safari and older browsers do not. */
type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

/**
 * Resolve once the browser is idle — or after `timeoutMs`, whichever is first.
 *
 * requestIdleCallback is the browser's own answer to "is there spare time right
 * now", so it is what decides when speculative work may run. Where it does not
 * exist the timeout alone applies, which is the same behaviour one step later.
 */
function whenIdle(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const w = window as IdleWindow
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(() => resolve(), { timeout: timeoutMs })
      return
    }
    setTimeout(resolve, timeoutMs)
  })
}

/**
 * Wait until nothing else is fetching, so the prefetch never competes.
 *
 * `inFlightCount()` counts every request going through the shared cache, which
 * in practice is the page the user is looking at. While that is non-zero this
 * yields; the cap stops a permanently busy app from starving the prefetch
 * forever.
 */
async function whenQuiet(): Promise<void> {
  for (let waited = 0; waited < QUIET_WAIT_CAP_MS; waited += QUIET_POLL_MS) {
    if (inFlightCount() === 0) return
    await new Promise((resolve) => setTimeout(resolve, QUIET_POLL_MS))
  }
}

/**
 * Run the prefetch progressively: idle-triggered, one request at a time, and
 * yielding to anything the user actually asked for.
 *
 * WHY THIS SHAPE. These seven used to start together. DATABASE_URL caps Prisma
 * at `connection_limit=3` with `pool_timeout=10` — a deliberate setting for this
 * shared host (see lib/prisma.ts) — so seven concurrent route handlers, each
 * running one to four queries, queued against three connections. Measured
 * against the real database, the heaviest of them (Analytics: rows plus three
 * groupBys) finished at 7.5s with one dashboard tab open and 9.4s with two.
 * With three tabs the queue crossed the 10s pool timeout and Prisma threw
 *
 *   P2024  Timed out fetching a new connection from the connection pool
 *          (Current connection pool timeout: 10, connection limit: 3)
 *
 * which the Analytics route reported as HTTP 500 and the page rendered as
 * "Error loading data". The requests were fine; this prefetch was starving them
 * of connections.
 *
 * So: one at a time, started only when the browser is idle, and re-checked
 * before every single task — because by then the page may have cached the entry
 * itself, may be fetching it right now, or the user may have navigated away.
 *
 * Returns a cancel function. Calling it stops the queue at the next task
 * boundary; a request already in flight is left to finish and populate the
 * cache, since cancelling it would waste the connection it already holds.
 */
function runProgressively(tasks: PrefetchTask[]): () => void {
  let cancelled = false

  void (async () => {
    for (const task of tasks) {
      if (cancelled) return

      // Idle first: the opened page's own request is issued during mount, so
      // this cannot reach the pool before it.
      await whenIdle(IDLE_TIMEOUT_MS)
      if (cancelled) return

      // Then quiet: yield while any real request is still running.
      await whenQuiet()
      if (cancelled) return

      // Re-checked per task, not once up front. Between queueing and now the
      // entry may have been filled by an earlier task or by the page itself.
      if (!shouldFetch(task.key)) continue
      // Already being fetched — by the page that owns it, most likely. Skip
      // rather than attach: attaching would hold a slot in this queue waiting
      // on work that is already happening.
      if (isFetching(task.key)) continue

      // Awaited, so the next task does not start until this connection is back.
      // The rejection is dropped here and nowhere else: this is speculative
      // work with no one waiting on it, and the page that owns the entry still
      // performs its own request and reports its own error when opened. No
      // database error is hidden from the user by this line.
      await fetchCached(task.key, task.run).catch(() => {})
    }
  })()

  return () => { cancelled = true }
}

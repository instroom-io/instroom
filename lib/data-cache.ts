// lib/data-cache.ts
// App-wide stale-while-revalidate cache for client data fetching.
//
// Every page hook used to own its data in component state, so navigating away
// unmounted the state and navigating back re-ran the fetch from scratch behind a
// full-page loading skeleton — even when the data had not changed. Two
// components asking for the same endpoint also fired two requests.
//
// This module keeps fetched data in a module-level store (it survives unmounts
// and route changes), de-duplicates in-flight requests by key, and revalidates
// in the background once an entry is older than its TTL. The rules are:
//
//   • cached data is rendered immediately — no loading state on return visits
//   • `isLoading` is true ONLY when there is nothing cached yet
//   • a stale entry refreshes in the background (`isValidating`) while the
//     existing data stays on screen
//   • mutations call `invalidateCache(...)` so the next read refetches
//
// Deliberately tiny and dependency-free: it mirrors the fetch-in-a-hook pattern
// the app already uses rather than introducing a data-layer library.

"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type CacheEntry = {
  data: unknown
  /** Epoch ms of the last successful fetch. 0 marks an explicitly invalidated entry. */
  updatedAt: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()
const subscribers = new Map<string, Set<() => void>>()

/** How long a cached entry is considered fresh before a background refresh. */
export const DEFAULT_TTL = 30_000

function notify(key: string) {
  subscribers.get(key)?.forEach((cb) => cb())
}

export function subscribe(key: string, cb: () => void): () => void {
  let set = subscribers.get(key)
  if (!set) {
    set = new Set()
    subscribers.set(key, set)
  }
  set.add(cb)
  return () => {
    set!.delete(cb)
    if (set!.size === 0) subscribers.delete(key)
  }
}

export function getCachedData<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined
}

export function hasCachedData(key: string): boolean {
  return cache.has(key)
}

export function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, updatedAt: Date.now() })
  notify(key)
}

export function isStale(key: string, ttl: number = DEFAULT_TTL): boolean {
  const entry = cache.get(key)
  if (!entry) return true
  return Date.now() - entry.updatedAt > ttl
}

/**
 * Mark cached data as stale so the next read refreshes it. Data is KEPT, so the
 * UI never blanks out — it is refreshed in the background instead.
 *
 * `keyOrPrefix` matches by prefix, so `invalidateCache("/api/brand/abc")`
 * covers every endpoint scoped to that brand.
 */
export function invalidateCache(keyOrPrefix: string): void {
  for (const [key, entry] of cache) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      cache.set(key, { ...entry, updatedAt: 0 })
      notify(key)
    }
  }
}

/** Drop cached data entirely (e.g. on sign-out). */
export function clearCache(): void {
  cache.clear()
  inflight.clear()
  subscribers.forEach((_, key) => notify(key))
}

/**
 * Run `fetcher` for `key`, sharing a single request between every concurrent
 * caller. Returns cached data untouched when it is still fresh.
 */
export async function fetchCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { ttl?: number; force?: boolean } = {}
): Promise<T> {
  const { ttl = DEFAULT_TTL, force = false } = opts

  if (!force && cache.has(key) && !isStale(key, ttl)) {
    return cache.get(key)!.data as T
  }

  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const request = fetcher()
    .then((data) => {
      setCachedData(key, data)
      return data
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, request)
  return request as Promise<T>
}

export type CachedFetchResult<T> = {
  data: T | undefined
  error: string | null
  /** True only when there is no cached data to show yet. */
  isLoading: boolean
  /** True while a background refresh is running over existing data. */
  isValidating: boolean
  refetch: () => Promise<T | undefined>
  /** Write data straight into the cache (optimistic updates). */
  mutate: (data: T) => void
}

/**
 * Stale-while-revalidate data hook.
 *
 * Pass `key: null` to skip fetching (e.g. before a session or brandId exists) —
 * the same guard the hooks already used.
 */
export function useCachedFetch<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts: { ttl?: number; enabled?: boolean; revalidateOnFocus?: boolean } = {}
): CachedFetchResult<T> {
  const { ttl = DEFAULT_TTL, enabled = true, revalidateOnFocus = true } = opts

  const active = Boolean(key) && enabled
  const [, forceRender] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  // The fetcher is usually an inline closure; keeping it in a ref means a new
  // identity on every render cannot retrigger the effect (one of the sources of
  // the duplicate requests this replaces).
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const data = key ? getCachedData<T>(key) : undefined

  // Re-render this component when the shared entry changes, so every consumer
  // of the same key stays in sync without its own request.
  useEffect(() => {
    if (!key) return
    return subscribe(key, () => forceRender((n) => n + 1))
  }, [key])

  const run = useCallback(
    async (force: boolean) => {
      if (!key || !enabled) return undefined
      if (!force && cache.has(key) && !isStale(key, ttl)) return getCachedData<T>(key)

      setIsValidating(true)
      try {
        const result = await fetchCached<T>(key, () => fetcherRef.current(), { ttl, force })
        setError(null)
        return result
      } catch (err) {
        console.error(`[data-cache] fetch failed for ${key}:`, err)
        setError(err instanceof Error ? err.message : "Unknown error")
        return undefined
      } finally {
        setIsValidating(false)
      }
    },
    [key, enabled, ttl]
  )

  // Mount / key change: fetch when nothing is cached, revalidate in the
  // background when the cached entry is stale, do nothing when it is fresh.
  useEffect(() => {
    if (!active) return
    void run(false)
  }, [active, run])

  // Pick up changes made in another tab or another part of the app.
  useEffect(() => {
    if (!active || !revalidateOnFocus) return
    const onFocus = () => {
      if (key && isStale(key, ttl)) void run(false)
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [active, revalidateOnFocus, key, ttl, run])

  const refetch = useCallback(() => run(true), [run])

  const mutate = useCallback(
    (next: T) => {
      if (key) setCachedData(key, next)
    },
    [key]
  )

  return {
    data,
    error,
    isLoading: active && data === undefined,
    isValidating,
    refetch,
    mutate,
  }
}

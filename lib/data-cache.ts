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

/**
 * Per-key write generation.
 *
 * A background revalidation that was already in flight when a mutation ran
 * carries PRE-mutation data. Left alone it resolves afterwards and overwrites
 * the newer persisted state, so the change appears to snap back until the next
 * fetch. Callers bracket a mutation with `markCacheWrite(key)` (once when it
 * starts, once when it settles); `fetchCached` records the generation it started
 * on and refuses to cache a payload whose generation has moved on.
 *
 * It is a counter, not a lock: there is nothing to release, so a failed or
 * abandoned mutation can never leave an entry permanently blocked, and keys are
 * independent of each other.
 */
const writeGenerations = new Map<string, number>()

/**
 * Mark that `key`'s underlying data is being written. Call once before the
 * mutation and once after it settles (success OR failure), so any request whose
 * lifetime overlaps the mutation window is discarded rather than cached.
 */
/**
 * Keys with a write currently in flight.
 *
 * The generation counter already discards a response whose key was written
 * WHILE the request was out. It cannot discard one whose request both started
 * and finished inside the write window — and that is the window a cross-module
 * seed lives in: the Post Tracker entry is written the moment Pipeline's Deal
 * Agreed PATCH goes out, and that PATCH takes ~1.3s while a closed GET takes
 * ~400ms. A fetch landing in that gap wrote server state that does not yet
 * include the seeded row, and the card vanished.
 *
 * This is the same discard path, keyed the same way, with one more reason to
 * take it: a write is pending for this key, so any response is by definition
 * describing state older than what is about to be persisted.
 */
const pendingWrites = new Map<string, number>()

/**
 * The `updatedAt` a key carried when its first pending write opened.
 *
 * A mutation writes to the cache optimistically, and `setCachedData` stamps a
 * fresh `updatedAt` — so a mutation that then FAILED and rolled back would still
 * have moved the timestamp, and anything reporting freshness would say the data
 * had just been refreshed when it had not. Keeping the pre-write value lets a
 * failed write put it back.
 */
const preWriteUpdatedAt = new Map<string, number>()

/** Open a write window for a key. Pair with `endKeyWrite`. */
export function beginKeyWrite(key: string): void {
  const depth = (pendingWrites.get(key) ?? 0) + 1
  pendingWrites.set(key, depth)
  // Only the outermost write records it; nested writes must not overwrite the
  // value the first one saved.
  if (depth === 1) {
    const entry = cache.get(key)
    preWriteUpdatedAt.set(key, entry?.updatedAt ?? 0)
  }
  // Subscribers re-render on this, which is what lets a freshness indicator flip
  // to "Syncing…" the moment a save starts rather than only when the cache is
  // next written.
  notify(key)
}

/**
 * Close a write window.
 *
 * `succeeded` defaults to true, so existing callers keep their behaviour. Pass
 * false for a write that failed: the key's `updatedAt` is restored to what it
 * was before the write, so the rollback's own setCachedData does not read as a
 * successful refresh.
 */
export function endKeyWrite(key: string, succeeded = true): void {
  const next = (pendingWrites.get(key) ?? 0) - 1
  if (next > 0) {
    pendingWrites.set(key, next)
    return
  }
  pendingWrites.delete(key)

  const previous = preWriteUpdatedAt.get(key)
  preWriteUpdatedAt.delete(key)
  if (!succeeded && previous !== undefined) {
    const entry = cache.get(key)
    // The data itself is whatever the rollback left; only the freshness stamp
    // is reverted.
    if (entry) cache.set(key, { ...entry, updatedAt: previous })
  }
  notify(key)
}

/** Is a write in flight for this key right now? */
export function hasPendingWrite(key: string): boolean {
  return (pendingWrites.get(key) ?? 0) > 0
}

/**
 * Per-ROW write sequence, within a key.
 *
 * The generation counter and the pending-write map above protect a cache entry
 * from a stale FETCH. Neither protects a row from a stale ROLLBACK, which is a
 * different race and the one that made a stage change appear to revert:
 *
 *   1. a card is moved      → optimistic value B written, request A sent
 *   2. it is moved again    → optimistic value C written, request B sent
 *   3. request A fails      → its rollback restores the snapshot it took,
 *                             which is the value from BEFORE step 1
 *
 * The user's newest, still-valid change is replaced by the oldest value on the
 * board. Every optimistic writer in the app has this shape, so the counter
 * lives here rather than in one of them: a writer takes a sequence number when
 * it starts, and only rolls back if it is still the newest write for that row.
 *
 * A plain counter, like `writeGenerations`: nothing is held, so an abandoned
 * request cannot block a row, and rows are independent of each other.
 */
const rowWriteSequences = new Map<string, number>()

/**
 * Row id first, then "@", then the cache key. A row id is a cuid and never
 * contains "@", so the first one is always the separator and two different
 * (key, row) pairs cannot produce the same string.
 */
function rowSequenceKey(key: string, rowId: string): string {
  return `${rowId}@${key}`
}

/** Take the next write sequence for a row. Pair with `isLatestRowWrite`. */
export function beginRowWrite(key: string, rowId: string): number {
  const seqKey = rowSequenceKey(key, rowId)
  const next = (rowWriteSequences.get(seqKey) ?? 0) + 1
  rowWriteSequences.set(seqKey, next)
  return next
}

/**
 * Is `seq` still the newest write for this row?
 *
 * False means a later change to the same row has already been applied, so this
 * writer's snapshot is out of date and restoring it would undo that change.
 */
export function isLatestRowWrite(key: string, rowId: string, seq: number): boolean {
  return rowWriteSequences.get(rowSequenceKey(key, rowId)) === seq
}

export function markCacheWrite(key: string): void {
  writeGenerations.set(key, (writeGenerations.get(key) ?? 0) + 1)
}

function writeGeneration(key: string): number {
  return writeGenerations.get(key) ?? 0
}

/* ── Reload persistence ────────────────────────────────────────────────────
   The cache above is a module-level Map, so it dies with the page: a refresh
   (F5) meant every screen went back to a skeleton and re-read the database even
   though the payload it was about to receive was the one just discarded.

   Entries are mirrored into `sessionStorage`, which is the conservative choice
   here: it survives a reload but is dropped when the tab closes, so a brand's
   data never outlives the session on a shared machine — and it is per-tab, so
   two tabs signed into different accounts cannot read each other's payloads.

   Restored payloads never enter the live cache directly. Several components
   read `getCachedData` / `hasCachedData` DURING RENDER to seed their initial
   state (BrandPartnersPage, DiscordClient, the inbox, billing) — if such a read
   can return a restored payload while React is hydrating, the server's skeleton
   and the client's populated markup disagree and the tree is thrown away with a
   hydration error.

   So the mirror is read into a staging map that only `useCachedFetch`'s mount
   effect consults. Promotion into the live cache happens there, in an effect,
   which is a normal client update React never diffs against the server HTML.
   Anything reading the cache during render therefore behaves exactly as it did
   before persistence existed.
   ------------------------------------------------------------------------ */

const STORAGE_PREFIX = "instroom:cache:"

/**
 * Payloads read back from the mirror, waiting to be promoted. Deliberately not
 * the live `cache`: nothing that renders may observe these until a mount effect
 * moves them across.
 */
const restored = new Map<string, unknown>()

/** Payloads larger than this are not mirrored — quota is shared and small. */
const MAX_PERSISTED_BYTES = 512_000

function storage(): Storage | null {
  // Private mode, disabled site data and SSR all land here.
  try {
    if (typeof window === "undefined") return null
    return window.sessionStorage
  } catch {
    return null
  }
}

function persist(key: string, entry: CacheEntry): void {
  const store = storage()
  if (!store) return
  try {
    const serialised = JSON.stringify({ data: entry.data, updatedAt: entry.updatedAt })
    if (serialised.length > MAX_PERSISTED_BYTES) {
      store.removeItem(STORAGE_PREFIX + key)
      return
    }
    store.setItem(STORAGE_PREFIX + key, serialised)
  } catch {
    // Out of quota or unserialisable — the in-memory cache is unaffected, this
    // key simply won't survive the next reload.
  }
}

function clearPersisted(): void {
  const store = storage()
  if (!store) return
  try {
    const keys: string[] = []
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i)
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => store.removeItem(k))
  } catch { /* nothing to do */ }
}

/**
 * Move one restored payload into the live cache. Called only from an effect.
 *
 * Stamped `updatedAt: 0` — the same marker `invalidateCache` uses — so the
 * payload paints immediately and the very next read still treats it as stale
 * and revalidates in the background. A payload is never trusted as fresh just
 * because it was written shortly before the reload.
 *
 * Returns true when something was promoted, so the caller knows a re-render is
 * warranted.
 */
function promoteRestored(key: string): boolean {
  if (!restored.has(key) || cache.has(key)) {
    restored.delete(key)
    return false
  }
  const data = restored.get(key)
  restored.delete(key)
  cache.set(key, { data, updatedAt: 0 })
  notify(key)
  return true
}

let hydrated = false

/**
 * Read the mirror into the staging map. Runs once per page load, from
 * `useCachedFetch`'s mount effect. Emits no notifications and touches no live
 * entry, so calling it cannot change what any component is currently rendering.
 */
export function hydrateCacheFromStorage(): void {
  if (hydrated) return
  hydrated = true

  const store = storage()
  if (!store) return

  try {
    for (let i = 0; i < store.length; i += 1) {
      const storageKey = store.key(i)
      if (!storageKey || !storageKey.startsWith(STORAGE_PREFIX)) continue

      const key = storageKey.slice(STORAGE_PREFIX.length)
      // Anything already in memory is newer than the mirror by definition.
      if (cache.has(key)) continue

      const raw = store.getItem(storageKey)
      if (!raw) continue

      try {
        const parsed = JSON.parse(raw) as { data: unknown }
        if (!parsed || !("data" in parsed)) continue
        restored.set(key, parsed.data)
      } catch {
        // Corrupt entry — discard it rather than carrying it forward.
        store.removeItem(storageKey)
      }
    }
  } catch { /* storage became unavailable mid-loop; keep the memory cache */ }
}

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

/**
 * When this key was last written by a SUCCESSFUL fetch, in ms since epoch.
 *
 * `null` when nothing is cached, and null when the entry carries the stale
 * marker (`updatedAt: 0`, set by invalidateCache and by promoteRestored). That
 * marker is deliberately not a timestamp — treating it as one would report a
 * refresh in 1970 — so callers that want to show freshness get "unknown"
 * instead, which is the truth: the entry is there but its age is not vouched
 * for.
 */
export function getCacheUpdatedAt(key: string): number | null {
  const entry = cache.get(key)
  if (!entry || entry.updatedAt === 0) return null
  return entry.updatedAt
}

export function hasCachedData(key: string): boolean {
  return cache.has(key)
}

export function setCachedData<T>(key: string, data: T): void {
  const entry: CacheEntry = { data, updatedAt: Date.now() }
  cache.set(key, entry)
  // Mirrored so the next page load can render this without a request.
  persist(key, entry)
  notify(key)
}

/**
 * Is a fetch for this key already running?
 *
 * `fetchCached` dedupes on its own, so callers never NEED this to stay correct.
 * It exists for the background prefetch, which wants to skip a key rather than
 * attach to someone else's request and hold a slot in its own queue.
 */
export function isFetching(key: string): boolean {
  return inflight.has(key)
}

/**
 * Requests that do NOT go through this cache but still occupy a pooled database
 * connection — the optimistic save paths, which issue their own PATCH/PUT.
 *
 * Without this, `inFlightCount()` read 0 during a save, so the background
 * prefetch saw an idle app and took a connection while the user was writing.
 * The save hooks already bracket every write with beginWrite/endWrite, so
 * counting there is one line in each.
 */
let externalInFlight = 0

/** Bracket a non-cache request so the prefetch knows the app is busy. */
export function beginExternalRequest(): void {
  externalInFlight += 1
}

export function endExternalRequest(): void {
  externalInFlight = Math.max(0, externalInFlight - 1)
}

/**
 * How many fetches are in flight right now, across every key.
 *
 * Read by the background prefetch as a "is the app busy?" signal: while a page
 * the user actually opened is still loading, the prefetch waits rather than
 * competing with it for one of the three pooled database connections.
 */
export function inFlightCount(): number {
  return inflight.size + externalInFlight
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
      const invalidated = { ...entry, updatedAt: 0 }
      cache.set(key, invalidated)
      persist(key, invalidated)
      notify(key)
    }
  }
}

/** Drop cached data entirely (e.g. on sign-out). */
export function clearCache(): void {
  cache.clear()
  inflight.clear()
  restored.clear()
  // The mirror goes too, or a sign-out would leave the next session able to
  // render the previous account's data before its first fetch returns.
  clearPersisted()
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

  // Generation at request start. If a mutation happens while this is in flight,
  // the response describes state older than what is already cached, so it is
  // returned to the caller but NOT written to the cache.
  const startedAtGeneration = writeGeneration(key)

  const request = fetcher()
    .then((data) => {
      // Two reasons to keep what is cached instead of what just arrived:
      // the key was written while this was out (generation moved), or a write
      // for it is still in flight, so this response predates it either way.
      if (writeGeneration(key) !== startedAtGeneration || hasPendingWrite(key)) {
        const current = cache.get(key)
        return (current ? current.data : data) as T
      }
      setCachedData(key, data)
      return data
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, request)
  return request as Promise<T>
}

/**
 * Promote this key's persisted payload after mount and hand it over once.
 *
 * For components that seed state from the cache DURING RENDER (their
 * `useState` initializers call `getCachedData`). Those reads must keep
 * returning undefined while React hydrates, or the server's skeleton and the
 * client's populated markup disagree — so the payload is delivered here
 * instead, from an effect, which is a normal client update.
 *
 * `onRestore` fires only when a payload actually came out of the mirror, i.e.
 * after a page reload. On a client navigation the entry is already live and the
 * component's own initializer has read it, so nothing is delivered twice. When
 * nothing was persisted, this is inert and the component behaves exactly as it
 * did before persistence existed.
 */
export function useRestoredCache<T>(key: string | null, onRestore: (data: T) => void): void {
  const handler = useRef(onRestore)
  handler.current = onRestore

  useEffect(() => {
    hydrateCacheFromStorage()
    if (!key) return
    if (!promoteRestored(key)) return
    const data = getCachedData<T>(key)
    if (data !== undefined) handler.current(data)
  }, [key])
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

  // Read the mirror, then promote just this key. Both happen in an effect, so
  // the first render still matches the server-rendered HTML — and a key nothing
  // mirrored behaves exactly as it did before persistence: no entry, normal
  // fetch, normal loading state.
  useEffect(() => {
    hydrateCacheFromStorage()
    if (key) promoteRestored(key) // notify() re-renders every consumer of the key
  }, [key])

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

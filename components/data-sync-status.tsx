"use client"

// components/data-sync-status.tsx
//
// The small text-only freshness line that sits in a dashboard toolbar, after the
// record count:
//
//   44 of 44 influencers   Syncing…
//   44 of 44 influencers   Updated just now
//
// No dot, no separator, no colour, no animation — one grey tone, set apart by
// spacing alone. It is a footnote, not a signal to act on.
//
// It reports REAL state, not a timer someone started on mount:
//
//   * "Syncing…"           a read OR a write for this cache key is in flight
//                          right now (lib/data-cache's in-flight map and its
//                          pending-write map)
//   * "Updated just now"   the key was written by a successful fetch < 60s ago
//   * "Updated 2m ago"     …from that same timestamp, counted up
//   * nothing              nothing has been fetched yet, or the entry is marked
//                          stale, in which case its age is genuinely unknown
//                          and inventing one would be worse than saying nothing
//
// One component for every board, so the placement, size and colour cannot drift
// between them.

import { useEffect, useState } from "react"
import { getCacheUpdatedAt, hasPendingWrite, isFetching, subscribe } from "@/lib/data-cache"

/** How often to re-render so "2m ago" becomes "3m ago" on its own. */
const TICK_MS = 30_000

function relative(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000))
  if (seconds < 60) return "Updated just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Updated ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Updated ${hours}h ago`
  return `Updated ${Math.floor(hours / 24)}d ago`
}

export function DataSyncStatus({ cacheKey }: { cacheKey: string | null }) {
  /**
   * `now` doubles as "have we mounted yet".
   *
   * Two reasons it is state rather than a Date.now() call in the render body:
   * reading the clock during render is impure, and the server has no cache while
   * the client does — rendering from either during the first paint is how the
   * hydration mismatches elsewhere in this app happened. Null until mounted, so
   * server and client both render nothing, and this fills in as a normal client
   * update.
   */
  const [now, setNow] = useState<number | null>(null)

  // One effect owns the clock. The first stamp is deferred to a timeout rather
  // than set synchronously here (a synchronous set in an effect cascades a
  // render); at 0ms it still lands in the same frame the user sees.
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0)
    const tick = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => { clearTimeout(first); clearInterval(tick) }
  }, [])

  // Re-stamp whenever this key changes, so a fetch finishing flips "Syncing…"
  // to "Updated just now" immediately instead of at the next tick. setNow is
  // also what re-renders, so no separate counter is needed.
  useEffect(() => {
    if (!cacheKey) return
    return subscribe(cacheKey, () => setNow(Date.now()))
  }, [cacheKey])

  if (now === null || !cacheKey) return null

  // Syncing covers BOTH directions: a read in flight through fetchCached, and a
  // write in flight for this key — an inline edit, a stage change, a drag, a
  // bulk action, an import. Without the second, the indicator only ever
  // reported page loads, and every save happened silently.
  const syncing = isFetching(cacheKey) || hasPendingWrite(cacheKey)
  const updatedAt = getCacheUpdatedAt(cacheKey)

  // Nothing loaded and nothing in flight — say nothing rather than guess.
  if (!syncing && updatedAt === null) return null

  const label = syncing ? "Syncing…" : relative(updatedAt!, now)

  return (
    <span
      className="ml-1.5 whitespace-nowrap text-xs text-gray-400"
      // Announced politely: it changes on its own and must not interrupt.
      aria-live="polite"
      title={
        syncing
          ? "Fetching the latest data"
          : `Last successful refresh: ${new Date(updatedAt!).toLocaleTimeString()}`
      }
    >
      {label}
    </span>
  )
}

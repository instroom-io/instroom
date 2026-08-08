"use client"
// Post Tracker → Automatic Post Detection → "Recently detected posts".
//
// Newest-first, 5 at a time, with background polling that prepends new arrivals
// in place (currently disabled — see POLL_ENABLED). Split out of
// AutoPostDetection.tsx so a poll re-renders this list only — the settings
// inputs above keep their focus and the page keeps its scroll position.

import { useState, useEffect, useCallback, useRef } from "react"
import { IconExternalLink, IconLoader2, IconBrandTiktok, IconBrandInstagram, IconWorld } from "@tabler/icons-react"

export type DetectedPost = {
  id: string
  platform: string
  postUrl: string
  matchedHashtag: string | null
  matchedMention: string | null
  author?: string | null
  detectedAt: string
}

export const PAGE_SIZE = 5
/**
 * Off while there is no scheduled detection job (the Vercel Cron entry was
 * removed — see app/api/cron/post-detection/route.ts). With nothing writing
 * new rows in the background, this interval could only ever fetch an empty
 * result, and a list that quietly refreshes itself implies detection is
 * running when it isn't. Flip back to true alongside the cron.
 *
 * The list still updates after "Check now": the parent reloads and pushes
 * fresh rows down through `initialPosts`.
 */
const POLL_ENABLED: boolean = false
/** Matches the monitoring cadence without hammering the API. */
const POLL_INTERVAL_MS = 45_000
/** A detection is "New" for this long. */
const NEW_WINDOW_MS = 10 * 60 * 1000

/** "Just now", "2 min ago", "3 h ago", then an absolute date past a week. */
function relativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const secs = Math.max(0, Math.round((now - then) / 1000))
  if (secs < 45) return "Just now"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  if (days <= 7) return `${days} d ago`
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const PLATFORM = {
  instagram: { label: "Instagram", Icon: IconBrandInstagram, cls: "bg-[#E1306C]/10 text-[#C13584]" },
  tiktok: { label: "TikTok", Icon: IconBrandTiktok, cls: "bg-gray-900/8 text-gray-800" },
} as const

function PlatformBadge({ platform }: { platform: string }) {
  const meta = PLATFORM[platform.toLowerCase() as keyof typeof PLATFORM]
  const Icon = meta?.Icon ?? IconWorld
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        meta?.cls ?? "bg-gray-100 text-gray-600"
      }`}
    >
      <Icon size={10} />
      {meta?.label ?? platform}
    </span>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-1.5" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className="h-3.5 w-16 animate-pulse rounded-full bg-gray-100" />
              <div className="h-3.5 w-20 animate-pulse rounded-full bg-gray-100" />
            </div>
            <div className="mt-1.5 h-2.5 w-24 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-3 w-10 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

export function DetectedPostsList({
  brandId,
  biId,
  enabled,
  initialPosts,
  initialHasMore,
  loading,
}: {
  brandId: string
  biId: string
  /** Polling only runs while monitoring is on. */
  enabled: boolean
  initialPosts: DetectedPost[]
  initialHasMore: boolean
  loading: boolean
}) {
  const [posts, setPosts] = useState<DetectedPost[]>(initialPosts)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  /** Grows with "Load more" so a poll doesn't trim away pages the user opened. */
  const [visibleCap, setVisibleCap] = useState(PAGE_SIZE)
  // Ticks so relative timestamps age without a data fetch.
  const [now, setNow] = useState(() => Date.now())

  // Keep in sync when the parent reloads (e.g. after "Check now").
  useEffect(() => {
    setPosts(initialPosts)
    setHasMore(initialHasMore)
    setVisibleCap((cap) => Math.max(cap, PAGE_SIZE))
  }, [initialPosts, initialHasMore])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Newest detectedAt drives the incremental poll. Held in a ref so changing it
  // doesn't re-arm the interval — that would reset the timer on every arrival.
  const newestRef = useRef<string | null>(initialPosts[0]?.detectedAt ?? null)
  useEffect(() => {
    if (posts[0]?.detectedAt) newestRef.current = posts[0].detectedAt
  }, [posts])

  const base = `/api/post-tracker/detection/posts?brandId=${encodeURIComponent(brandId)}&biId=${encodeURIComponent(biId)}`

  // Background poll: asks only for rows newer than the newest one held, so the
  // usual response is an empty array and nothing re-renders.
  useEffect(() => {
    if (!enabled || !POLL_ENABLED) return
    let cancelled = false

    const poll = async () => {
      if (document.visibilityState === "hidden") return // don't poll a hidden tab
      try {
        const since = newestRef.current
        const res = await fetch(`${base}&limit=${PAGE_SIZE}${since ? `&since=${encodeURIComponent(since)}` : ""}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        const incoming: DetectedPost[] = data.posts ?? []
        if (incoming.length === 0) return

        setPosts((prev) => {
          // Dedupe by id: a post already held must never appear twice, however
          // the timestamps line up.
          const seen = new Set(prev.map((p) => p.id))
          const fresh = incoming.filter((p) => !seen.has(p.id))
          if (fresh.length === 0) return prev
          setNewIds((ids) => new Set([...ids, ...fresh.map((p) => p.id)]))
          return [...fresh, ...prev].sort(
            (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
          )
        })
      } catch {
        /* transient network failure — the next tick retries */
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [base, enabled])

  const loadMore = useCallback(async () => {
    const oldest = posts[posts.length - 1]?.detectedAt
    if (!oldest) return
    setLoadingMore(true)
    try {
      const res = await fetch(`${base}&limit=${PAGE_SIZE}&before=${encodeURIComponent(oldest)}`)
      const data = await res.json()
      const older: DetectedPost[] = data.posts ?? []
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...older.filter((p) => !seen.has(p.id))]
      })
      setHasMore(Boolean(data.hasMore))
      setVisibleCap((cap) => cap + PAGE_SIZE)
    } catch {
      /* leave the button available to retry */
    } finally {
      setLoadingMore(false)
    }
  }, [base, posts])

  // Trim to the cap: new arrivals push the oldest visible item off the list.
  const visible = posts.slice(0, visibleCap)

  if (loading) return <Skeleton />

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-[11px] text-gray-400">
        No recent posts detected yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((p) => {
        const isNew = newIds.has(p.id) || now - new Date(p.detectedAt).getTime() < NEW_WINDOW_MS
        return (
          <div
            key={p.id}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
              isNew ? "border-[#1FAE5B]/30 bg-[#1FAE5B]/[0.04]" : "border-gray-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <PlatformBadge platform={p.platform} />
                {isNew && (
                  <span className="rounded-full bg-[#1FAE5B] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    New
                  </span>
                )}
                {p.matchedHashtag && (
                  <span className="rounded-full bg-[#0F6B3E]/10 px-1.5 py-0.5 text-[10px] text-[#0F6B3E]">
                    #{p.matchedHashtag.replace(/^#/, "")}
                  </span>
                )}
                {p.matchedMention && (
                  <span className="rounded-full bg-[#2C8EC4]/10 px-1.5 py-0.5 text-[10px] text-[#2C8EC4]">
                    @{p.matchedMention.replace(/^@/, "")}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                {/* title carries the exact timestamp the relative label replaces */}
                <span title={new Date(p.detectedAt).toLocaleString()}>{relativeTime(p.detectedAt, now)}</span>
                {p.author && <span className="truncate">· @{p.author.replace(/^@/, "")}</span>}
              </div>
            </div>
            <a
              href={p.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-[#0F6B3E] hover:underline"
            >
              View <IconExternalLink size={11} />
            </a>
          </div>
        )
      })}

      {(hasMore || posts.length > visible.length) && (
        <button
          type="button"
          onClick={() => {
            // Reveal already-fetched rows first; only hit the API when exhausted.
            if (posts.length > visible.length) setVisibleCap((cap) => cap + PAGE_SIZE)
            else void loadMore()
          }}
          disabled={loadingMore}
          className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {loadingMore && <IconLoader2 size={11} className="animate-spin" />}
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  )
}

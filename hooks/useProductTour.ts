"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchCached, invalidateCache } from "@/lib/data-cache"
import { useSession } from "next-auth/react"

/** One entry per user — the response depends on nothing else. */
const tourCacheKey = (userId: string) => `/api/product-tour?user=${userId}`

export function useProductTour() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [seenScenes, setSeenScenes] = useState<Set<string>>(() => new Set())
  // Consumers should treat a failed fetch as "don't start anything" rather
  // than trusting the empty seenScenes set, which would otherwise read as
  // "nothing seen yet" and fire every scene's tour on an unrelated network error.
  const [fetchFailed, setFetchFailed] = useState(false)

  useEffect(() => {
    // useSession() starts "loading" on every page load, even for an already
    // signed-in user with a valid cookie — session is undefined during that
    // window, indistinguishable from "no session" if we only check
    // session?.user?.id. Deciding "no session" too early would flip loading
    // to false while seenScenes is still empty, which for this hook means
    // "nothing seen" — the tour would flash on using stale data, then vanish
    // once the real fetch lands a moment later.
    if (status === "loading") return
    if (status !== "authenticated" || !session?.user?.id) {
      setLoading(false)
      return
    }

    const fetchTourStatus = async () => {
      try {
        // Through the shared cache. This hook mounts on every page that has a
        // tour, so an uncached fetch was one query per mount — and two
        // simultaneous identical queries whenever two scenes mounted together.
        // fetchCached collapses concurrent callers onto ONE request and skips
        // it entirely while the entry is fresh, which is what stops rapid
        // navigation between dashboard sections from re-reading tour state each
        // time. Keyed by user, because that is what the response depends on.
        const data = await fetchCached<{ seenScenes?: unknown } | null>(
          tourCacheKey(session.user.id),
          async () => {
            const response = await fetch("/api/product-tour")
            // 401 is an expected state, not a failure. useSession() can report
            // "authenticated" from the client's cached session while the server
            // rejects the request — an expired or not-yet-set cookie, or a
            // signed out tab that hasn't refreshed. Answered as null and
            // treated below as "no tour state available": consumers keep every
            // tour off while fetchFailed is true, so nothing fires on an empty
            // seenScenes set, and it stays out of the console because there is
            // nothing for anyone to fix.
            if (response.status === 401) return null
            if (!response.ok) {
              throw new Error(`Failed to fetch product tour status (HTTP ${response.status})`)
            }
            return response.json()
          }
        )

        if (data === null) {
          setFetchFailed(true)
          return
        }

        setSeenScenes(new Set(Array.isArray(data.seenScenes) ? data.seenScenes : []))
      } catch (error) {
        console.error("Error fetching product tour status:", error)
        setFetchFailed(true)
      } finally {
        setLoading(false)
      }
    }

    fetchTourStatus()
  }, [status, session?.user?.id])

  const userId = session?.user?.id
  const markSceneSeen = useCallback((scene: string) => {
    setSeenScenes((prev) => (prev.has(scene) ? prev : new Set(prev).add(scene)))
    fetch("/api/product-tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene }),
    })
      .then(() => {
        // The cached entry no longer matches what was just persisted. Marked
        // stale rather than refetched: data is kept, so nothing re-reads the
        // database now — the next mount that actually needs it does.
        if (userId) invalidateCache(tourCacheKey(userId))
      })
      .catch((error) => {
        console.error("Error saving product tour status:", error)
      })
  }, [userId])

  return { loading, seenScenes, fetchFailed, markSceneSeen }
}

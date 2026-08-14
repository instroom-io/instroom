"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"

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
        const response = await fetch("/api/product-tour")

        if (!response.ok) {
          throw new Error("Failed to fetch product tour status")
        }

        const data = await response.json()
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

  const markSceneSeen = useCallback((scene: string) => {
    setSeenScenes((prev) => (prev.has(scene) ? prev : new Set(prev).add(scene)))
    fetch("/api/product-tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene }),
    }).catch((error) => {
      console.error("Error saving product tour status:", error)
    })
  }, [])

  return { loading, seenScenes, fetchFailed, markSceneSeen }
}

"use client"

// components/dashboard-prefetcher.tsx
//
// Renders nothing. Mounted once by the dashboard layout, it starts every
// module's initial fetch as soon as the dashboard is on screen, so opening
// Influencer List, Pipeline, Post Tracker or Analytics renders from data that is
// already in the shared cache.
//
// It lives in the layout rather than in a page because the layout is the only
// thing that mounts before the user has chosen where to go. On a route change
// the queue is deliberately cancelled and re-armed, so the page just opened
// issues its request ahead of any background work — already-cached entries are
// skipped on the next pass, so re-arming costs no requests. A full browser
// refresh remounts the layout and starts the flow again.

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { fetchCached, getCachedData } from "@/lib/data-cache"
import { prefetchDashboard } from "@/lib/dashboard-prefetch"

/** What /api/brands/me reports — the same entry useBrandCapabilities reads. */
type BrandsMe = { brands?: { id: string }[]; defaultBrandId?: string | null }

const BRANDS_ME_KEY = "/api/brands/me"

export function DashboardPrefetcher() {
  const { status } = useSession()
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId")
  // Navigating is the clearest signal that the user wants something now: the
  // queue is cancelled and re-armed for the page they just opened, so the
  // background work restarts behind that page's own request instead of ahead
  // of it. Anything already cached is skipped on the way through, so re-arming
  // is not re-fetching.
  const pathname = usePathname()

  useEffect(() => {
    // Nothing is prefetched for a session that is still resolving or absent:
    // every request below is brand-scoped and would only 401.
    if (status !== "authenticated") return

    let cancelled = false

    // Straight after login there is usually no ?brandId yet, so the brand to
    // warm comes from the same /api/brands/me entry the app already caches —
    // read from the cache when it is there, fetched through the shared cache
    // when it is not (so this does not become an extra request).
    async function resolveBrandId(): Promise<string | null> {
      if (brandId) return brandId
      const cached = getCachedData<BrandsMe>(BRANDS_ME_KEY)
      if (cached) return cached.defaultBrandId ?? cached.brands?.[0]?.id ?? null
      try {
        const data = await fetchCached<BrandsMe>(BRANDS_ME_KEY, async () => {
          const res = await fetch(BRANDS_ME_KEY)
          if (!res.ok) throw new Error(`Failed to fetch brands (${res.status})`)
          return (await res.json()) as BrandsMe
        })
        return data?.defaultBrandId ?? data?.brands?.[0]?.id ?? null
      } catch {
        // No brand resolvable — each page still loads for itself, as before.
        return null
      }
    }

    // Set once the queue is running, so unmount and navigation can stop it.
    let stopPrefetch: (() => void) | null = null

    void resolveBrandId().then((resolved) => {
      if (cancelled || !resolved) return
      stopPrefetch = prefetchDashboard(resolved)
    })

    return () => {
      cancelled = true
      stopPrefetch?.()
    }
  }, [status, brandId, pathname])

  return null
}

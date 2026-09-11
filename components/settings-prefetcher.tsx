"use client"

// components/settings-prefetcher.tsx
//
// Renders nothing. Mounted once by the Settings layout, so it runs as soon as
// Settings is opened — whichever section the user landed on — and is NOT
// restarted when they move between sections, since the layout persists across
// those navigations.

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { prefetchSettings } from "@/lib/settings-prefetch"

export function SettingsPrefetcher() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const brandId = searchParams.get("brandId")

  useEffect(() => {
    // Every endpoint below is session-scoped and would only 401 otherwise.
    if (status !== "authenticated") return
    // The pathname tells prefetchSettings which section is CURRENT, so it can
    // leave that one to fetch for itself instead of competing with it. The
    // returned canceller drops still-pending idle work when the route changes,
    // so a user moving quickly between sections never accumulates queued
    // speculative requests.
    return prefetchSettings(session?.user?.id ?? null, brandId, pathname)
  }, [status, session?.user?.id, brandId, pathname])

  return null
}

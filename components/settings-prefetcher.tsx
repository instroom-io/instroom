"use client"

// components/settings-prefetcher.tsx
//
// Renders nothing. Mounted once by the Settings layout, so it runs as soon as
// Settings is opened — whichever section the user landed on — and is NOT
// restarted when they move between sections, since the layout persists across
// those navigations.

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { prefetchSettings } from "@/lib/settings-prefetch"

export function SettingsPrefetcher() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId")

  useEffect(() => {
    // Every endpoint below is session-scoped and would only 401 otherwise.
    if (status !== "authenticated") return
    prefetchSettings(session?.user?.id ?? null, brandId)
  }, [status, session?.user?.id, brandId])

  return null
}

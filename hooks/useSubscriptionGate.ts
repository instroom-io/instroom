// hooks/useSubscriptionGate.ts
//
// The brand-scoped subscription check that gates Pipeline, Inbox and the Post
// Tracker. Each of those pages used to own a copy of this fetch in local state
// starting at `null`, which meant every navigation back to the page rendered a
// skeleton until the request resolved — even though the answer was already
// known from the previous visit.
//
// Reading through the shared cache (lib/data-cache) makes the resolved answer
// available on mount, so a revisit renders the real page immediately while the
// status revalidates in the background. `isSubscribed` is null ONLY when there
// is genuinely nothing cached yet, so a first visit still shows its loading UI.

"use client"

import { useCallback } from "react"
import { useSession } from "next-auth/react"
import { useCachedFetch } from "@/lib/data-cache"

export interface SubscriptionGateState {
  /** null while the first check is still in flight (no cached answer yet). */
  isSubscribed: boolean | null
  /** Raw status string, or undefined until first resolved. */
  status: string | undefined
  isLoading: boolean
}

export function useSubscriptionGate(brandId?: string | null): SubscriptionGateState {
  const { data: session, status: sessionStatus } = useSession()

  // Same URL the pages requested before, so nothing changes server-side.
  const url = brandId
    ? `/api/subscription/status?brandId=${brandId}`
    : "/api/subscription/status"

  const fetcher = useCallback(async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to check subscription (${res.status})`)
    return (await res.json()) as { status?: string; isExpired?: boolean }
  }, [url])

  const enabled = sessionStatus === "authenticated" && Boolean(session?.user?.id)
  const { data, error, isLoading } = useCachedFetch(enabled ? url : null, fetcher)

  // A failed check is treated as "not subscribed", exactly as the pages did.
  if (error) {
    return { isSubscribed: false, status: "inactive", isLoading: false }
  }

  if (!data) {
    return { isSubscribed: null, status: undefined, isLoading }
  }

  return {
    isSubscribed: (data.status === "active" || data.status === "trialing") && !data.isExpired,
    status: data.status || "inactive",
    isLoading: false,
  }
}

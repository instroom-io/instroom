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
  /** Display name of the subscriber's current plan (e.g. "Basic"), or null
   *  when there's no subscription at all. Lets a blocked page say "upgrade
   *  from Basic" instead of implying there's no subscription to begin with. */
  planDisplayName: string | null
  /**
   * Re-run the check against the server, past the cache.
   *
   * A failed check is deliberately treated as "not subscribed" below, so a
   * transient failure leaves the page showing its locked state until something
   * asks again. Callers that know the situation just changed — the Inbox after
   * a mailbox is connected in another tab — can force a real re-validation
   * instead of waiting for the next stale read. This re-runs the same check; it
   * does not skip it.
   */
  refetch: () => Promise<unknown>
}

export function useSubscriptionGate(
  brandId?: string | null,
  /**
   * Plan names (lowercase, e.g. "solo", "team") allowed to pass this gate.
   * Omit for "any active/trialing subscription, any plan" — Pipeline and Post
   * Tracker are included in Basic, so they don't pass this. Inbox is Solo/Team
   * only per the pricing page, so it does.
   */
  requiredPlans?: string[]
): SubscriptionGateState {
  const { data: session, status: sessionStatus } = useSession()

  // Same URL the pages requested before, so nothing changes server-side.
  const url = brandId
    ? `/api/subscription/status?brandId=${brandId}`
    : "/api/subscription/status"

  const fetcher = useCallback(async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to check subscription (${res.status})`)
    return (await res.json()) as {
      status?: string
      isExpired?: boolean
      subscription?: { plan?: { name?: string; display_name?: string } } | null
    }
  }, [url])

  const enabled = sessionStatus === "authenticated" && Boolean(session?.user?.id)
  const { data, error, isLoading, refetch } = useCachedFetch(enabled ? url : null, fetcher)

  // A failed check is treated as "not subscribed", exactly as the pages did.
  if (error) {
    return { isSubscribed: false, status: "inactive", isLoading: false, planDisplayName: null, refetch }
  }

  if (!data) {
    return { isSubscribed: null, status: undefined, isLoading, planDisplayName: null, refetch }
  }

  const statusOk = (data.status === "active" || data.status === "trialing") && !data.isExpired
  const planName = data.subscription?.plan?.name
  const planOk = !requiredPlans || (!!planName && requiredPlans.includes(planName))

  return {
    isSubscribed: statusOk && planOk,
    status: data.status || "inactive",
    isLoading: false,
    planDisplayName: data.subscription?.plan?.display_name ?? null,
    refetch,
  }
}

"use client"

import { useCallback } from "react"
import { useSession } from "next-auth/react"
import { useCachedFetch } from "@/lib/data-cache"

interface SubscriptionData {
  id: string
  plan_id: string
  plan: {
    name: string
    display_name: string
  }
  billing_cycle: string
  current_period_end: string | null
  current_period_start: string | null
  ended_at: string | null
}

export interface SubscriptionStatus {
  status: "free" | "active" | "paused" | "cancelled" | "expired"
  subscription: SubscriptionData | null
  isExpired: boolean
  isExpiringSoon: boolean
  daysUntilExpiry: number | null
  loading: boolean
  error: string | null
}

const FALLBACK: Omit<SubscriptionStatus, "loading" | "error"> = {
  status: "free",
  subscription: null,
  isExpired: false,
  isExpiringSoon: false,
  daysUntilExpiry: null,
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const { data: session } = useSession()
  const userId = session?.user?.id

  const fetcher = useCallback(async () => {
    const response = await fetch("/api/subscription/status")
    if (!response.ok) throw new Error("Failed to fetch subscription status")
    return (await response.json()) as Omit<SubscriptionStatus, "loading" | "error">
  }, [])

  // Cached per user: the provider mounts on every page, so without this the
  // status was refetched on each navigation.
  const { data, error, isLoading } = useCachedFetch(
    userId ? `/api/subscription/status?user=${userId}` : null,
    fetcher
  )

  return {
    ...FALLBACK,
    ...(data ?? {}),
    loading: Boolean(userId) && isLoading,
    error,
  }
}

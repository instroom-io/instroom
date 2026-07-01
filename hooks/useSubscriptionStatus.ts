"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

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

export function useSubscriptionStatus() {
  const { data: session } = useSession()
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    status: "free",
    subscription: null,
    isExpired: false,
    isExpiringSoon: false,
    daysUntilExpiry: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!session?.user?.id) {
      setSubscriptionStatus((prev) => ({ ...prev, loading: false }))
      return
    }

    const fetchSubscriptionStatus = async () => {
      try {
        const response = await fetch("/api/subscription/status")
        
        if (!response.ok) {
          throw new Error("Failed to fetch subscription status")
        }

        const data = await response.json()
        setSubscriptionStatus({
          ...data,
          loading: false,
          error: null,
        })
      } catch (error) {
        console.error("Error fetching subscription status:", error)
        setSubscriptionStatus((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }))
      }
    }

    fetchSubscriptionStatus()
  }, [session?.user?.id])

  return subscriptionStatus
}

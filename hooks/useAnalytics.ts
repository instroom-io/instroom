// hooks/useAnalytics.ts
// Fetches analytics data from /api/analytics scoped to the current brand.
// Follows the same pattern as useSubscriptionStatus — single fetch, local state,
// no polling. Call refetch() manually when filters change.

"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsInfluencer {
  id: string
  platform: string
  instagramHandle: string | null
  niche: string
  location: string
  createdAt: string

  pipelineStatus: string
  rejectionReason: string | null
  rejectionBucket: "hard" | "soft" | null

  views:    number
  likes:    number
  comments: number
  clicks:   number
  salesQty: number
  salesAmt: number
  prodCost: number

  usageRights:  boolean
  contentSaved: boolean
  adCode:       boolean

  /** Days since product was delivered — only set when status is "Content Pending" */
  deliveredDaysAgo: number | null
}

export interface AnalyticsFilters {
  platform:  string
  niche:     string
  location:  string
  dateRange: string
}

export interface AnalyticsState {
  data:      AnalyticsInfluencer[]
  isLoading: boolean
  error:     string | null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnalytics(brandId: string | null, filters: AnalyticsFilters): AnalyticsState & { refetch: () => void } {
  const { data: session } = useSession()

  const [state, setState] = useState<AnalyticsState>({
    data:      [],
    isLoading: true,
    error:     null,
  })

  const fetchData = useCallback(async () => {
    // Don't fetch until we have both a session and a brandId
    if (!session?.user?.id || !brandId) {
      setState((prev) => ({ ...prev, isLoading: false }))
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const params = new URLSearchParams({
        brandId,
        platform:  filters.platform,
        niche:     filters.niche,
        location:  filters.location,
        dateRange: filters.dateRange,
      })

      const res = await fetch(`/api/analytics?${params.toString()}`)

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }

      const json = await res.json()

      setState({
        data:      json.data ?? [],
        isLoading: false,
        error:     null,
      })
    } catch (err) {
      console.error("[useAnalytics] fetch error:", err)
      setState({
        data:      [],
        isLoading: false,
        error:     err instanceof Error ? err.message : "Unknown error",
      })
    }
  }, [session?.user?.id, brandId, filters.platform, filters.niche, filters.location, filters.dateRange])

  // Fetch whenever session, brandId, or any filter changes
  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    ...state,
    refetch: fetchData,
  }
}
"use client"

import { useCallback } from "react"
import { roleHasCapability } from "@/lib/role-capabilities"
import { useCachedFetch } from "@/lib/data-cache"

export function useBrandCapabilities(brandId: string | null | undefined) {
  const fetcher = useCallback(async () => {
    const res = await fetch("/api/brands/me")
    if (!res.ok) throw new Error(`Failed to fetch brands (${res.status})`)
    return (await res.json()) as { brands?: any[] }
  }, [])

  // One shared "/api/brands/me" entry for the whole app — this hook is mounted
  // by several components at once, which previously meant one request each.
  const { data, isLoading } = useCachedFetch(
    brandId ? "/api/brands/me" : null,
    fetcher
  )

  const role: string | null =
    (data?.brands || []).find((b: any) => b.id === brandId)?.role ?? null
  const loading = Boolean(brandId) && isLoading

  return {
    role,
    loading,
    isOwner: role === "owner",
    canApproveInfluencers: !loading && roleHasCapability(role, "approveInfluencers"),
    canManageCampaigns: !loading && roleHasCapability(role, "manageCampaigns"),
    canManageInfluencers: !loading && roleHasCapability(role, "manageInfluencers"),
  }
}

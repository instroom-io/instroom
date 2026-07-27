"use client"

import { useEffect, useState } from "react"
import { roleHasCapability } from "@/lib/role-capabilities"

export function useBrandCapabilities(brandId: string | null | undefined) {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!brandId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch("/api/brands/me")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const brand = (data.brands || []).find((b: any) => b.id === brandId)
        setRole(brand?.role ?? null)
      })
      .catch(() => {
        if (!cancelled) setRole(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [brandId])

  return {
    role,
    loading,
    isOwner: role === "owner",
    canApproveInfluencers: !loading && roleHasCapability(role, "approveInfluencers"),
    canManageCampaigns: !loading && roleHasCapability(role, "manageCampaigns"),
    canManageInfluencers: !loading && roleHasCapability(role, "manageInfluencers"),
  }
}

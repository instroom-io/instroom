// hooks/useBrandTaxonomy.ts
//
// Fetches, creates, and deletes BrandNiche + BrandLocation entries.
// Drop this hook into any modal that manages niches / locations.
//
// Usage:
//   const { niches, locations, addNiche, removeNiche, addLocation, removeLocation, isLoading } =
//     useBrandTaxonomy(brandId)

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

export interface BrandNiche {
  id: string
  brand_id: string
  name: string
  created_at: string
}

export interface BrandLocation {
  id: string
  brand_id: string
  name: string
  created_at: string
}

export function useBrandTaxonomy(brandId: string | null) {
  const [niches, setNiches] = useState<BrandNiche[]>([])
  const [locations, setLocations] = useState<BrandLocation[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // ── Fetch both on mount / brandId change ────────────────────────────────
  useEffect(() => {
    if (!brandId) {
      setNiches([])
      setLocations([])
      return
    }

    setIsLoading(true)

    Promise.all([
      fetch(`/api/brand/${brandId}/niches`).then((r) => r.json()),
      fetch(`/api/brand/${brandId}/locations`).then((r) => r.json()),
    ])
      .then(([nichesData, locationsData]) => {
        setNiches(nichesData.niches ?? [])
        setLocations(locationsData.locations ?? [])
      })
      .catch(() => {
        toast.error("Failed to load niches / locations")
      })
      .finally(() => setIsLoading(false))
  }, [brandId])

  // ── Add niche ───────────────────────────────────────────────────────────
  const addNiche = useCallback(
    async (name: string): Promise<BrandNiche | null> => {
      if (!brandId) return null
      const trimmed = name.trim()
      if (!trimmed) return null

      try {
        const res = await fetch(`/api/brand/${brandId}/niches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        })

        if (res.status === 409) {
          toast.error("That niche already exists")
          return null
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          toast.error(body.error || "Failed to add niche")
          return null
        }

        const { niche } = await res.json()
        setNiches((prev) =>
          [...prev, niche].sort((a, b) => a.name.localeCompare(b.name))
        )
        return niche
      } catch {
        toast.error("Network error — could not add niche")
        return null
      }
    },
    [brandId]
  )

  // ── Remove niche ────────────────────────────────────────────────────────
  const removeNiche = useCallback(
    async (nicheId: string): Promise<boolean> => {
      if (!brandId) return false

      // Optimistic removal
      setNiches((prev) => prev.filter((n) => n.id !== nicheId))

      try {
        const res = await fetch(`/api/brand/${brandId}/niches/${nicheId}`, {
          method: "DELETE",
        })

        if (!res.ok && res.status !== 404) {
          // Rollback — re-fetch to get back in sync
          fetch(`/api/brand/${brandId}/niches`)
            .then((r) => r.json())
            .then((d) => setNiches(d.niches ?? []))
          toast.error("Failed to remove niche")
          return false
        }

        return true
      } catch {
        toast.error("Network error — could not remove niche")
        return false
      }
    },
    [brandId]
  )

  // ── Add location ────────────────────────────────────────────────────────
  const addLocation = useCallback(
    async (name: string): Promise<BrandLocation | null> => {
      if (!brandId) return null
      const trimmed = name.trim()
      if (!trimmed) return null

      try {
        const res = await fetch(`/api/brand/${brandId}/locations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        })

        if (res.status === 409) {
          toast.error("That location already exists")
          return null
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          toast.error(body.error || "Failed to add location")
          return null
        }

        const { location } = await res.json()
        setLocations((prev) =>
          [...prev, location].sort((a, b) => a.name.localeCompare(b.name))
        )
        return location
      } catch {
        toast.error("Network error — could not add location")
        return null
      }
    },
    [brandId]
  )

  // ── Remove location ─────────────────────────────────────────────────────
  const removeLocation = useCallback(
    async (locationId: string): Promise<boolean> => {
      if (!brandId) return false

      // Optimistic removal
      setLocations((prev) => prev.filter((l) => l.id !== locationId))

      try {
        const res = await fetch(
          `/api/brand/${brandId}/locations/${locationId}`,
          { method: "DELETE" }
        )

        if (!res.ok && res.status !== 404) {
          fetch(`/api/brand/${brandId}/locations`)
            .then((r) => r.json())
            .then((d) => setLocations(d.locations ?? []))
          toast.error("Failed to remove location")
          return false
        }

        return true
      } catch {
        toast.error("Network error — could not remove location")
        return false
      }
    },
    [brandId]
  )

  return {
    niches,
    locations,
    isLoading,
    addNiche,
    removeNiche,
    addLocation,
    removeLocation,
  }
}
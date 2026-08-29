// hooks/useBrandTaxonomy.ts
//
// Fetches, creates, and deletes BrandNiche + BrandLocation entries.
// Drop this hook into any modal that manages niches / locations.
//
// Usage:
//   const { niches, locations, addNiche, removeNiche, addLocation, removeLocation, isLoading } =
//     useBrandTaxonomy(brandId)

import { useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useCachedFetch, invalidateCache, getCachedData, setCachedData } from "@/lib/data-cache"

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

const EMPTY_NICHES: BrandNiche[] = []
const EMPTY_LOCATIONS: BrandLocation[] = []

export function useBrandTaxonomy(brandId: string | null) {
  const taxonomyKey = brandId ? `/api/brand/${brandId}/taxonomy` : null

  // ── Fetch both, once, shared across every modal that mounts this hook ────
  const fetchTaxonomy = useCallback(async () => {
    // One after the other, not together. Every modal that manages niches or
    // locations mounts this hook, and two simultaneous route handlers took two
    // of the three pooled connections at the moment a page was also loading its
    // own data. The shared cache entry means this pair is fetched once per
    // brand either way, so the only thing serialising costs is one round trip.
    const nichesData = await fetch(`/api/brand/${brandId}/niches`).then((r) => r.json())
    const locationsData = await fetch(`/api/brand/${brandId}/locations`).then((r) => r.json())
    return {
      niches: (nichesData.niches ?? []) as BrandNiche[],
      locations: (locationsData.locations ?? []) as BrandLocation[],
    }
  }, [brandId])

  const { data, error, isLoading } = useCachedFetch(taxonomyKey, fetchTaxonomy)

  // Rendered straight from the shared cache — optimistic edits below write back
  // into it, so every modal using this hook sees the same list.
  const niches = data?.niches ?? EMPTY_NICHES
  const locations = data?.locations ?? EMPTY_LOCATIONS

  const setNiches = useCallback(
    (value: BrandNiche[] | ((prev: BrandNiche[]) => BrandNiche[])) => {
      if (!taxonomyKey) return
      const prev = getCachedData<{ niches: BrandNiche[]; locations: BrandLocation[] }>(taxonomyKey)
        ?? { niches: [], locations: [] }
      const next = typeof value === "function" ? value(prev.niches) : value
      setCachedData(taxonomyKey, { ...prev, niches: next })
    },
    [taxonomyKey]
  )

  const setLocations = useCallback(
    (value: BrandLocation[] | ((prev: BrandLocation[]) => BrandLocation[])) => {
      if (!taxonomyKey) return
      const prev = getCachedData<{ niches: BrandNiche[]; locations: BrandLocation[] }>(taxonomyKey)
        ?? { niches: [], locations: [] }
      const next = typeof value === "function" ? value(prev.locations) : value
      setCachedData(taxonomyKey, { ...prev, locations: next })
    },
    [taxonomyKey]
  )

  useEffect(() => {
    if (error) toast.error("Failed to load niches / locations")
  }, [error])

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
        if (taxonomyKey) invalidateCache(taxonomyKey)
        return niche
      } catch {
        toast.error("Network error — could not add niche")
        return null
      }
    },
    [brandId, taxonomyKey, setNiches, setLocations]
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

        if (taxonomyKey) invalidateCache(taxonomyKey)
        return true
      } catch {
        toast.error("Network error — could not remove niche")
        return false
      }
    },
    [brandId, taxonomyKey, setNiches, setLocations]
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
        if (taxonomyKey) invalidateCache(taxonomyKey)
        return location
      } catch {
        toast.error("Network error — could not add location")
        return null
      }
    },
    [brandId, taxonomyKey, setNiches, setLocations]
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

        if (taxonomyKey) invalidateCache(taxonomyKey)
        return true
      } catch {
        toast.error("Network error — could not remove location")
        return false
      }
    },
    [brandId, taxonomyKey, setNiches, setLocations]
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
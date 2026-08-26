// ─── hooks/useInfluencerData.ts ──────────────────────────────────────────────
// Fetches influencer rows + custom field definitions from the API.
// Returns data shaped exactly for the TableSheet component.
// NO localStorage — all state lives in React and is persisted to the DB.

"use client"

import { useCallback } from "react"
import type { InfluencerRow, CustomColumn } from "@/components/table-sheet"
import { useCachedFetch, setCachedData, getCachedData } from "@/lib/data-cache"

type InfluencerPayload = { rows: InfluencerRow[]; customColumns: CustomColumn[] }

// Stable empty references so consumers' memos don't rerun before data arrives.
const EMPTY_ROWS: InfluencerRow[] = []
const EMPTY_COLUMNS: CustomColumn[] = []

type UseInfluencerDataReturn = {
  rows: InfluencerRow[]
  customColumns: CustomColumn[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  setRows: React.Dispatch<React.SetStateAction<InfluencerRow[]>>
  setCustomColumns: React.Dispatch<React.SetStateAction<CustomColumn[]>>
}

/**
 * Fetch and shape a brand's Influencer List payload — the exact value cached
 * under `/api/brand/{brandId}/influencers`.
 *
 * Exported for lib/dashboard-prefetch. The cached value is `{ rows, customColumns }`,
 * a mapping of the response rather than the response itself, so the prefetch has to
 * run this same mapping — writing the raw payload would leave the sheet reading a
 * shape it cannot render.
 */
export async function fetchInfluencerPayload(brandId: string): Promise<InfluencerPayload> {
    const res = await fetch(`/api/brand/${brandId}/influencers`)

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody.error || `Failed to fetch (${res.status})`)
    }

    const data = await res.json()

    // API returns { influencers: BrandInfluencer[] with nested influencer, customFields: [] }
    // Sort by created_at ascending so oldest entries stay at the top
    const sortedInfluencers = [...(data.influencers ?? [])].sort((a: any, b: any) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
      return dateA - dateB
    })

    const apiRows: InfluencerRow[] = sortedInfluencers
      .filter((item: any) => item.influencer?.id)
      .map((item: any) => {
        const inf = item.influencer ?? {}
        // Derive first_name from full_name stored in DB
        const fullName: string = inf.full_name ?? ""
        const firstName = fullName ? fullName.split(" ")[0] : ""

        return {
          // Core identity — use BrandInfluencer.id as the row ID so updates
          // hit the right record. The actual Influencer.id is inf.id.
          id: inf.id,
          brand_influencer_id: item.id,
          handle: (inf.handle ?? "").replace(/^@/, ""), // strip @ — stored inconsistently in older records
          platform: inf.platform ?? "instagram",
          full_name: fullName,
          email: inf.email ?? "",
          follower_count: String(inf.follower_count ?? ""),
          engagement_rate: String(inf.engagement_rate ?? ""),
          niche: inf.niche ?? "",
          gender: inf.gender ?? "",
          location: inf.location ?? "",
          social_link: inf.social_link ?? "",
          bio: inf.bio ?? "",
          profile_image_url: inf.profile_image_url ?? "",
          avg_likes: inf.avg_likes ?? "",
          avg_comments: inf.avg_comments ?? "",
          avg_views: inf.avg_views ?? "",

          // Affiliate / performance fields for GoAffPro-connected creators
          affiliate_id: item.affiliate_id ?? null,
          ref_code: item.ref_code ?? null,
          coupon: item.coupon ?? null,
          spark_ads: item.spark_ads ?? null,
          affiliate_link: item.affiliate_link ?? null,
          clicks: item.clicks ?? 0,
          sales_count: item.sales_count ?? 0,
          gmv: item.gmv ? Number(item.gmv) : 0,

          // BrandInfluencer relationship fields
          contact_status: item.contact_status ?? "not_contacted",
          stage: String(item.stage ?? "1"),
          agreed_rate: item.agreed_rate ?? "",
          notes: item.notes ?? "",
          approval_status: (item.approval_status ?? "Pending") as
            | "Approved"
            | "Declined"
            | "Pending",
          approval_notes: item.approval_notes ?? "",
          transferred_date: item.transferred_date
            ? new Date(item.transferred_date).toISOString().split("T")[0]
            : "",

          // Derived / UI-only fields
          // Always derive first_name fresh from full_name so edits to first_name
          // in the sidebar are reflected correctly after a refetch
          first_name: firstName,
          contact_info: inf.email ?? "",
          decline_reason: "",
          tier: "Bronze",
          community_status: "Pending",

          // Custom field values — keyed by field_key
          custom: Object.fromEntries(
            (item.customValues ?? []).map((cv: any) => [
              cv.custom_field?.field_key ?? cv.custom_field_id,
              cv.value ?? "",
            ])
          ),
        }
      })

    const apiCustomCols: CustomColumn[] = (data.customFields ?? []).map(
      (cf: any) => ({
        id: cf.id,
        field_key: cf.field_key,
        field_name: cf.field_name,
        field_type: cf.field_type ?? "text",
        field_options: cf.field_options ?? [],
        assignedGroup:
          cf.assignedGroup ??
          cf.assigned_group ??
          "Influencer Details",
        description: cf.description,
      })
    )

    return { rows: apiRows, customColumns: apiCustomCols }
}

export function useInfluencerData(brandId: string | null): UseInfluencerDataReturn {
  // Shared across pages: returning to the sheet renders the cached rows
  // immediately and only refreshes in the background when they are stale.
  const cacheKey = brandId ? `/api/brand/${brandId}/influencers` : null

  const fetchPayload = useCallback(() => fetchInfluencerPayload(brandId!), [brandId])

  const { data, error, isLoading, refetch } = useCachedFetch<InfluencerPayload>(
    cacheKey,
    fetchPayload
  )

  // The cache IS the state: reading it during render (rather than copying it
  // into local state in an effect) is what keeps every consumer of this brand's
  // rows in sync without extra renders or extra requests.
  const rows = data?.rows ?? EMPTY_ROWS
  const customColumns = data?.customColumns ?? EMPTY_COLUMNS

  // Local edits (inline cell edits, optimistic updates) write straight into the
  // cache, so they show up everywhere and survive navigating away and back.
  const updateRows = useCallback<React.Dispatch<React.SetStateAction<InfluencerRow[]>>>(
    (value) => {
      if (!cacheKey) return
      const cached = getCachedData<InfluencerPayload>(cacheKey) ?? { rows: [], customColumns: [] }
      const next = typeof value === "function"
        ? (value as (p: InfluencerRow[]) => InfluencerRow[])(cached.rows)
        : value
      setCachedData(cacheKey, { ...cached, rows: next })
    },
    [cacheKey]
  )

  const updateCustomColumns = useCallback<React.Dispatch<React.SetStateAction<CustomColumn[]>>>(
    (value) => {
      if (!cacheKey) return
      const cached = getCachedData<InfluencerPayload>(cacheKey) ?? { rows: [], customColumns: [] }
      const next = typeof value === "function"
        ? (value as (p: CustomColumn[]) => CustomColumn[])(cached.customColumns)
        : value
      setCachedData(cacheKey, { ...cached, customColumns: next })
    },
    [cacheKey]
  )

  return {
    rows,
    customColumns,
    isLoading,
    error: brandId ? error : "No brand selected",
    refetch: async () => {
      await refetch()
    },
    setRows: updateRows,
    setCustomColumns: updateCustomColumns,
  }
}
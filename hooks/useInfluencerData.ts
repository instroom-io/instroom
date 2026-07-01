// ─── hooks/useInfluencerData.ts ──────────────────────────────────────────────
// Fetches influencer rows + custom field definitions from the API.
// Returns data shaped exactly for the TableSheet component.
// NO localStorage — all state lives in React and is persisted to the DB.

"use client"

import { useState, useEffect, useCallback } from "react"
import type { InfluencerRow, CustomColumn } from "@/components/table-sheet"

type UseInfluencerDataReturn = {
  rows: InfluencerRow[]
  customColumns: CustomColumn[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  setRows: React.Dispatch<React.SetStateAction<InfluencerRow[]>>
  setCustomColumns: React.Dispatch<React.SetStateAction<CustomColumn[]>>
}

export function useInfluencerData(brandId: string | null): UseInfluencerDataReturn {
  const [rows, setRows] = useState<InfluencerRow[]>([])
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!brandId) {
      setIsLoading(false)
      setError("No brand selected")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
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

      setRows(apiRows)
      setCustomColumns(apiCustomCols)
    } catch (err: any) {
      console.error("useInfluencerData fetch error:", err)
      setError(err.message || "Failed to load influencers")
    } finally {
      setIsLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    rows,
    customColumns,
    isLoading,
    error,
    refetch: fetchData,
    setRows,
    setCustomColumns,
  }
}
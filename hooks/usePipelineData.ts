// hooks/usePipelineData.ts
// FIXED:
//   1. refetch() no longer sets isLoading=true (eliminates board flicker)
//   2. On successful PATCH, we update local state directly — no refetch needed
//   3. Only refetch (silently) on failure to restore correct server state

import { useState, useEffect, useCallback, useRef } from "react"

export interface PipelineInfluencer {
  id: string
  influencerId: string
  collabType?: string
  campaignId: string | null
  campaignName: string | null
  influencer: string
  instagramHandle: string
  handle: string
  platform: string
  followers: string
  followerCount: number
  engagementRate: string
  niche: string
  location: string
  email: string
  profileImageUrl: string | null
  bio: string
  pipelineStatus: string
  contactStatus: string
  stage: number | null
  orderStatus: string | null
  contentPosted: boolean
  approvalStatus: string | null
  approvalNotes: string | null
  niReason?: string
  addressReceived?: boolean
  agreedRate: number | null
  currency: string | null
  deliverables: string | null
  deadline: string | null
  notes: string
  internalRating: number | null
  lastContact: string
  createdAt: string
}

interface UsePipelineDataReturn {
  data: PipelineInfluencer[]
  isLoading: boolean
  error: string | null
  updateStatus: (id: string, newStatus: string, extra?: { niReason?: string }) => Promise<boolean>
  refetch: () => void
}

function mapItem(item: any): PipelineInfluencer {
  return {
    id:              item.id,
    influencerId:    item.influencerId,
    campaignId:      item.campaignId,
    campaignName:    item.campaignName,
    influencer:      item.influencer,
    instagramHandle: item.instagramHandle,
    handle:          item.handle,
    platform:        item.platform,
    followers:       item.followers,
    followerCount:   item.followerCount,
    engagementRate:  item.engagementRate,
    niche:           item.niche,
    location:        item.location,
    email:           item.email,
    profileImageUrl: item.profileImageUrl,
    bio:             item.bio,
    pipelineStatus:  item.pipelineStatus,
    contactStatus:   item.contactStatus  || item.contact_status  || "",
    stage:           item.stage          ?? null,
    orderStatus:     item.orderStatus    ?? null,
    contentPosted:   item.contentPosted  ?? false,
    approvalStatus:  item.approvalStatus ?? null,
    approvalNotes:   item.approvalNotes  ?? null,
    niReason:        item.approvalNotes  || undefined,
    addressReceived: false,
    agreedRate:      item.agreedRate     ?? null,
    currency:        item.currency       ?? null,
    deliverables:    item.deliverables   ?? null,
    deadline:        item.deadline       ?? null,
    notes:           item.notes          || "",
    internalRating:  item.internalRating ?? null,
    lastContact:     item.lastContact,
    createdAt:       item.createdAt,
  }
}

// Derives what the local state should look like after a status change,
// matching what the server will persist (so no refetch is needed on success)
function applyStatusChange(
  item: PipelineInfluencer,
  newStatus: string,
  niReason?: string
): PipelineInfluencer {
  const base: Partial<PipelineInfluencer> = { pipelineStatus: newStatus }

  switch (newStatus) {
    case "For Outreach":
      return { ...item, ...base, contactStatus: "pending",           stage: 1, approvalStatus: "Approved" }
    case "Contacted":
      return { ...item, ...base, contactStatus: "contacted",         stage: 2, approvalStatus: "Approved" }
    case "In Conversation":
      return { ...item, ...base, contactStatus: "negotiating",       stage: 3, approvalStatus: "Approved" }
    case "Deal Agreed":
      return { ...item, ...base, contactStatus: "agreed",            stage: 4, approvalStatus: "Approved" }
    case "For Order Creation":
      return { ...item, ...base, contactStatus: "for_order_creation",stage: 5, approvalStatus: "Approved" }
    case "Not Interested":
      return {
        ...item, ...base,
        contactStatus:  "not_interested",
        stage:          0,
        approvalStatus: "Declined",
        approvalNotes:  niReason || "Not interested",
        niReason:       niReason || "Not interested",
      }
    default:
      return { ...item, ...base }
  }
}

export function usePipelineData(brandId?: string): UsePipelineDataReturn {
  const [data,      setData]      = useState<PipelineInfluencer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // Track in-flight PATCH requests so we don't refetch while one is pending
  const pendingRef = useRef(0)

  // ── Initial fetch (shows spinner) ─────────────────────────────────────────
  const fetchData = useCallback(async (showSpinner = true) => {
    if (!brandId) { setIsLoading(false); return }

    try {
      if (showSpinner) setIsLoading(true)
      setError(null)

      const res = await fetch(`/api/brand/${brandId}/pipeline`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to fetch pipeline data")
      }

      const json = await res.json()
      const mapped = (json.data || []).map(mapItem)
      setData(mapped)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e?.message || "Something went wrong")
    } finally {
      if (showSpinner) setIsLoading(false)
    }
  }, [brandId])

  useEffect(() => { fetchData(true) }, [fetchData])

  // ── Status update — optimistic, no loading flicker ────────────────────────
  const updateStatus = useCallback(
    async (id: string, newStatus: string, extra?: { niReason?: string }): Promise<boolean> => {
      if (!brandId) return false

      // 1. Save snapshot for rollback
      let snapshot: PipelineInfluencer[] = []

      // 2. Apply optimistic update immediately (no spinner)
      setData((prev) => {
        snapshot = prev
        return prev.map((item) =>
          item.id === id ? applyStatusChange(item, newStatus, extra?.niReason) : item
        )
      })

      pendingRef.current += 1

      try {
        const res = await fetch(`/api/brand/${brandId}/pipeline/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineStatus: newStatus,
            ...(extra?.niReason ? { niReason: extra.niReason } : {}),
          }),
        })

        if (!res.ok) {
          // Server rejected — rollback silently
          setData(snapshot)
          return false
        }

        // Success — state is already correct from optimistic update.
        // No refetch needed, no spinner.
        return true
      } catch {
        setData(snapshot)
        return false
      } finally {
        pendingRef.current -= 1
      }
    },
    [brandId]
  )

  return {
    data,
    isLoading,
    error,
    updateStatus,
    // Public refetch (e.g. retry button) — no spinner so board stays visible
    refetch: () => fetchData(false),
  }
}
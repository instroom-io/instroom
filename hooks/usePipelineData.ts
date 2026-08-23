// hooks/usePipelineData.ts
// FIXED:
//   1. refetch() no longer sets isLoading=true (eliminates board flicker)
//   2. On successful PATCH, we update local state directly — no refetch needed
//   3. Only refetch (silently) on failure to restore correct server state

import { useCallback, useRef, useState } from "react"
import { useCachedFetch, getCachedData, setCachedData, markCacheWrite } from "@/lib/data-cache"
import { invalidateInfluencerDerivedCaches, pipelineCacheKey } from "@/lib/cache-invalidation"

/** Stable empty reference used before the first payload arrives. */
const EMPTY_PIPELINE: PipelineInfluencer[] = []

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
  avgLikes: number | null
  avgComments: number | null
  avgViews: number | null
  niche: string
  location: string
  email: string
  profileImageUrl: string | null
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
  affiliateId: string | null
  refCode: string | null
  coupon: string | null
  sparkAds: string | null
  affiliateLink: string | null
  clicks: number
  salesCount: number
  gmv: number
}

interface UsePipelineDataReturn {
  data: PipelineInfluencer[]
  isLoading: boolean
  error: string | null
  updateStatus: (id: string, newStatus: string, extra?: { niReason?: string; collaborationType?: string }) => Promise<boolean>
  /** True while at least one status write is in flight — drives the saving indicator. */
  isSaving: boolean
  refetch: () => void
}

function mapItem(item: any): PipelineInfluencer {
  return {
    id:              item.id,
    influencerId:    item.influencerId,
    collabType:      item.collabType || undefined,
    campaignId:      item.campaignId,
    campaignName:    item.campaignName,
    influencer:      item.influencer,
    instagramHandle: item.instagramHandle,
    handle:          item.handle,
    platform:        item.platform,
    followers:       item.followers,
    followerCount:   item.followerCount,
    engagementRate:  item.engagementRate,
    avgLikes:        item.avgLikes    ?? null,
    avgComments:     item.avgComments ?? null,
    avgViews:        item.avgViews    ?? null,
    niche:           item.niche,
    location:        item.location,
    email:           item.email,
    profileImageUrl: item.profileImageUrl,
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
    affiliateId:     item.affiliateId    ?? null,
    refCode:         item.refCode        ?? null,
    coupon:          item.coupon         ?? null,
    sparkAds:        item.sparkAds       ?? null,
    affiliateLink:   item.affiliateLink  ?? null,
    clicks:          item.clicks         ?? 0,
    salesCount:      item.salesCount     ?? 0,
    gmv:             item.gmv            ?? 0,
  }
}

// Derives what the local state should look like after a status change,
// matching what the server will persist (so no refetch is needed on success)
function applyStatusChange(
  item: PipelineInfluencer,
  newStatus: string,
  niReason?: string,
  collaborationType?: string
): PipelineInfluencer {
  const collab = collaborationType !== undefined ? { collabType: collaborationType } : {}

  switch (newStatus) {
    case "For Outreach":
      return { ...item, pipelineStatus: newStatus, ...collab, contactStatus: "pending",           stage: 1, approvalStatus: "Approved" }
    case "Contacted":
      return { ...item, pipelineStatus: newStatus, ...collab, contactStatus: "contacted",         stage: 2, approvalStatus: "Approved" }
    case "In Conversation":
      return { ...item, pipelineStatus: newStatus, ...collab, contactStatus: "negotiating",       stage: 3, approvalStatus: "Approved" }
    case "Deal Agreed":
      // A Collaboration Type is only ever sent alongside "Deal Agreed" once
      // the user confirms it in the modal — at that point the deal cascades
      // straight through to Post Tracker's default status (stage 5), matching
      // what the server now does, instead of resting at "Deal Agreed" first.
      return collaborationType !== undefined
        ? { ...item, pipelineStatus: "For Order Creation", ...collab, contactStatus: "for_order_creation", stage: 5, approvalStatus: "Approved" }
        : { ...item, pipelineStatus: newStatus, contactStatus: "agreed", stage: 4, approvalStatus: "Approved" }
    case "For Order Creation":
      return { ...item, pipelineStatus: newStatus, ...collab, contactStatus: "for_order_creation",stage: 5, approvalStatus: "Approved" }
    case "Not Interested":
      return {
        ...item, pipelineStatus: newStatus,
        contactStatus:  "not_interested",
        stage:          0,
        approvalStatus: "Declined",
        approvalNotes:  niReason || "Not interested",
        niReason:       niReason || "Not interested",
      }
    default:
      return { ...item, pipelineStatus: newStatus }
  }
}

export function usePipelineData(brandId?: string): UsePipelineDataReturn {
  // Shared cache key — returning to the board renders the cached cards at once
  // and only revalidates in the background.
  const cacheKey = brandId ? `/api/brand/${brandId}/pipeline` : null

  // Track in-flight PATCH requests, so a refetch is not fired while one is pending.
  const pendingRef = useRef(0)
  // Mirrored into state so the board can show a saving indicator while a write
  // is actually in flight (a ref alone never triggers a render).
  const [pendingWrites, setPendingWrites] = useState(0)

  // Bracketing the write bumps the cache's write generation, so a revalidation
  // that started before this mutation cannot overwrite the newer state when it
  // resolves. Called on both edges — a failed write matters just as much,
  // because the rollback is also newer than that in-flight response.
  const beginWrite = useCallback(() => {
    pendingRef.current += 1
    setPendingWrites((n) => n + 1)
    if (cacheKey) markCacheWrite(cacheKey)
  }, [cacheKey])

  const endWrite = useCallback(() => {
    pendingRef.current = Math.max(0, pendingRef.current - 1)
    setPendingWrites((n) => Math.max(0, n - 1))
    if (cacheKey) markCacheWrite(cacheKey)
  }, [cacheKey])

  // Optimistic writes go straight into the shared cache, which is also what the
  // board renders from — so a change survives navigating away and back.
  const setData = useCallback(
    (value: PipelineInfluencer[] | ((prev: PipelineInfluencer[]) => PipelineInfluencer[])) => {
      if (!cacheKey) return
      const prev = getCachedData<PipelineInfluencer[]>(cacheKey) ?? []
      const next = typeof value === "function" ? value(prev) : value
      setCachedData(cacheKey, next)
    },
    [cacheKey]
  )

  const fetchPipeline = useCallback(async (): Promise<PipelineInfluencer[]> => {
    const res = await fetch(`/api/brand/${brandId}/pipeline`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || "Failed to fetch pipeline data")
    }
    const json = await res.json()
    return (json.data || []).map(mapItem)
  }, [brandId])

  const { data: cached, error, isLoading, refetch } = useCachedFetch<PipelineInfluencer[]>(
    cacheKey,
    fetchPipeline
  )

  const data = cached ?? EMPTY_PIPELINE

  // ── Status update — optimistic, no loading flicker ────────────────────────
  const updateStatus = useCallback(
    async (id: string, newStatus: string, extra?: { niReason?: string; collaborationType?: string }): Promise<boolean> => {
      if (!brandId) return false

      // 1. Save the previous state of THIS row only. Rolling back a full-list
      //    snapshot would also revert every other row updated since this call
      //    started, which is what made a run of status changes (a bulk move, or
      //    several dropdowns in quick succession) appear to do nothing as soon
      //    as one of them failed.
      let previous: PipelineInfluencer | undefined

      // 2. Apply optimistic update immediately (no spinner)
      setData((prev) => {
        previous = prev.find((item) => item.id === id)
        const next = prev.map((item) =>
          item.id === id ? applyStatusChange(item, newStatus, extra?.niReason, extra?.collaborationType) : item
        )
        // Mirror into the shared cache so the change survives navigation.
        if (cacheKey) setCachedData(cacheKey, next)
        return next
      })

      // Restores just this row, leaving concurrent updates to other rows intact.
      const rollback = () => {
        if (!previous) return
        setData((prev) => prev.map((item) => (item.id === id ? previous! : item)))
      }

      beginWrite()

      try {
        const res = await fetch(`/api/brand/${brandId}/pipeline/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineStatus: newStatus,
            ...(extra?.niReason ? { niReason: extra.niReason } : {}),
            ...(extra?.collaborationType !== undefined ? { collaborationType: extra.collaborationType } : {}),
          }),
        })

        if (!res.ok) {
          // Server rejected — undo this row and say why, so a silent rollback
          // isn't the only signal the user gets.
          const err = await res.json().catch(() => ({}))
          console.error(`[pipeline] PATCH ${id} → ${newStatus} failed (${res.status}):`, err.error || res.statusText)
          rollback()
          return false
        }

        // Success — this board's own entry is already correct from the optimistic
        // update, so it is excluded. Every OTHER view of these rows (Influencer
        // List, Post Tracker, Brand Partners, Analytics) is now out of date and
        // is marked stale so opening it shows the new stage without a refresh.
        invalidateInfluencerDerivedCaches(brandId, [pipelineCacheKey(brandId)])
        return true
      } catch (err) {
        console.error(`[pipeline] PATCH ${id} → ${newStatus} failed:`, err)
        rollback()
        return false
      } finally {
        endWrite()
      }
    },
    [brandId, cacheKey, setData, beginWrite, endWrite]
  )

  return {
    data,
    // Only true before there is anything to show — a revalidation keeps the
    // board on screen.
    isLoading: Boolean(brandId) && isLoading,
    error,
    updateStatus,
    isSaving: pendingWrites > 0,
    // Public refetch (e.g. retry button) — no spinner so board stays visible.
    // Skipped while a write is in flight: its response would predate the
    // mutation, which is exactly what pendingRef is here to prevent.
    refetch: () => { if (pendingRef.current === 0) void refetch() },
  }
  
}


// hooks/useClosedData.ts
// FIXED: same pattern as usePipelineData
//   1. fetchData(showSpinner) — only shows spinner on initial load
//   2. updateColumn uses optimistic update with applyColumnChange()
//      that mirrors mapClosedToPipelineFields in the PATCH route
//   3. On success: NO refetch (state already correct)
//   4. On failure: silent rollback via snapshot
//   5. updatePaidCollab / updateCampaignType: same pattern

import { useState, useEffect, useCallback, useRef } from "react"

export type ClosedColumn =
  | "For Order Creation"
  | "In-Transit"
  | "Delivered"
  | "Posted"
  | "No post"

export interface ClosedInfluencer {
  id: string
  influencerId: string
  campaignId: string | null
  campaignName: string | null

  influencer: string
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

  closedStatus: ClosedColumn

  contactStatus: string
  stage: number | null
  orderStatus: string | null
  contentPosted: boolean
  approvalStatus: string | null
  approvalNotes: string | null

  scriptStatus: string | null
  contentStatus: string | null

  agreedRate: number | null
  currency: string | null
  deliverables: string | null
  deadline: string | null
  notes: string

  campaignType: string | null

  productDetails: string | null
  shippedAt: string | null
  deliveredAt: string | null
  trackingNumber: string | null

  postUrl: string | null
  postedAt: string | null
  likesCount: number
  commentsCount: number
  engagementCount: number

  paidCollabData: PaidCollabData | null

  internalRating: number | null
  lastContact: string
  createdAt: string
}

export interface PaidCollabData {
  contractEnabled: boolean
  contractStatus: string
  contractLink: string
  scriptEnabled: boolean
  postStatus: string
  deliverables: CollabDeliverable[]
  agreedRate: number
  payStructure: "upfront" | "5050" | "after" | "custom"
  milestoneStatuses: string[]
  milestoneProofLinks: string[]
}

export interface CollabDeliverable {
  id: number
  name: string
  scriptStatus: string
  scriptLink: string
  scriptRevs: { num: number; date: string; notes: string }[]
  contentStatus: string
  contentLink: string
  contentRevs: { num: number; date: string; notes: string }[]
}

interface UseClosedDataReturn {
  data: ClosedInfluencer[]
  isLoading: boolean
  error: string | null
  updateColumn: (id: string, newColumn: ClosedColumn) => Promise<boolean>
  updatePaidCollab: (id: string, paidCollabData: PaidCollabData) => Promise<boolean>
  updateCampaignType: (id: string, campaignType: string) => Promise<boolean>
  refetch: () => void
}

// ─── Infer script/content status from paidCollabData ─────────────────────────
function inferContentStatuses(inf: { paidCollabData?: PaidCollabData | null }) {
  const paid = inf.paidCollabData
  if (!paid?.deliverables?.length) return { scriptStatus: null, contentStatus: null }

  const scripts  = paid.deliverables.map((d) => d.scriptStatus)
  const contents = paid.deliverables.map((d) => d.contentStatus)

  return {
    scriptStatus: scripts.every((s) => s === "approved")
      ? "approved"
      : scripts.some((s) => ["pending", "revision_requested"].includes(s))
      ? "pending"
      : null,
    contentStatus: contents.every((s) => s === "approved")
      ? "approved"
      : contents.some((s) => ["pending", "revision_requested"].includes(s))
      ? "pending"
      : null,
  }
}

// ─── Mirror of mapClosedToPipelineFields in the PATCH route ──────────────────
// Keeps optimistic state 100% in sync with what the server will persist.
function applyColumnChange(
  item: ClosedInfluencer,
  newColumn: ClosedColumn
): ClosedInfluencer {
  const now = new Date().toISOString()

  switch (newColumn) {
    case "For Order Creation":
      return {
        ...item,
        closedStatus:   "For Order Creation",
        contactStatus:  "for_order_creation",
        stage:          5,
        orderStatus:    "pending",
        shippedAt:      null,
        deliveredAt:    null,
        contentPosted:  false,
        postedAt:       null,
        approvalStatus: "Approved",
        approvalNotes:  null,
      }

    case "In-Transit":
      return {
        ...item,
        closedStatus:   "In-Transit",
        contactStatus:  "for_order_creation",
        stage:          6,
        orderStatus:    "shipped",
        shippedAt:      item.shippedAt || now,
        deliveredAt:    null,
        contentPosted:  false,
        postedAt:       null,
        approvalStatus: "Approved",
      }

    case "Delivered":
      return {
        ...item,
        closedStatus:   "Delivered",
        contactStatus:  "for_order_creation",
        stage:          7,
        orderStatus:    "delivered",
        shippedAt:      item.shippedAt || null,
        deliveredAt:    item.deliveredAt || now,
        contentPosted:  false,
        postedAt:       null,
        approvalStatus: "Approved",
      }

    case "Posted":
      return {
        ...item,
        closedStatus:   "Posted",
        contactStatus:  "for_order_creation",
        stage:          8,
        orderStatus:    "delivered",
        shippedAt:      item.shippedAt || null,
        deliveredAt:    item.deliveredAt || now,
        contentPosted:  true,
        postedAt:       item.postedAt || now,
        approvalStatus: "Approved",
      }

    case "No post":
      return {
        ...item,
        closedStatus:   "No post",
        contactStatus:  "not_interested",
        stage:          0,
        orderStatus:    null,
        shippedAt:      null,
        deliveredAt:    null,
        contentPosted:  false,
        postedAt:       null,
        approvalStatus: "Declined",
        approvalNotes:  "No content published - exited",
      }

    default:
      return item
  }
}

// ─── Map raw API item to ClosedInfluencer ─────────────────────────────────────
function mapItem(inf: any): ClosedInfluencer {
  const base: ClosedInfluencer = {
    ...inf,
    closedStatus:
      inf.closedStatus === "For Order Creation" ||
      inf.contactStatus === "for_order_creation"
        ? "For Order Creation"
        : (inf.closedStatus as ClosedColumn) || "For Order Creation",
    ...inferContentStatuses(inf),
  }
  return base
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useClosedData(brandId?: string): UseClosedDataReturn {
  const [data,      setData]      = useState<ClosedInfluencer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const pendingRef  = useRef(0)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (showSpinner = true) => {
    if (!brandId) {
      setData([])
      setIsLoading(false)
      return
    }

    try {
      if (showSpinner) setIsLoading(true)
      setError(null)

      const res = await fetch(`/api/brand/${brandId}/closed`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Fetch failed")
      }

      const json = await res.json()
      const mapped = (json.data || []).map(mapItem)
      setData(mapped)
    } catch (err: any) {
      setError(err.message || "Error loading data")
    } finally {
      if (showSpinner) setIsLoading(false)
    }
  }, [brandId])

  useEffect(() => { fetchData(true) }, [fetchData])

  // ── Update Column (optimistic, no spinner) ────────────────────────────────
  const updateColumn = useCallback(
    async (id: string, newColumn: ClosedColumn): Promise<boolean> => {
      if (!brandId) return false

      let snapshot: ClosedInfluencer[] = []

      setData((prev) => {
        snapshot = prev
        return prev.map((item) =>
          item.id === id ? applyColumnChange(item, newColumn) : item
        )
      })

      pendingRef.current += 1

      try {
        const res = await fetch(`/api/brand/${brandId}/closed/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ closedStatus: newColumn }),
        })

        if (!res.ok) {
          setData(snapshot)
          return false
        }

        // ✅ State already correct — no refetch, no spinner
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

  // ── Update Paid Collab (optimistic) ───────────────────────────────────────
  const updatePaidCollab = useCallback(
    async (id: string, paidCollabData: PaidCollabData): Promise<boolean> => {
      if (!brandId) return false

      let snapshot: ClosedInfluencer[] = []

      setData((prev) => {
        snapshot = prev
        return prev.map((item) =>
          item.id !== id ? item : {
            ...item,
            paidCollabData,
            ...inferContentStatuses({ paidCollabData }),
          }
        )
      })

      try {
        const res = await fetch(`/api/brand/${brandId}/closed/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ paidCollabData }),
        })

        if (!res.ok) {
          setData(snapshot)
          return false
        }

        return true
      } catch {
        setData(snapshot)
        return false
      }
    },
    [brandId]
  )

  // ── Update Campaign Type (optimistic) ─────────────────────────────────────
  const updateCampaignType = useCallback(
    async (id: string, campaignType: string): Promise<boolean> => {
      if (!brandId) return false

      let snapshot: ClosedInfluencer[] = []

      setData((prev) => {
        snapshot = prev
        return prev.map((item) =>
          item.id !== id ? item : { ...item, campaignType }
        )
      })

      try {
        const res = await fetch(`/api/brand/${brandId}/closed/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ campaignType }),
        })

        if (!res.ok) {
          setData(snapshot)
          return false
        }

        return true
      } catch {
        setData(snapshot)
        return false
      }
    },
    [brandId]
  )

  return {
    data,
    isLoading,
    error,
    updateColumn,
    updatePaidCollab,
    updateCampaignType,
    refetch: () => fetchData(false), // background sync, no spinner
  }
}
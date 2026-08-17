// hooks/useClosedData.ts
// FIXED: same pattern as usePipelineData
//   1. fetchData(showSpinner) — only shows spinner on initial load
//   2. updateColumn uses optimistic update with applyColumnChange()
//      that mirrors mapClosedToPipelineFields in the PATCH route
//   3. On success: NO refetch (state already correct)
//   4. On failure: silent rollback via snapshot
//   5. updatePaidCollab / updateCampaignType: same pattern

import { useCallback, useRef } from "react"
import { useCachedFetch, getCachedData, setCachedData } from "@/lib/data-cache"
import { invalidateInfluencerDerivedCaches, closedCacheKey } from "@/lib/cache-invalidation"

/** Stable empty reference used before the first payload arrives. */
const EMPTY_CLOSED: ClosedInfluencer[] = []

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
  /**
   * Number of posts Automatic Post Detection has found for this influencer.
   * Counted from DetectedPost by the closed list route. 0 when detection has
   * found nothing yet or was never enabled.
   */
  detectedPostCount: number
  /** When detection last found a post, or null if it never has. */
  latestDetectedAt: string | null
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

/**
 * Result of a stage move. An object rather than a bare boolean so the caller
 * can distinguish "the write failed" from "Posted is terminal, and a reset
 * would be needed" — the two need different UI.
 */
export interface UpdateColumnResult {
  ok: boolean
  /** True when the server refused because the row is already Posted. */
  terminal?: boolean
  /** True when a reset was attempted without permission. */
  forbidden?: boolean
  error?: string
}

interface UseClosedDataReturn {
  data: ClosedInfluencer[]
  isLoading: boolean
  error: string | null
  updateColumn: (
    id: string,
    newColumn: ClosedColumn,
    options?: { resetWorkflow?: boolean }
  ) => Promise<UpdateColumnResult>
  updatePaidCollab: (id: string, paidCollabData: PaidCollabData) => Promise<boolean>
  updateCampaignType: (id: string, campaignType: string) => Promise<boolean>
  updatePostUrl: (id: string, postUrl: string) => Promise<boolean>
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

const VALID_COLUMNS: ClosedColumn[] = [
  "For Order Creation",
  "In-Transit",
  "Delivered",
  "Posted",
  "No post",
]

// ─── Map raw API item to ClosedInfluencer ─────────────────────────────────────
// The API's closedStatus is authoritative and is used verbatim. There is no
// client-side derivation and no default.
//
// This is where the "Posted reverts to For Order Creation after refresh" bug
// lived. The previous version re-derived the column on every load:
//
//     inf.closedStatus === "For Order Creation" ||
//     inf.contactStatus === "for_order_creation"   ← the bug
//       ? "For Order Creation"
//       : inf.closedStatus || "For Order Creation"
//
// Every non-exit stage maps to contact_status "for_order_creation" in the DB
// (see mapClosedToPipelineFields) — that column tracks the PIPELINE phase, not
// the Post Tracker stage. So a correctly saved "Posted" row came back from the
// API as "Posted" and was then rewritten to "For Order Creation" client-side.
// The database was never wrong; the client discarded the answer.
function mapItem(inf: any): ClosedInfluencer {
  const fromApi = inf.closedStatus as ClosedColumn | undefined

  if (!fromApi || !VALID_COLUMNS.includes(fromApi)) {
    // Loud, because it means the API contract broke. Silently substituting a
    // default here is exactly what hid the original bug.
    console.error(
      `[useClosedData] API returned an invalid closedStatus (${JSON.stringify(fromApi)}) ` +
        `for brandInfluencer ${inf?.id}. Rendering it as-is rather than guessing a stage.`
    )
  }

  return {
    ...inf,
    closedStatus: fromApi,
    ...inferContentStatuses(inf),
  } as ClosedInfluencer
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useClosedData(brandId?: string): UseClosedDataReturn {
  // Shared cache key — the tracker re-renders from cache on return visits and
  // revalidates in the background. Keying by brandId also removes the
  // stale-response race the manual ref-tracking used to guard against.
  const cacheKey = brandId ? `/api/brand/${brandId}/closed` : null

  const pendingRef  = useRef(0)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchClosed = useCallback(async (): Promise<ClosedInfluencer[]> => {
    const res = await fetch(`/api/brand/${brandId}/closed`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || "Fetch failed")
    }
    const json = await res.json()
    return (json.data || []).map(mapItem)
  }, [brandId])

  const { data: cached, error, isLoading, refetch } = useCachedFetch<ClosedInfluencer[]>(
    cacheKey,
    fetchClosed
  )

  // The shared cache is the rendered state, so optimistic writers just write to
  // it — local edits stay visible everywhere and survive navigation.
  const data = cached ?? EMPTY_CLOSED

  const setDataCached = useCallback(
    (value: React.SetStateAction<ClosedInfluencer[]>) => {
      if (!cacheKey) return
      const prev = getCachedData<ClosedInfluencer[]>(cacheKey) ?? []
      const next = typeof value === "function"
        ? (value as (p: ClosedInfluencer[]) => ClosedInfluencer[])(prev)
        : value
      setCachedData(cacheKey, next)
    },
    [cacheKey]
  )

  // ── Update Column (optimistic, no spinner) ────────────────────────────────
  const updateColumn = useCallback(
    async (
      id: string,
      newColumn: ClosedColumn,
      options?: { resetWorkflow?: boolean }
    ): Promise<UpdateColumnResult> => {
      if (!brandId) return { ok: false, error: "No brand selected" }

      let snapshot: ClosedInfluencer[] = []

      setDataCached((prev) => {
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
          body:    JSON.stringify({
            closedStatus: newColumn,
            ...(options?.resetWorkflow ? { resetWorkflow: true } : {}),
          }),
        })

        if (!res.ok) {
          // Roll the optimistic change back — the persisted stage is the truth.
          setDataCached(snapshot)
          const body = await res.json().catch(() => ({}))
          return {
            ok: false,
            // 409 = the row is Posted and Posted is terminal.
            terminal: res.status === 409 || Boolean(body.terminalState),
            forbidden: res.status === 403,
            error: body.error || "Failed to move",
          }
        }

        // ✅ This tracker's own entry is already correct from the optimistic
        // update; every other view of these rows (Pipeline, Influencer List,
        // Brand Partners, Analytics) is now stale and refreshes on next open.
        invalidateInfluencerDerivedCaches(brandId, [closedCacheKey(brandId!)])
        return { ok: true }
      } catch {
        setDataCached(snapshot)
        return { ok: false, error: "Network error" }
      } finally {
        pendingRef.current -= 1
      }
    },
    [brandId, setDataCached]
  )

  // ── Update Paid Collab (optimistic) ───────────────────────────────────────
  const updatePaidCollab = useCallback(
    async (id: string, paidCollabData: PaidCollabData): Promise<boolean> => {
      if (!brandId) return false

      let snapshot: ClosedInfluencer[] = []

      setDataCached((prev) => {
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
          setDataCached(snapshot)
          return false
        }

        invalidateInfluencerDerivedCaches(brandId, [closedCacheKey(brandId!)])
        return true
      } catch {
        setDataCached(snapshot)
        return false
      }
    },
    [brandId, setDataCached]
  )

  // ── Update Campaign Type (optimistic) ─────────────────────────────────────
  const updateCampaignType = useCallback(
    async (id: string, campaignType: string): Promise<boolean> => {
      if (!brandId) return false

      let snapshot: ClosedInfluencer[] = []

      setDataCached((prev) => {
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
          setDataCached(snapshot)
          return false
        }

        invalidateInfluencerDerivedCaches(brandId, [closedCacheKey(brandId!)])
        return true
      } catch {
        setDataCached(snapshot)
        return false
      }
    },
    [brandId, setDataCached]
  )

  // ── Update Post URL (optimistic) ──────────────────────────────────────────
  // Evidence that a post exists — the Posted stage requires it for manual moves.
  const updatePostUrl = useCallback(
    async (id: string, postUrl: string): Promise<boolean> => {
      if (!brandId) return false

      const trimmed = postUrl.trim()
      let snapshot: ClosedInfluencer[] = []

      setDataCached((prev) => {
        snapshot = prev
        return prev.map((item) =>
          item.id !== id ? item : { ...item, postUrl: trimmed || null }
        )
      })

      try {
        const res = await fetch(`/api/brand/${brandId}/closed/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ postUrl: trimmed }),
        })

        if (!res.ok) {
          setDataCached(snapshot)
          return false
        }

        invalidateInfluencerDerivedCaches(brandId, [closedCacheKey(brandId!)])
        return true
      } catch {
        setDataCached(snapshot)
        return false
      }
    },
    [brandId, setDataCached]
  )

  return {
    data,
    isLoading: Boolean(brandId) && isLoading,
    error,
    updateColumn,
    updatePaidCollab,
    updateCampaignType,
    updatePostUrl,
    refetch: () => { void refetch() }, // background sync, no spinner
  }
}
// hooks/useClosedData.ts
// FIXED: same pattern as usePipelineData
//   1. fetchData(showSpinner) — only shows spinner on initial load
//   2. updateColumn uses optimistic update with applyColumnChange()
//      that mirrors mapClosedToPipelineFields in the PATCH route
//   3. On success: NO refetch (state already correct)
//   4. On failure: silent rollback via snapshot
//   5. updatePaidCollab / updateCampaignType: same pattern

import { useCallback, useRef, useState } from "react"
import {
  useCachedFetch,
  getCachedData,
  setCachedData,
  markCacheWrite,
  beginExternalRequest,
  endExternalRequest,
  beginKeyWrite,
  endKeyWrite,
  beginRowWrite,
  isLatestRowWrite,
} from "@/lib/data-cache"
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

export interface OrderDetailsFields {
  /** Human-typed product note — kept separate from the Shopify-order JSON
   *  that shares the same underlying column. */
  note?: string
  trackingNumber?: string
  shippedAt?: string
  deliveredAt?: string
  deadline?: string
  currency?: string
  deliverables?: string
}

interface UseClosedDataReturn {
  data: ClosedInfluencer[]
  isLoading: boolean
  error: string | null
  updateColumn: (
    id: string,
    newColumn: ClosedColumn,
    options?: { resetWorkflow?: boolean; deferDerivedInvalidation?: boolean }
  ) => Promise<UpdateColumnResult>
  updatePaidCollab: (id: string, paidCollabData: PaidCollabData) => Promise<boolean>
  updateCampaignType: (id: string, campaignType: string) => Promise<boolean>
  updatePostUrl: (id: string, postUrl: string) => Promise<boolean>
  updateOrderDetails: (id: string, fields: OrderDetailsFields) => Promise<boolean>
  /** True while at least one write is in flight — drives the saving indicator. */
  isSaving: boolean
  /** True when the write that just finished failed, so the pill skips "Saved". */
  saveFailed: boolean
  /** Processing wording for the write in flight; null takes "Saving changes…". */
  saveMessage: string | null
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
/**
 * Fetch and shape a brand's Post Tracker rows — the exact value cached under
 * `/api/brand/{brandId}/closed`. Exported for lib/dashboard-prefetch, so the
 * prefetch stores the shaped rows rather than the raw response.
 */
export async function fetchClosedRows(brandId: string): Promise<ClosedInfluencer[]> {
  const res = await fetch(`/api/brand/${brandId}/closed`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Fetch failed")
  }
  const json = await res.json()
  return (json.data || []).map(mapItem)
}

export function useClosedData(brandId?: string): UseClosedDataReturn {
  // Shared cache key — the tracker re-renders from cache on return visits and
  // revalidates in the background. Keying by brandId also removes the
  // stale-response race the manual ref-tracking used to guard against.
  const cacheKey = brandId ? `/api/brand/${brandId}/closed` : null

  const pendingRef  = useRef(0)
  // Mirrored into state so the board can show a saving indicator while a write
  // is actually in flight (a ref alone never triggers a render).
  const [pendingWrites, setPendingWrites] = useState(0)
  // Whether the write that finished most recently failed. Read by the shared
  // SaveStatusPill so a failed save shows nothing instead of "Saved" — the
  // failure itself is still reported by the page's own notification.
  const [saveFailed, setSaveFailed] = useState(false)
  // What the shared SaveStatusPill says while a write is out. Null takes the
  // standard "Saving changes…"; a stage/status move names itself "Updating…"
  // so the wording matches the operation, as it does on every other screen.
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Bracketing the write bumps the cache's write generation, so a revalidation
  // that started before this mutation cannot overwrite the newer state when it
  // resolves. Both edges are marked — a rollback is also newer than that
  // in-flight response.
  const beginWrite = useCallback((message?: string) => {
    // Only the first write of a batch names it — a later one joining the same
    // in-flight window must not relabel what is already on screen.
    if (pendingRef.current === 0) setSaveMessage(message ?? null)
    pendingRef.current += 1
    setPendingWrites((n) => n + 1)
    setSaveFailed(false)
    // Counted into inFlightCount() so the background prefetch yields while a
    // save is in flight. These PATCHes do not go through the cache, so without
    // this the prefetch saw an idle app and took one of the three pooled
    // connections mid-write.
    // Also opens a per-key write window, so the board's freshness indicator
    // reports "Syncing…" for a SAVE and not only for a page load.
    beginExternalRequest()
    if (cacheKey) { markCacheWrite(cacheKey); beginKeyWrite(cacheKey) }
  }, [cacheKey])
  const endWrite = useCallback((succeeded = true) => {
    pendingRef.current = Math.max(0, pendingRef.current - 1)
    setPendingWrites((n) => Math.max(0, n - 1))
    if (!succeeded) setSaveFailed(true)
    endExternalRequest()
    // `succeeded` is what stops a failed save from stamping a fresh "updated"
    // time: the rollback writes to the cache too, and without this the
    // indicator would report a refresh that never happened.
    if (cacheKey) { markCacheWrite(cacheKey); endKeyWrite(cacheKey, succeeded) }
  }, [cacheKey])

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchClosed = useCallback(() => fetchClosedRows(brandId!), [brandId])

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
      options?: {
        resetWorkflow?: boolean
        /**
         * Skip marking the OTHER views stale after this row succeeds.
         *
         * A bulk move calls this once per row, and each call invalidated five
         * derived keys. The caller sets this and invalidates once at the end of
         * the run instead.
         */
        deferDerivedInvalidation?: boolean
      }
    ): Promise<UpdateColumnResult> => {
      if (!brandId) return { ok: false, error: "No brand selected" }

      // Claim this row's newest write and open the write window BEFORE the
      // optimistic change — see the note in usePipelineData.updateStatus.
      const writeSeq = cacheKey ? beginRowWrite(cacheKey, id) : 0
      beginWrite("Updating…")

      // Only THIS row is remembered for rollback. Restoring a whole-list
      // snapshot also reverted every other card moved since this call started,
      // so one failed move undid its neighbours' successful ones.
      let previous: ClosedInfluencer | undefined

      setDataCached((prev) => {
        previous = prev.find((item) => item.id === id)
        return prev.map((item) =>
          item.id === id ? applyColumnChange(item, newColumn) : item
        )
      })

      // Flipped by `rollback`, which every failure path calls and no success
      // path does. `endWrite(writeOk)` then keeps the previous "updated" time
      // on a failed save instead of stamping a refresh that did not happen.
      let writeOk = true
      const rollback = () => {
        writeOk = false
        // A later change to this row has already been applied, so this
        // snapshot is out of date: restoring it would undo the newer value.
        // See beginRowWrite in lib/data-cache.
        if (cacheKey && !isLatestRowWrite(cacheKey, id, writeSeq)) return
        if (!previous) return
        setDataCached((prev) => prev.map((item) => (item.id === id ? previous! : item)))
      }


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
          rollback()
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
        if (!options?.deferDerivedInvalidation) {
          invalidateInfluencerDerivedCaches(brandId, [closedCacheKey(brandId!)])
        }
        return { ok: true }
      } catch {
        rollback()
        return { ok: false, error: "Network error" }
      } finally {
        endWrite(writeOk)
      }
    },
    [brandId, cacheKey, setDataCached, beginWrite, endWrite]
  )

  // ── Update Paid Collab (optimistic) ───────────────────────────────────────
  const updatePaidCollab = useCallback(
    async (id: string, paidCollabData: PaidCollabData): Promise<boolean> => {
      if (!brandId) return false

      // Claim this row's newest write and open the write window BEFORE the
      // optimistic change — see the note in usePipelineData.updateStatus.
      const writeSeq = cacheKey ? beginRowWrite(cacheKey, id) : 0
      beginWrite()

      // Per-row rollback — see updateColumn.
      let previous: ClosedInfluencer | undefined

      setDataCached((prev) => {
        previous = prev.find((item) => item.id === id)
        return prev.map((item) =>
          item.id !== id ? item : {
            ...item,
            paidCollabData,
            ...inferContentStatuses({ paidCollabData }),
          }
        )
      })

      // Flipped by `rollback`, which every failure path calls and no success
      // path does. `endWrite(writeOk)` then keeps the previous "updated" time
      // on a failed save instead of stamping a refresh that did not happen.
      let writeOk = true
      const rollback = () => {
        writeOk = false
        // A later change to this row has already been applied, so this
        // snapshot is out of date: restoring it would undo the newer value.
        // See beginRowWrite in lib/data-cache.
        if (cacheKey && !isLatestRowWrite(cacheKey, id, writeSeq)) return
        if (!previous) return
        setDataCached((prev) => prev.map((item) => (item.id === id ? previous! : item)))
      }

      // Bracketed like updateColumn. Without it this write never bumped the
      // cache's write generation, so a background revalidation that started
      // before it could resolve afterwards and put the old value back — and the
      // saving indicator never showed for it either.
      try {
        const res = await fetch(`/api/brand/${brandId}/closed/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ paidCollabData }),
        })

        if (!res.ok) {
          rollback()
          return false
        }

        invalidateInfluencerDerivedCaches(brandId, [closedCacheKey(brandId!)])
        return true
      } catch {
        rollback()
        return false
      } finally {
        endWrite(writeOk)
      }
    },
    [brandId, cacheKey, setDataCached, beginWrite, endWrite]
  )

  // ── Update Campaign Type (optimistic) ─────────────────────────────────────
  const updateCampaignType = useCallback(
    async (id: string, campaignType: string): Promise<boolean> => {
      if (!brandId) return false

      // Claim this row's newest write and open the write window BEFORE the
      // optimistic change — see the note in usePipelineData.updateStatus.
      const writeSeq = cacheKey ? beginRowWrite(cacheKey, id) : 0
      beginWrite()

      // Per-row rollback — see updateColumn.
      let previous: ClosedInfluencer | undefined

      setDataCached((prev) => {
        previous = prev.find((item) => item.id === id)
        return prev.map((item) =>
          item.id !== id ? item : { ...item, campaignType }
        )
      })

      // Flipped by `rollback`, which every failure path calls and no success
      // path does. `endWrite(writeOk)` then keeps the previous "updated" time
      // on a failed save instead of stamping a refresh that did not happen.
      let writeOk = true
      const rollback = () => {
        writeOk = false
        // A later change to this row has already been applied, so this
        // snapshot is out of date: restoring it would undo the newer value.
        // See beginRowWrite in lib/data-cache.
        if (cacheKey && !isLatestRowWrite(cacheKey, id, writeSeq)) return
        if (!previous) return
        setDataCached((prev) => prev.map((item) => (item.id === id ? previous! : item)))
      }

      // Bracketed like updateColumn. Without it this write never bumped the
      // cache's write generation, so a background revalidation that started
      // before it could resolve afterwards and put the old value back — and the
      // saving indicator never showed for it either.
      try {
        const res = await fetch(`/api/brand/${brandId}/closed/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ campaignType }),
        })

        if (!res.ok) {
          rollback()
          return false
        }

        invalidateInfluencerDerivedCaches(brandId, [closedCacheKey(brandId!)])
        return true
      } catch {
        rollback()
        return false
      } finally {
        endWrite(writeOk)
      }
    },
    [brandId, cacheKey, setDataCached, beginWrite, endWrite]
  )

  // ── Update Post URL (optimistic) ──────────────────────────────────────────
  // Evidence that a post exists — the Posted stage requires it for manual moves.
  const updatePostUrl = useCallback(
    async (id: string, postUrl: string): Promise<boolean> => {
      if (!brandId) return false

      const trimmed = postUrl.trim()
      // Claim this row's newest write and open the write window BEFORE the
      // optimistic change — see the note in usePipelineData.updateStatus.
      const writeSeq = cacheKey ? beginRowWrite(cacheKey, id) : 0
      beginWrite()

      // Per-row rollback — see updateColumn.
      let previous: ClosedInfluencer | undefined

      setDataCached((prev) => {
        previous = prev.find((item) => item.id === id)
        return prev.map((item) =>
          item.id !== id ? item : { ...item, postUrl: trimmed || null }
        )
      })

      // Flipped by `rollback`, which every failure path calls and no success
      // path does. `endWrite(writeOk)` then keeps the previous "updated" time
      // on a failed save instead of stamping a refresh that did not happen.
      let writeOk = true
      const rollback = () => {
        writeOk = false
        // A later change to this row has already been applied, so this
        // snapshot is out of date: restoring it would undo the newer value.
        // See beginRowWrite in lib/data-cache.
        if (cacheKey && !isLatestRowWrite(cacheKey, id, writeSeq)) return
        if (!previous) return
        setDataCached((prev) => prev.map((item) => (item.id === id ? previous! : item)))
      }

      // Bracketed like updateColumn. Without it this write never bumped the
      // cache's write generation, so a background revalidation that started
      // before it could resolve afterwards and put the old value back — and the
      // saving indicator never showed for it either.
      try {
        const res = await fetch(`/api/brand/${brandId}/closed/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ postUrl: trimmed }),
        })

        if (!res.ok) {
          rollback()
          return false
        }

        invalidateInfluencerDerivedCaches(brandId, [closedCacheKey(brandId!)])
        return true
      } catch {
        rollback()
        return false
      } finally {
        endWrite(writeOk)
      }
    },
    [brandId, cacheKey, setDataCached, beginWrite, endWrite]
  )

  // ── Update Order Details (optimistic) ─────────────────────────────────────
  // Everything the Post Tracker's "Order" tab Save button covers except
  // stage — that stays on updateColumn, the same path the Stage dropdown
  // uses, so the two never disagree about what stage this influencer is in.
  const updateOrderDetails = useCallback(
    async (id: string, fields: OrderDetailsFields): Promise<boolean> => {
      if (!brandId) return false

      // Claim this row's newest write and open the write window BEFORE the
      // optimistic change — see the note in usePipelineData.updateStatus.
      const writeSeq = cacheKey ? beginRowWrite(cacheKey, id) : 0
      beginWrite()

      // Per-row rollback, matching every other mutation in this hook. This one
      // kept a WHOLE-LIST snapshot and restored it on failure, which also
      // reverted any other row written while this request was in flight — a
      // bulk stage move running in the background, for instance.
      let previous: ClosedInfluencer | undefined

      setDataCached((prev) => {
        previous = prev.find((item) => item.id === id)
        return prev.map((item) => {
          if (item.id !== id) return item
          return {
            ...item,
            ...(fields.trackingNumber !== undefined && { trackingNumber: fields.trackingNumber || null }),
            ...(fields.shippedAt !== undefined && { shippedAt: fields.shippedAt || null }),
            ...(fields.deliveredAt !== undefined && { deliveredAt: fields.deliveredAt || null }),
            ...(fields.deadline !== undefined && { deadline: fields.deadline || null }),
            ...(fields.currency !== undefined && { currency: fields.currency || null }),
            ...(fields.deliverables !== undefined && { deliverables: fields.deliverables || null }),
          }
        })
      })

      // Flipped by `rollback`, which every failure path calls and no success
      // path does. `endWrite(writeOk)` then keeps the previous "updated" time
      // on a failed save instead of stamping a refresh that did not happen.
      let writeOk = true
      const rollback = () => {
        writeOk = false
        // A later change to this row has already been applied, so this
        // snapshot is out of date: restoring it would undo the newer value.
        // See beginRowWrite in lib/data-cache.
        if (cacheKey && !isLatestRowWrite(cacheKey, id, writeSeq)) return
        if (!previous) return
        setDataCached((prev) => prev.map((item) => (item.id === id ? previous! : item)))
      }

      // Bracketed like updateColumn. Without it this write never bumped the
      // cache's write generation, so a background revalidation that started
      // before it could resolve afterwards and put the old value back — and the
      // saving indicator never showed for it either.
      try {
        const res = await fetch(`/api/brand/${brandId}/closed/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(fields),
        })

        if (!res.ok) {
          rollback()
          return false
        }

        invalidateInfluencerDerivedCaches(brandId, [closedCacheKey(brandId!)])
        return true
      } catch {
        rollback()
        return false
      } finally {
        endWrite(writeOk)
      }
    },
    [brandId, cacheKey, setDataCached, beginWrite, endWrite]
  )

  return {
    data,
    isLoading: Boolean(brandId) && isLoading,
    error,
    updateColumn,
    updatePaidCollab,
    updateCampaignType,
    updatePostUrl,
    updateOrderDetails,
    isSaving: pendingWrites > 0,
    saveFailed,
    saveMessage,
    // Skipped while a write is in flight: its response would predate the
    // mutation, which is what pendingRef is here to prevent.
    refetch: () => { if (pendingRef.current === 0) void refetch() }, // background sync, no spinner
  }
}
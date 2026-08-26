// hooks/usePipelineData.ts
// FIXED:
//   1. refetch() no longer sets isLoading=true (eliminates board flicker)
//   2. On successful PATCH, we update local state directly — no refetch needed
//   3. Only refetch (silently) on failure to restore correct server state

import { useCallback, useRef, useState } from "react"
import {
  useCachedFetch,
  getCachedData,
  setCachedData,
  markCacheWrite,
  invalidateCache,
  beginExternalRequest,
  endExternalRequest,
  beginKeyWrite,
  endKeyWrite,
} from "@/lib/data-cache"
import { invalidateInfluencerDerivedCaches, pipelineCacheKey, closedCacheKey } from "@/lib/cache-invalidation"
import type { ClosedInfluencer } from "@/hooks/useClosedData"

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
  updateStatus: (
    id: string,
    newStatus: string,
    extra?: {
    niReason?: string
    collaborationType?: string
    /**
     * Skip marking the OTHER views stale after this row succeeds.
     *
     * A bulk move calls this once per row, and each call invalidated five
     * derived keys — a 20-row move did that a hundred times, and every one
     * of them re-marked the Post Tracker entry the same run had just
     * seeded. The caller sets this and invalidates once when the run ends.
     */
    deferDerivedInvalidation?: boolean
  }
  ) => Promise<boolean>
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

/**
 * The Post Tracker's entry stage. A row lands here the moment a Collaboration
 * Type is confirmed on Deal Agreed, or on an explicit move to For Order
 * Creation — the two writes that hand an influencer over to Post Tracker.
 */
const POST_TRACKER_ENTRY = "For Order Creation"

/**
 * Build the Post Tracker's row shape from the Pipeline row being moved.
 *
 * Every value comes from the record already in hand; the fields left null / 0
 * are the ones the closed route itself returns null / 0 for a row at the entry
 * stage — nothing has shipped, nothing is posted, detection has found nothing.
 * The background revalidation that follows replaces this with the server's own
 * mapping either way, so this only has to be right for the seconds in between.
 */
function toClosedRow(item: PipelineInfluencer, collaborationType?: string): ClosedInfluencer {
  return {
    id:              item.id,
    influencerId:    item.influencerId,
    campaignId:      item.campaignId,
    campaignName:    item.campaignName,

    influencer:      item.influencer,
    handle:          item.handle,
    platform:        item.platform,
    followers:       item.followers,
    followerCount:   item.followerCount,
    engagementRate:  item.engagementRate,
    niche:           item.niche,
    location:        item.location,
    email:           item.email,
    profileImageUrl: item.profileImageUrl,
    bio:             "",

    closedStatus:    POST_TRACKER_ENTRY,

    contactStatus:   "for_order_creation",
    stage:           5,
    orderStatus:     item.orderStatus,
    contentPosted:   false,
    approvalStatus:  "Approved",
    approvalNotes:   item.approvalNotes ?? "",

    scriptStatus:    null,
    contentStatus:   null,

    agreedRate:      item.agreedRate,
    currency:        item.currency,
    deliverables:    item.deliverables,
    deadline:        item.deadline,
    notes:           item.notes,

    campaignType:    collaborationType ?? item.collabType ?? null,
    productDetails:  null,

    shippedAt:       null,
    deliveredAt:     null,
    trackingNumber:  null,

    postUrl:         null,
    postedAt:        null,

    detectedPostCount: 0,
    latestDetectedAt:  null,
    likesCount:        0,
    commentsCount:     0,
    engagementCount:   0,

    paidCollabData:  null,

    internalRating:  item.internalRating,
    lastContact:     item.lastContact,
    createdAt:       item.createdAt,
  }
}

/** Matches the Pipeline route's own follower formatting. */
function formatFollowers(n: number): string {
  if (!n) return "0"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return String(n)
}

/**
 * The fields an approved Influencer List row carries into the Pipeline cache.
 * Deliberately narrow: the caller passes what the list already has, nothing is
 * fetched to build it.
 */
export type ApprovedRowSeed = {
  /** BrandInfluencer.id — the Pipeline board's row id. */
  brandInfluencerId: string
  /** Influencer.id — the Influencer List's row id. */
  influencerId: string
  name: string
  handle: string
  platform: string
  followerCount: number
  engagementRate: number
  niche: string
  location: string
  email: string
  profileImageUrl: string | null
  notes: string
  approvalNotes: string | null
}

/**
 * Put a just-approved influencer into the Pipeline cache so the board shows it
 * the moment it is opened, with no wait on `/pipeline`.
 *
 * Approving writes approval_status "Approved" at stage 1, which the Pipeline
 * route derives as "For Outreach" — the column this row is placed in.
 *
 * Only an entry that already exists is touched: writing into a missing one would
 * leave the board rendering a single row as if it were the whole pipeline. The
 * entry is then marked stale, so the board still revalidates on open and the
 * server's own mapping replaces this. Returns true when a row was added.
 */
export function seedPipelineFromApproval(brandId: string, seedRow: ApprovedRowSeed): boolean {
  const key = pipelineCacheKey(brandId)
  const rows = getCachedData<PipelineInfluencer[]>(key)
  if (!rows) return false

  const existing = rows.find((r) => r.id === seedRow.brandInfluencerId)
  markCacheWrite(key)

  if (existing) {
    // Already on the board (a re-approval, or a Declined row being approved
    // again): correct the fields the approval changed, leave the rest.
    setCachedData(
      key,
      rows.map((r) =>
        r.id === seedRow.brandInfluencerId
          ? { ...r, approvalStatus: "Approved", pipelineStatus: r.pipelineStatus === "Not Interested" ? "For Outreach" : r.pipelineStatus }
          : r
      )
    )
    invalidateCache(key)
    markCacheWrite(key)
    return false
  }

  const row: PipelineInfluencer = {
    id:              seedRow.brandInfluencerId,
    influencerId:    seedRow.influencerId,
    campaignId:      null,
    campaignName:    null,
    influencer:      seedRow.name,
    instagramHandle:  seedRow.handle,
    handle:          seedRow.handle,
    platform:        seedRow.platform,
    followers:       formatFollowers(seedRow.followerCount),
    followerCount:   seedRow.followerCount,
    engagementRate:  `${seedRow.engagementRate.toFixed(1)}%`,
    avgLikes:        null,
    avgComments:     null,
    avgViews:        null,
    niche:           seedRow.niche,
    location:        seedRow.location,
    email:           seedRow.email,
    profileImageUrl: seedRow.profileImageUrl,
    // What approval persists: stage 1 / not yet contacted, which the board
    // derives as For Outreach.
    pipelineStatus:  "For Outreach",
    contactStatus:   "not_contacted",
    stage:           1,
    orderStatus:     null,
    contentPosted:   false,
    approvalStatus:  "Approved",
    approvalNotes:   seedRow.approvalNotes,
    agreedRate:      null,
    currency:        null,
    deliverables:    null,
    deadline:        null,
    notes:           seedRow.notes,
    internalRating:  null,
    lastContact:     new Date().toISOString(),
    createdAt:       new Date().toISOString(),
    affiliateId:     null,
    refCode:         null,
    coupon:          null,
    sparkAds:        null,
    affiliateLink:   null,
    clicks:          0,
    salesCount:      0,
    gmv:             0,
  }

  setCachedData(key, [...rows, row])
  // Kept stale so the board still revalidates on open, as after any other
  // cross-module write.
  invalidateCache(key)
  markCacheWrite(key)
  return true
}

/** Undo a seed when the approval write turns out to have failed. */
export function unseedPipelineRow(brandId: string, brandInfluencerId: string): void {
  const key = pipelineCacheKey(brandId)
  const rows = getCachedData<PipelineInfluencer[]>(key)
  if (!rows) return
  markCacheWrite(key)
  setCachedData(key, rows.filter((r) => r.id !== brandInfluencerId))
  invalidateCache(key)
  markCacheWrite(key)
}

/**
 * Fetch and shape a brand's pipeline rows — the exact value cached under
 * `pipelineCacheKey(brandId)`.
 *
 * Exported for lib/dashboard-prefetch: the prefetch must store the SHAPED rows,
 * not the raw response, or the board would read a payload it cannot render.
 */
export async function fetchPipelineRows(brandId: string): Promise<PipelineInfluencer[]> {
  const res = await fetch(`/api/brand/${brandId}/pipeline`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Failed to fetch pipeline data")
  }
  const json = await res.json()
  return (json.data || []).map(mapItem)
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
    endExternalRequest()
    // `succeeded` is what stops a failed save from stamping a fresh "updated"
    // time: the rollback writes to the cache too, and without this the
    // indicator would report a refresh that never happened.
    if (cacheKey) { markCacheWrite(cacheKey); endKeyWrite(cacheKey, succeeded) }
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

  const fetchPipeline = useCallback(
    () => fetchPipelineRows(brandId!),
    [brandId]
  )

  const { data: cached, error, isLoading, refetch } = useCachedFetch<PipelineInfluencer[]>(
    cacheKey,
    fetchPipeline
  )

  const data = cached ?? EMPTY_PIPELINE

  // ── Status update — optimistic, no loading flicker ────────────────────────
  const updateStatus = useCallback(
    async (
      id: string,
      newStatus: string,
      extra?: {
        niReason?: string
        collaborationType?: string
        /**
         * Skip marking the OTHER views stale after this row succeeds.
         *
         * A bulk move calls this once per row, and each call invalidated five
         * derived keys — a 20-row move did that a hundred times, and every one
         * of them re-marked the Post Tracker entry the same run had just
         * seeded. The caller sets this and invalidates once when the run ends.
         */
        deferDerivedInvalidation?: boolean
      }
    ): Promise<boolean> => {
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
        // No setCachedData here: `setData` above already writes what this
        // updater returns. Writing inside the updater as well meant every
        // optimistic change hit the cache twice and notified every subscriber
        // twice, and it put a side effect inside a function whose only job is
        // to compute the next value.
        return prev.map((item) =>
          item.id === id ? applyStatusChange(item, newStatus, extra?.niReason, extra?.collaborationType) : item
        )
      })

      // ── Hand the row to Post Tracker's cache at the same moment ──────────
      // Deal Agreed with a Collaboration Type (and an explicit For Order
      // Creation move) lands the row at Post Tracker's entry stage. Inserting
      // it into the closed entry here means opening Post Tracker renders the
      // card immediately instead of waiting on its own fetch.
      //
      // Only an entry that already exists is touched: writing into a missing
      // one would leave Post Tracker rendering a single-row list as if it were
      // the whole board. With no entry there is nothing to keep in step — the
      // normal fetch on open still applies.
      const closedKey = brandId ? closedCacheKey(brandId) : null
      const entersPostTracker =
        newStatus === POST_TRACKER_ENTRY ||
        (newStatus === "Deal Agreed" && extra?.collaborationType !== undefined)

      let seededClosed = false
      if (closedKey && entersPostTracker && previous) {
        const closedRows = getCachedData<ClosedInfluencer[]>(closedKey)
        if (closedRows && !closedRows.some((row) => row.id === id)) {
          markCacheWrite(closedKey)
          setCachedData(closedKey, [...closedRows, toClosedRow(previous, extra?.collaborationType)])
          // NOT invalidated here — that is what made the seeded card disappear.
          //
          // invalidateCache sets updatedAt = 0, so the entry read as stale the
          // instant it was seeded. Opening Post Tracker during the PATCH then
          // fetched (a closed GET is ~400ms, this PATCH ~1.3s), and that
          // response — server state from before the write landed — had no such
          // row, so it replaced the seeded one and the card vanished.
          //
          // Left FRESH instead: useCachedFetch skips its mount fetch for a
          // fresh entry, and revalidateOnFocus checks staleness too, so nothing
          // starts a fetch for it while the write is out. The invalidation then
          // happens exactly once, below, after the PATCH settles.
          //
          // beginKeyWrite additionally makes fetchCached discard any response
          // for this key while the write is pending — covering an explicit
          // refetch(), which forces past freshness.
          beginKeyWrite(closedKey)
          seededClosed = true
        }
      }

      // Restores just this row, leaving concurrent updates to other rows intact.
      // Flipped by `rollback`, which every failure path calls and no success
      // path does. `endWrite(writeOk)` then keeps the previous "updated" time
      // on a failed save instead of stamping a refresh that did not happen.
      let writeOk = true
      const rollback = () => {
        writeOk = false
        if (previous) {
          setData((prev) => prev.map((item) => (item.id === id ? previous! : item)))
        }
        // The seeded card goes with it — the same rollback the Pipeline row gets.
        if (seededClosed && closedKey) {
          const closedRows = getCachedData<ClosedInfluencer[]>(closedKey)
          if (closedRows) {
            // Bumped BEFORE the write, matching the seed path above. Bumping
            // afterwards left a window in which a revalidation that resolved
            // between the write and the bump was still accepted, putting the
            // rolled-back card back on the board.
            markCacheWrite(closedKey)
            setCachedData(closedKey, closedRows.filter((row) => row.id !== id))
            // No invalidateCache here: the `finally` below does it once, after
            // the write window closes, whether this succeeded or rolled back.
          } else {
            markCacheWrite(closedKey)
          }
        }
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
        if (!extra?.deferDerivedInvalidation) {
          invalidateInfluencerDerivedCaches(brandId, [pipelineCacheKey(brandId)])
        }
        return true
      } catch (err) {
        console.error(`[pipeline] PATCH ${id} → ${newStatus} failed:`, err)
        rollback()
        return false
      } finally {
        endWrite(writeOk)
        if (seededClosed && closedKey) {
          // Close the generation window on the Post Tracker entry too, so a
          // revalidation that started while this write was in flight cannot
          // land afterwards and drop the seeded card.
          markCacheWrite(closedKey)
          // The write is no longer pending, so responses for this key are
          // accepted again.
          endKeyWrite(closedKey)
          // The one invalidation for this seed, deferred from the seed itself
          // to here: by now the row is either persisted (success) or removed
          // again (rollback), so a revalidation can only confirm the truth
          // rather than race it. Post Tracker still revalidates on open,
          // exactly as it did before — just not mid-write.
          invalidateCache(closedKey)
        }
      }
    },
    [brandId, setData, beginWrite, endWrite]
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


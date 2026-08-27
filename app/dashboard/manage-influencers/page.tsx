// app/dashboard/manage-influencers/page.tsx
"use client"

import { useState, useRef, Suspense, useCallback, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import TableSheet, {
  type InfluencerRow,
  type CustomColumn,
  type BulkApprovalResult,
} from "@/components/table-sheet"
import { useInfluencerData } from "@/hooks/useInfluencerData"
import { seedPipelineFromApproval, unseedPipelineRow, fetchPipelineRows, type ApprovedRowSeed } from "@/hooks/usePipelineData"
import { useBrandCapabilities } from "@/hooks/useBrandCapabilities"
import { fetchCached, hasCachedData, beginExternalRequest, endExternalRequest, beginKeyWrite, endKeyWrite } from "@/lib/data-cache"
import { invalidateInfluencerDerivedCaches } from "@/lib/cache-invalidation"
import { LimitExceededDialog } from "@/components/limit-exceeded-dialog"
import { WorkspaceUnavailableModal } from "@/components/workspace-unavailable-modal"
import { TableSkeleton } from "@/components/shared/skeletons"
import { STATUS_LABEL } from "@/components/table-sheet/constants"
import { IconLoader2 } from "@tabler/icons-react"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function rowHasHandle(row: InfluencerRow): boolean {
  const handle = row.handle?.trim().replace(/^@/, "")
  return !!(handle && handle.length > 0 && row.platform)
}

function buildCreatePayload(row: InfluencerRow, brandId: string) {
  return {
    handle: row.handle.trim().replace(/^@/, ""),
    platform: row.platform,
    full_name: row.full_name || row.first_name || null,
    email: row.contact_info || row.email || null,
    gender: row.gender || null,
    niche: row.niche || null,
    location: row.location || null,
    bio: row.bio || null,
    profile_image_url: row.profile_image_url || null,
    social_link: row.social_link || null,
    follower_count: parseInt(String(row.follower_count)) || 0,
    engagement_rate: parseFloat(String(row.engagement_rate)) || 0,
    avg_likes: parseInt(String(row.avg_likes)) || 0,
    avg_comments: parseInt(String(row.avg_comments)) || 0,
    avg_views: parseInt(String(row.avg_views)) || 0,
    brandId,
  }
}

function buildUpdatePayload(row: InfluencerRow) {
  const existingLastName = row.full_name
    ? row.full_name.split(" ").slice(1).join(" ")
    : ""
  const rebuiltFullName = row.first_name
    ? existingLastName
      ? `${row.first_name} ${existingLastName}`
      : row.first_name
    : row.full_name || null

  return {
    full_name: rebuiltFullName,
    email: row.contact_info || row.email || null,
    gender: row.gender || null,
    niche: row.niche || null,
    location: row.location || null,
    bio: row.bio || null,
    profile_image_url: row.profile_image_url || null,
    social_link: row.social_link || null,
    follower_count: parseInt(String(row.follower_count)) || 0,
    engagement_rate: parseFloat(String(row.engagement_rate)) || 0,
    avg_likes: parseInt(String(row.avg_likes)) || 0,
    avg_comments: parseInt(String(row.avg_comments)) || 0,
    avg_views: parseInt(String(row.avg_views)) || 0,
    contact_status: row.contact_status,
    stage: parseInt(String(row.stage)) || 1,
    agreed_rate: row.agreed_rate || null,
    notes: row.notes || null,
    approval_status: row.approval_status,
    approval_notes: row.approval_notes || null,
    transferred_date: row.transferred_date || null,
  }
}

/** Where an approval decision lands the influencer on the Pipeline board. */
const APPROVAL_DESTINATION: Record<string, string> = {
  Approved: "For Outreach",
  Declined: "Not Interested",
}

/**
 * The Pipeline cache's view of a just-approved row, built entirely from what the
 * Influencer List already holds — nothing is fetched. `brand_influencer_id` is
 * the Pipeline board's row id (the list's own `id` is the Influencer id).
 */
function approvalSeed(row: InfluencerRow): ApprovedRowSeed | null {
  if (!row.brand_influencer_id) return null
  return {
    brandInfluencerId: row.brand_influencer_id,
    influencerId:      row.id,
    name:              row.full_name || row.handle,
    handle:            row.handle,
    platform:          row.platform,
    followerCount:     Number(row.follower_count) || 0,
    engagementRate:    Number(row.engagement_rate) || 0,
    niche:             row.niche || "",
    location:          row.location || "",
    email:             row.contact_info || row.email || "",
    profileImageUrl:   row.profile_image_url || null,
    notes:             row.notes || "",
    approvalNotes:     row.approval_notes || null,
  }
}

/** Discrete lifecycle fields — a change to one of these is saved immediately. */
const LIFECYCLE_FIELDS = ["approval_status", "contact_status", "stage", "transferred_date"] as const

// ─────────────────────────────────────────────────────────────────────────────
// Serial PUT queue
// ─────────────────────────────────────────────────────────────────────────────

/** What the PUT route reports back about the row it persisted. */
type SavedInfluencer = { handle?: string | null; platform?: string | null }

type QueueItem = {
  url: string
  payload: string
  /** Confirmation shown when this save lands (e.g. "handle moved to Approved"). */
  message?: string | null
  /**
   * Confirmation built from the persisted row instead of a fixed string, so the
   * result names the influencer the DATABASE stored. Used when there is no
   * lifecycle `message` — which is where the generic "Changes saved" came from.
   */
  messageFromSaved?: (saved: SavedInfluencer) => string | null
  onError?: (status: number) => void
  /** Runs after the row was persisted — used to refresh the views derived from it. */
  onSuccess?: () => void
}

/**
 * `onRequest` brackets each real PUT, so the save indicator reflects the request
 * actually in flight — not the debounce window before it, and not a timer.
 */
function createPutQueue(
  onRequest?: (phase: "start" | "ok" | "fail", message?: string | null) => void,
  /**
   * The cache key these PUTs mutate, so the list's freshness indicator reports
   * "Syncing…" for a save and not only for a page load. A function, because the
   * queue outlives any single brandId.
   */
  cacheKeyFor?: () => string | null
) {
  const queue: QueueItem[] = []
  let running = false

  async function run() {
    if (running) return
    running = true
    while (queue.length > 0) {
      const item = queue.shift()!
      onRequest?.("start", item.message)
      // Counted into the shared cache's in-flight total so the background
      // dashboard prefetch yields while this request is out. These PUTs do not
      // go through fetchCached, so without this the prefetch saw an idle app
      // and took one of the three pooled database connections mid-save.
      beginExternalRequest()
      const writeKey = cacheKeyFor?.() ?? null
      if (writeKey) beginKeyWrite(writeKey)
      let writeOk = false
      try {
        const res = await fetch(item.url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: item.payload,
        })
        if (res.ok) {
          const saved = (await res.json().catch(() => ({}))) as SavedInfluencer
          item.onSuccess?.()
          onRequest?.("ok", item.message ?? item.messageFromSaved?.(saved) ?? null)
          writeOk = true
        }
        else { item.onError?.(res.status); onRequest?.("fail") }
      } catch {
        // Network error — silent
        onRequest?.("fail")
      } finally {
        endExternalRequest()
        // writeOk is false for a rejected response and for a network error, so a
        // failed save keeps the previous "updated" time.
        if (writeKey) endKeyWrite(writeKey, writeOk)
      }
    }
    running = false
  }

  return {
    enqueue(item: QueueItem) {
      const existing = queue.findIndex((q) => q.url === item.url)
      if (existing >= 0) queue[existing] = item
      else queue.push(item)
      run()
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function InfluencersContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawBrandId = searchParams.get("brandId")
  const brandId = rawBrandId?.trim() || null

  const { rows, customColumns, isLoading, error, refetch, setCustomColumns } =
    useInfluencerData(brandId)
  const { canManageInfluencers, canApproveInfluencers } = useBrandCapabilities(brandId)

  // ── Auto-select owned brand if no brandId provided ──────────────────────────
  useEffect(() => {
    if (brandId) return
    const autoSelectBrand = async () => {
      try {
        // Same shared cache entry the workspace switcher uses, so this does not
        // duplicate a request that has usually already been made.
        const data = await fetchCached<{ brands?: any[] }>("/api/brand/list", async () => {
          const res = await fetch("/api/brand/list")
          if (!res.ok) throw new Error(`Failed to load brands (${res.status})`)
          return res.json()
        })
        {
          const brands = data.brands || []
          const ownedBrand = brands.find((b: any) => b.owner === true)
          if (ownedBrand) {
            router.push(`/dashboard/manage-influencers?brandId=${ownedBrand.id}`)
          }
        }
      } catch {
        // Silent fail
      }
    }
    autoSelectBrand()
  }, [brandId, router])

  // ── Warm the Pipeline entry ───────────────────────────────────────────────
  // Approving here is supposed to put the card on the Pipeline board
  // immediately, via seedPipelineFromApproval. That function refuses to write
  // into a MISSING pipeline cache entry, and rightly so: a single row written
  // into nothing would leave the board rendering one card as if it were the
  // whole pipeline.
  //
  // But that made the very case the feature exists for fail. In a fresh session
  // the user opens the Influencer List and approves before anything has read the
  // pipeline, so there is no entry, the seed is skipped, and the card only turns
  // up when the board fetches for itself on open. The dashboard prefetch does
  // warm it — but it is idle-gated, serial, and pipeline is fifth of seven, so
  // it can be ten seconds or more away.
  //
  // Read once here, through the shared cache: `fetchCached` skips a fresh entry
  // and joins an in-flight one, so this is the SAME request the prefetch would
  // have made, not an extra one. This is the page whose approvals feed that
  // board, so it is the page that should have it ready.
  useEffect(() => {
    if (!brandId) return
    const key = `/api/brand/${brandId}/pipeline`
    if (hasCachedData(key)) return
    void fetchCached(key, () => fetchPipelineRows(brandId)).catch(() => {
      // Speculative: the board still loads for itself, and an approval made
      // before this lands behaves exactly as it did before.
    })
  }, [brandId])

  // ── dbIds: real DB IDs confirmed saved for this brand ─────────────────────
  const dbIds = useRef<Set<string>>(new Set())

  // What was last persisted for each row, so an edit only re-sends the rows that
  // actually changed. Seeded from every payload the server returns.
  const lastSentPayloads = useRef<Map<string, string>>(new Map())

  // Seeded from every payload, not just the first one: latching after the first
  // non-loading render meant rows that arrived later (a background refresh, or
  // rows created elsewhere) were never registered, so `scheduleUpdate` returned
  // early and their edits — an approval included — were never sent to the DB at
  // all, while the table went on showing the new value until the next reload.
  useEffect(() => {
    if (!brandId) return
    rows.forEach((r) => {
      if (r.id.startsWith("temp-")) return
      dbIds.current.add(r.id)
      // Server payload = the current database state for this row. Only set it
      // when absent so a pending local edit is still detected as a change.
      if (!lastSentPayloads.current.has(r.id)) {
        lastSentPayloads.current.set(r.id, JSON.stringify(buildUpdatePayload(r)))
      }
    })
  }, [rows, brandId])

  // ── Brand name for modal ───────────────────────────────────────────────────
  const [selectedBrandName, setSelectedBrandName] = useState<string>("")
  useEffect(() => {
    if (!brandId) return
    const fetchBrandName = async () => {
      try {
        const data = await fetchCached<{ brands?: any[] }>(
          `/api/brands/me?brandId=${brandId}`,
          async () => {
            const res = await fetch(`/api/brands/me?brandId=${brandId}`)
            if (!res.ok) throw new Error(`Failed to load brand (${res.status})`)
            return res.json()
          }
        )
        const brand = data.brands?.find((b: any) => b.id === brandId)
        if (brand) setSelectedBrandName(brand.name)
      } catch {
        // Silent fail
      }
    }
    fetchBrandName()
  }, [brandId])

  // ── Prevent PUT storm on mount ────────────────────────────────────────────
  const readyToSave = useRef(false)
  useEffect(() => {
    if (!isLoading) {
      const t = setTimeout(() => { readyToSave.current = true }, 800)
      return () => clearTimeout(t)
    }
  }, [isLoading])

  // ── Save status (bottom indicator) ────────────────────────────────────────
  // Same two-part pattern as the Pipeline board and the Post Tracker: a dark
  // "Saving" pill while a request is in flight, replaced by the outcome
  // notification once it settles (3s, as `showToast` uses there).
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const savingCount = useRef(0)
  const failedSinceIdle = useRef(false)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pendingMessage = useRef<string | null>(null)

  const reportSave = useCallback((phase: "start" | "ok" | "fail", message?: string | null) => {
    if (phase === "start") {
      if (message) pendingMessage.current = message
      savingCount.current += 1
      failedSinceIdle.current = failedSinceIdle.current && savingCount.current > 1
      if (noticeTimer.current) { clearTimeout(noticeTimer.current); noticeTimer.current = null }
      setNotice(null)
      setIsSaving(true)
      return
    }
    // An outcome may carry its own confirmation — the PUT queue passes the
    // handle the database reported, which is only known once the response is
    // back. It supersedes whatever `start` guessed.
    if (phase === "ok" && message) pendingMessage.current = message
    if (phase === "fail") failedSinceIdle.current = true
    savingCount.current = Math.max(0, savingCount.current - 1)
    if (savingCount.current > 0) return

    const failed = failedSinceIdle.current
    failedSinceIdle.current = false
    // The pill goes the moment the request is done — no lingering saving state.
    setIsSaving(false)
    // Same wording as the Pipeline board and Post Tracker: "<influencer> moved
    // to <destination>" for a stage/approval move, and their plain failure line
    // otherwise.
    const confirmation = pendingMessage.current
    pendingMessage.current = null
    // A success with nothing specific to report shows nothing. The generic
    // "Changes saved" line is gone: every save path that lands here either
    // carries its own confirmation (the lifecycle move, or the handle the PUT
    // response reported) or already raised its own notification — where the
    // generic line was a second, vaguer toast on top of it.
    if (!failed && !confirmation) return
    setNotice({
      message: failed ? "Failed to save" : confirmation!,
      type: failed ? "error" : "success",
    })
    noticeTimer.current = setTimeout(() => setNotice(null), 3000)
  }, [])

  // Wraps any save that doesn't go through the PUT queue (create, bulk approve,
  // delete) so every path feeds the same indicator.
  const trackSave = useCallback(
    async <T,>(op: () => Promise<T>, succeeded: (result: T) => boolean): Promise<T> => {
      reportSave("start")
      try {
        const result = await op()
        reportSave(succeeded(result) ? "ok" : "fail")
        return result
      } catch (err) {
        reportSave("fail")
        throw err
      }
    },
    [reportSave]
  )

  /**
   * The one notification on this page.
   *
   * `reportSave` already owns the green toast for every save path. The table
   * had a SECOND system of its own — a stacking top-right container
   * with pale backgrounds and its own icons (components/table-sheet/toast.tsx) —
   * so Approve, Import and fetch messages looked nothing like "… moved to For
   * Outreach". This routes those through the same single `notice`, which
   * replaces rather than stacks because it is one value, not a list.
   *
   * Only a real error takes the red state. Warnings and info are still
   * information, not failures, so they read as the standard toast.
   */
  const notify = useCallback((type: "success" | "error" | "warning" | "info", message: string) => {
    if (noticeTimer.current) { clearTimeout(noticeTimer.current); noticeTimer.current = null }
    setNotice({ message, type: type === "error" ? "error" : "success" })
    noticeTimer.current = setTimeout(() => setNotice(null), 3000)
  }, [])

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  // ── Queues and timers ─────────────────────────────────────────────────────
  // brandIdRef, not brandId: the queue is created once and must read the brand
  // in effect at the time each request runs, not the one at first render.
  const brandIdRef = useRef(brandId)
  brandIdRef.current = brandId
  const putQueue = useRef(
    createPutQueue(reportSave, () =>
      brandIdRef.current ? `/api/brand/${brandIdRef.current}/influencers` : null
    )
  )
  const updateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ── savedHandles: "handle@platform" keys already saved or in-flight ───────
  // This is the ONLY dedup guard. Once set, we never POST again for this handle.
  const savedHandles = useRef<Set<string>>(new Set())

  // ── tempToReal: maps temp row ID → real DB ID after createRow resolves ────
  const tempToReal = useRef<Map<string, string>>(new Map())

  // ── manualRows: rows the API could not fill in, so the user is filling them ─
  // An Instagram/TikTok row is normally written by TableSheet once its lookup
  // succeeds. When the lookup comes back with nothing, that never happens — and
  // the row would be unsaveable no matter what the user typed into it. Its id
  // lands here instead (via onLookupFailed), which tells handleRowsChange to
  // treat it like any manually entered row from here on.
  //
  // Membership alone saves nothing: the create still waits for a real edit, so a
  // failed lookup the user walks away from is not persisted.
  const manualRows = useRef<Set<string>>(new Set())

  const idSwapCallback = useRef<((tempId: string, realId: string) => void) | null>(null)

  const { data: session } = useSession()

  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false)
  const [showWorkspaceUnavailableModal, setShowWorkspaceUnavailableModal] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    status: string
    isExpired: boolean
    subscription?: { plan?: { name?: string } } | null
  } | null>(null)
  const [showTrialLimitModal, setShowTrialLimitModal] = useState(false)

  const handleWorkspaceUnavailableClose = () => {
    setShowWorkspaceUnavailableModal(false)
    router.push("/dashboard")
  }

  // ── Fetch subscription status for trial limit detection ────────────────────
  useEffect(() => {
    if (!session?.user?.id) return
    // Shares the entry useSubscriptionStatus fills, so the status is fetched
    // once per user rather than again on every visit to this page.
    fetchCached<{ status: string; isExpired: boolean }>(
      `/api/subscription/status?user=${session.user.id}`,
      async () => {
        const res = await fetch("/api/subscription/status")
        if (!res.ok) throw new Error(`Failed to load subscription status (${res.status})`)
        return res.json()
      }
    )
      .then(data => setSubscriptionStatus(data))
      .catch(() => setSubscriptionStatus({ status: "inactive", isExpired: false }))
  }, [session?.user?.id])

  // ── scheduleUpdate: debounced PUT for already-saved rows ──────────────────
  // `handleRowsChange` receives the WHOLE table on every edit and calls this for
  // every row, so without the payload comparison below a single approval queued
  // one full-payload PUT per row in the list (150 rows → 150 serialised
  // requests, repeated on the next edit). Comparing against what was last sent
  // reduces an edit to one request for the row that actually changed.
  const scheduleUpdate = useCallback(
    (row: InfluencerRow) => {
      if (!brandId || !dbIds.current.has(row.id)) return

      const payload = JSON.stringify(buildUpdatePayload(row))
      const lastSent = lastSentPayloads.current.get(row.id)
      if (lastSent === payload) return // nothing changed on this row

      const existing = updateTimers.current.get(row.id)
      if (existing) clearTimeout(existing)

      const url = `/api/brand/${brandId}/influencers/${row.id}`
      const handle = row.handle

      // Typing needs the debounce; a discrete lifecycle action (approve/decline,
      // status, stage, review date) does not — those go straight out so the save
      // finishes while the user is still looking at the row.
      const prevApprovalStatus = (() => {
        if (!lastSent) return null
        try { return (JSON.parse(lastSent) as { approval_status?: string }).approval_status ?? null }
        catch { return null }
      })()

      const { discrete, moveMessage } = (() => {
        if (!lastSent) return { discrete: false, moveMessage: null as string | null }
        try {
          const prev = JSON.parse(lastSent)
          const next = JSON.parse(payload)
          const changed = LIFECYCLE_FIELDS.filter((f) => prev[f] !== next[f])
          if (!changed.length) return { discrete: false, moveMessage: null as string | null }
          // Destination is the pipeline column the row actually lands in, not
          // the approval verdict: approving puts an influencer in For Outreach
          // (stage 1), declining puts it in Not Interested. Anything else reads
          // the funnel stage label.
          const approvalDestination = changed.includes("approval_status")
            ? APPROVAL_DESTINATION[String(next.approval_status)] ?? null
            : null
          const destination = approvalDestination ?? STATUS_LABEL[String(next.contact_status)] ?? null
          const who = row.handle?.trim() || row.full_name?.trim() || "Influencer"
          return {
            discrete: true,
            moveMessage: destination ? `${who} moved to ${destination}` : null,
          }
        } catch { return { discrete: false, moveMessage: null as string | null } }
      })()

      // An approval is what puts a row on the Pipeline board, so the board's
      // cache is seeded as the write goes out — opening Pipeline then shows the
      // card with no wait on /pipeline. Undone below if the write fails.
      const seed = row.approval_status === "Approved" ? approvalSeed(row) : null
      const seedsPipeline = Boolean(seed) && discrete && prevApprovalStatus !== "Approved"

      const timer = setTimeout(() => {
        updateTimers.current.delete(row.id)
        if (!dbIds.current.has(row.id)) return
        const seeded = seedsPipeline && brandId ? seedPipelineFromApproval(brandId, seed!) : false
        putQueue.current.enqueue({
          url,
          payload,
          message: moveMessage,
          // This queue only ever UPDATES a row that is already in the list, so
          // it reports an edit — "added to Influencer List" belongs to the
          // create path alone (createRow, below), which is what actually puts a
          // fetched influencer in the list. The handle comes from the PUT
          // response, not from this row's local copy.
          messageFromSaved: (saved) => {
            const savedHandle = saved.handle?.trim()
            return savedHandle ? `@${savedHandle} details updated` : null
          },
          // An approval or stage edit here changes what Pipeline, Post Tracker,
          // Brand Partners and Analytics should show. Their cached entries are
          // marked stale so those pages pick the change up on open — this
          // page's own entry is already correct from the inline edit.
          onSuccess() {
            // This payload is now what the database holds, so it becomes the
            // baseline the next edit is compared against.
            lastSentPayloads.current.set(row.id, payload)
            // Every derived view is stale now — and so is this page's own entry,
            // because the row it holds was written locally. Marking it stale too
            // (data is kept, so nothing blanks out) means the next read comes
            // from the database rather than from the optimistic edit.
            invalidateInfluencerDerivedCaches(brandId)
          },
          onError(status) {
            // The approval did not persist, so take the seeded card back off the
            // board — same rollback rule the Pipeline's own writes follow.
            if (seeded && brandId && row.brand_influencer_id) {
              unseedPipelineRow(brandId, row.brand_influencer_id)
            }
            if (status === 404) {
              dbIds.current.delete(row.id)
              notify("error", `Could not save @${handle} — not found. Try refreshing.`)
            } else if (status !== 503) {
              notify("error", `Save failed (${status})`)
            }
          },
        })
      }, discrete ? 0 : 1500)

      updateTimers.current.set(row.id, timer)
    },
    [brandId, notify]
  )

  // ── createRow: POST to create influencer + swap temp ID → real ID ─────────
  const createRow = useCallback(
    async (row: InfluencerRow, skipToast = false): Promise<string | null> => {
      if (!brandId || !rowHasHandle(row)) return null

      const handle = row.handle.trim().replace(/^@/, "")
      const key = `${handle}@${row.platform}`

      // Already saved or in-flight — skip
      if (savedHandles.current.has(key)) return null
      savedHandles.current.add(key)

      try {
        reportSave("start")
        const res = await fetch("/api/influencers/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildCreatePayload(row, brandId)),
        }).then(
          (r) => { reportSave(r.ok || r.status === 409 ? "ok" : "fail"); return r },
          (e) => { reportSave("fail"); throw e }
        )

        if (res.ok) {
          const created = await res.json()
          const realId: string = created.id || created.influencer_id

          dbIds.current.add(realId)
          tempToReal.current.set(row.id, realId)
          idSwapCallback.current?.(row.id, realId)

          // A newly linked influencer appears in the pipeline and in analytics
          // scope, so those views must not keep serving their old payload.
          invalidateInfluencerDerivedCaches(brandId)

          if (!skipToast) notify("success", `@${handle} added to Influencer List`)
          return realId

        } else if (res.status === 409) {
          // Already exists globally — API links it to this brand
          const body = await res.json().catch(() => ({}))
          const existingId: string = body.id || body.influencer_id || row.id

          dbIds.current.add(existingId)
          tempToReal.current.set(row.id, existingId)
          if (existingId !== row.id) idSwapCallback.current?.(row.id, existingId)

          // Linking an existing influencer to this brand widens what the other
          // views cover, so refresh them too.
          invalidateInfluencerDerivedCaches(brandId)
          return existingId

        } else if (res.status === 403) {
          const body = await res.json().catch(() => ({}))
          if (body.requiresSubscription) {
            // Show trial-specific modal if user is on trial
            if (body.subscriptionStatus === "trialing") {
              setShowTrialLimitModal(true)
            } else {
              setShowSubscriptionDialog(true)
            }
          } else {
            notify("error", body.error || "Influencer limit reached")
          }
          savedHandles.current.delete(key)
          return null

        } else {
          const body = await res.json().catch(() => ({}))
          if (!skipToast) notify("error", body.details || body.error || `Failed to save @${handle}`)
          savedHandles.current.delete(key)
          return null
        }
      } catch {
        if (!skipToast) notify("error", `Network error saving @${handle}`)
        savedHandles.current.delete(`${handle}@${row.platform}`)
        return null
      }
    },
    [brandId, reportSave, notify]
  )

  // ── handleFetchComplete ───────────────────────────────────────────────────
  // TableSheet calls this after the Instroom API enriches a row with real stats.
  // This is the PRIMARY save trigger for Instagram / TikTok manual adds.
  //
  // Flow:
  //   A) Row already in DB (existing influencer loaded on mount) → PUT update
  //   B) Row is new + createRow already resolved → tempToReal has realId → PUT
  //   C) Row is new + createRow hasn't been called yet → createRow(enrichedRow)
  //   D) createRow is in-flight (savedHandles set, tempToReal not yet) → do
  //      nothing; the POST already on its way carries this same enriched row.
  //      Reachable only when two completions land for one row before the first
  //      POST resolves — createRow is no longer called from anywhere that runs
  //      before a lookup succeeds, so there is no pre-enrichment POST to
  //      out-race any more.
  const handleFetchComplete = useCallback(
    async (row: InfluencerRow) => {
      if (!brandId || !rowHasHandle(row)) return

      const handle = row.handle.trim().replace(/^@/, "")
      const key = `${handle}@${row.platform}`

      // Case A — row is already in the DB with its own real ID
      if (dbIds.current.has(row.id)) {
        const existing = updateTimers.current.get(row.id)
        if (existing) clearTimeout(existing)
        putQueue.current.enqueue({
          url: `/api/brand/${brandId}/influencers/${row.id}`,
          payload: JSON.stringify(buildUpdatePayload(row)),
        })
        return
      }

      // Case B — createRow resolved; temp ID was mapped to realId
      const realId = tempToReal.current.get(row.id)
      if (realId) {
        putQueue.current.enqueue({
          url: `/api/brand/${brandId}/influencers/${realId}`,
          payload: JSON.stringify(buildUpdatePayload({ ...row, id: realId })),
        })
        return
      }

      // Case C — createRow hasn't been called yet; create now with enriched data
      if (!savedHandles.current.has(key)) {
        await createRow(row)
        return
      }

      // Case D — createRow is in-flight; nothing to do right now. The POST
      // already carries this enriched row, and once it resolves the row has a
      // real ID, so any later edit goes through scheduleUpdate.
    },
    [brandId, createRow]
  )

  // ── handleBulkApprove ─────────────────────────────────────────────────────
  // One request for the whole selection instead of one debounced PUT per row.
  // The route applies the writes in a transaction and returns the persisted
  // rows, which TableSheet then renders; the derived caches are marked stale
  // exactly once for the batch.
  const handleBulkApprove = useCallback(
    async (influencerIds: string[]): Promise<BulkApprovalResult | null> => {
      if (!brandId || influencerIds.length === 0) return null
      try {
        const res = await trackSave(
          () => fetch(`/api/brand/${brandId}/influencers/bulk-approval`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ influencerIds }),
          }),
          (r) => r.ok
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          notify("error", body.error === "Forbidden"
            ? "Only Owners and Managers can approve influencers"
            : `Bulk approval failed (${res.status})`)
          return null
        }
        const result = (await res.json()) as BulkApprovalResult
        // Persisted rows only — `failed` ids are never seeded. Each row's
        // profile fields come from the table, its ids from the response.
        result.updated.forEach((saved) => {
          const row = rows.find((r) => r.id === saved.influencer_id)
          if (!row) return
          const seed = approvalSeed({ ...row, brand_influencer_id: saved.id })
          if (seed) seedPipelineFromApproval(brandId, seed)
        })
        invalidateInfluencerDerivedCaches(brandId)
        return result
      } catch {
        notify("error", "Bulk approval failed — check your connection and try again")
        return null
      }
    },
    [brandId, trackSave, rows, notify]
  )

  // ── handleLookupFailed ────────────────────────────────────────────────────
  // TableSheet reports a lookup that returned no data. The row stays exactly as
  // it is and nothing is saved here; it simply becomes eligible to save the way
  // a YouTube or Twitter row already is, on the user's next edit.
  const handleLookupFailed = useCallback((rowId: string) => {
    manualRows.current.add(rowId)
  }, [])

  // ── handleRowsChange ──────────────────────────────────────────────────────
  // Called on every table edit (keystroke, dropdown change, etc.)
  //
  // For Instagram/TikTok rows this creates NOTHING. The row is written by
  // TableSheet's own saveRowToDatabase, which runs only after
  // autoFetchInfluencer has a profile in hand, and reaches this file as
  // handleFetchComplete.
  //
  // There used to be a 5-second fallback timer here that called createRow if no
  // enriched row had arrived by then. It was a safety net for "the API never
  // answered", but it could not tell that case apart from the two ordinary ones
  // — the lookup is still running, or it came back not-found — so it saved in
  // all three. Typing a handle and picking a platform was enough to persist a
  // row whose lookup had failed or had not finished, and the save indicator
  // appeared while the fetch was still in flight. Waiting for a successful
  // lookup is now the only path.
  //
  // The trade-off, stated plainly: if a lookup neither succeeds nor fails, the
  // row stays unsaved and is lost on refresh. That is the intended behaviour
  // here — an influencer with no verified profile data is not written.
  const handleRowsChange = useCallback(
    (updatedRows: InfluencerRow[]) => {
      if (!readyToSave.current) return

      updatedRows.forEach((row) => {
        if (!rowHasHandle(row)) return

        // ── Already in DB — just debounce-update
        if (dbIds.current.has(row.id)) {
          scheduleUpdate(row)
          return
        }

        const handle = row.handle.trim().replace(/^@/, "")
        const key = `${handle}@${row.platform}`

        // Already saved or in-flight — nothing to do
        if (savedHandles.current.has(key)) return

        const isApiPlatform = row.platform === "instagram" || row.platform === "tiktok"

        if (!isApiPlatform) {
          // YouTube, Twitter, etc. — no enrichment, save immediately
          createRow(row)
          return
        }

        // Instagram / TikTok — the lookup owns the create, EXCEPT for a row the
        // lookup already gave up on. That one is the user's to complete, so an
        // edit to it saves like any manual row.
        if (manualRows.current.has(row.id)) {
          createRow(row)
          return
        }

        // Otherwise nothing: the lookup has not run, is still running, or is
        // about to write this row itself through handleFetchComplete. Editing
        // the handle or switching the platform must not write anything.
      })
    },
    [scheduleUpdate, createRow]
  )

  // ── handleImportRows — bulk import, bypasses enrichment wait ─────────────
  const handleImportRows = useCallback(
    async (importedRows: InfluencerRow[]) => {
      if (!brandId) return
      const validRows = importedRows.filter(rowHasHandle)
      if (!validRows.length) return

      let savedCount = 0
      let skippedCount = 0

      const BATCH = 5
      for (let i = 0; i < validRows.length; i += BATCH) {
        const batch = validRows.slice(i, i + BATCH)
        await Promise.all(
          batch.map(async (row) => {
            const realId = await createRow(row, true)
            if (realId) savedCount++
            else skippedCount++
          })
        )
      }

      if (savedCount > 0)
        notify("success", 
          `Imported ${savedCount} influencer${savedCount !== 1 ? "s" : ""}${
            skippedCount ? ` (${skippedCount} skipped — duplicates or limit reached)` : ""
          }`
        )
      else if (skippedCount > 0)
        notify("warning", `${skippedCount} rows skipped — already exist or limit reached`)
    },
    [brandId, createRow, notify]
  )

  // ── handleDeleteRow ───────────────────────────────────────────────────────
  const handleDeleteRow = useCallback(
    async (rowId: string) => {
      if (!brandId) return

      manualRows.current.delete(rowId)

      // Cancel any pending update for this row
      const update = updateTimers.current.get(rowId)
      if (update) { clearTimeout(update); updateTimers.current.delete(rowId) }

      // If the row was never saved to DB (still temp), just clean up refs
      if (!dbIds.current.has(rowId)) {
        tempToReal.current.delete(rowId)
        return
      }

      try {
        const res = await trackSave(
          () => fetch(`/api/brand/${brandId}/influencers/${rowId}`, { method: "DELETE" }),
          (r) => r.ok || r.status === 404
        )
        if (res.ok || res.status === 404) {
          dbIds.current.delete(rowId)
          tempToReal.current.delete(rowId)
          invalidateInfluencerDerivedCaches(brandId)
          if (res.ok) notify("success", "Influencer removed")
        } else {
          const body = await res.json().catch(() => ({}))
          notify("error", body.error || "Failed to delete")
        }
      } catch {
        notify("error", "Network error — could not delete")
      }
    },
    [brandId, trackSave, notify]
  )

  // ── handleCustomColumnsChange ─────────────────────────────────────────────
  const handleCustomColumnsChange = useCallback(
    async (cols: CustomColumn[]) => {
      setCustomColumns(cols)
      if (!brandId) return
      for (const col of cols) {
        try {
          const res = await fetch(`/api/brand/${brandId}/custom-fields`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              field_name: col.field_name,
              field_key: col.field_key,
              field_type: col.field_type,
              field_options: col.field_options ?? [],
              assignedGroup: col.assignedGroup,
              description: col.description ?? "",
            }),
          })
          // A rejected column was silently dropped before: the header stayed on
          // screen while nothing was persisted.
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            console.error("[custom-fields] save failed:", res.status, body.error)
            notify("error", body.error || `Could not save the "${col.field_name}" column`)
          }
        } catch (err) {
          console.error("[custom-fields] error:", err)
          notify("error", `Could not save the "${col.field_name}" column`)
        }
      }
    },
    [brandId, setCustomColumns, notify]
  )

  // ─────────────────────────────────────────────────────────────────────────

  if (!brandId) {
    return (
              <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="flex flex-col items-center gap-5 max-w-sm w-full px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
              <svg
                className="w-7 h-7 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-semibold text-gray-900">No brand selected</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Choose a brand from the dropdown above to view and manage its influencers.
              </p>
            </div>
          </div>
        </div>
    )
  }

  if (error) {
    const isSubscriptionExpired = error.toLowerCase().includes("subscription expired")
    const isWorkspaceUnavailable =
      error.toLowerCase().includes("workspace is unavailable") ||
      error.toLowerCase().includes("subscription is inactive")

    if (isSubscriptionExpired) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Subscription Expired</h2>
              <p className="text-sm text-gray-600 mt-2">
                Your subscription has expired. Please renew it to access your workspace and
                continue working with your influencers.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-900">
                Renew your subscription now to regain full access to all features.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => (window.location.href = "/pricing")}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
              >
                Renew Subscription
              </button>
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (isWorkspaceUnavailable) {
      return (
        <WorkspaceUnavailableModal
          open={true}
          onOpenChange={setShowWorkspaceUnavailableModal}
          workspaceName={selectedBrandName || "Workspace"}
          onClose={handleWorkspaceUnavailableClose}
        />
      )
    }

    // A Retry button, matching the Post Tracker's error state. Without it this
    // screen was a dead end for a failure that is usually transient — the
    // database refusing another connection, which the route now reports as a
    // retryable 503 — and the only way out was a full page reload.
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-2 font-medium">Failed to load influencers</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 text-[13px] px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6 relative min-h-screen">
      {isLoading ? (
        <TableSkeleton rows={10} cols={7} label="Fetching data..." />
      ) : (
        <TableSheet
          initialRows={rows}
          initialCustomColumns={customColumns}
          onRowsChange={handleRowsChange}
          onDeleteRow={handleDeleteRow}
          onFetchComplete={handleFetchComplete}
          onCustomColumnsChange={handleCustomColumnsChange}
          onImportRows={handleImportRows}
          onBulkApprove={handleBulkApprove}
          onRegisterIdSwap={(fn) => {
            idSwapCallback.current = fn
          }}
          brandId={brandId}
          subscriptionStatus={subscriptionStatus}
          onShowTrialModal={() => setShowTrialLimitModal(true)}
          // Every message the table raises lands in this page's single toast.
          onNotify={notify}
          onLookupFailed={handleLookupFailed}
          readOnly={!canManageInfluencers}
          canApproveInfluencers={canApproveInfluencers}
        />
      )}

      {/* The saving pill only — bottom-right, identical to the Pipeline board
          and Post Tracker. The outcome moved to the top dock below. */}
      <div className="notice-dock">
        {isSaving && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900/90 text-white text-xs font-medium shadow-lg animate-in fade-in">
            <IconLoader2 size={12} className="animate-spin" />
            Saving
          </div>
        )}
      </div>

      {/* Outcome floating at the top right (`.notice-dock-top`,
          app/globals.css) — the answer the user was waiting for, where they
          are actually looking. h-9 is the toolbar Search field's height, so
          the two match without forcing the message to a fixed width. Slides
          in from the top to match the edge it now enters from; timing,
          wording and dismissal are untouched. */}
      <div className="notice-dock-top">
        {notice && (
          <div className={`flex h-9 max-w-full items-center rounded-lg px-3 shadow-lg text-white text-sm font-medium whitespace-nowrap animate-in slide-in-from-top-2 ${notice.type === "error" ? "bg-red-600" : "bg-[#1FAE5B]"}`}>
            <span className="truncate">{notice.message}</span>
          </div>
        )}
      </div>

      <LimitExceededDialog
        isOpen={showSubscriptionDialog}
        onClose={() => setShowSubscriptionDialog(false)}
        limitType="influencer"
        current={0}
        max={null}
        title="Subscription Required"
        description="You need a paid plan to add influencers."
        message="Subscribe to a paid plan to start adding influencers to your brand."
      />

      <WorkspaceUnavailableModal
        open={showWorkspaceUnavailableModal}
        onOpenChange={setShowWorkspaceUnavailableModal}
        onClose={handleWorkspaceUnavailableClose}
        workspaceName={selectedBrandName}
      />

      {showTrialLimitModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* Overlay covering only content area (not sidebar/navbar) */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(10,20,15,0.45)", backdropFilter: "blur(1px)" }}
            onClick={() => setShowTrialLimitModal(false)}
          />
          
          {/* Card centered on overlay */}
          <div
            className="flex flex-col items-center gap-6 rounded-2xl px-8 py-9 text-center relative"
            style={{
              background: "rgba(255,255,255,0.98)",
              boxShadow:
                "0 2px 0px rgba(15,107,62,0.08) inset, 0 32px 72px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(31,174,91,0.2)",
              maxWidth: 380,
              width: "88%",
              borderRadius: 20,
            }}
          >
            {/* Clock icon */}
            <div
              className="flex items-center justify-center"
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(145deg, #fef3c7 0%, #fde68a 100%)",
                boxShadow: "0 1px 3px rgba(180,83,9,0.15), 0 0 0 1px rgba(180,83,9,0.1)",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#b45309"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            {/* Text */}
            <div className="flex flex-col gap-2">
              <h2
                className="text-xl font-semibold leading-tight"
                style={{ color: "#111827", letterSpacing: "-0.025em" }}
              >
                Import/Export unavailable on Basic plan
              </h2>
              <p
                className="text-sm leading-relaxed mx-auto"
                style={{ color: "#6b7280", maxWidth: 280 }}
              >
                You're currently on the Basic plan. Upgrade to Solo or Team to import or export influencers.
              </p>
            </div>

            {/* Plan pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {["Solo", "Team"].map((plan) => (
                <span
                  key={plan}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide"
                  style={{
                    background: "#f0faf5",
                    color: "#0F6B3E",
                    border: "1px solid #c3e6d4",
                    letterSpacing: "0.03em",
                  }}
                >
                  {plan}
                </span>
              ))}
            </div>

            {/* CTA */}
            <a
              href="/pricing"
              className="block w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg,#22c55e 0%,#0F6B3E 100%)",
                boxShadow: "0 4px 16px rgba(15,107,62,0.32), 0 1px 0 rgba(255,255,255,0.15) inset",
              }}
            >
              View pricing & upgrade
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InfluencersPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} cols={7} label="Fetching data..." />}>
      <InfluencersContent />
    </Suspense>
  )
}
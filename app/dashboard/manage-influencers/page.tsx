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
import { fetchCached, hasCachedData, beginExternalRequest, endExternalRequest, beginKeyWrite, endKeyWrite, markRowConfirmed } from "@/lib/data-cache"
import { invalidateInfluencerDerivedCaches, influencersCacheKey } from "@/lib/cache-invalidation"
import { LimitExceededDialog } from "@/components/limit-exceeded-dialog"
import { WorkspaceUnavailableModal } from "@/components/workspace-unavailable-modal"
import { TableSkeleton } from "@/components/shared/skeletons"
import { STATUS_LABEL } from "@/components/table-sheet/constants"
import { isUsableEmail, normalizeContactInfo } from "@/components/table-sheet/utils"
import { SaveStatusPill } from "@/components/save-status-pill"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shortest handle worth acting on — the same threshold TableSheet's own lookup
 * uses before it will call the provider. A single character is someone still
 * typing, not an identifier.
 */
const MIN_HANDLE_LENGTH = 2

function rowHasHandle(row: InfluencerRow): boolean {
  const handle = row.handle?.trim().replace(/^@/, "")
  return !!(handle && handle.length >= MIN_HANDLE_LENGTH && row.platform)
}

/**
 * Does this row carry anything about the influencer beyond a handle?
 *
 * A blank row starts life with `contact_status: "not_contacted"`, `stage: "1"`,
 * `approval_status: "Pending"`, `tier: "Bronze"` and `community_status:
 * "Pending"` (newEmptyRow), and typing a handle also fills `social_link` with
 * the derived profile URL. None of those is information the user or the
 * provider supplied, so none of them may be what causes an influencer to be
 * written — otherwise picking a platform and typing two characters persisted an
 * otherwise-empty record, and a lookup that came back not-found persisted the
 * same thing on the user's next keystroke.
 *
 * This is deliberately generous about WHAT counts: any real name, contact,
 * classification, note or non-zero metric is enough. It gates only the empty
 * case.
 */
function hasMeaningfulDetails(row: InfluencerRow): boolean {
  const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0
  const positive = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0
  }
  return (
    filled(row.full_name) ||
    filled(row.first_name) ||
    // A provider stand-in is not contact information: a row carrying nothing
    // but "Email not available" must not count as having details worth writing.
    isUsableEmail(row.email) ||
    normalizeContactInfo(row.contact_info).length > 0 ||
    filled(row.niche) ||
    filled(row.gender) ||
    filled(row.location) ||
    filled(row.bio) ||
    filled(row.profile_image_url) ||
    filled(row.agreed_rate) ||
    filled(row.notes) ||
    positive(row.follower_count) ||
    positive(row.engagement_rate) ||
    positive(row.avg_likes) ||
    positive(row.avg_comments) ||
    positive(row.avg_views)
  )
}

/**
 * The address to store for a row, or null.
 *
 * `contact_info` is preferred as before, but only when it is a real address:
 * the provider's "Email not available" stand-in used to be sent here, and the
 * route discarded it (no "@"), which is why the field appeared to empty itself
 * on the next reload.
 */
function persistableEmail(row: InfluencerRow): string | null {
  // Keeps ANY real contact detail the user entered — not just addresses.
  //
  // This used to run both fields through `normalizeEmail`, which requires an
  // "@", so everything else was silently dropped to null on save: a DM link
  // (ig.me/m/nike), a bare handle (nike) and a phone number all vanished the
  // moment the row was written. Only "@creatorname" survived, and then only by
  // accident of containing an "@".
  //
  // `normalizeContactInfo` strips the provider's "not available" stand-ins and
  // keeps everything else exactly as typed, which is what this field is for —
  // the importer maps an "email address/handlename" column into it. Whether a
  // value is UNIQUE is a separate question, asked by isUniqueContact at
  // duplicate-detection time; it must not decide what gets stored.
  return normalizeContactInfo(row.contact_info) || normalizeContactInfo(row.email) || null
}

function buildCreatePayload(row: InfluencerRow, brandId: string) {
  return {
    handle: row.handle.trim().replace(/^@/, ""),
    platform: row.platform,
    full_name: row.full_name || row.first_name || null,
    email: persistableEmail(row),
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
    // Sent so a DRAFT row can be promoted in place — the PUT route accepts
    // these only while the stored row is still a draft, and ignores them for a
    // real influencer exactly as it did before.
    handle: row.handle?.trim().replace(/^@/, "") || "",
    platform: row.platform || "",
    full_name: rebuiltFullName,
    email: persistableEmail(row),
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

/**
 * The fields that live on the GLOBAL Influencer record, shared by every brand
 * that has this creator.
 *
 * Everything not listed here belongs to the brand's own BrandInfluencer row
 * (stage, contact_status, approval_status, notes, agreed_rate, …) and is safe
 * to send on every request — it is scoped to one brand_id + influencer_id.
 *
 * `handle` and `platform` are deliberately ABSENT: they are the draft-promotion
 * keys, the PUT route accepts them only while the stored row is still a draft,
 * and dropping them would break promoting a draft in place.
 */
const GLOBAL_PROFILE_FIELDS = [
  "full_name", "email", "gender", "niche", "location", "bio",
  "profile_image_url", "social_link", "follower_count",
  "engagement_rate", "avg_likes", "avg_comments", "avg_views",
] as const

/**
 * Drop global profile fields this edit did not actually change.
 *
 * One Influencer row is shared by every brand linked to it, and the PUT route
 * writes any field that is not `undefined`. Because the payload always carried
 * the whole row, a brand changing only its OWN stage still rewrote the shared
 * profile with its copy of it — so a second brand's profile edit was silently
 * reverted by the first brand's next stage change.
 *
 * Comparing against the previously sent payload leaves genuinely edited fields
 * in place (editing a name still updates it globally, as before) while a
 * brand-scoped edit now sends only brand-scoped fields. `lastSent` is absent on
 * the row's first PUT of the session, where the full payload is still correct.
 */
function withoutUnchangedGlobalFields(
  payload: Record<string, unknown>,
  lastSent: string | undefined
): Record<string, unknown> {
  if (!lastSent) return payload
  let previous: Record<string, unknown>
  try { previous = JSON.parse(lastSent) as Record<string, unknown> }
  catch { return payload }

  const trimmed = { ...payload }
  for (const field of GLOBAL_PROFILE_FIELDS) {
    // Only when the previous payload actually carried the field, so a field
    // trimmed from an earlier request is never treated as "unchanged".
    if (field in previous && previous[field] === trimmed[field]) delete trimmed[field]
  }
  return trimmed
}

/**
 * The two fields the PUT route normalises, mapped back onto the row's own
 * shape. `email` is carried in `contact_info` as well, which is the field the
 * grid and the sidebar actually read.
 */
function normalisedRow(normalised: Record<string, unknown>): Partial<InfluencerRow> {
  const patch: Partial<InfluencerRow> = {}
  if ("email" in normalised) {
    const email = (normalised.email as string | null) ?? ""
    patch.email = email
    patch.contact_info = email
  }
  if ("profile_image_url" in normalised) {
    patch.profile_image_url = (normalised.profile_image_url as string | null) ?? ""
  }
  return patch
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
    email:             persistableEmail(row) ?? "",
    profileImageUrl:   row.profile_image_url || null,
    notes:             row.notes || "",
    approvalNotes:     row.approval_notes || null,
  }
}

/**
 * How long after the last edit a typed change is saved.
 *
 * Long enough that a field is still typed as one edit rather than per keystroke,
 * short enough that the row confirms while the user is still looking at it. Only
 * applies to typed fields — LIFECYCLE_FIELDS below bypass it entirely.
 *
 * Lowering this does not increase requests per edit: the row's pending timer is
 * cleared and re-armed on every change and the payload is the whole row's latest
 * values, so any burst of edits still collapses into exactly one PUT.
 */
const AUTOSAVE_DEBOUNCE_MS = 400

/** Discrete lifecycle fields — a change to one of these is saved immediately. */
const LIFECYCLE_FIELDS = ["approval_status", "contact_status", "stage", "transferred_date"] as const

// ─────────────────────────────────────────────────────────────────────────────
// Serial PUT queue
// ─────────────────────────────────────────────────────────────────────────────

/** What the PUT route reports back about the row it persisted. */
type SavedInfluencer = {
  handle?: string | null
  platform?: string | null
  /** What the route actually STORED for the two fields it normalises. */
  email?: string | null
  profile_image_url?: string | null
}

type QueueItem = {
  url: string
  payload: string
  /**
   * What the processing pill says while this PUT is out. Omitted for an
   * ordinary edit, which takes the standard "Saving changes…".
   */
  processing?: string
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
  /** Runs after the row was persisted, with what the server reported storing. */
  onSuccess?: (saved: SavedInfluencer) => void
}

/**
 * `onRequest` brackets each real PUT, so the save indicator reflects the request
 * actually in flight — not the debounce window before it, and not a timer.
 */
function createPutQueue(
  onRequest?: (
    phase: "start" | "ok" | "fail",
    message?: string | null,
    processing?: string
  ) => void,
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
      onRequest?.("start", item.message, item.processing)
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
          item.onSuccess?.(saved)
          onRequest?.("ok", item.message ?? item.messageFromSaved?.(saved) ?? null)
          writeOk = true
        }
        else {
          item.onError?.(res.status)
          // Carry the route's own message through instead of discarding it. The
          // PUT route returns a user-safe line (the raw MySQL/Prisma text stays
          // in the server log), so this is what the person editing can act on —
          // previously every failure collapsed into a bare "Failed to save"
          // with no indication of what went wrong or whether retrying would
          // help. Local edits are deliberately left untouched, so the value is
          // still on screen to retry.
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          onRequest?.("fail", typeof body.error === "string" ? body.error : null)
        }
      } catch {
        // Status 0 = the request never reached the server (offline, DNS, abort).
        // This used to skip item.onError entirely, so a row's per-row indicator
        // stayed on "Saving…" for good and an optimistically seeded Pipeline
        // card was never rolled back — the two things onError exists to do.
        item.onError?.(0)
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
      if (existing >= 0) {
        // Merging must not silently drop the superseded item's onError. That
        // callback owns a rollback the replacement knows nothing about — an
        // approval seeds a card into the Pipeline cache BEFORE its PUT is
        // enqueued, so if that item is replaced and the surviving save then
        // fails, the seeded card stayed on the board for an approval that never
        // persisted. Both handlers now run, superseded first.
        const superseded = queue[existing]
        queue[existing] = {
          ...item,
          onError: (status) => {
            try { superseded.onError?.(status) } catch { /* still run the newer one */ }
            item.onError?.(status)
          },
        }
      } else queue.push(item)
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

  const { rows, customColumns, isLoading, error, refetch, setRows, setCustomColumns } =
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
  // Same two-part pattern as the Pipeline board, the Post Tracker and Brand
  // Partners: the shared SaveStatusPill while a request is in flight, with the
  // outcome notification once it settles (3s, as `showToast` uses there). The
  // pill tracks the REAL request, not the debounce window before it.
  const [isSaving, setIsSaving] = useState(false)
  /** Whether the batch that just finished failed, so the pill skips "Saved". */
  const [saveFailed, setSaveFailed] = useState(false)
  /**
   * What the processing pill says for the operation in flight. Null takes the
   * standard "Saving changes…"; a delete or a bulk move names itself instead.
   */
  const [processingMessage, setProcessingMessage] = useState<string | null>(null)

  // ── Status ownership, per operation ───────────────────────────────────────
  // Adding an influencer, saving a typed edit and saving a fetch enrichment are
  // three different operations that can overlap, and they used to share one
  // counter and one label. Whichever started last renamed the pill, and
  // whichever finished first cleared it — so an add showed "Saving changes…"
  // and then "Saved", and an enrichment landing mid-add stole the label.
  //
  // Each flow now owns its own state:
  //
  //   Add        "Adding influencer…"  → "@handle added to Influencer List"
  //   Manual     "Saving changes…"     → "Saved"          (reportSave)
  //   Enrichment silent                → "@handle details updated"
  //
  // The pill renders the add when one is running, because that is the
  // operation the user explicitly asked for; a manual save underneath it is
  // still tracked and shows as soon as the add finishes.
  const [addingCount, setAddingCount] = useState(0)
  const reportAdd = useCallback((phase: "start" | "ok" | "fail") => {
    setAddingCount((n) => (phase === "start" ? n + 1 : Math.max(0, n - 1)))
  }, [])
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const savingCount = useRef(0)
  const failedSinceIdle = useRef(false)
  /** The last failure's user-safe message, as the route reported it. */
  const failureMessage = useRef<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pendingMessage = useRef<string | null>(null)

  const reportSave = useCallback((
    phase: "start" | "ok" | "fail",
    message?: string | null,
    processing?: string
  ) => {
    if (phase === "start") {
      if (message) pendingMessage.current = message
      // Only the first operation of a batch names it — a later one joining the
      // same in-flight window must not relabel what is already on screen.
      if (savingCount.current === 0) setProcessingMessage(processing ?? null)
      savingCount.current += 1
      failedSinceIdle.current = failedSinceIdle.current && savingCount.current > 1
      if (noticeTimer.current) { clearTimeout(noticeTimer.current); noticeTimer.current = null }
      setNotice(null)
      setSaveFailed(false)
      setIsSaving(true)
      return
    }
    // An outcome may carry its own confirmation — the PUT queue passes the
    // handle the database reported, which is only known once the response is
    // back. It supersedes whatever `start` guessed.
    if (phase === "ok" && message) pendingMessage.current = message
    if (phase === "fail") {
      failedSinceIdle.current = true
      // Kept separately from pendingMessage, which holds the SUCCESS
      // confirmation: a batch can contain both, and the failure is what the
      // user needs to see.
      if (message) failureMessage.current = message
    }
    savingCount.current = Math.max(0, savingCount.current - 1)
    if (savingCount.current > 0) return

    const failed = failedSinceIdle.current
    failedSinceIdle.current = false
    const failureText = failureMessage.current
    failureMessage.current = null
    // The pill goes the moment the request is done — no lingering saving state.
    // `failed` is handed to the pill so a failed batch shows nothing rather
    // than "Saved"; the failure itself is reported by the notice below.
    setSaveFailed(failed)
    setIsSaving(false)
    setProcessingMessage(null)
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
      // The route's own wording when it gave one, the previous generic line
      // otherwise (network errors, which have no response body to read).
      message: failed ? failureText ?? "Failed to save" : confirmation!,
      type: failed ? "error" : "success",
    })
    noticeTimer.current = setTimeout(() => setNotice(null), 3000)
  }, [])

  // Wraps any save that doesn't go through the PUT queue (create, bulk approve,
  // delete) so every path feeds the same indicator.
  const trackSave = useCallback(
    async <T,>(
      op: () => Promise<T>,
      succeeded: (result: T) => boolean,
      processing?: string
    ): Promise<T> => {
      reportSave("start", null, processing)
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
  /**
   * How to fire a row's pending debounced save RIGHT NOW, by row id.
   *
   * Registered next to its timer rather than replacing it, so the existing
   * clearTimeout call sites keep working unchanged. Its only job is to let a
   * navigation or tab close flush what the 1500ms debounce is still holding —
   * a best-effort safety net, never the primary persistence path.
   */
  const pendingFlush = useRef<Map<string, () => void>>(new Map())
  /** The most recent rows handed to handleRowsChange, by reference. */
  const latestRows = useRef<InfluencerRow[]>([])
  /** scheduleUpdate, reachable from its own callbacks. */
  const scheduleUpdateRef = useRef<(row: InfluencerRow) => void>(() => {})


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
  // Membership alone saves nothing, and now says so in two ways. The value is
  // the HANDLE the lookup gave up on, so editing the handle afterwards drops
  // the row back to the lookup (a different identifier deserves a fresh
  // attempt, not a record built from a failure). And the create still waits for
  // `hasMeaningfulDetails`, so a not-found the user walks away from — or types
  // one more character into — is never persisted as an empty influencer.
  const manualRows = useRef<Map<string, string>>(new Map())

  /**
   * Rows that were still drafts when their enrichment save went out.
   *
   * The row reaches handleFetchComplete already flipped to `is_draft: false`
   * (the sheet reconciles it from the response), so by then it no longer looks
   * like an add. Recorded when the save starts, consumed when it lands.
   */
  const promotedDrafts = useRef<Set<string>>(new Set())

  /**
   * Rows paused on a contact-duplicate decision.
   *
   * The sheet raises the modal and holds the row; this is the gate that stops
   * the row's contact reaching the database before the user has chosen. Held in
   * a ref so `handleRowsChange` — which runs on every edit — reads the current
   * value rather than one render behind.
   *
   * Paused, not cancelled: any timer already armed for the row is cleared, and
   * the row saves normally the moment the hold lifts.
   */
  const contactHeldRows = useRef<Set<string>>(new Set())

  const handleContactHoldChange = useCallback((rowId: string, held: boolean) => {
    if (held) {
      contactHeldRows.current.add(rowId)
      // Cancel a debounce already counting down for this row, or it would fire
      // mid-modal and persist the very contact the user is being asked about.
      const pending = updateTimers.current.get(rowId)
      if (pending) { clearTimeout(pending); updateTimers.current.delete(rowId) }
      // And drop the unload flush, which would otherwise send the same payload
      // if the tab were closed while the modal was open.
      pendingFlush.current.delete(rowId)
    } else {
      contactHeldRows.current.delete(rowId)
    }
  }, [])

  /**
   * At most two draft creates in flight, so a rapid multi-add cannot exhaust
   * the connection pool. A plain promise chain over two lanes — no timers, so
   * nothing waits longer than it has to.
   */
  const createLanes = useRef<Promise<unknown>[]>([Promise.resolve(), Promise.resolve()])
  const createDraftGate = useCallback(<T,>(op: () => Promise<T>): Promise<T> => {
    // The lane that will free up first is the one whose turn it is; with only
    // two, taking them in rotation is equivalent and needs no bookkeeping.
    const lane = createLanes.current.shift()!
    const run = lane.then(op, op)
    createLanes.current.push(run.catch(() => {}))
    return run
  }, [])

  const idSwapCallback = useRef<((tempId: string, realId: string) => void) | null>(null)

  /**
   * Stable, so the sheet's registration effect does not re-run every render.
   *
   * This was an inline arrow in the JSX below, which is a new function on every
   * render of this page — the effect that registers the swap callback therefore
   * re-ran constantly, re-registering it each time. It only writes a ref, so it
   * has no dependencies and never needs to change identity.
   */
  const handleRegisterIdSwap = useCallback((fn: (tempId: string, realId: string) => void) => {
    idSwapCallback.current = fn
  }, [])

  /**
   * Tail of the delete chain, so deletes run one after another.
   *
   * Deleting a multi-row selection fires one onDeleteRow per row at once, and a
   * delete is now a transaction rather than a single statement — against
   * connection_limit=3 a selection of any size would have queued transactions
   * against the pool and timed out (P2024/P2037). Serialising costs a moment on
   * a large selection and cannot exhaust the pool.
   */
  const deleteChain = useRef<Promise<void>>(Promise.resolve())

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
      // Waiting on a contact-duplicate decision: nothing for this row is written
      // until the user chooses. This is the single gate every autosave passes
      // through, so a typed contact, a fetched one and a debounce already in
      // flight are all covered by it — no per-call-site guarding needed.
      if (contactHeldRows.current.has(row.id)) return

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

      const fire = () => {
        updateTimers.current.delete(row.id)
        pendingFlush.current.delete(row.id)
        if (!dbIds.current.has(row.id)) return
        const seeded = seedsPipeline && brandId ? seedPipelineFromApproval(brandId, seed!) : false
        putQueue.current.enqueue({
          url,
          // Unchanged GLOBAL profile fields are stripped here, not above: the
          // comparison that decides `discrete` and detects "nothing changed"
          // needs the whole row, and `lastSentPayloads` must keep storing the
          // whole row or the next diff would compare against a partial one.
          // Only what actually goes over the wire is trimmed.
          payload: JSON.stringify(
            withoutUnchangedGlobalFields(JSON.parse(payload), lastSent)
          ),
          // "Updating…", not the flat "Saving changes…": every row reaching
          // this queue is already in the list, so this is an update to an
          // existing influencer. A lifecycle move keeps its own wording below.
          processing: "Updating…",
          message: moveMessage,
          // NO per-row toast.
          //
          // This fired "@handle details updated" for every single row edit, so
          // editing a few fields — or a few rows — produced a queue of near
          // identical notifications. An ordinary edit is not news: the pill
          // already says "Updating…" while the write is out and "Saved" when it
          // lands, and it coalesces because `savingCount` only settles once the
          // whole burst is done.
          //
          // A LIFECYCLE move keeps its notification (`message` above, e.g.
          // "@handle moved to Approved") — that is a state change worth
          // announcing, not a field edit.
          // An approval or stage edit here changes what Pipeline, Post Tracker,
          // Brand Partners and Analytics should show. Their cached entries are
          // marked stale so those pages pick the change up on open — this
          // page's own entry is already correct from the inline edit.
          onSuccess(saved) {
            // ── 1. Did the route rewrite anything? ──────────────────────────
            // It nulls an email without "@" and an expiring CDN image url. The
            // client used to keep showing the value it SENT, its diff saw no
            // change, and the field silently emptied on the next reload.
            const sentPayload = JSON.parse(payload) as Record<string, unknown>
            const normalised: Record<string, unknown> = {}
            for (const field of ["email", "profile_image_url"] as const) {
              if (saved[field] === undefined) continue
              if (saved[field] !== sentPayload[field]) normalised[field] = saved[field]
            }
            const wasNormalised = Object.keys(normalised).length > 0

            // ── 2. The baseline the next edit is diffed against ─────────────
            // Reconciled to what the DATABASE holds when the route rewrote a
            // field, so the snapshot and the row cannot disagree.
            lastSentPayloads.current.set(
              row.id,
              wasNormalised ? JSON.stringify({ ...sentPayload, ...normalised }) : payload
            )

            // ── 3. The cached row, updated from what was persisted ─────────
            // The grid has its own copy of the rows, so an inline edit never
            // reached the shared cache entry — the one that is mirrored to
            // sessionStorage and painted first after a reload. A refresh taken
            // right after a save therefore showed the PRE-save row until the
            // background revalidation came back. Writing the persisted values
            // in (from the response where the route rewrote a field, from the
            // row that was sent otherwise) means the first paint is already
            // right, with no extra request and no full-page refresh.
            const confirmed = { ...row, ...normalisedRow(normalised) }
            setRows((prev) => prev.map((r) => (r.id === row.id ? confirmed : r)))
            markRowConfirmed(influencersCacheKey(brandId), row.id, confirmed)

            // Every OTHER view of this row is stale now. This page's own entry
            // is excluded, the same way the Pipeline board and the Post Tracker
            // exclude theirs: the row above was just written into it from what
            // the database reported, so it is correct. It used to be marked
            // stale as well, which — with an autosave firing every 500ms of
            // typing — left the entry permanently stale and had the list re-read
            // itself from the database on every window focus, for a row it
            // already held the persisted value of.
            invalidateInfluencerDerivedCaches(brandId, [influencersCacheKey(brandId)])

            if (wasNormalised) {
              // The MUTATION RESPONSE is the answer — no follow-up fetch.
              //
              // `confirmed` above already carries what the database stored (the
              // route reports back the fields it rewrites: an email without "@"
              // and the Cloudinary avatar URL), and it has been written into both
              // the local row and the cache entry. A `refetch()` here re-read the
              // WHOLE list to learn what the response had just told us — and it
              // ran on every enrichment, because mirroring an avatar to
              // Cloudinary always counts as a normalisation.
              //
              // Still no re-diff: the on-screen row now matches the reconciled
              // snapshot, so there is nothing to re-send, and diffing a rejected
              // value against it would loop forever.
              return
            }

            // ── 3. Did the row move while this request was in flight? ───────
            // The diff gate compares against lastSentPayloads, which only
            // advances here. So an edit made during the request — including a
            // revert BACK to the previous value, which matched the not-yet-
            // advanced snapshot — was skipped as "unchanged" and never saved.
            // The UI then showed one value and the database another.
            //
            // Re-diffing against the row as it stands now closes that window:
            // if it differs from what was just persisted, it is scheduled like
            // any other change (same debounce, same queue, same dedup).
            const current = latestRows.current.find((r) => r.id === row.id)
            if (!current) return
            if (JSON.stringify(buildUpdatePayload(current)) === payload) return
            scheduleUpdateRef.current(current)
          },
          onError(status) {
            // The edited values stay on screen and lastSentPayloads is NOT
            // advanced, so the next detected change retries this row. The
            // outcome itself is reported by the page's global notice.
            // The approval did not persist, so take the seeded card back off the
            // board — same rollback rule the Pipeline's own writes follow.
            if (seeded && brandId && row.brand_influencer_id) {
              unseedPipelineRow(brandId, row.brand_influencer_id)
            }
            if (status === 409) {
              // A real duplicate WITHIN this brand — this influencer is already
              // on the list. A GLOBAL match is no longer a 409: the route links
              // the existing record to this brand and returns OK, so reusing an
              // influencer another brand already has is not an error here.
              //
              // The row keeps what was typed so the user can correct it; nothing
              // is created twice and no handle is cleared.
              notify("error", `@${handle} is already in your list`)
            } else if (status === 403) {
              // The plan limit applies at promotion, not at add — a blank draft
              // costs nothing. The route's own message is the accurate one.
              notify("error", `Could not save @${handle} — influencer limit reached`)
            } else if (status === 404) {
              dbIds.current.delete(row.id)
              notify("error", `Could not save @${handle} — not found. Try refreshing.`)
            } else if (status === 0) {
              // Never reached the server — "(0)" would mean nothing to the user.
              notify("error", `Could not save @${handle} — you appear to be offline.`)
            } else if (status === 503) {
              // The database is momentarily out of connections. The save did
              // NOT happen, so staying silent here would leave the user
              // believing it had — the edited values are still on screen and
              // look saved. Say plainly that it failed, that nothing was lost,
              // and that waiting is the fix. No automatic retry: retrying into
              // an exhausted pool is what deepens the exhaustion.
              notify("error", "The server is busy right now. Your changes are safe. Please wait a moment and try again.")
            } else {
              // No status code: it tells the user nothing they can act on, and
              // the code is already in the console from the queue's own logging.
              // The edited values stay on screen, so a retry is just an edit.
              console.error(`PUT influencer ${row.id} failed with status ${status}`)
              notify("error", `Couldn't save @${handle}. Your changes are still here — please try again.`)
            }
          },
        })
      }

      const timer = setTimeout(fire, discrete ? 0 : AUTOSAVE_DEBOUNCE_MS)
      updateTimers.current.set(row.id, timer)
      pendingFlush.current.set(row.id, () => { clearTimeout(timer); fire() })
    },
    // refetch is gone from here: a normalised field is reconciled from the
    // mutation response now, so this path no longer re-reads the list.
    [brandId, notify, setRows]
  )
  // Assigned after definition so onSuccess can reschedule through the ref
  // without scheduleUpdate having to reference itself during construction.
  scheduleUpdateRef.current = scheduleUpdate

  // ── Flush pending debounced saves on the way out ──────────────────────────
  // Covers both exits: `pagehide` for a real unload (reload, tab close, external
  // link) and the unmount cleanup for a client-side navigation away from this
  // page, which `pagehide` does not fire for.
  //
  // Best effort by design. A request started this late may not complete, which
  // is why the debounce stays short enough that there is rarely anything
  // pending — this is a net, not the mechanism.
  useEffect(() => {
    const flushAll = () => {
      const flushes = Array.from(pendingFlush.current.values())
      pendingFlush.current.clear()
      flushes.forEach((f) => { try { f() } catch { /* keep flushing the rest */ } })
    }
    window.addEventListener("pagehide", flushAll)
    return () => {
      window.removeEventListener("pagehide", flushAll)
      flushAll()
    }
  }, [])

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
        reportAdd("start")
        const res = await fetch("/api/influencers/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildCreatePayload(row, brandId)),
        }).then(
          (r) => { reportAdd(r.ok || r.status === 409 ? "ok" : "fail"); return r },
          (e) => { reportAdd("fail"); throw e }
        )

        if (res.ok) {
          const created = await res.json()
          const realId: string = created.id || created.influencer_id

          dbIds.current.add(realId)
          tempToReal.current.set(row.id, realId)
          manualRows.current.delete(row.id)
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
          manualRows.current.delete(row.id)
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
          // `body.details` is deliberately NOT used: /api/influencers/[id]
          // returns the raw driver message there, which is for the log, not for
          // the person adding an influencer. Logged in full, reported briefly.
          console.error(`POST /api/influencers/create failed for @${handle}:`, res.status, body)
          if (!skipToast) {
            // 503 is the database being momentarily out of connections. Saying
            // "check the handle" there would send the user to fix something
            // that is not wrong; nothing was created and waiting is the fix.
            notify(
              "error",
              res.status === 503
                ? "The server is busy right now. Your changes are safe. Please wait a moment and try again."
                : `Couldn't add @${handle}. Please check the handle and try again.`
            )
          }
          savedHandles.current.delete(key)
          return null
        }
      } catch (err) {
        console.error(`POST /api/influencers/create threw for @${handle}:`, err)
        if (!skipToast) notify("error", `Couldn't add @${handle} — you appear to be offline.`)
        savedHandles.current.delete(`${handle}@${row.platform}`)
        return null
      }
    },
    // reportSave is no longer used here — createRow reports through reportAdd,
    // so the add flow owns its own status.
    [brandId, reportAdd, notify]
  )

  // ── handleCreateDraft ─────────────────────────────────────────────────────
  // Persist a blank row the moment it is added, so it is still there after a
  // refresh. Each call is independent and they run in parallel: five rapid
  // additions are five requests, each resolving into its own row by id, with no
  // shared state to overwrite.
  //
  // A draft consumes no plan slot and appears in no other view — the server
  // owns both of those rules (`is_draft`). On failure the row simply stays as a
  // local temp row: it still saves normally once it has a handle, it just will
  // not survive a refresh, which is strictly better than removing it.
  const handleCreateDraft = useCallback(
    async (rowId: string): Promise<string | null> => {
      if (!brandId) return null
      // Queued behind at most one other create.
      //
      // Adding several rows started every create at once. Each one opens a
      // transaction (influencer + link), and DATABASE_URL caps this deployment
      // at connection_limit=3 — so a burst of five produced
      // "P2028 Unable to start a transaction in the given time" for the ones
      // that could not get in, surfacing as HTTP 500. Reproduced directly
      // against the database: 3 of 5 concurrent creates succeed, 2 fail.
      //
      // Two at a time, matching the bulk limit used elsewhere, leaves a
      // connection free for whatever the user does next. Not a delay: a slot is
      // taken as soon as one frees, so a single add is unchanged.
      return createDraftGate(async () => {
      try {
        const res = await fetch("/api/influencers/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft: true, brandId }),
        })
        if (!res.ok) return null
        const created = await res.json()
        const realId: string | undefined = created?.id
        if (!realId) return null

        // The row is now a real database row, so ordinary editing saves apply
        // to it — this is what makes typing a handle promote THIS row rather
        // than create another.
        dbIds.current.add(realId)
        tempToReal.current.set(rowId, realId)
        idSwapCallback.current?.(rowId, realId)
        return realId
      } catch {
        return null
      }
      })
    },
    [brandId, createDraftGate]
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
  /**
   * Called by the sheet as an enrichment save goes out, before the row is
   * reconciled — the only moment it is still visibly a draft.
   */
  const handleEnrichmentStart = useCallback((rowId: string, wasDraft: boolean) => {
    if (!wasDraft) return
    promotedDrafts.current.add(rowId)
    // A draft becoming a real influencer IS the add, so the pill belongs to it.
    // createRow — which used to own this — is not on this path: a draft row is
    // already in the database, so it is promoted by the enrichment's PUT rather
    // than created, and the pill went silent for the one operation the user
    // most obviously started. Closed in handleFetchComplete, immediately before
    // the "added to Influencer List" notice, so the two hand over cleanly
    // instead of overlapping.
    reportAdd("start")
  }, [reportAdd])

  /** The promote failed, so the add never happened — close its pill. */
  const handleEnrichmentFailed = useCallback((rowId: string) => {
    if (promotedDrafts.current.delete(rowId)) reportAdd("fail")
  }, [reportAdd])

  const handleFetchComplete = useCallback(
    async (row: InfluencerRow) => {
      if (!brandId || !rowHasHandle(row)) return

      const handle = row.handle.trim().replace(/^@/, "")
      const key = `${handle}@${row.platform}`

      // Case A — row is already in the DB with its own real ID.
      //
      // TableSheet has ALREADY written this row: onFetchComplete is called
      // after its own save landed, so re-enqueueing the same payload here was
      // the second half of the double save. What is left to do is bookkeeping:
      //
      //   * cancel any typed-field save still pending for this row — it holds a
      //     pre-fetch payload that the enrichment has now superseded;
      //   * record the enriched payload as the last one sent, so the next diff
      //     compares against what is actually stored and a burst of enrichment
      //     fields does not read as an edit and start another save;
      //   * mark the derived views stale, exactly as a save through the queue
      //     would have.
      //
      // A later manual edit diffs against this snapshot and saves normally on
      // the ordinary debounce.
      if (dbIds.current.has(row.id)) {
        const existing = updateTimers.current.get(row.id)
        if (existing) { clearTimeout(existing); updateTimers.current.delete(row.id) }
        pendingFlush.current.delete(row.id)
        lastSentPayloads.current.set(row.id, JSON.stringify(buildUpdatePayload(row)))

        // Write the confirmed row into the SHARED cache entry.
        //
        // The sheet keeps its own copy of the rows, so the enriched row was
        // only ever on screen — this entry still held the blank draft. And this
        // entry is what is mirrored into sessionStorage and painted first after
        // a reload, so refreshing right after an enrichment showed the row as
        // it was BEFORE the fetch (blank handle, no avatar) until the
        // background revalidation returned, then it snapped to the real values.
        //
        // The PUT queue already does this for a typed save (see its onSuccess);
        // the enrichment bypasses that queue, so it has to do it here. Same
        // shape, same helper, no extra request: `row` is what the sheet
        // reconciled from the PUT's own response, so it is what the database
        // holds — including the permanent Cloudinary avatar URL.
        setRows((prev) =>
          prev.some((r) => r.id === row.id)
            ? prev.map((r) => (r.id === row.id ? { ...r, ...row } : r))
            // A row created during this session may not be in the cached
            // payload yet; add it rather than dropping the confirmed values.
            : [...prev, row]
        )
        // Remembered briefly, so a read that has not caught up — the one a
        // refresh a second later issues — cannot revert this row.
        markRowConfirmed(influencersCacheKey(brandId), row.id, row)

        invalidateInfluencerDerivedCaches(brandId, [influencersCacheKey(brandId)])

        // Which confirmation this is depends on what just happened to the row.
        //
        // A row that was a draft until this write is an ADD — it has just
        // become a real influencer, so it gets the add's own wording. Anything
        // else is a re-fetch of a row that was already in the list, which is an
        // update. Both used to say "details updated", so adding an influencer
        // never confirmed that it had been added.
        const wasDraft = promotedDrafts.current.delete(row.id)
        // Close the add pill BEFORE its notice, so the sequence reads
        // "Adding influencer…" → "@handle added to Influencer List" rather than
        // the two sitting on screen together.
        if (wasDraft) reportAdd("ok")
        notify(
          "success",
          wasDraft
            ? `@${handle} added to Influencer List`
            : `@${handle} details updated`
        )
        return
      }

      // Case B — createRow resolved; temp ID was mapped to realId
      const realId = tempToReal.current.get(row.id)
      if (realId) {
        putQueue.current.enqueue({
          url: `/api/brand/${brandId}/influencers/${realId}`,
          payload: JSON.stringify(buildUpdatePayload({ ...row, id: realId })),
          processing: "Updating profile…",
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
    [brandId, createRow, notify, reportAdd, setRows]
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
          (r) => r.ok,
          "Updating…"
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.error("Bulk approval failed:", res.status, body)
          notify("error", body.error === "Forbidden"
            ? "Only Owners and Managers can approve influencers"
            // Nothing was approved either way, so the selection is still there.
            // Capacity gets the "wait" wording; anything else gets "try again".
            : res.status === 503
              ? "The server is busy right now. Your changes are safe. Please wait a moment and try again."
              : "Couldn't approve the selected influencers. Please try again.")
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

        // Write the persisted rows into the SHARED cache entry.
        //
        // The sheet applies the result to its own local rows, but this entry —
        // the one mirrored to sessionStorage and re-read on revalidation — still
        // held the PRE-approval values. So the rows showed Approved, then a
        // background read returned and replaced them with the old state, which
        // is the "only some of them stayed Approved until I refreshed" symptom.
        //
        // Values come from the response (what the database stored), not from a
        // guess, and each row is marked confirmed so a read that has not caught
        // up cannot revert it.
        const savedById = new Map(result.updated.map((u) => [u.influencer_id, u]))
        const listKey = influencersCacheKey(brandId)
        setRows((prev) =>
          prev.map((r) => {
            const saved = savedById.get(r.id)
            if (!saved) return r
            const next = {
              ...r,
              approval_status: (saved.approval_status ?? "Pending") as InfluencerRow["approval_status"],
              transferred_date: saved.transferred_date
                ? new Date(saved.transferred_date).toISOString().split("T")[0]
                : "",
              contact_status: saved.contact_status ?? r.contact_status,
            }
            markRowConfirmed(listKey, r.id, next)
            return next
          })
        )

        // Every OTHER view is stale now; this page's own entry was just written
        // above, so it is excluded — the same rule the single-row save follows.
        invalidateInfluencerDerivedCaches(brandId, [listKey])
        return result
      } catch (err) {
        console.error("Bulk approval threw:", err)
        notify("error", "Couldn't approve the selected influencers — check your connection and try again.")
        return null
      }
    },
    [brandId, trackSave, rows, notify, setRows]
  )

  // ── handleLookupFailed ────────────────────────────────────────────────────
  // TableSheet reports a lookup that returned no data. The row stays exactly as
  // it is and nothing is saved here; it simply becomes eligible to save the way
  // a YouTube or Twitter row already is, on the user's next edit.
  const handleLookupFailed = useCallback((rowId: string) => {
    // Recorded against the handle that failed, so a later edit to the handle
    // itself hands the row back to the lookup instead of creating from nothing.
    const row = latestRows.current.find((r) => r.id === rowId)
    manualRows.current.set(rowId, row?.handle?.trim().replace(/^@/, "") ?? "")
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
  /**
   * Is this row's handle still the lookup's to resolve?
   *
   * True for a draft on an API platform whose handle has not been looked up
   * yet — the enrichment owns the write until it succeeds or gives up. False
   * once the row is a real influencer, once the lookup has failed (manualRows),
   * or on a platform with no lookup at all.
   */
  const awaitingLookup = useCallback((row: InfluencerRow): boolean => {
    if (!row.is_draft) return false
    const isApiPlatform = row.platform === "instagram" || row.platform === "tiktok"
    if (!isApiPlatform) return false
    return !manualRows.current.has(row.id)
  }, [])

  const handleRowsChange = useCallback(
    (updatedRows: InfluencerRow[]) => {
      // The table owns the live rows; this is the page's view of them. Needed so
      // a save that has just landed can re-diff against what the row looks like
      // NOW rather than against the snapshot the request was built from, and so
      // handleLookupFailed can read the handle a lookup gave up on. Kept in step
      // BEFORE the save gate below, because it is a mirror, not a write — it was
      // left empty for the first 800ms after load, which is exactly when a
      // freshly typed row's lookup can come back not-found.
      latestRows.current = updatedRows

      if (!readyToSave.current) return

      updatedRows.forEach((row) => {
        if (!rowHasHandle(row)) return

        // ── Already in DB — just debounce-update
        if (dbIds.current.has(row.id)) {
          // EXCEPT while its lookup still owns it.
          //
          // A draft row is in the database from the moment it is added, so
          // typing the first characters of a handle used to start saving
          // immediately — a write per pause, each one a partially typed handle,
          // before the API had returned anything. The enrichment writes this
          // row itself once the fetch resolves (saveRowToDatabase), so nothing
          // is lost by waiting; a lookup that fails hands the row over through
          // manualRows and typing saves from then on.
          if (awaitingLookup(row)) return
          scheduleUpdate(row)
          return
        }

        const handle = row.handle.trim().replace(/^@/, "")
        const key = `${handle}@${row.platform}`

        // Already saved or in-flight — nothing to do
        if (savedHandles.current.has(key)) return

        const isApiPlatform = row.platform === "instagram" || row.platform === "tiktok"

        if (!isApiPlatform) {
          // YouTube, Twitter, etc. — no enrichment, so the user is the only
          // source of data. Written once they have actually entered some:
          // a handle alone is not an influencer.
          if (hasMeaningfulDetails(row)) createRow(row)
          return
        }

        // Instagram / TikTok — the lookup owns the create, EXCEPT for a row the
        // lookup already gave up on. That one is the user's to complete, so an
        // edit to it saves like any manual row — once there is something to
        // save beyond the handle the lookup could not resolve.
        const failedHandle = manualRows.current.get(row.id)
        if (failedHandle !== undefined) {
          if (failedHandle !== handle) {
            // The identifier changed, so this is no longer the row the lookup
            // failed on. TableSheet is already re-querying it; let that own the
            // create again rather than writing a record for a handle nobody has
            // looked up yet.
            manualRows.current.delete(row.id)
            return
          }
          if (hasMeaningfulDetails(row)) createRow(row)
          return
        }

        // Otherwise nothing: the lookup has not run, is still running, or is
        // about to write this row itself through handleFetchComplete. Editing
        // the handle or switching the platform must not write anything.
      })
    },
    [scheduleUpdate, createRow, awaitingLookup]
  )

  // ── handleImportRows — bulk import, bypasses enrichment wait ─────────────
  const handleImportRows = useCallback(
    async (importedRows: InfluencerRow[]) => {
      if (!brandId) return
      const validRows = importedRows.filter(rowHasHandle)
      if (!validRows.length) return

      let savedCount = 0
      let skippedCount = 0

      // Two at a time, not five: DATABASE_URL caps this deployment at
      // connection_limit=3 and each create runs several queries, so a batch
      // wider than the pool starved the user's own reads and surfaced as
      // P2037/P2024 mid-import. One connection is deliberately left free.
      const BATCH = 2
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

      // ONE notification for the whole run, not one per row.
      //
      // Every row is attempted independently (createRow is called per row and
      // returns null on failure), so a row that fails never stops the others and
      // every successful row is kept. The outcome is summarised once — stacking
      // a toast per failure was unreadable on a large import.
      if (savedCount > 0)
        notify("success",
          `Imported ${savedCount} influencer${savedCount !== 1 ? "s" : ""}${
            skippedCount ? ` (${skippedCount} skipped — already in your list or limit reached)` : ""
          }`
        )
      else if (skippedCount > 0)
        notify("warning", `${skippedCount} row${skippedCount !== 1 ? "s" : ""} skipped — already in your list or limit reached`)
    },
    [brandId, createRow, notify]
  )

  // ── handleDeleteRow ───────────────────────────────────────────────────────
  // The table has already taken the row off screen by the time this runs, so
  // the shared cache entry is brought in line with it IMMEDIATELY — the entry
  // is what is mirrored into sessionStorage and painted first after a reload,
  // and leaving the row in it meant a refresh taken straight after a delete put
  // the influencer back until the background revalidation returned. The DELETE
  // is bracketed as a write on that key for the same reason: a revalidation
  // already in flight carries pre-delete rows, and data-cache discards a
  // response whose lifetime overlaps a write window.
  //
  // If the request fails the row is put back at its original position, so the
  // table shows it again rather than pretending it was deleted.
  const deleteRowNow = useCallback(
    async (rowId: string) => {
      if (!brandId) return

      manualRows.current.delete(rowId)

      // Cancel any pending update for this row
      const update = updateTimers.current.get(rowId)
      if (update) { clearTimeout(update); updateTimers.current.delete(rowId) }
      // The flush closure has to go with it. Left registered, a pagehide or an
      // unmount would fire the cancelled save — and since dbIds is only cleared
      // once the DELETE succeeds, a failed or still-in-flight delete would have
      // PUT the row straight back.
      pendingFlush.current.delete(rowId)

      // The row as the cache still holds it, and where it sits — both needed to
      // restore it untouched if the delete fails.
      const cachedIndex = rows.findIndex((r) => r.id === rowId)
      const cachedRow = cachedIndex >= 0 ? rows[cachedIndex] : null

      // If the row was never saved to DB (still temp), just clean up refs
      if (!dbIds.current.has(rowId)) {
        tempToReal.current.delete(rowId)
        // The handle is free again, or createRow would treat a re-add of the
        // same influencer as already saved and never POST it.
        if (cachedRow?.handle) {
          savedHandles.current.delete(`${cachedRow.handle.trim().replace(/^@/, "")}@${cachedRow.platform}`)
        }
        if (cachedIndex >= 0) setRows((prev) => prev.filter((r) => r.id !== rowId))
        return
      }

      // Opened BEFORE the optimistic removal, so the freshness stamp a failed
      // delete is rolled back to is the one from before this touched the entry.
      const cacheKey = `/api/brand/${brandId}/influencers`
      beginKeyWrite(cacheKey)
      beginExternalRequest()
      if (cachedIndex >= 0) setRows((prev) => prev.filter((r) => r.id !== rowId))
      let deleted = false

      try {
        const res = await trackSave(
          () => fetch(`/api/brand/${brandId}/influencers/${rowId}`, { method: "DELETE" }),
          (r) => r.ok || r.status === 404,
          "Removing influencer…"
        )
        if (res.ok || res.status === 404) {
          deleted = true
          // The route reports the id it deleted; fall back to the one asked for
          // when the row was already gone (404 has no body to read).
          const body = (await res.json().catch(() => ({}))) as { id?: string }
          const deletedId = body.id ?? rowId

          dbIds.current.delete(deletedId)
          tempToReal.current.delete(deletedId)
          lastSentPayloads.current.delete(deletedId)
          // Re-adding the same handle must create the influencer again rather
          // than being skipped as "already saved or in flight".
          if (cachedRow?.handle) {
            savedHandles.current.delete(`${cachedRow.handle.trim().replace(/^@/, "")}@${cachedRow.platform}`)
          }
          if (deletedId !== rowId) setRows((prev) => prev.filter((r) => r.id !== deletedId))

          // The Pipeline board keeps its own cached rows, so marking them
          // stale alone would still paint the deleted card until the
          // revalidation returned. Same helper the approval rollback uses.
          if (cachedRow?.brand_influencer_id) {
            unseedPipelineRow(brandId, cachedRow.brand_influencer_id)
          }
          invalidateInfluencerDerivedCaches(brandId)
          if (res.ok) notify("success", "Influencer removed")
        } else {
          const body = await res.json().catch(() => ({}))
          console.error(`DELETE influencer ${rowId} failed:`, res.status, body)
          // The row is restored either way by the `finally` below, so the list
          // still shows the influencer — the message just has to match why.
          notify(
            "error",
            res.status === 503
              ? "The server is busy right now. Your changes are safe. Please wait a moment and try again."
              : "Couldn't remove this influencer. Please try again."
          )
        }
      } catch (err) {
        console.error(`DELETE influencer ${rowId} threw:`, err)
        notify("error", "Couldn't remove this influencer — you appear to be offline.")
      } finally {
        // A failed delete puts the row back where it was, so the table picks it
        // up again on the next render and nothing was silently lost.
        if (!deleted && cachedRow) {
          setRows((prev) =>
            prev.some((r) => r.id === rowId)
              ? prev
              : [...prev.slice(0, cachedIndex), cachedRow, ...prev.slice(cachedIndex)]
          )
        }
        endExternalRequest()
        endKeyWrite(cacheKey, deleted)
      }
    },
    [brandId, rows, setRows, trackSave, notify]
  )

  /** Queued behind any delete still running — see `deleteChain`. */
  const handleDeleteRow = useCallback(
    (rowId: string) => {
      const next = deleteChain.current.then(() => deleteRowNow(rowId))
      // Never breaks the chain: deleteRowNow reports its own failures.
      deleteChain.current = next.catch(() => {})
      return next
    },
    [deleteRowNow]
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
    /**
     * Is this the database refusing another connection, rather than a fault?
     *
     * The read routes report capacity as a retryable 503 whose message is
     * "The database is temporarily out of connections…" (lib/db-capacity), and
     * the raw driver text can also reach here when a failure surfaces from
     * somewhere without that handling. Matched on the message, the same way the
     * two states above are — this is a transient, self-clearing condition, so
     * it gets wording that says "wait" rather than "something broke".
     */
    const isAtCapacity = (() => {
      const text = error.toLowerCase()
      return (
        text.includes("out of connections") ||
        text.includes("too many database connections") ||
        text.includes("max_user_connections") ||
        text.includes("too many clients") ||
        text.includes("timed out fetching a new connection")
      )
    })()
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
        <div className="flex flex-col items-center text-center">
          {/* Capacity is transient and nothing is lost, so it reads as the
              table's own empty state — same 15px/13px pair and grey palette as
              "No influencers yet" — rather than as a red fault. A genuine
              failure keeps the red heading it has always had. */}
          {isAtCapacity ? (
            <>
              <p className="text-[15px] font-medium text-gray-900 mb-1.5">
                We&apos;re having trouble loading your influencers
              </p>
              <p className="text-[13px] text-gray-500 max-w-xs leading-relaxed">
                The server is temporarily busy. Your data is safe. Please try again in a moment.
              </p>
            </>
          ) : (
            <>
              <p className="text-red-600 mb-2 font-medium">Failed to load influencers</p>
              <p className="text-sm text-gray-500">{error}</p>
            </>
          )}
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
          onRegisterIdSwap={handleRegisterIdSwap}
          onCreateDraft={handleCreateDraft}
          onContactHoldChange={handleContactHoldChange}
          // Deliberately NOT wired to reportSave.
          //
          // The enrichment's save is not a state the user needs narrated: the
          // row already shows its own fetching spinner, and the outcome is the
          // single "@handle details updated" notice raised by
          // handleFetchComplete. Routing it through the shared save state made
          // it announce "Saving changes…" and "Saved" around a write nobody
          // asked for, and let it overwrite the label of an add running at the
          // same time. Failures still surface — saveRowToDatabase raises its
          // own error toast.
          onSaveState={undefined}
          onEnrichmentStart={handleEnrichmentStart}
          onEnrichmentFailed={handleEnrichmentFailed}
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

      {/* The shared saving pill — bottom-right, identical to the Pipeline board,
          the Post Tracker and Brand Partners. The outcome moved to the top dock
          below. */}
      <div className="notice-dock">
        {/* One pill, but the ADD owns it while an add is in flight — it is the
            operation the user explicitly started, and it must never read
            "Saving changes…". A manual save overlapping it is still tracked and
            appears the moment the add finishes. */}
        <SaveStatusPill
          saving={addingCount > 0 || isSaving}
          failed={addingCount > 0 ? false : saveFailed}
          message={addingCount > 0 ? "Adding influencer…" : processingMessage ?? undefined}
          // An add confirms with "@handle added to Influencer List", so the
          // pill must not also say "Saved" as it closes.
          confirmsElsewhere={addingCount > 0}
        />
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
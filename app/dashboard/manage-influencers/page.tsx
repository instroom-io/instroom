// app/dashboard/manage-influencers/page.tsx
"use client"

import { useState, useRef, Suspense, useCallback, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

import TableSheet, {
  type InfluencerRow,
  type CustomColumn,
} from "@/components/table-sheet"
import { useInfluencerData } from "@/hooks/useInfluencerData"
import { LimitExceededDialog } from "@/components/limit-exceeded-dialog"
import { WorkspaceUnavailableModal } from "@/components/workspace-unavailable-modal"

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

// ─────────────────────────────────────────────────────────────────────────────
// Serial PUT queue
// ─────────────────────────────────────────────────────────────────────────────

type QueueItem = {
  url: string
  payload: string
  onError?: (status: number) => void
}

function createPutQueue() {
  const queue: QueueItem[] = []
  let running = false

  async function run() {
    if (running) return
    running = true
    while (queue.length > 0) {
      const item = queue.shift()!
      try {
        const res = await fetch(item.url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: item.payload,
        })
        if (!res.ok) item.onError?.(res.status)
      } catch {
        // Network error — silent
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

  const { rows, customColumns, isLoading, error, setCustomColumns } =
    useInfluencerData(brandId)

  // ── Auto-select owned brand if no brandId provided ──────────────────────────
  useEffect(() => {
    if (brandId) return
    const autoSelectBrand = async () => {
      try {
        const res = await fetch("/api/brand/list")
        if (res.ok) {
          const data = await res.json()
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

  // ── dbIds: real DB IDs confirmed saved for this brand ─────────────────────
  const dbIds = useRef<Set<string>>(new Set())
  const seededForBrand = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoading && brandId && seededForBrand.current !== brandId) {
      seededForBrand.current = brandId
      rows.forEach((r) => dbIds.current.add(r.id))
    }
  }, [isLoading, rows, brandId])

  // ── Brand name for modal ───────────────────────────────────────────────────
  const [selectedBrandName, setSelectedBrandName] = useState<string>("")
  useEffect(() => {
    if (!brandId) return
    const fetchBrandName = async () => {
      try {
        const res = await fetch(`/api/brands/me?brandId=${brandId}`)
        if (res.ok) {
          const data = await res.json()
          const brand = data.brands?.find((b: any) => b.id === brandId)
          if (brand) setSelectedBrandName(brand.name)
        }
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

  // ── Queues and timers ─────────────────────────────────────────────────────
  const putQueue = useRef(createPutQueue())
  const updateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ── savedHandles: "handle@platform" keys already saved or in-flight ───────
  // This is the ONLY dedup guard. Once set, we never POST again for this handle.
  const savedHandles = useRef<Set<string>>(new Set())

  // ── tempToReal: maps temp row ID → real DB ID after createRow resolves ────
  const tempToReal = useRef<Map<string, string>>(new Map())

  // ── fetchFallbackTimers: safety net if Instroom API never calls back ───────
  const fetchFallbackTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const idSwapCallback = useRef<((tempId: string, realId: string) => void) | null>(null)

  const { data: session } = useSession()

  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false)
  const [showWorkspaceUnavailableModal, setShowWorkspaceUnavailableModal] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ status: string; isExpired: boolean } | null>(null)
  const [showTrialLimitModal, setShowTrialLimitModal] = useState(false)

  const handleWorkspaceUnavailableClose = () => {
    setShowWorkspaceUnavailableModal(false)
    router.push("/dashboard")
  }

  // ── Fetch subscription status for trial limit detection ────────────────────
  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/subscription/status")
      .then(res => res.json())
      .then(data => setSubscriptionStatus(data))
      .catch(() => setSubscriptionStatus({ status: "inactive", isExpired: false }))
  }, [session?.user?.id])

  // ── scheduleUpdate: debounced PUT for already-saved rows ──────────────────
  const scheduleUpdate = useCallback(
    (row: InfluencerRow) => {
      if (!brandId || !dbIds.current.has(row.id)) return

      const existing = updateTimers.current.get(row.id)
      if (existing) clearTimeout(existing)

      const payload = JSON.stringify(buildUpdatePayload(row))
      const url = `/api/brand/${brandId}/influencers/${row.id}`
      const handle = row.handle

      const timer = setTimeout(() => {
        updateTimers.current.delete(row.id)
        if (!dbIds.current.has(row.id)) return
        putQueue.current.enqueue({
          url,
          payload,
          onError(status) {
            if (status === 404) {
              dbIds.current.delete(row.id)
              toast.error(`Could not save @${handle} — not found. Try refreshing.`)
            } else if (status !== 503) {
              toast.error(`Save failed (${status})`)
            }
          },
        })
      }, 1500)

      updateTimers.current.set(row.id, timer)
    },
    [brandId]
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

      // Cancel fallback timer — we're creating now
      const fallback = fetchFallbackTimers.current.get(row.id)
      if (fallback) {
        clearTimeout(fallback)
        fetchFallbackTimers.current.delete(row.id)
      }

      try {
        const res = await fetch("/api/influencers/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildCreatePayload(row, brandId)),
        })

        if (res.ok) {
          const created = await res.json()
          const realId: string = created.id || created.influencer_id

          dbIds.current.add(realId)
          tempToReal.current.set(row.id, realId)
          idSwapCallback.current?.(row.id, realId)

          if (!skipToast) toast.success(`@${handle} added`)
          return realId

        } else if (res.status === 409) {
          // Already exists globally — API links it to this brand
          const body = await res.json().catch(() => ({}))
          const existingId: string = body.id || body.influencer_id || row.id

          dbIds.current.add(existingId)
          tempToReal.current.set(row.id, existingId)
          if (existingId !== row.id) idSwapCallback.current?.(row.id, existingId)

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
            toast.error(body.error || "Influencer limit reached")
          }
          savedHandles.current.delete(key)
          return null

        } else {
          const body = await res.json().catch(() => ({}))
          if (!skipToast) toast.error(body.details || body.error || `Failed to save @${handle}`)
          savedHandles.current.delete(key)
          return null
        }
      } catch {
        if (!skipToast) toast.error(`Network error saving @${handle}`)
        savedHandles.current.delete(`${handle}@${row.platform}`)
        return null
      }
    },
    [brandId]
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
  //      nothing; createRow will land with the pre-enrichment data shortly.
  //      The enriched fields will be saved on the next user edit via scheduleUpdate.
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

      // Case D — createRow is in-flight; nothing to do right now.
      // The POST is already on its way with the pre-enrichment data.
      // Once it resolves the row will have a real ID and any subsequent
      // user edit will trigger scheduleUpdate with the latest data.
    },
    [brandId, createRow]
  )

  // ── handleRowsChange ──────────────────────────────────────────────────────
  // Called on every table edit (keystroke, dropdown change, etc.)
  //
  // For Instagram/TikTok rows we DO NOT create here — we wait for
  // handleFetchComplete (which carries enriched stats). A 5-second fallback
  // timer ensures we save even if the Instroom API never responds.
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

        // Instagram / TikTok — reset the fallback timer on each keystroke.
        // handleFetchComplete should fire and cancel this before it triggers.
        const existing = fetchFallbackTimers.current.get(row.id)
        if (existing) clearTimeout(existing)

        const timer = setTimeout(() => {
          fetchFallbackTimers.current.delete(row.id)
          if (!savedHandles.current.has(key) && !dbIds.current.has(row.id)) {
            createRow(row)
          }
        }, 5000)

        fetchFallbackTimers.current.set(row.id, timer)
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
        toast.success(
          `Imported ${savedCount} influencer${savedCount !== 1 ? "s" : ""}${
            skippedCount ? ` (${skippedCount} skipped — duplicates or limit reached)` : ""
          }`
        )
      else if (skippedCount > 0)
        toast.warning(`${skippedCount} rows skipped — already exist or limit reached`)
    },
    [brandId, createRow]
  )

  // ── handleDeleteRow ───────────────────────────────────────────────────────
  const handleDeleteRow = useCallback(
    async (rowId: string) => {
      if (!brandId) return

      // Cancel all pending timers for this row
      const fallback = fetchFallbackTimers.current.get(rowId)
      if (fallback) { clearTimeout(fallback); fetchFallbackTimers.current.delete(rowId) }
      const update = updateTimers.current.get(rowId)
      if (update) { clearTimeout(update); updateTimers.current.delete(rowId) }

      // If the row was never saved to DB (still temp), just clean up refs
      if (!dbIds.current.has(rowId)) {
        tempToReal.current.delete(rowId)
        return
      }

      try {
        const res = await fetch(`/api/brand/${brandId}/influencers/${rowId}`, {
          method: "DELETE",
        })
        if (res.ok || res.status === 404) {
          dbIds.current.delete(rowId)
          tempToReal.current.delete(rowId)
          if (res.ok) toast.success("Influencer removed")
        } else {
          const body = await res.json().catch(() => ({}))
          toast.error(body.error || "Failed to delete")
        }
      } catch {
        toast.error("Network error — could not delete")
      }
    },
    [brandId]
  )

  // ── handleCustomColumnsChange ─────────────────────────────────────────────
  const handleCustomColumnsChange = useCallback(
    async (cols: CustomColumn[]) => {
      setCustomColumns(cols)
      if (!brandId) return
      for (const col of cols) {
        try {
          await fetch(`/api/brand/${brandId}/custom-fields`, {
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
        } catch (err) {
          console.error("[custom-fields] error:", err)
        }
      }
    },
    [brandId, setCustomColumns]
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

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-2 font-medium">Failed to load influencers</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 relative min-h-screen">
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading influencers…</p>
          </div>
        </div>
      ) : (
        <TableSheet
          initialRows={rows}
          initialCustomColumns={customColumns}
          onRowsChange={handleRowsChange}
          onDeleteRow={handleDeleteRow}
          onFetchComplete={handleFetchComplete}
          onCustomColumnsChange={handleCustomColumnsChange}
          onImportRows={handleImportRows}
          onRegisterIdSwap={(fn) => {
            idSwapCallback.current = fn
          }}
          brandId={brandId}
          subscriptionStatus={subscriptionStatus}
          onShowTrialModal={() => setShowTrialLimitModal(true)}
        />
      )}

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
                Upgrade to use the influencer list
              </h2>
              <p
                className="text-sm leading-relaxed mx-auto"
                style={{ color: "#6b7280", maxWidth: 280 }}
              >
                You're currently on a free trial. Upgrade to a paid plan to access the influencer list.
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
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <InfluencersContent />
    </Suspense>
  )
}
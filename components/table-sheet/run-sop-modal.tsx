"use client"

// Run SOP — start a research run from the Influencer List, follow its progress,
// review each proposed field, and apply what was approved. Also lists past runs.
//
// The browser drives processing: it calls /process one bounded batch at a time
// until the run finishes, so no request is long-running. Closing the modal just
// pauses that loop — reopening the run from History resumes it.

import { useCallback, useEffect, useMemo, useState } from "react"
import { IconCheck, IconClipboardList, IconHistory, IconLoader2, IconX } from "@tabler/icons-react"
import { RESEARCH_FIELD_LABELS, isResearchField } from "@/lib/research-sop/fields"
import { getPlatformLabel } from "./utils"

type TargetMode = "selected" | "missing" | "all"
type RunStatus = "queued" | "running" | "completed" | "needs_review" | "failed"

interface SopSummary {
  id: string
  name: string
  version: number
  status: string
  steps: { target_field: string | null; title: string }[]
}

interface RunSummary {
  id: string
  sop_name: string
  sop_version: number
  target_mode: TargetMode
  status: RunStatus
  total_count: number
  processed_count: number
  completed_count: number
  needs_review_count: number
  failed_count: number
  started_by_name: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

interface RunResult {
  id: string
  brand_influencer_id: string
  field: string | null
  current_value: string | null
  proposed_value: string | null
  source: string | null
  confidence: number | null
  value_type: string | null
  status: string
  evidence: string | null
  error: string | null
  influencer: { handle: string; platform: string; full_name: string | null } | null
}

type RunDetail = RunSummary & { results: RunResult[] }

export interface AppliedChange {
  brand_influencer_id: string
  field: string
  value: string
}

const TARGET_LABELS: Record<TargetMode, string> = {
  selected: "Selected influencers",
  missing: "Influencers with missing information",
  all: "All influencers",
}

const RUN_STATUS_STYLE: Record<RunStatus, string> = {
  queued: "bg-gray-100 text-gray-600",
  running: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  needs_review: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
}

const RESULT_STATUS: Record<string, { label: string; className: string }> = {
  proposed:     { label: "Ready to review", className: "bg-blue-50 text-blue-700" },
  needs_review: { label: "Needs review",    className: "bg-amber-50 text-amber-700" },
  conflict:     { label: "Changed since run", className: "bg-orange-50 text-orange-700" },
  approved:     { label: "Approved",        className: "bg-green-50 text-green-700" },
  rejected:     { label: "Rejected",        className: "bg-gray-100 text-gray-500" },
  applied:      { label: "Applied",         className: "bg-green-100 text-green-800" },
  unchanged:    { label: "Already correct", className: "bg-gray-100 text-gray-500" },
  not_found:    { label: "Not found",       className: "bg-gray-100 text-gray-500" },
  failed:       { label: "Failed",          className: "bg-red-50 text-red-700" },
}

const DECIDABLE = new Set(["proposed", "needs_review", "conflict", "approved", "rejected"])
const FINISHED: RunStatus[] = ["completed", "needs_review", "failed"]

const runLabel = (s: RunStatus) => (s === "needs_review" ? "Needs review" : s.charAt(0).toUpperCase() + s.slice(1))
const fieldLabel = (f: string | null) => (f && isResearchField(f) ? RESEARCH_FIELD_LABELS[f] : "Influencer")
const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—")

export function RunSopModal({
  brandId,
  selectedInfluencerIds,
  initialTarget,
  onClose,
  onNotify,
  onApplied,
}: {
  brandId: string
  /** Influencer ids from the sheet's selection, temp rows already removed. */
  selectedInfluencerIds: string[]
  initialTarget: TargetMode
  onClose: () => void
  onNotify: (type: "success" | "error" | "warning" | "info", message: string) => void
  onApplied: (changes: AppliedChange[]) => void
}) {
  const [view, setView] = useState<"start" | "run" | "history">("start")
  const [sops, setSops] = useState<SopSummary[] | null>(null)
  const [sopId, setSopId] = useState("")
  const [target, setTarget] = useState<TargetMode>(selectedInfluencerIds.length ? initialTarget : initialTarget === "selected" ? "missing" : initialTarget)
  const [starting, setStarting] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [run, setRun] = useState<RunDetail | null>(null)
  const [history, setHistory] = useState<RunSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState("")

  const base = `/api/brand/${brandId}/research-sops`

  // Esc closes, like the sheet's other dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    fetch(base)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return
        if (!ok) { setLoadError(j.error || "Couldn't load SOPs"); setSops([]); return }
        const active = (j.data as SopSummary[]).filter((s) => s.status === "active")
        setSops(active)
        if (active[0]) setSopId(active[0].id)
      })
      .catch(() => { if (!cancelled) { setLoadError("Couldn't load SOPs"); setSops([]) } })
    return () => { cancelled = true }
  }, [base])

  const selectedSop = sops?.find((s) => s.id === sopId) ?? null
  const sopFields = useMemo(
    () => Array.from(new Set((selectedSop?.steps ?? []).map((s) => s.target_field).filter(isResearchField))),
    [selectedSop]
  )

  const loadRun = useCallback(async (id: string) => {
    const res = await fetch(`${base}/runs/${id}`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || "Couldn't load this run")
    setRun(json.data)
    return json.data as RunDetail
  }, [base])

  // Drive processing while the run view is open and the run is unfinished. A
  // second loop (another tab, a quick reopen) is harmless: the server's batch
  // lease answers it with "busy" instead of processing twice.
  useEffect(() => {
    if (view !== "run" || !runId) return
    let cancelled = false
    ;(async () => {
      try {
        let detail = await loadRun(runId)
        while (!cancelled && !FINISHED.includes(detail.status)) {
          const res = await fetch(`${base}/runs/${runId}/process`, { method: "POST" })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(json.error || "Research stopped unexpectedly")
          if (cancelled) break
          if (json.outcome === "busy") await new Promise((r) => setTimeout(r, 3000))
          if (json.data) setRun((prev) => (prev ? { ...prev, ...json.data } : prev))
          detail = { ...detail, ...json.data }
        }
        if (!cancelled) await loadRun(runId)
      } catch (e) {
        if (!cancelled) onNotify("error", e instanceof Error ? e.message : "Research stopped unexpectedly")
      }
    })()
    return () => { cancelled = true }
  }, [view, runId, base, loadRun, onNotify])

  const start = async () => {
    if (!sopId) return
    setStarting(true)
    try {
      const res = await fetch(`${base}/${sopId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_mode: target,
          influencer_ids: target === "selected" ? selectedInfluencerIds : [],
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Couldn't start research")
      if (json.truncated) {
        onNotify("warning", `Researching the first ${json.data.total_count} of ${json.eligible_count} influencers.`)
      }
      setRun(null)
      setRunId(json.data.id)
      setView("run")
    } catch (e) {
      onNotify("error", e instanceof Error ? e.message : "Couldn't start research")
    } finally {
      setStarting(false)
    }
  }

  const openHistory = async () => {
    setView("history")
    setHistory(null)
    try {
      const res = await fetch(`${base}/runs`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Couldn't load run history")
      setHistory(json.data)
    } catch (e) {
      onNotify("error", e instanceof Error ? e.message : "Couldn't load run history")
      setHistory([])
    }
  }

  const decide = async (ids: string[], decision: "approve" | "reject") => {
    if (!runId || !ids.length) return
    setBusy(true)
    try {
      const res = await fetch(`${base}/runs/${runId}/results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result_ids: ids, decision }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Couldn't save your decision")
      await loadRun(runId)
    } catch (e) {
      onNotify("error", e instanceof Error ? e.message : "Couldn't save your decision")
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!runId) return
    setBusy(true)
    try {
      const res = await fetch(`${base}/runs/${runId}/apply`, { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Couldn't apply changes")
      const { applied, conflicts, failed, changes } = json.data as {
        applied: number; conflicts: number; failed: number; changes: AppliedChange[]
      }
      if (applied) onApplied(changes ?? [])
      const parts = [`${applied} change${applied === 1 ? "" : "s"} applied`]
      if (conflicts) parts.push(`${conflicts} changed since the run — review again`)
      if (failed) parts.push(`${failed} failed`)
      onNotify(conflicts || failed ? "warning" : "success", parts.join(" · "))
      await loadRun(runId)
    } catch (e) {
      onNotify("error", e instanceof Error ? e.message : "Couldn't apply changes")
    } finally {
      setBusy(false)
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, RunResult[]>()
    for (const r of run?.results ?? []) {
      const list = map.get(r.brand_influencer_id) ?? []
      list.push(r)
      map.set(r.brand_influencer_id, list)
    }
    return Array.from(map.values())
  }, [run])

  const pendingIds = (run?.results ?? []).filter((r) => r.status === "proposed" || r.status === "needs_review").map((r) => r.id)
  const approvedCount = (run?.results ?? []).filter((r) => r.status === "approved").length
  const finished = run ? FINISHED.includes(run.status) : false

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Run SOP"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:w-[760px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
          <IconClipboardList size={18} className="text-[#0F6B3E]" />
          <h3 className="text-sm font-semibold text-gray-900">
            {view === "history" ? "SOP run history" : view === "run" ? (run ? `${run.sop_name} · v${run.sop_version}` : "Research") : "Run SOP"}
          </h3>
          <div className="ml-auto flex items-center gap-1">
            {view !== "history" && (
              <button onClick={openHistory} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-50 hover:text-gray-800">
                <IconHistory size={14} /> History
              </button>
            )}
            {view !== "start" && (
              <button onClick={() => setView("start")} className="rounded-lg px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-50 hover:text-gray-800">
                New run
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700">
              <IconX size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {view === "start" && (
            sops === null ? (
              <p className="flex items-center gap-2 text-sm text-gray-500"><IconLoader2 size={16} className="animate-spin" /> Loading SOPs…</p>
            ) : !sops.length ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                {loadError || "There's no active SOP yet. Create and activate one in Settings → Workspace → SOPs."}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">SOP</label>
                  <select value={sopId} onChange={(e) => setSopId(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]">
                    {sops.map((s) => <option key={s.id} value={s.id}>{s.name} (v{s.version})</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-500">Targets</label>
                  {(Object.keys(TARGET_LABELS) as TargetMode[]).map((mode) => {
                    const disabled = mode === "selected" && !selectedInfluencerIds.length
                    return (
                      <label key={mode} className={`flex items-center gap-2 text-sm ${disabled ? "text-gray-300" : "text-gray-700"}`}>
                        <input type="radio" name="sop-target" checked={target === mode} disabled={disabled} onChange={() => setTarget(mode)} />
                        {TARGET_LABELS[mode]}
                        {mode === "selected" && selectedInfluencerIds.length > 0 && <span className="text-xs text-gray-400">({selectedInfluencerIds.length})</span>}
                      </label>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-500">Fields</label>
                  <div className="flex flex-wrap gap-1.5">
                    {sopFields.map((f) => (
                      <span key={f} className="rounded-full border border-[#1FAE5B]/30 bg-[#1FAE5B]/10 px-2.5 py-1 text-xs font-medium text-[#0F6B3E]">
                        {RESEARCH_FIELD_LABELS[f]}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Research only proposes changes. Nothing on an influencer is updated until you approve and apply it.
                </p>
              </div>
            )
          )}

          {view === "run" && (
            !run ? (
              <p className="flex items-center gap-2 text-sm text-gray-500"><IconLoader2 size={16} className="animate-spin" /> Starting…</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${RUN_STATUS_STYLE[run.status]}`}>{runLabel(run.status)}</span>
                    {!finished && <IconLoader2 size={14} className="animate-spin text-blue-600" />}
                    <span>{run.processed_count} of {run.total_count} researched</span>
                    <span className="text-gray-300">·</span>
                    <span>{run.completed_count} completed</span>
                    <span className="text-gray-300">·</span>
                    <span>{run.needs_review_count} need review</span>
                    <span className="text-gray-300">·</span>
                    <span className={run.failed_count ? "text-red-600" : ""}>{run.failed_count} failed</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-[#1FAE5B] transition-all"
                      style={{ width: `${run.total_count ? Math.round((run.processed_count / run.total_count) * 100) : 0}%` }} />
                  </div>
                </div>

                {grouped.map((results) => {
                  const inf = results[0].influencer
                  return (
                    <div key={results[0].brand_influencer_id} className="rounded-lg border border-gray-200">
                      <div className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-900">
                        @{inf?.handle ?? "unknown"}
                        {inf && <span className="ml-2 text-xs font-normal text-gray-400">{getPlatformLabel(inf.platform)}</span>}
                      </div>
                      <ul className="divide-y divide-gray-100">
                        {results.map((r) => {
                          const status = RESULT_STATUS[r.status] ?? { label: r.status, className: "bg-gray-100 text-gray-600" }
                          const canDecide = finished && DECIDABLE.has(r.status) && r.proposed_value !== null && r.field !== null
                          return (
                            <li key={r.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start">
                              <div className="min-w-0 flex-1 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-gray-800">{fieldLabel(r.field)}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
                                  {r.confidence !== null && r.proposed_value !== null && (
                                    <span className="text-gray-500">{Math.round(r.confidence * 100)}% confidence</span>
                                  )}
                                  {r.value_type && r.proposed_value !== null && <span className="text-gray-400">{r.value_type}</span>}
                                </div>
                                {r.field ? (
                                  <div className="mt-1 break-words text-gray-700">
                                    {r.proposed_value !== null ? (
                                      <>
                                        <span className="text-gray-400 line-through">{r.current_value || "empty"}</span>
                                        {" → "}
                                        <span className="font-medium text-gray-900">{r.proposed_value.length > 160 ? `${r.proposed_value.slice(0, 160)}…` : r.proposed_value}</span>
                                      </>
                                    ) : (
                                      <span className="text-gray-400">Current: {r.current_value || "empty"}</span>
                                    )}
                                  </div>
                                ) : null}
                                {(r.source || r.evidence) && (
                                  <p className="mt-0.5 text-[11px] text-gray-400">
                                    {r.source && <>Source: {r.source}</>}
                                    {r.source && r.evidence && " · "}
                                    {r.evidence}
                                  </p>
                                )}
                                {r.error && <p className="mt-0.5 text-[11px] text-red-600">{r.error}</p>}
                              </div>
                              {canDecide && (
                                <div className="flex flex-shrink-0 gap-1.5">
                                  <button disabled={busy || r.status === "rejected"} onClick={() => decide([r.id], "reject")}
                                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 disabled:opacity-40">
                                    Reject
                                  </button>
                                  <button disabled={busy || r.status === "approved"} onClick={() => decide([r.id], "approve")}
                                    className="flex items-center gap-1 rounded-lg bg-[#1FAE5B] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[#178a48] disabled:opacity-40">
                                    <IconCheck size={12} /> Approve
                                  </button>
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {view === "history" && (
            history === null ? (
              <p className="flex items-center gap-2 text-sm text-gray-500"><IconLoader2 size={16} className="animate-spin" /> Loading history…</p>
            ) : !history.length ? (
              <p className="text-sm text-gray-500">No SOP runs yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {history.map((h) => (
                  <li key={h.id}>
                    <button onClick={() => { setRun(null); setRunId(h.id); setView("run") }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-left transition hover:border-[#0F6B3E]/40 hover:bg-green-50/40">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-gray-900">{h.sop_name}</span>
                        <span className="text-xs text-gray-400">v{h.sop_version}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RUN_STATUS_STYLE[h.status]}`}>{runLabel(h.status)}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {TARGET_LABELS[h.target_mode]} · {h.total_count} influencer{h.total_count === 1 ? "" : "s"} · {h.completed_count} completed · {h.needs_review_count} need review · {h.failed_count} failed
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Started {formatDateTime(h.started_at ?? h.created_at)}{h.started_by_name ? ` by ${h.started_by_name}` : ""}
                        {h.finished_at ? ` · Finished ${formatDateTime(h.finished_at)}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>

        {/* Footer */}
        {view === "start" && sops && sops.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
            <button onClick={onClose} className="rounded-lg border border-gray-200 px-5 py-1.5 text-sm font-medium text-gray-600 transition hover:border-gray-300">Cancel</button>
            <button onClick={start} disabled={starting || !sopId || !sopFields.length}
              className="rounded-lg bg-[#1FAE5B] px-5 py-1.5 text-sm font-medium text-white transition hover:bg-[#178a48] disabled:opacity-50">
              {starting ? "Starting…" : "Start Research"}
            </button>
          </div>
        )}
        {view === "run" && run && finished && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
            {pendingIds.length > 0 && (
              <>
                <button disabled={busy} onClick={() => decide(pendingIds, "reject")}
                  className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 transition hover:border-gray-300 disabled:opacity-50">
                  Reject all
                </button>
                <button disabled={busy} onClick={() => decide(pendingIds, "approve")}
                  className="rounded-lg border border-[#1FAE5B]/40 px-4 py-1.5 text-sm font-medium text-[#0F6B3E] transition hover:bg-green-50 disabled:opacity-50">
                  Approve all ({pendingIds.length})
                </button>
              </>
            )}
            <button disabled={busy || approvedCount === 0} onClick={apply}
              className="rounded-lg bg-[#1FAE5B] px-5 py-1.5 text-sm font-medium text-white transition hover:bg-[#178a48] disabled:opacity-50">
              {busy ? "Saving…" : `Apply approved (${approvedCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

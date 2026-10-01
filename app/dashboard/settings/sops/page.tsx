"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, ArrowDown, ArrowUp, ClipboardList, Copy, Pencil, Plus, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingsSkeleton } from "@/components/shared/skeletons"
import { useBrandCapabilities } from "@/hooks/useBrandCapabilities"
import { RESEARCH_FIELDS, RESEARCH_FIELD_LABELS, type ResearchField } from "@/lib/research-sop/fields"

interface SopStep {
  title: string
  instructions: string
  required: boolean
  target_field: ResearchField | null
  verification_required: boolean
  notes: string
}

interface Sop {
  id: string
  name: string
  description: string | null
  applies_to: string
  status: "draft" | "active" | "archived"
  version: number
  created_by_name: string | null
  updated_at: string
  steps: (SopStep & { id: string; position: number; instructions: string | null; notes: string | null })[]
}

interface Draft {
  id: string | null
  name: string
  description: string
  steps: SopStep[]
}

const STATUS_STYLE: Record<Sop["status"], string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  archived: "bg-amber-50 text-amber-700 border-amber-200",
}

const blankStep = (): SopStep => ({
  title: "",
  instructions: "",
  required: true,
  target_field: null,
  verification_required: false,
  notes: "",
})

const TEXTAREA =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function SopsContent() {
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId")
  const { canManageCampaigns: canManage, loading: capsLoading } = useBrandCapabilities(brandId)

  const [sops, setSops] = useState<Sop[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [viewing, setViewing] = useState<Sop | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!brandId) return
    try {
      const res = await fetch(`/api/brand/${brandId}/research-sops${showArchived ? "?include_archived=1" : ""}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Couldn't load SOPs")
      setSops(json.data ?? [])
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load SOPs")
    } finally {
      setLoaded(true)
    }
  }, [brandId, showArchived])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(""), 3000)
    return () => clearTimeout(t)
  }, [notice])

  const call = async (id: string, url: string, init: RequestInit, success: string) => {
    setBusyId(id)
    setError("")
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Something went wrong")
      setNotice(success)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setBusyId(null)
    }
  }

  const setStatus = (sop: Sop, status: Sop["status"], success: string) =>
    call(sop.id, `/api/brand/${brandId}/research-sops/${sop.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, success)

  const duplicate = (sop: Sop) =>
    call(sop.id, `/api/brand/${brandId}/research-sops/${sop.id}/duplicate`, { method: "POST" }, "SOP duplicated as a draft")

  const openEditor = (sop?: Sop) => {
    setError("")
    setViewing(null)
    setDraft(
      sop
        ? {
            id: sop.id,
            name: sop.name,
            description: sop.description ?? "",
            steps: sop.steps.map((s) => ({
              title: s.title,
              instructions: s.instructions ?? "",
              required: s.required,
              target_field: s.target_field,
              verification_required: s.verification_required,
              notes: s.notes ?? "",
            })),
          }
        : { id: null, name: "", description: "", steps: [blankStep()] }
    )
  }

  const save = async () => {
    if (!draft || !brandId) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(
        draft.id ? `/api/brand/${brandId}/research-sops/${draft.id}` : `/api/brand/${brandId}/research-sops`,
        {
          method: draft.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            description: draft.description || null,
            applies_to: "influencer",
            steps: draft.steps,
          }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Couldn't save the SOP")
      setDraft(null)
      setNotice(draft.id ? "SOP saved as a new version" : "SOP created as a draft")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the SOP")
    } finally {
      setSaving(false)
    }
  }

  const updateStep = (index: number, patch: Partial<SopStep>) =>
    setDraft((d) => d && { ...d, steps: d.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) })

  const moveStep = (index: number, delta: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d
      const target = index + delta
      if (target < 0 || target >= d.steps.length) return d
      const steps = [...d.steps]
      ;[steps[index], steps[target]] = [steps[target], steps[index]]
      return { ...d, steps }
    })

  if (!brandId) {
    return (
      <div className="max-w-3xl px-4 py-5 sm:px-6 sm:py-6 md:px-9 md:py-7">
        <Card><CardContent className="p-5 text-sm text-muted-foreground">Please select a brand to manage SOPs.</CardContent></Card>
      </div>
    )
  }
  if (!loaded || capsLoading) return <SettingsSkeleton sections={[{ fields: 3 }]} label="Loading SOPs…" />

  return (
    <div className="max-w-4xl px-4 py-5 sm:px-6 sm:py-6 md:px-9 md:py-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">SOPs</h1>
          <p className="text-xs text-muted-foreground">
            Research procedures your team runs from the Influencer List. Results are always reviewed before they change a record.
          </p>
        </div>
        {canManage && !draft && (
          <Button onClick={() => openEditor()} className="bg-[#15803d] text-white hover:bg-[#166534]">
            <Plus className="h-4 w-4" /> Create SOP
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{notice}</div>
      )}

      {draft ? (
        <SopEditor
          draft={draft}
          saving={saving}
          onChange={setDraft}
          onUpdateStep={updateStep}
          onMoveStep={moveStep}
          onCancel={() => { setDraft(null); setError("") }}
          onSave={save}
        />
      ) : viewing ? (
        <SopView sop={viewing} onClose={() => setViewing(null)} />
      ) : (
        <Card className="mb-4 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
                <ClipboardList className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-foreground">Research SOPs</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
          </div>
          {sops.length === 0 ? (
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No SOPs yet.{canManage ? " Create one to guide influencer research." : ""}
            </CardContent>
          ) : (
            <ul className="divide-y">
              {sops.map((sop) => (
                <li key={sop.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setViewing(sop)} className="truncate text-left text-sm font-semibold text-foreground hover:text-[#15803d]">
                        {sop.name}
                      </button>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[sop.status]}`}>
                        {sop.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">v{sop.version}</span>
                    </div>
                    {sop.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{sop.description}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Applies to {sop.applies_to} · {sop.steps.length} step{sop.steps.length === 1 ? "" : "s"} · Updated {formatDate(sop.updated_at)}
                      {sop.created_by_name ? ` · Created by ${sop.created_by_name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setViewing(sop)}>View</Button>
                    {canManage && (
                      <>
                        {sop.status !== "archived" && (
                          <Button size="sm" variant="outline" onClick={() => openEditor(sop)} disabled={busyId === sop.id}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => duplicate(sop)} disabled={busyId === sop.id}>
                          <Copy className="h-3.5 w-3.5" /> Duplicate
                        </Button>
                        {sop.status === "draft" && (
                          <Button size="sm" onClick={() => setStatus(sop, "active", "SOP activated")} disabled={busyId === sop.id} className="bg-[#15803d] text-white hover:bg-[#166534]">
                            Activate
                          </Button>
                        )}
                        {sop.status === "active" && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(sop, "draft", "SOP deactivated")} disabled={busyId === sop.id}>
                            Deactivate
                          </Button>
                        )}
                        {sop.status !== "archived" ? (
                          <Button size="sm" variant="outline" onClick={() => setStatus(sop, "archived", "SOP archived")} disabled={busyId === sop.id} className="text-red-600 hover:text-red-700">
                            Archive
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setStatus(sop, "draft", "SOP restored as a draft")} disabled={busyId === sop.id}>
                            Restore
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}

function SopView({ sop, onClose }: { sop: Sop; onClose: () => void }) {
  return (
    <Card className="mb-4">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{sop.name} <span className="text-xs font-normal text-muted-foreground">v{sop.version}</span></p>
          {sop.description && <p className="text-xs text-muted-foreground">{sop.description}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>Back</Button>
      </div>
      <CardContent className="pt-4">
        <ol className="flex flex-col gap-3">
          {sop.steps.map((s) => (
            <li key={s.id} className="rounded-lg border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{s.position}.</span>
                <span className="text-sm font-medium text-foreground">{s.title}</span>
                {s.target_field && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    → {RESEARCH_FIELD_LABELS[s.target_field]}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">{s.required ? "Required" : "Optional"}</span>
                {s.verification_required && <span className="text-[10px] font-medium text-amber-700">Manual verification</span>}
              </div>
              {s.instructions && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{s.instructions}</p>}
              {s.notes && <p className="mt-1 whitespace-pre-wrap text-[11px] italic text-muted-foreground">{s.notes}</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function SopEditor({
  draft, saving, onChange, onUpdateStep, onMoveStep, onCancel, onSave,
}: {
  draft: Draft
  saving: boolean
  onChange: (d: Draft) => void
  onUpdateStep: (index: number, patch: Partial<SopStep>) => void
  onMoveStep: (index: number, delta: -1 | 1) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <Card className="mb-4">
      <div className="border-b px-5 py-3">
        <p className="text-sm font-semibold text-foreground">{draft.id ? "Edit SOP" : "New SOP"}</p>
        <p className="text-xs text-muted-foreground">
          {draft.id ? "Saving creates a new version. Past runs keep the version they used." : "New SOPs start as drafts — activate one to make it runnable."}
        </p>
      </div>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs">SOP name</Label>
            <Input value={draft.name} maxLength={150} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="e.g. Influencer Research" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Applies to</Label>
            <Input value="Influencer" disabled />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Description</Label>
          <textarea className={TEXTAREA} rows={2} value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} placeholder="What this procedure is for" />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Steps</Label>
          <span className="text-[11px] text-muted-foreground">{draft.steps.length} / 30</span>
        </div>
        <ol className="flex flex-col gap-3">
          {draft.steps.map((step, i) => (
            <li key={i} className="rounded-lg border p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move step up" disabled={i === 0} onClick={() => onMoveStep(i, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move step down" disabled={i === draft.steps.length - 1} onClick={() => onMoveStep(i, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" aria-label="Remove step" disabled={draft.steps.length === 1}
                    onClick={() => onChange({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs">Title</Label>
                  <Input value={step.title} maxLength={200} onChange={(e) => onUpdateStep(i, { title: e.target.value })} placeholder="e.g. Determine creator location" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Maps to field</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={step.target_field ?? ""}
                    onChange={(e) => onUpdateStep(i, { target_field: (e.target.value || null) as ResearchField | null })}
                  >
                    <option value="">No field (guidance only)</option>
                    {RESEARCH_FIELDS.map((f) => <option key={f} value={f}>{RESEARCH_FIELD_LABELS[f]}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <Label className="mb-1.5 block text-xs">Instructions</Label>
                <textarea className={TEXTAREA} rows={2} value={step.instructions} onChange={(e) => onUpdateStep(i, { instructions: e.target.value })} placeholder="How this step should be researched" />
              </div>
              <div className="mt-3">
                <Label className="mb-1.5 block text-xs">Notes</Label>
                <textarea className={TEXTAREA} rows={1} value={step.notes} onChange={(e) => onUpdateStep(i, { notes: e.target.value })} placeholder="Optional — e.g. how to handle uncertain answers" />
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-foreground">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={step.required} onChange={(e) => onUpdateStep(i, { required: e.target.checked })} />
                  Required
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={step.verification_required} onChange={(e) => onUpdateStep(i, { verification_required: e.target.checked })} />
                  Always flag for manual verification
                </label>
              </div>
            </li>
          ))}
        </ol>
        <div>
          <Button variant="outline" size="sm" disabled={draft.steps.length >= 30} onClick={() => onChange({ ...draft, steps: [...draft.steps, blankStep()] })}>
            <Plus className="h-3.5 w-3.5" /> Add step
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="bg-[#15803d] text-white hover:bg-[#166534]">
            {saving ? "Saving…" : draft.id ? "Save new version" : "Create SOP"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SopsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton sections={[{ fields: 3 }]} label="Loading SOPs…" />}>
      <SopsContent />
    </Suspense>
  )
}

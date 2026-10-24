"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, ArrowDown, ArrowUp, ClipboardList, Copy, Eye, FileText, Info, Pencil, Plus, Trash2, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingsSkeleton } from "@/components/shared/skeletons"
import { useBrandCapabilities } from "@/hooks/useBrandCapabilities"
import { SopDocument } from "@/components/research-sop/sop-document"
import { SopMarkdown, SOP_SNIPPETS } from "@/components/research-sop/sop-markdown"

// A stored step is one SECTION of the SOP document: a heading plus rich
// content (procedure, rules, decision points, examples, callouts, tables…).
// It is documentation for the researcher — never tied to an influencer field.
interface SopStep {
  title: string
  instructions: string
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

// "active" is shown as Published: it's the version researchers see.
const STATUS_LABEL: Record<Sop["status"], string> = {
  active: "Published",
  draft: "Draft",
  archived: "Archived",
}

const STATUS_STYLE: Record<Sop["status"], string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  archived: "bg-amber-50 text-amber-700 border-amber-200",
}

const blankStep = (): SopStep => ({ title: "", instructions: "", notes: "" })

// A starting point for a new SOP — ordinary editable content, not logic.
const EXAMPLE_SOP: Omit<Draft, "id"> = {
  name: "Influencer Profile Research",
  description: "Explain the standard procedure researchers follow when researching an influencer, so every profile is researched and verified the same way.",
  steps: [
    {
      title: "Procedure",
      instructions: [
        "1. Start with the provided influencer handle.",
        "2. Verify that the account belongs to the correct person.",
        "   - Check the name, profile photo and linked accounts match.",
        "3. Check the profile and relevant public sources.",
        "4. Determine location, niche, audience information and other relevant details.",
        "5. Cross-check information when necessary.",
        "6. Record evidence and sources for every finding.",
        "7. If information cannot be verified, follow the fallback procedure below rather than guessing.",
      ].join("\n"),
      notes: "",
    },
    {
      title: "Verification rules",
      instructions: [
        "- A finding counts as verified only when it is stated by the influencer or a reliable public source.",
        "- Record **where** each finding came from (profile bio, website, recent post…).",
        "",
        "> [!DONT]",
        "> - Don't infer a location from a single post or hashtag.",
        "> - Don't record a guess as a fact.",
      ].join("\n"),
      notes: "",
    },
    {
      title: "If the primary source is unavailable",
      instructions: [
        "**If** the profile is private or the information isn't on it:",
        "- Check the linked website or other social accounts.",
        "- Check recent content for an explicit mention.",
        "",
        "> [!WARNING]",
        "> If it still can't be confirmed, mark the information as **uncertain** and note what you checked.",
      ].join("\n"),
      notes: "",
    },
    {
      title: "Research criteria",
      instructions: [
        "| Field | What to record | Example |",
        "|---|---|---|",
        "| Location | Country (City if stated) | Philippines |",
        "| Niche | Primary content category | Beauty |",
        "| Followers | Current count on the profile | 12.3K |",
        "| Contact | Public business email only | hello@brand.com |",
      ].join("\n"),
      notes: "",
    },
  ],
}

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
  // "What is this?" popup — shown on the first visit, reopenable from the title.
  // Read once on the client; the page shows its skeleton until data loads, so
  // the popup never takes part in hydration.
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === "undefined") return false
    try { return !localStorage.getItem(INTRO_SEEN_KEY) } catch { return true }
  })
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

  const closeIntro = () => {
    setShowIntro(false)
    try { localStorage.setItem(INTRO_SEEN_KEY, "1") } catch {}
  }

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
            // Sections are documentation: no field mapping, no execution flags.
            steps: draft.steps.map((st) => ({ ...st, target_field: null, required: true, verification_required: false })),
          }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Couldn't save the SOP")
      setDraft(null)
      setNotice(draft.id ? "SOP saved as a new version" : "SOP saved as a draft")
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
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">SOPs</h1>
            <button onClick={() => setShowIntro(true)} className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground">
              <Info className="h-3.5 w-3.5" /> What is this?
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your team&apos;s research playbook — step-by-step procedures researchers read and follow while researching influencers.
          </p>
        </div>
        {canManage && !draft && (
          <Button onClick={() => openEditor()} className="bg-[#15803d] text-white hover:bg-[#166534]">
            <Plus className="h-4 w-4" /> Create SOP
          </Button>
        )}
      </div>

      {showIntro && <SopIntroModal onClose={closeIntro} />}

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
              No SOPs yet.{canManage ? " Write your first research procedure so the whole team researches the same way." : ""}
            </CardContent>
          ) : (
            <ul className="divide-y">
              {sops.map((sop) => (
                <li key={sop.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setViewing(sop)} className="flex items-center gap-1.5 truncate text-left text-sm font-semibold text-foreground hover:text-[#15803d]">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {sop.name}
                      </button>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[sop.status]}`}>
                        {STATUS_LABEL[sop.status]}
                      </span>
                      <span className="text-[11px] text-muted-foreground">v{sop.version}</span>
                    </div>
                    {sop.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{sop.description}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Influencer research · {sop.steps.length} section{sop.steps.length === 1 ? "" : "s"} · Updated {formatDate(sop.updated_at)}
                      {sop.created_by_name ? ` · Created by ${sop.created_by_name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setViewing(sop)}><Eye className="h-3.5 w-3.5" /> Read</Button>
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
                          <Button size="sm" onClick={() => setStatus(sop, "active", "SOP published — researchers can now use it as a guide")} disabled={busyId === sop.id} className="bg-[#15803d] text-white hover:bg-[#166534]">
                            Publish
                          </Button>
                        )}
                        {sop.status === "active" && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(sop, "draft", "SOP unpublished")} disabled={busyId === sop.id}>
                            Unpublish
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
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <p className="text-xs text-muted-foreground">How researchers will see this procedure</p>
        <Button size="sm" variant="outline" onClick={onClose}>Back</Button>
      </div>
      <CardContent className="pt-4">
        <SopDocument sop={sop} />
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
  const isBlank = !draft.id && !draft.name && !draft.description && draft.steps.every((st) => !st.title && !st.instructions)
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{draft.id ? "Edit SOP" : "New SOP"}</p>
          <p className="text-xs text-muted-foreground">
            {draft.id ? "Saving creates a new version." : "New SOPs start as drafts — publish one when it's ready for the team."}
          </p>
        </div>
        {isBlank && (
          <Button size="sm" variant="outline" onClick={() => onChange({ id: null, ...EXAMPLE_SOP })}>
            <FileText className="h-3.5 w-3.5" /> Use example template
          </Button>
        )}
      </div>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div>
          <Label className="mb-1.5 block text-xs">Title</Label>
          <Input value={draft.name} maxLength={150} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="e.g. Influencer Profile Research" />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Purpose / objective</Label>
          <textarea className={TEXTAREA} rows={2} value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} placeholder="What this procedure is for, and when researchers should follow it" />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sections</Label>
          <span className="text-[11px] text-muted-foreground">{draft.steps.length} / 60</span>
        </div>
        <p className="-mt-2 text-[11px] text-muted-foreground">
          Break the SOP into sections — e.g. Procedure, Verification rules, If information is missing, Research criteria, Examples.
        </p>
        <ol className="flex flex-col gap-3">
          {draft.steps.map((step, i) => (
            <SectionEditor
              key={i}
              index={i}
              count={draft.steps.length}
              step={step}
              onUpdate={(patch) => onUpdateStep(i, patch)}
              onMove={(delta) => onMoveStep(i, delta)}
              onRemove={() => onChange({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}
            />
          ))}
        </ol>
        <div>
          <Button variant="outline" size="sm" disabled={draft.steps.length >= 60} onClick={() => onChange({ ...draft, steps: [...draft.steps, blankStep()] })}>
            <Plus className="h-3.5 w-3.5" /> Add section
          </Button>
        </div>

        <FormattingHelp />

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="bg-[#15803d] text-white hover:bg-[#166534]">
            {saving ? "Saving…" : draft.id ? "Save new version" : "Save draft"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** One document section: heading + rich content, with Write / Preview. */
function SectionEditor({
  index, count, step, onUpdate, onMove, onRemove,
}: {
  index: number
  count: number
  step: SopStep
  onUpdate: (patch: Partial<SopStep>) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  const [preview, setPreview] = useState(false)
  const insert = (snippet: string) => {
    const body = step.instructions
    onUpdate({ instructions: body ? `${body.replace(/\s+$/, "")}\n\n${snippet}` : snippet })
    setPreview(false)
  }
  return (
    <li className="rounded-lg border p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Section {index + 1}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move section up" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move section down" disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" aria-label="Remove section" disabled={count === 1} onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Input value={step.title} maxLength={200} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="Section heading — e.g. Verification rules" />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <div className="flex rounded-md border p-0.5">
          <button type="button" onClick={() => setPreview(false)} className={`rounded px-2.5 py-1 text-xs font-medium ${!preview ? "bg-gray-100 text-foreground" : "text-muted-foreground"}`}>Write</button>
          <button type="button" onClick={() => setPreview(true)} className={`rounded px-2.5 py-1 text-xs font-medium ${preview ? "bg-gray-100 text-foreground" : "text-muted-foreground"}`}>Preview</button>
        </div>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <span className="text-[11px] text-muted-foreground">Insert:</span>
        {SOP_SNIPPETS.map((sn) => (
          <button key={sn.label} type="button" onClick={() => insert(sn.text)}
            className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 transition hover:border-gray-300 hover:bg-gray-50">
            {sn.label}
          </button>
        ))}
      </div>

      {preview ? (
        <div className="mt-2 min-h-[120px] rounded-md border border-dashed px-3 py-2">
          {step.instructions.trim() ? <SopMarkdown source={step.instructions} /> : <p className="text-xs text-muted-foreground">Nothing to preview yet.</p>}
        </div>
      ) : (
        <textarea
          className={`${TEXTAREA} mt-2 font-mono text-[12.5px] leading-relaxed`}
          rows={Math.min(18, Math.max(6, step.instructions.split("\n").length + 1))}
          value={step.instructions}
          onChange={(e) => onUpdate({ instructions: e.target.value })}
          placeholder={"Write the procedure, rules, decision points, examples…\n\n1. First, …\n2. Then, …\n\n> [!WARNING]\n> What to do when information can't be verified."}
        />
      )}
    </li>
  )
}

/** Collapsible cheat sheet for the section syntax. */
function FormattingHelp() {
  return (
    <details className="rounded-lg border bg-gray-50/60 px-4 py-2.5 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">Formatting help</summary>
      <div className="mt-2 grid gap-x-6 gap-y-1 font-mono text-[11.5px] sm:grid-cols-2">
        <span># Heading · ## Subheading</span>
        <span>**bold** · *italic* · `code`</span>
        <span>1. Numbered step</span>
        <span>- Bullet ·   - nested (2 spaces)</span>
        <span>- [ ] Checklist item</span>
        <span>[link text](https://…)</span>
        <span>{"> [!DO] / [!DONT] / [!WARNING]"}</span>
        <span>{"> [!INFO] / [!TIP] / [!IMPORTANT] / [!NOTE]"}</span>
        <span>| Col | Col | then |---|---|</span>
        <span>![screenshot](https://…)</span>
      </div>
    </details>
  )
}

const INTRO_SEEN_KEY = "instroom:sops-intro-seen"

/** One-time explainer for SOPs, closed with the X (or Esc / the backdrop). */
function SopIntroModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sop-intro-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
          </div>
          <p id="sop-intro-title" className="text-sm font-semibold text-foreground">Research SOPs</p>
        </div>
        <p className="text-sm text-muted-foreground">
          An SOP is your team&apos;s research playbook — a document that explains <span className="font-medium text-foreground">how</span> to
          research an influencer: the procedure, verification rules, what to do when information is missing, research
          criteria, examples and warnings.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li>• Owners and Managers write the SOP in sections and publish it.</li>
          <li>• Researchers open an influencer, open the <span className="font-medium text-foreground">Research guide</span>, and follow the procedure.</li>
          <li>• The SOP is a guide only — it never changes influencer data. What you find is still recorded by you.</li>
        </ul>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose} className="bg-[#15803d] text-white hover:bg-[#166534]">Got it</Button>
        </div>
      </div>
    </div>
  )
}

/**
 * SOPs are strictly brand-scoped. Keying the page by brand remounts it on a
 * brand switch, so an open editor, a half-written draft or the SOP being read
 * can never carry over from one brand and be saved into another.
 */
function SopsForCurrentBrand() {
  const brandId = useSearchParams().get("brandId")
  return <SopsContent key={brandId ?? "no-brand"} />
}

export default function SopsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton sections={[{ fields: 3 }]} label="Loading SOPs…" />}>
      <SopsForCurrentBrand />
    </Suspense>
  )
}

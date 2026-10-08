"use client"
// table-sheet/profile-sidebar.tsx

import React, { useState, useEffect, useRef } from "react"
import { FileSearch } from "lucide-react"
import { ResearchGuideModal } from "@/components/research-sop/research-guide"
import { prefetchHistory } from "@/lib/activity-history"
import type { InfluencerRow, CustomColumn } from "./types"
import { getProfileUrl, handleApprovalChange, canListDecline, drawerStageLabel, formatFollowers } from "./utils"
import { EmailModal } from "@/components/shared/email-modal"
import { invalidateInfluencerDerivedCaches } from "@/lib/cache-invalidation"
import type { CampaignDeliverable } from "@/lib/deliverables"
import { AttributionTab } from "@/components/shared/attribution-tab"
import { InfluencerStatsTab } from "@/components/shared/influencer-stats-tab"
import { HistoryTab, LastEditedBy } from "@/components/InfluencerProfileSidebar"
import { formatDealRate } from "@/lib/pipeline-transitions"
import {
  DrawerShell, DrawerHeader, DrawerControl, DrawerTabs, DrawerBody, DrawerActionBar, resolveActiveTab, type DrawerTab,
} from "@/components/shared/influencer-drawer"
import { useClosedData } from "@/hooks/useClosedData"
import {
  PAID_COLLAB_TYPES, ReadOnlyTabPlaceholder, ReadOnlyOrderTab, ReadOnlyPostTab, ReadOnlyPaidCollabTab,
} from "@/components/pipeline/post-tracker-readonly-tabs"



// ─── Paid Collab Details tab ────────────────────────────────────────────────────
// "n_a": this deliverable has no script / content review step. Treated as
// done — it never blocks the content step or the "all approved" rollups.
type StepStatus = "n_a" | "pending" | "submitted" | "revision_requested" | "resubmitted" | "approved"
type ContractStatus = "not_started" | "draft" | "sent" | "signed"
type PostStatus = "pending" | "submitted" | "live"
type PayStructure = "upfront" | "5050" | "after" | "custom"
type MilestoneStatus = "unpaid" | "due" | "paid"

interface PaidDeliverable {
  id: number
  name: string
  scriptStatus: StepStatus
  scriptLink: string
  contentStatus: StepStatus
  contentLink: string
  postUrl: string
  postDate: string
}

const PC_STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  not_started: { bg: "#f1f0eb", color: "#888888", border: "#e8e7e0" },
  draft: { bg: "#f1f0eb", color: "#888888", border: "#e8e7e0" },
  sent: { bg: "#e6f1fb", color: "#185fa5", border: "#b5d4f4" },
  signed: { bg: "#eaf3de", color: "#3b6d11", border: "#c0dd97" },
  pending: { bg: "#f1f0eb", color: "#888888", border: "#e8e7e0" },
  submitted: { bg: "#e6f1fb", color: "#185fa5", border: "#b5d4f4" },
  revision_requested: { bg: "#faeeda", color: "#854f0b", border: "#fac775" },
  resubmitted: { bg: "#ddeeff", color: "#185fa5", border: "#aaccee" },
  approved: { bg: "#eaf3de", color: "#3b6d11", border: "#c0dd97" },
  live: { bg: "#eaf3de", color: "#3b6d11", border: "#c0dd97" },
  paid: { bg: "#eaf3de", color: "#3b6d11", border: "#c0dd97" },
  due: { bg: "#faeeda", color: "#854f0b", border: "#fac775" },
  unpaid: { bg: "#fcebeb", color: "#a32d2d", border: "#f7c1c1" },
  off: { bg: "#f1f0eb", color: "#aaaaaa", border: "#e8e7e0" },
  n_a: { bg: "#f1f0eb", color: "#aaaaaa", border: "#e8e7e0" },
}

const PC_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started", draft: "Draft", sent: "Sent — awaiting signature", signed: "Signed",
  pending: "Pending", submitted: "Submitted", revision_requested: "Revision requested",
  resubmitted: "Resubmitted", approved: "Approved", live: "All live", paid: "Paid", due: "Due", unpaid: "Pending",
  n_a: "N/A",
}

function pcStatusSelectStyle(status: string, disabled?: boolean) {
  const c = PC_STATUS_STYLE[status] || PC_STATUS_STYLE.pending
  return {
    fontSize: 11, fontWeight: 500, padding: "4px 22px 4px 9px", borderRadius: 20,
    border: `1px solid ${c.border}`, background: c.bg, color: c.color,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    outline: "none", appearance: "none" as const,
  }
}

export function PaidCollabTab({ influencerName, rateHint, initialDeliverables }: {
  influencerName: string
  rateHint?: number
  /** The influencer's saved campaign deliverables (lib/deliverables), when known. */
  initialDeliverables?: CampaignDeliverable[]
}) {
  const [contractEnabled, setContractEnabled] = useState(false)
  const [contractStatus, setContractStatus] = useState<ContractStatus>("not_started")
  const [contractLink, setContractLink] = useState("")
  const [contractNotes, setContractNotes] = useState("")

  const [scriptEnabled, setScriptEnabled] = useState(true)
  const [postStatus, setPostStatus] = useState<PostStatus>("pending")

  const [deliverables, setDeliverables] = useState<PaidDeliverable[]>(() =>
    initialDeliverables?.length
      ? initialDeliverables.map(d => ({
          id: d.id, name: d.name ?? "",
          scriptStatus: (d.scriptStatus || "pending") as StepStatus, scriptLink: d.scriptLink ?? "",
          contentStatus: (d.contentStatus || "pending") as StepStatus, contentLink: d.contentLink ?? "",
          postUrl: d.postUrl ?? "", postDate: d.postDate ?? "",
        }))
      : [
          { id: 1, name: "", scriptStatus: "pending", scriptLink: "", contentStatus: "pending", contentLink: "", postUrl: "", postDate: "" },
          { id: 2, name: "", scriptStatus: "pending", scriptLink: "", contentStatus: "pending", contentLink: "", postUrl: "", postDate: "" },
        ]
  )
  const nextIdRef = React.useRef(deliverables.reduce((m, d) => Math.max(m, Number(d.id) || 0), 0) + 1)

  // Payment starts in a blank / zero state. An agreed fee already stored on the
  // record is real data and is still honoured; everything else (no rate, or 0)
  // starts empty so nothing is calculated until the user enters a fee. No
  // template amount, no pre-marked "paid" milestone.
  const initialRate = rateHint && rateHint > 0 ? String(rateHint) : ""
  const [rate, setRate] = useState(initialRate)
  // Committed value that drives every amount — the draft above only becomes
  // committed once the user leaves the field or presses Enter, so milestones
  // don't churn on each keystroke.
  const [committedRate, setCommittedRate] = useState(initialRate)
  const [paymentMethod, setPaymentMethod] = useState("Bank transfer")
  const [paymentStatus, setPaymentStatus] = useState("Unpaid")
  const [payStructure, setPayStructure] = useState<PayStructure>("5050")
  const [milestoneStatuses, setMilestoneStatuses] = useState<MilestoneStatus[]>([])

  const updateDeliverable = (id: number, patch: Partial<PaidDeliverable>) =>
    setDeliverables(ds => ds.map(d => d.id === id ? { ...d, ...patch } : d))

  const addDeliverable = () => {
    const id = nextIdRef.current++
    setDeliverables(ds => [...ds, { id, name: "", scriptStatus: "pending", scriptLink: "", contentStatus: "pending", contentLink: "", postUrl: "", postDate: "" }])
  }
  const removeDeliverable = (id: number) => setDeliverables(ds => ds.filter(d => d.id !== id))
  const setDeliverableCount = (n: number) => {
    if (n > deliverables.length) { for (let i = deliverables.length; i < n; i++) addDeliverable() }
    else if (n < deliverables.length) { setDeliverables(ds => ds.slice(0, n)) }
  }

  const anyPostUrl = deliverables.some(d => d.postUrl.trim().length > 0)
  const anyContractLink = contractLink.trim().length > 0
  const n = deliverables.length
  const scriptAllApproved = n > 0 && deliverables.every(d => d.scriptStatus === "approved" || d.scriptStatus === "n_a")
  const contentAllApproved = n > 0 && deliverables.every(d => d.contentStatus === "approved" || d.contentStatus === "n_a")

  const steps: boolean[] = []
  if (contractEnabled) steps.push(contractStatus === "signed")
  if (scriptEnabled) steps.push(scriptAllApproved)
  steps.push(contentAllApproved)
  steps.push(postStatus === "live")
  const doneSteps = steps.filter(Boolean).length
  const pct = steps.length > 0 ? Math.round((doneSteps / steps.length) * 100) : 0

  // Amounts derive from the committed fee only, and never go negative
  const rateNum = Math.max(0, parseFloat(committedRate) || 0)
  const hasAgreedFee = rateNum > 0
  const milestones: { label: string; amount: number; dot: string }[] =
    payStructure === "upfront" ? [{ label: "100% upfront — before shoot", amount: rateNum, dot: "#1fae5b" }]
    : payStructure === "5050" ? [{ label: "50% upfront — before shoot", amount: rateNum / 2, dot: "#1fae5b" }, { label: "50% — after post goes live", amount: rateNum / 2, dot: "#ef9f27" }]
    : payStructure === "after" ? [{ label: "100% — after all deliverables", amount: rateNum, dot: "#ef9f27" }]
    : (() => {
        const p1 = Math.round(rateNum * 0.4), p2 = Math.round(rateNum * 0.4), p3 = rateNum - p1 - p2
        return [
          { label: "Payment 1 — upfront", amount: p1, dot: "#1fae5b" },
          { label: "Payment 2 — after content approved", amount: p2, dot: "#ef9f27" },
          { label: "Payment 3 — after post goes live", amount: p3, dot: "#aaaaaa" },
        ]
      })()

  useEffect(() => {
    setMilestoneStatuses(prev => {
      const next = milestones.map((_, i) => prev[i] ?? "unpaid")
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payStructure])

  const totalPaid = milestones.reduce((sum, m, i) => sum + (milestoneStatuses[i] === "paid" ? m.amount : 0), 0)

  const P = {
    label: { fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em" },
    card: { border: "1px solid #eee", borderRadius: 10, background: "#fafafa", marginBottom: 8 },
    cardHead: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" },
    input: { flex: 1, fontSize: 12, padding: "7px 10px", borderRadius: 7, border: "1px solid #e0e0e0", background: "#fff", color: "#333", outline: "none" as const },
    smallInput: { width: "100%", fontSize: 12, padding: "7px 10px", borderRadius: 7, border: "1px solid #e0e0e0", background: "#fff", color: "#333", outline: "none" as const, boxSizing: "border-box" as const },
    toggle: (on: boolean) => ({ position: "relative" as const, width: 34, height: 18, flexShrink: 0, borderRadius: 9, background: on ? "#1fae5b" : "#ccc", cursor: "pointer", transition: "background 0.2s" }),
    knob: (on: boolean) => ({ position: "absolute" as const, width: 14, height: 14, top: 2, left: on ? 18 : 2, background: "#fff", borderRadius: "50%", transition: "left 0.2s" }),
  }

  return (
    <div>
      {/* Progress */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ height: 5, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: 5, background: "#1fae5b", borderRadius: 3, width: `${pct}%`, transition: "width 0.3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
          <span style={{ fontSize: 11, color: "#aaa" }}>{doneSteps} of {steps.length} steps complete</span>
          <span style={{ fontSize: 11, color: "#aaa" }}>{pct}%</span>
        </div>
      </div>

      <div style={P.label}>Deliverables checklist</div>

      {/* Deliverables setup */}
      <div style={{ border: "1px solid #eee", borderRadius: 10, background: "#fafafa", margin: "10px 0 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Define deliverables</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>
              {n === 0 ? "Name each deliverable — they'll appear in every step below" : `${deliverables.map((d, i) => d.name || `Deliverable ${i + 1}`).join(", ").slice(0, 55)}${deliverables.map(d => d.name).join("").length > 55 ? "…" : ""} · ${n} total`}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" as const }}>How many?</label>
            <select value={n} onChange={e => setDeliverableCount(parseInt(e.target.value))} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 7, border: "1px solid #e0e0e0", background: "#fff", cursor: "pointer" }}>
              {Array.from({ length: 11 }, (_, i) => i).map(v => <option key={v} value={v}>{v === 0 ? "Select…" : v}</option>)}
            </select>
          </div>
        </div>
        <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {deliverables.map((d, i) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#fff", border: "1px solid #eee", borderRadius: 7 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa", minWidth: 16 }}>{i + 1}</span>
              <input
                value={d.name} placeholder="e.g. 1x IG Reel, 3x Stories, TikTok video…"
                onChange={e => updateDeliverable(d.id, { name: e.target.value })}
                style={{ flex: 1, fontSize: 12, color: "#333", border: "none", background: "transparent", outline: "none" }}
              />
              <button onClick={() => removeDeliverable(d.id)} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, border: "1px solid #f7c1c1", background: "#fff", color: "#a32d2d", cursor: "pointer" }}>✕</button>
            </div>
          ))}
          <button onClick={addDeliverable} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 12, padding: "7px 14px", borderRadius: 7, border: "1px dashed #ccc", background: "#fff", color: "#888", cursor: "pointer" }}>+ Add one more</button>
        </div>
      </div>

      {/* Contract */}
      <div style={P.card}>
        <div style={P.cardHead}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>Contract <span style={{ fontSize: 10, color: "#bbb", fontWeight: 400 }}>optional</span></div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{contractEnabled ? (PC_STATUS_LABEL[contractStatus] || contractStatus) : "Not required for this collab"}</div>
          </div>
          <select value={contractStatus} disabled={!contractEnabled || !anyContractLink} onChange={e => setContractStatus(e.target.value as ContractStatus)} style={pcStatusSelectStyle(contractStatus, !contractEnabled || !anyContractLink)}>
            <option value="not_started">Not started</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent — awaiting signature</option>
            <option value="signed">Signed</option>
          </select>
          <div style={P.toggle(contractEnabled)} onClick={() => setContractEnabled(v => !v)}><div style={P.knob(contractEnabled)} /></div>
        </div>
        {contractEnabled && (
          <div style={{ borderTop: "1px solid #eee", padding: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#888" }}>Contract link / file</label>
              <input style={P.smallInput} placeholder="Paste contract link…" value={contractLink} onChange={e => setContractLink(e.target.value)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#888" }}>Contract notes <span style={{ color: "#bbb" }}>(optional)</span></label>
              <textarea style={{ ...P.smallInput, minHeight: 60, resize: "vertical" as const }} placeholder="e.g. Usage rights: 6 months only. Exclusivity: 30 days." value={contractNotes} onChange={e => setContractNotes(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Script review */}
      <div style={P.card}>
        <div style={P.cardHead}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>Script review <span style={{ fontSize: 10, color: "#bbb", fontWeight: 400 }}>optional</span></div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>One script per deliverable</div>
          </div>
          <span style={pcStatusSelectStyle(scriptEnabled ? (scriptAllApproved ? "approved" : "submitted") : "off")}>
            {!scriptEnabled ? "Off" : n === 0 ? "—" : `${deliverables.filter(d => d.scriptStatus === "approved").length}/${n} approved`}
          </span>
          <div style={P.toggle(scriptEnabled)} onClick={() => setScriptEnabled(v => !v)}><div style={P.knob(scriptEnabled)} /></div>
        </div>
        {scriptEnabled && (
          <div style={{ borderTop: "1px solid #eee", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {n === 0 && <div style={{ fontSize: 12, color: "#ccc" }}>Add deliverables above first.</div>}
            {deliverables.map((d, i) => (
              <div key={d.id} style={{ border: "1px solid #eee", borderRadius: 8, background: "#f9f9f9" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{i + 1}. {d.name || `Deliverable ${i + 1}`}</span>
                  <select value={d.scriptStatus} disabled={!d.scriptLink} onChange={e => updateDeliverable(d.id, { scriptStatus: e.target.value as StepStatus })} style={pcStatusSelectStyle(d.scriptStatus, !d.scriptLink)}>
                    <option value="n_a">N/A</option><option value="pending">Pending</option><option value="submitted">Submitted</option>
                    <option value="revision_requested">Revision requested</option><option value="resubmitted">Resubmitted</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <input style={P.smallInput} placeholder="Paste script link…" value={d.scriptLink} onChange={e => updateDeliverable(d.id, { scriptLink: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content review */}
      <div style={P.card}>
        <div style={P.cardHead}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>Content review</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>One content file per deliverable</div>
          </div>
          <span style={pcStatusSelectStyle(contentAllApproved ? "approved" : "submitted")}>
            {n === 0 ? "—" : `${deliverables.filter(d => d.contentStatus === "approved").length}/${n} approved`}
          </span>
        </div>
        <div style={{ borderTop: "1px solid #eee", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {n === 0 && <div style={{ fontSize: 12, color: "#ccc" }}>Add deliverables above first.</div>}
          {deliverables.map((d, i) => {
            const scriptDone = !scriptEnabled || d.scriptStatus === "approved" || d.scriptStatus === "n_a"
            return (
              <div key={d.id} style={{ border: "1px solid #eee", borderRadius: 8, background: "#f9f9f9" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{i + 1}. {d.name || `Deliverable ${i + 1}`}</span>
                  <select value={d.contentStatus} disabled={!scriptDone || !d.contentLink} onChange={e => updateDeliverable(d.id, { contentStatus: e.target.value as StepStatus })} style={pcStatusSelectStyle(d.contentStatus, !scriptDone || !d.contentLink)}>
                    <option value="n_a">N/A</option><option value="pending">Pending</option><option value="submitted">Submitted</option>
                    <option value="revision_requested">Revision requested</option><option value="resubmitted">Resubmitted</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
                <div style={{ padding: "10px 12px", opacity: scriptDone ? 1 : 0.45, pointerEvents: scriptDone ? "auto" : "none" }}>
                  <input style={P.smallInput} placeholder="Paste content link (Drive, Dropbox, WeTransfer…)" value={d.contentLink} onChange={e => updateDeliverable(d.id, { contentLink: e.target.value })} />
                  {!scriptDone && <div style={{ fontSize: 11, color: "#ef9f27", marginTop: 6 }}>Approve the script above to unlock content review.</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Post links */}
      <div style={P.card}>
        <div style={P.cardHead}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>Post links</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>One live URL + date per deliverable</div>
          </div>
          <select value={postStatus} disabled={!anyPostUrl} onChange={e => setPostStatus(e.target.value as PostStatus)} style={pcStatusSelectStyle(postStatus, !anyPostUrl)}>
            <option value="pending">Pending</option><option value="submitted">Submitted</option><option value="live">All live</option>
          </select>
        </div>
        <div style={{ borderTop: "1px solid #eee", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {n === 0 && <div style={{ fontSize: 12, color: "#ccc" }}>Add deliverables above first.</div>}
          {deliverables.map((d, i) => (
            <div key={d.id} style={{ padding: "10px 12px", border: "1px solid #eee", borderRadius: 8, background: "#fafafa" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#555", marginBottom: 6 }}>{i + 1}. {d.name || `Deliverable ${i + 1}`}</div>
              <input style={{ ...P.smallInput, marginBottom: 6 }} placeholder="Paste live post URL…" value={d.postUrl} onChange={e => updateDeliverable(d.id, { postUrl: e.target.value })} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 11, color: "#888" }}>Date posted</label>
                <input type="date" style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid #e0e0e0" }} value={d.postDate} onChange={e => updateDeliverable(d.id, { postDate: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: "#eee", margin: "18px 0" }} />

      {/* Payment */}
      <div style={P.label}>Payment</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "10px 0 14px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#888" }}>Rate agreed ($)</label>
          <input
            type="number"
            min={0}
            placeholder="0"
            style={P.smallInput}
            value={rate}
            onChange={e => setRate(e.target.value)}
            onBlur={() => setCommittedRate(rate)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); setCommittedRate(rate) } }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#888" }}>Payment method</label>
          <select style={P.smallInput} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            <option>Bank transfer</option><option>PayPal</option><option>Wise</option><option>GCash</option><option>Other</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#888" }}>Overall payment status</label>
          <select style={P.smallInput} value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
            <option>Unpaid</option><option>Partially paid</option><option>Fully paid</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 260, marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: "#888" }}>Payment structure</label>
        <select style={P.smallInput} value={payStructure} onChange={e => setPayStructure(e.target.value as PayStructure)}>
          <option value="upfront">100% upfront</option>
          <option value="5050">50% / 50%</option>
          <option value="after">After all deliverables</option>
          <option value="custom">Custom milestones</option>
        </select>
      </div>
      <div style={{ border: "1px solid #eee", borderRadius: 10, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8f9fb", borderBottom: "1px solid #eee" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Payment milestones</span>
          <span style={{ fontSize: 11, color: "#888" }}>Agreed fee: <strong>${rateNum.toLocaleString()}</strong></span>
        </div>
        {!hasAgreedFee && (
          <div style={{ padding: "8px 14px", fontSize: 11, color: "#9ca3af", borderBottom: "1px solid #f5f5f5" }}>
            Enter an agreed fee above to calculate milestone amounts.
          </div>
        )}
        {milestones.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: i < milestones.length - 1 ? "1px solid #f5f5f5" : "none", flexWrap: "wrap" as const }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 12, color: "#333", minWidth: 100 }}>{m.label}</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>${m.amount.toLocaleString()}</span>
            <select
              value={milestoneStatuses[i] || "unpaid"}
              onChange={e => setMilestoneStatuses(s => s.map((v, idx) => idx === i ? e.target.value as MilestoneStatus : v))}
              style={pcStatusSelectStyle(milestoneStatuses[i] || "unpaid")}
            >
              <option value="unpaid">Pending</option><option value="due">Due</option><option value="paid">Paid</option>
            </select>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f0faf5", borderRadius: 8, border: "1px solid #d0ead9" }}>
        <span style={{ fontSize: 12, color: "#555" }}>Total paid to {influencerName || "creator"}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1fae5b" }}>${totalPaid.toLocaleString()} of ${rateNum.toLocaleString()}</span>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function displayMetric(val: string | number | undefined | null): string {
  if (val === null || val === undefined || val === "") return "—"
  const n = Number(val)
  if (isNaN(n)) return "—"
  return formatFollowers(n)
}

function FieldSelect({ label, icon, value, options, onChange, readOnly }: {
  label: string; icon: string; value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void; readOnly?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</span>
      </div>
      {readOnly ? (
        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", paddingLeft: 2 }}>
          {options.find(o => o.value === value)?.label || value || "—"}
        </div>
      ) : (
        <div style={{ position: "relative" as const }}>
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%", fontSize: 13, fontWeight: 500, padding: "7px 28px 7px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#f9fafb", color: "#111827", cursor: "pointer", appearance: "none" as const, outline: "none", transition: "border-color 0.15s" }}
            onFocus={e => { e.currentTarget.style.borderColor = "#1fae5b"; e.currentTarget.style.background = "#fff" }}
            onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb" }}
          >
            <option value="">—</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </div>
  )
}

function FieldInfo({ label, icon, value, href, truncate }: {
  label: string; icon: string; value?: string | null; href?: string; truncate?: boolean
}) {
  const displayVal = value || "—"
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</span>
      </div>
      {href && value ? (
        <a href={href.startsWith("http") ? href : `https://${href}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 500, color: "#1fae5b", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, display: "block" }}
          title={value}>{value.replace(/^https?:\/\//, "")}</a>
      ) : (
        <div style={{ fontSize: 13, fontWeight: value ? 500 : 400, color: value ? "#111827" : "#d1d5db", overflow: truncate ? "hidden" : undefined, textOverflow: truncate ? "ellipsis" : undefined, whiteSpace: truncate ? "nowrap" as const : undefined }}>
          {displayVal}
        </div>
      )}
    </div>
  )
}

export default function ProfileSidebar({
  row, customCols, onUpdate, onClose, readOnly = false,
  niches, locations, onAddNiche, onAddLocation, onToast, brandId,
}: {
  row: InfluencerRow | null; customCols: CustomColumn[]; onUpdate: (r: InfluencerRow) => void
  onClose: () => void; readOnly?: boolean; niches: string[]; locations: string[]
  onAddNiche: (v: string) => void; onAddLocation: (v: string) => void
  onToast?: (type: "success" | "error" | "info" | "warning", message: string) => void
  brandId?: string
}) {
  const [profileTab, setProfileTab] = useState(0)
  // Load History in the background as the drawer opens, so it is ready when clicked.
  const historyBiId = row ? row.brand_influencer_id || row.id : ""
  useEffect(() => {
    if (historyBiId && !historyBiId.startsWith("temp-")) prefetchHistory(brandId, historyBiId)
  }, [brandId, historyBiId])
  const [editedRow, setEditedRow] = useState<InfluencerRow | null>(row ? { ...row } : null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  // Read-only research playbook (published SOPs) for the researcher to follow.
  const [showResearchGuide, setShowResearchGuide] = useState(false)
  const resetFormToRow = () => {
    if (!row) return
    setEditedRow({ ...row })
  }

  const biId = row?.brand_influencer_id
  const inPostTracker = row ? drawerStageLabel(row) === "Post Tracker" : false
  const { data: closedRows, isLoading: closedLoading } = useClosedData(inPostTracker ? brandId : undefined)
  const closedRow = inPostTracker && biId ? closedRows.find(r => r.id === biId) : undefined
  const refreshSheet = () => invalidateInfluencerDerivedCaches(brandId)

  // Keyed on the row's IDENTITY, not the row object.
  //
  // Every edit below now flows straight back out through `onUpdate`, so the
  // `row` prop changes on each keystroke. Resetting on that would have wiped
  // the Order and Post tab fields — which are local, unsaved form state — while
  // the user was typing. Switching to a different influencer still resets, so
  // the panel always shows (and saves) the record it is actually pointed at.
  useEffect(() => {
    if (row) {
      resetFormToRow()
      setProfileTab(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id])

  // ── Autosave ──────────────────────────────────────────────────────────────
  // The sidebar has no save of its own. An edit is handed to the table, which
  // is the ONE save pipeline in this feature (TableSheet → onRowsChange → the
  // Influencer List page's debounced, serialised PUT queue). That is what makes
  // an edit survive closing the panel, switching influencer or navigating away,
  // collapses a burst of edits into a single write of the latest state, and
  // keeps a second, competing request from racing the first.
  const lastPropagated = useRef<string | null>(null)
  useEffect(() => {
    if (!row || !editedRow || editedRow.id !== row.id) return
    const next = JSON.stringify(editedRow)
    // Nothing edited (or the table has already caught up) — nothing to send.
    if (next === JSON.stringify(row)) { lastPropagated.current = next; return }
    if (next === lastPropagated.current) return
    lastPropagated.current = next
    onUpdate(editedRow)
  }, [editedRow, row, onUpdate])

  const handleCancel = () => resetFormToRow()

  if (!row || !editedRow) return null


  const handleFieldChange = (field: string, value: string) => {
    if (!editedRow) return
    if (field === "approval_status") {
      setEditedRow(handleApprovalChange(editedRow, value))
    } else if (field.startsWith("custom.")) {
      setEditedRow({ ...editedRow, custom: { ...editedRow.custom, [field.slice(7)]: value } })
    } else if (field === "handle" || field === "platform") {
      const nH = field === "handle" ? value : editedRow.handle
      const nP = field === "platform" ? value : editedRow.platform
      const oU = getProfileUrl(editedRow.platform, editedRow.handle)
      const fU = getProfileUrl(nP, nH)
      const cL = editedRow.social_link ?? ""
      const u = { ...editedRow, [field]: value }
      if (!cL || cL === oU) u.social_link = fU
      setEditedRow(u)
    } else {
      setEditedRow({ ...editedRow, [field]: value })
    }
  }

  // Fields autosave; Save only folds the first name into the full name.
  const handleSave = () => {
    const existingLastName = editedRow.full_name ? editedRow.full_name.split(" ").slice(1).join(" ") : ""
    const rebuiltFullName = editedRow.first_name
      ? existingLastName ? `${editedRow.first_name} ${existingLastName}` : editedRow.first_name
      : editedRow.full_name
    setEditedRow({ ...editedRow, full_name: rebuiltFullName || editedRow.full_name })
    onToast?.("success", "Changes saved")
  }

  const S = {
    pipeSel: { fontSize: 11, padding: "5px 10px", borderRadius: 8, border: "0.5px solid #f4b740", background: "#fffbeb", color: "#854f0b", cursor: "pointer", fontWeight: 500 },
    statRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, background: "linear-gradient(135deg, #f0fdf4 0%, #f9fafb 100%)", borderRadius: 12, padding: 14, marginBottom: 18, border: "1px solid #dcfce7" },
    statBox: { textAlign: "center" as const },
    statLabel: { fontSize: 9, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.07em" },
    statVal: { fontSize: 16, fontWeight: 700, color: "#111827", marginTop: 3 },
    formInput: { width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#f9fafb", color: "#111827", boxSizing: "border-box" as const, outline: "none", transition: "border-color 0.15s, background 0.15s" },
    saveBtn: { background: "#1fae5b", color: "#fff", border: "none", padding: "9px 20px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "background 0.15s" },
    cancelBtn: { background: "transparent", color: "#6b7280", border: "1.5px solid #e5e7eb", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "background 0.15s, border-color 0.15s" },
    sectionTitle: { fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.08em", padding: "14px 0 8px", marginBottom: 10, borderBottom: "1px solid #f3f4f6" },
    metricBox: { background: "#f9fafb", borderRadius: 10, padding: "12px 10px", textAlign: "center" as const, border: "1px solid #f3f4f6" },
    metricVal: { fontSize: 16, fontWeight: 700, color: "#111827" },
    metricLabel: { fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginTop: 3 },
    formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    formGroup: { display: "flex", flexDirection: "column" as const, gap: 4, marginBottom: 10 },
    formLabel: { fontSize: 10, fontWeight: 600, color: "#6b7280" },
  }

  const focusIn = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "#1fae5b"; e.currentTarget.style.background = "#fff" }
  const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb" }

  const locationOptions = locations.map(l => ({ value: l, label: l }))
  const nicheOptions = niches.map(n => ({ value: n, label: n }))
  const genderOptions = [
    { value: "Male", label: "Male" },
    { value: "Female", label: "Female" },
    { value: "Non-binary", label: "Non-binary" },
    { value: "Other", label: "Other" },
  ]
  const platformOptions = [
    { value: "instagram", label: "Instagram" },
    { value: "tiktok", label: "TikTok" },
    { value: "youtube", label: "YouTube" },
    { value: "twitter", label: "X (Twitter)" },
  ]

  const TABS = ["Basic", "Order", "Attribution", "Post", "Stats", "Paid collab details", "History"]
  const isSaved = !!biId && !editedRow.is_draft && !editedRow.id.startsWith("temp-")
  const tabDisabledReason = (idx: number): string | null => {
    if (idx === 0) return null
    if (!isSaved) return "Available once this influencer is saved"
    if (idx !== 1 && idx !== 3 && idx !== 5) return null
    if (!inPostTracker) return "Available once this influencer is in Post Tracker"
    if (idx === 5 && closedRow && !PAID_COLLAB_TYPES.has(closedRow.campaignType ?? "")) return "Only for paid collaborations"
    return null
  }
  // Falls back to Basic if the open tab becomes unavailable.
  const drawerTabs: DrawerTab[] = TABS.map((label, id) => ({ id, label, disabledReason: tabDisabledReason(id) }))
  const activeTab = resolveActiveTab(drawerTabs, profileTab)

  return (
    <>
      {showEmailModal && (
        <EmailModal
          partnerName={editedRow.full_name || editedRow.first_name || editedRow.handle}
          handle={editedRow.handle}
          platform={editedRow.platform}
          brandId={brandId}
          defaultTo={editedRow.contact_info || editedRow.email || ""}
          onClose={() => setShowEmailModal(false)}
        />
      )}

      <DrawerShell onClose={onClose}>
        <DrawerHeader
          name={editedRow.full_name || editedRow.first_name}
          handle={editedRow.handle}
          platform={editedRow.platform}
          avatarUrl={editedRow.profile_image_url}
          onSendEmail={() => setShowEmailModal(true)}
          onNotify={(msg, type) => onToast?.(type, msg)}
          handleExtra={brandId && (
            <button
              type="button"
              onClick={() => setShowResearchGuide(true)}
              title="Research guide"
              aria-label="Open research guide"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#0f6b3e", cursor: "pointer", padding: 0 }}
            >
              <FileSearch size={12} />
            </button>
          )}
          controls={<>
            {/* Read-only: stages are changed on the Pipeline, inbox and Post Tracker. */}
            <DrawerControl label="Stage">
              <select disabled value="stage" title="Change the stage on the Pipeline"
                style={{ ...S.pipeSel, width: 115, borderColor: "#e5e7eb", background: "#f3f4f6", color: "#9ca3af", cursor: "not-allowed" }}>
                <option value="stage">{drawerStageLabel(editedRow)}</option>
              </select>
            </DrawerControl>
            <DrawerControl label="Status">
              {(() => {
                const approval = editedRow.approval_status === "Approved" || editedRow.approval_status === "Declined"
                  ? editedRow.approval_status
                  : "Pending"
                const tone = approval === "Declined"
                  ? { borderColor: "#dc2626", background: "#fef2f2", color: "#991b1b" }
                  : approval === "Pending"
                    ? { borderColor: "#f4b740", background: "#fffbeb", color: "#854f0b" }
                    : { borderColor: "#16a34a", background: "#f0fdf4", color: "#166534" }
                return (
                  <select style={{ ...S.pipeSel, width: 115, ...tone }} value={approval}
                    onChange={e => handleFieldChange("approval_status", e.target.value)}>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    {canListDecline(editedRow) && <option value="Declined">Declined</option>}
                  </select>
                )
              })()}
            </DrawerControl>
          </>}
        />
        {showResearchGuide && brandId && (
          <ResearchGuideModal
            brandId={brandId}
            influencerLabel={`@${editedRow.handle.replace(/^@/, "")}`}
            onClose={() => setShowResearchGuide(false)}
          />
        )}

        <DrawerTabs tabs={drawerTabs} active={activeTab} onSelect={setProfileTab} />

        <DrawerBody>

          {/* ════ BASIC TAB ════ */}
          {activeTab === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {isSaved && <div style={{ marginBottom: 12 }}><LastEditedBy brandId={brandId} biId={biId} /></div>}
              <div style={S.statRow}>
                <div style={S.statBox}><div style={S.statLabel}>Followers</div><div style={S.statVal}>{displayMetric(editedRow.follower_count)}</div></div>
                <div style={S.statBox}><div style={S.statLabel}>Eng Rate</div><div style={{ ...S.statVal, color: "#2c8ec4" }}>{editedRow.engagement_rate ? `${editedRow.engagement_rate}%` : "—"}</div></div>
                <div style={S.statBox} title="Flat fee + commission per sale"><div style={S.statLabel}>Rate</div><div style={{ ...S.statVal, color: "#1fae5b" }}>{formatDealRate(editedRow.agreed_rate, editedRow.commission_rate)}</div></div>
                <div style={S.statBox}><div style={S.statLabel}>Tier</div><div style={{ ...S.statVal, fontSize: 13 }}>{editedRow.tier || "Bronze"}</div></div>
              </div>
              <div style={S.sectionTitle}>Avg Metrics</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                <div style={S.metricBox}><div style={S.metricVal}>{displayMetric(editedRow.avg_likes)}</div><div style={S.metricLabel}>Avg Likes</div></div>
                <div style={S.metricBox}><div style={S.metricVal}>{displayMetric(editedRow.avg_comments)}</div><div style={S.metricLabel}>Avg Comments</div></div>
                <div style={S.metricBox}><div style={S.metricVal}>{displayMetric(editedRow.avg_views)}</div><div style={S.metricLabel}>Avg Views</div></div>
              </div>
              {editedRow.transferred_date && (() => {
                const declined = editedRow.approval_status === "Declined"
                return (
                  <div style={{ background: declined ? "#fef2f2" : "#f0fdf4", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: declined ? "#991b1b" : "#166534", border: `1px solid ${declined ? "#fee2e2" : "#dcfce7"}`, display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span>{declined ? "✕" : "✅"}</span>
                    <span><strong>Reviewed:</strong> {new Date(editedRow.transferred_date).toLocaleDateString()}</span>
                  </div>
                )
              })()}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>Notes</div>
                {readOnly
                  ? <div style={{ fontSize: 12, color: "#374151", background: "#f9fafb", borderRadius: 8, padding: 10, minHeight: 56, border: "1px solid #f3f4f6" }}>{editedRow.notes || <span style={{ color: "#d1d5db" }}>No notes</span>}</div>
                  : <textarea style={{ ...S.formInput, minHeight: 72, resize: "vertical" as const, fontFamily: "inherit" }} value={editedRow.notes} onChange={e => handleFieldChange("notes", e.target.value)} placeholder="Add notes…" onFocus={focusIn} onBlur={focusOut} />
                }
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>Approval Notes</div>
                {readOnly
                  ? <div style={{ fontSize: 12, color: "#374151", background: "#f9fafb", borderRadius: 8, padding: 10, minHeight: 38, border: "1px solid #f3f4f6" }}>{editedRow.approval_notes || <span style={{ color: "#d1d5db" }}>No notes</span>}</div>
                  : <textarea style={{ ...S.formInput, minHeight: 60, resize: "vertical" as const, fontFamily: "inherit" }} value={editedRow.approval_notes || ""} onChange={e => handleFieldChange("approval_notes", e.target.value)} placeholder="Add approval notes…" onFocus={focusIn} onBlur={focusOut} />
                }
              </div>
              <div style={S.formRow}>
                <div style={S.formGroup}><div style={S.formLabel}>First name</div><input style={S.formInput} value={editedRow.first_name || ""} readOnly={readOnly} onChange={e => handleFieldChange("first_name", e.target.value)} onFocus={focusIn} onBlur={focusOut} /></div>
                <div style={S.formGroup}><div style={S.formLabel}>Email</div><input style={S.formInput} value={editedRow.contact_info || editedRow.email || ""} readOnly={readOnly} onChange={e => handleFieldChange("contact_info", e.target.value)} onFocus={focusIn} onBlur={focusOut} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <FieldSelect label="Location" icon="" value={editedRow.location || ""} options={locationOptions} onChange={v => handleFieldChange("location", v)} readOnly={readOnly} />
                <FieldSelect label="Niche" icon="" value={editedRow.niche || ""} options={nicheOptions} onChange={v => handleFieldChange("niche", v)} readOnly={readOnly} />
                <FieldSelect label="Gender" icon="" value={editedRow.gender || ""} options={genderOptions} onChange={v => handleFieldChange("gender", v)} readOnly={readOnly} />
                <FieldSelect label="Platform" icon="" value={editedRow.platform} options={platformOptions} onChange={v => handleFieldChange("platform", v)} readOnly={readOnly} />
              </div>
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", border: "1px solid #f3f4f6", marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 5 }}>Social Link</div>
                {editedRow.social_link ? (
                  <a href={editedRow.social_link.startsWith("http") ? editedRow.social_link : `https://${editedRow.social_link}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 500, color: "#1fae5b", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, display: "block" }} title={editedRow.social_link}>{editedRow.social_link.replace(/^https?:\/\//, "")}</a>
                ) : <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>}
              </div>
              {customCols.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={S.sectionTitle}>Custom Fields</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {customCols.map(col => {
                      const val = editedRow.custom[col.field_key] || ""
                      return (
                        <div key={col.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{col.field_name}</span>
                          {readOnly ? <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{val || "—"}</div>
                            : col.field_type === "boolean" ? <select style={S.formInput} value={val} onChange={e => handleFieldChange(`custom.${col.field_key}`, e.target.value)}><option value="No">No</option><option value="Yes">Yes</option></select>
                            : col.field_type === "dropdown" ? <select style={S.formInput} value={val} onChange={e => handleFieldChange(`custom.${col.field_key}`, e.target.value)}><option value="">—</option>{col.field_options?.map(o => <option key={o} value={o}>{o}</option>)}</select>
                            : <input style={S.formInput} type={col.field_type === "number" ? "number" : "text"} value={val} onChange={e => handleFieldChange(`custom.${col.field_key}`, e.target.value)} />
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {!readOnly && (
                <DrawerActionBar>
                  <button style={S.cancelBtn} onClick={handleCancel}>Cancel</button>
                  <button style={S.saveBtn} onClick={handleSave} onMouseEnter={e => { e.currentTarget.style.background = "#0f6b3e" }} onMouseLeave={e => { e.currentTarget.style.background = "#1fae5b" }}>Save Changes</button>
                </DrawerActionBar>
              )}
            </div>
          )}

          {/* ════ ORDER / POST / PAID COLLAB (read-only) ════ */}
          {(activeTab === 1 || activeTab === 3 || activeTab === 5) && !closedRow && (
            <ReadOnlyTabPlaceholder loading={closedLoading} brandId={brandId} />
          )}
          {activeTab === 1 && closedRow && <ReadOnlyOrderTab inf={closedRow} brandId={brandId} />}
          {activeTab === 3 && closedRow && <ReadOnlyPostTab inf={closedRow} brandId={brandId} />}
          {activeTab === 5 && closedRow && <ReadOnlyPaidCollabTab inf={closedRow} brandId={brandId} />}

          {/* ════ ATTRIBUTION / STATS ════ */}
          {activeTab === 2 && (
            <AttributionTab brandId={brandId} brandInfluencerId={biId} firstName={editedRow.first_name || editedRow.handle} onSaved={refreshSheet} />
          )}
          {activeTab === 4 && (
            <InfluencerStatsTab brandId={brandId} brandInfluencerId={biId} allowManualEntry onSaved={refreshSheet} />
          )}

          {/* ════ HISTORY TAB ════ */}
          {activeTab === 6 && (
            <HistoryTab
              brandId={brandId}
              biId={row.brand_influencer_id || row.id}
            />
          )}

        </DrawerBody>
      </DrawerShell>
    </>
  )
}
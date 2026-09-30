"use client"

import { useState, useEffect } from "react"
import { EmailModal } from "@/components/shared/email-modal"
import { ProfilePicture, PlatformIcon } from "@/components/table-sheet/ui-atoms"
import { getProfileUrl, getPlatformLabel } from "@/components/table-sheet/utils"
import { DeclineModal } from "@/components/shared/decline-modal"
import { AttributionTab } from "@/components/shared/attribution-tab"
import { InfluencerStatsTab } from "@/components/shared/influencer-stats-tab"
import { useClosedData } from "@/hooks/useClosedData"
import {
  PAID_COLLAB_TYPES, ReadOnlyOrderTab, ReadOnlyPostTab, ReadOnlyPaidCollabTab,
} from "@/components/pipeline/post-tracker-readonly-tabs"
import { allowedTransitions } from "@/lib/pipeline-transitions"

// ─── Types ────────────────────────────────────────────────────────────────────
interface MonthlyData {
  month: string; posts: number; clicks: number; rev: number; eng: number; sales: number
}
interface ProductSend {
  date: string; product: string; cost: number; reason: string
}

export interface Partner {
  id: number
  handle: string
  firstName: string
  lastName: string
  birthday: string
  plat: string
  niche: string
  gend: string
  loc: string
  tier: string
  tierOverride: string | null
  onRet: boolean
  retFee: number
  defComm: number
  commSt: string
  clicks: number; cvr: number; sales: number; aov: number; rev: number
  fol: number; eng: number; avgV: number; gmv: number
  added: Date
  prods: ProductSend[]
  prodCost: number; feesPaid: number; commPaid: number; totalSpend: number
  roi_val: number; roas_val: number
  monthly: MonthlyData[]
  ppm: number; hClicks: number; hSales: number; hRev: number; hCVR: number; hPosts: number
  avg_likes?: number | null
  avg_comments?: number | null
  avg_views?: number | null
  follower_count?: number | null
  engagement_rate?: number | null
  affiliate_id?: string | null
  ref_code?: string | null
  coupon?: string | null
  spark_ads?: string | null
  affiliate_link?: string | null
  brandInfluencerId?: string
  brandId?: string
  agreedRate?: number | null
  internalRating?: number | null
  likesCount?: number
  commentsCount?: number
  viewsCount?: number
  orderStatus?: string | null
  campaignName?: string | null
  contactStatus?: string
  email?: string | null
  /**
   * The influencer's stored avatar — the permanent Cloudinary URL the
   * Influencer List saves on the Influencer record. Read straight from the
   * pipeline payload; nothing is uploaded or re-fetched here.
   */
  profileImageUrl?: string | null
  /** Collaboration Type — same value persisted in product_details.campaignType,
   *  shared with the Pipeline board and Post Tracker so all three stay in sync. */
  collabType?: string
  /** Basic tab's free-text notes — BrandInfluencer.notes. */
  notes?: string
}

interface Deliverable { name: string; posted: boolean }
interface CampaignPartner {
  pid: number; payStatus: number; deliverables: Deliverable[]
  fee: number; productCost: number; commPaid: number
  revenue: number; views: number; likes: number; engRate: number
}
export interface Campaign {
  id: number; name: string; status: string; start: string; end: string
  budget: number; type: string; notes: string; partners: CampaignPartner[]
}

// ─── Activity log types ───────────────────────────────────────────────────────
interface ActivityLog {
  id: string
  action: string
  label: string
  details: Record<string, unknown>
  created_at: string
  user: {
    id: string
    name: string | null
    image: string | null
    initials: string
  } | null
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  "influencer.added":            { bg: "#dcfce7", color: "#166534" },
  "influencer.removed":          { bg: "#fee2e2", color: "#991b1b" },
  "influencer.approval_changed": { bg: "#f3e8ff", color: "#6b21a8" },
  "pipeline.stage_changed":      { bg: "#dbeafe", color: "#1e40af" },
  "pipeline.status_changed":     { bg: "#fef9c3", color: "#854d0e" },
  "posttracker.stage_changed":   { bg: "#ccfbf1", color: "#0f766e" },
  "influencer.submitted":        { bg: "#ffedd5", color: "#9a3412" },
  "influencer.updated":          { bg: "#e0f2fe", color: "#0369a1" },
}

function formatActivityDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

function formatActivityDetails(action: string, details: Record<string, unknown>): string {
  switch (action) {
    case "pipeline.stage_changed":
      return `Stage ${details.from} → ${details.to}`
    case "pipeline.status_changed":
      if (details.ni_reason) return `${details.from} → ${details.to} · "${details.ni_reason}"`
      return `${details.from} → ${details.to}`
    case "influencer.approval_changed":
      return `${details.from ?? "—"} → ${details.to}${details.notes ? ` · "${details.notes}"` : ""}`
    case "influencer.added":
      return `via ${details.method ?? "manual"}${details.platform ? ` on ${details.platform}` : ""}`
    case "posttracker.stage_changed":
      return `${details.from} → ${details.to}`
    case "influencer.updated": {
      const fields = details.fields as string[] | undefined
      return fields?.length ? `Updated ${fields.length} field${fields.length > 1 ? "s" : ""}` : ""
    }
    default:
      return ""
  }
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────
export function HistoryTab({ brandId, biId }: { brandId?: string; biId?: string }) {
  const [logs, setLogs]       = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!brandId || !biId) { setLoading(false); return }
    setLoading(true); setError(null)
    fetch(`/api/brand/${brandId}/influencers/${biId}/activity`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setLogs(d.logs ?? []); setLoading(false) })
      .catch(err => { console.error("[HistoryTab]", err); setError("Failed to load history"); setLoading(false) })
  }, [brandId, biId])

  if (!brandId || !biId) return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af", fontSize: 12 }}>
      No activity tracking context available
    </div>
  )
  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", fontSize: 13 }}>
      Loading history…
    </div>
  )
  if (error) return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 4 }}>{error}</div>
    </div>
  )
  if (logs.length === 0) return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.2 }}>🕐</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>No activity yet</div>
      <div style={{ fontSize: 11, color: "#d1d5db", maxWidth: 220, margin: "0 auto" }}>
        Actions like adding, approving, or moving this influencer will appear here
      </div>
    </div>
  )

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: 19, top: 8, bottom: 8, width: 1, background: "#f3f4f6" }} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {logs.map(log => {
          const colorScheme = ACTION_COLORS[log.action] ?? { bg: "#f3f4f6", color: "#374151" }
          const detail = formatActivityDetails(log.action, log.details)
          return (
            <div key={log.id} style={{ display: "flex", gap: 14, paddingBottom: 22, position: "relative" }}>
              <div style={{ flexShrink: 0, zIndex: 1 }}>
                {log.user?.image ? (
                  <img src={log.user.image} alt={log.user.name ?? ""} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "2px solid #f0fdf4" }} />
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#dcfce7", border: "2px solid #f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1fae5b" }}>
                    {log.user?.initials ?? "?"}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{log.user?.name ?? "Unknown user"}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: colorScheme.bg, color: colorScheme.color }}>
                      {log.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {formatActivityDate(log.created_at)}
                  </span>
                </div>
                {detail && (
                  <div style={{ fontSize: 11, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "5px 10px", display: "inline-block", marginTop: 2 }}>
                    {detail}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── LastEditedBy — compact "who touched this last" strip for the Basic tab ───
// Exported: Post Tracker's Basic tab reuses this, same as HistoryTab below.
export function LastEditedBy({ brandId, biId }: { brandId?: string; biId?: string }) {
  const [log, setLog]         = useState<ActivityLog | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!brandId || !biId) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/brand/${brandId}/influencers/${biId}/activity?limit=1`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setLog(d?.logs?.[0] ?? null))
      .catch(() => setLog(null))
      .finally(() => setLoading(false))
  }, [brandId, biId])

  if (loading || !log) return null

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#9ca3af", padding: "6px 10px", background: "#f9fafb", borderRadius: 8, border: "1px solid #f3f4f6" }}>
      <span>Last updated by <strong style={{ color: "#374151", fontWeight: 600 }}>{log.user?.name ?? "Unknown user"}</strong></span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>{formatActivityDate(log.created_at)}</span>
    </div>
  )
}

// ─── Collaboration Types (from DTC "Final clean list") ────────────────────────
const COLLAB_TYPES = [
  { value: "Gifting",            implied: "Product sent, no payment, no commission" },
  { value: "Paid",               implied: "Product sent + flat fee" },
  { value: "Affiliate",          implied: "Product sent + commission link" },
  { value: "UGC",                implied: "Product sent, brand owns content, no post required" },
  { value: "TikTok Shop",        implied: "Product sent + in-app shop tagging + commission" },
  { value: "Paid + Affiliate",   implied: "Product sent + flat fee + commission" },
  { value: "UGC + Paid",         implied: "Product sent + flat fee + brand owns content" },
  { value: "TikTok Shop + Paid", implied: "TikTok Shop + flat fee on top" },
]

// The Pipeline board (and the persisted DB value) use short kebab-case ids
// ("gifting", "tiktok-shop", ...) while this sidebar shows the nicer Title
// Case label. Map between them at the read/write boundary so both surfaces
// stay in sync against the same underlying value.
const KANBAN_ID_TO_LABEL: Record<string, string> = {
  "gifting": "Gifting", "paid": "Paid", "affiliate": "Affiliate", "ugc": "UGC",
  "tiktok-shop": "TikTok Shop", "paid-affiliate": "Paid + Affiliate",
  "ugc-paid": "UGC + Paid", "tiktok-shop-paid": "TikTok Shop + Paid",
}
const LABEL_TO_KANBAN_ID: Record<string, string> = Object.fromEntries(
  Object.entries(KANBAN_ID_TO_LABEL).map(([id, label]) => [label, id])
)

// ─── NI Modal ────────────────────────────────────────────────────────────────
// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMoney(v: number) { return "$" + Math.round(v).toLocaleString() }
function autoTier(rev: number) { return rev >= 10001 ? "Gold" : rev >= 2001 ? "Silver" : "Bronze" }

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—"
  const num = Number(n)
  if (isNaN(num)) return "—"
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M"
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K"
  return String(num)
}



// ─── Main Component ───────────────────────────────────────────────────────────
export default function InfluencerProfileSidebar({
  partner,
  allPartners,
  onClose,
  onPipelineStatusChange,
  onCollabTypeChange,
}: {
  partner:                  Partner
  campaigns:                Campaign[]
  allPartners:              Partner[]
  onClose:                  () => void
  onPipelineStatusChange?:  (biId: string, newStatus: string, niReason?: string, declineNotes?: string) => void
  /** Optional: called when collab type is changed, so parent can persist the value */
  onCollabTypeChange?:      (biId: string, newType: string) => void
}) {
  const [profileTab,     setProfileTab]     = useState(0)
  const [pipelineStatus, setPipelineStatus] = useState(partner.commSt || "For Outreach")
  // Collaboration type — initialized from the real persisted value (shared
  // with Pipeline + Post Tracker via product_details.campaignType) instead of
  // always resetting to "Gifting" regardless of what's actually saved.
  const [collabType,     setCollabType]     = useState(
    KANBAN_ID_TO_LABEL[partner.collabType ?? ""] ?? partner.collabType ?? "Gifting"
  )
  const [showNIModal,    setShowNIModal]    = useState(false)
  const [prevStatus,     setPrevStatus]     = useState(partner.commSt || "For Outreach")
  const [showEmailModal, setShowEmailModal] = useState(false)

  // Follow the persisted stage whenever it changes underneath this panel.
  //
  // The dropdown sets `pipelineStatus` optimistically so it responds instantly,
  // but the parent is the one that actually persists the move, and it can end
  // up somewhere other than what was picked: moving to Deal Agreed opens a
  // collaboration-type modal that the user can cancel, and any write can fail
  // and roll back. Without this the dropdown would keep displaying a stage the
  // record never reached. Re-syncing from the parent's value also keeps the
  // panel correct when the same influencer is moved from the board behind it.
  useEffect(() => {
    const persisted = partner.commSt || "For Outreach"
    setPipelineStatus(persisted)
    setPrevStatus(persisted)
  }, [partner.commSt])


  // Notes uses the same pipeline route the Stage/Collaboration Type dropdowns use.
  const [notesValue, setNotesValue] = useState(partner.notes ?? "")
  const [notesSaveState, setNotesSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const handleNotesSave = async () => {
    if (!partner.brandId || !partner.brandInfluencerId) return
    setNotesSaveState("saving")
    try {
      const res = await fetch(`/api/brand/${partner.brandId}/pipeline/${partner.brandInfluencerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesValue }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setNotesSaveState("saved")
    } catch {
      setNotesSaveState("error")
    } finally {
      setTimeout(() => setNotesSaveState("idle"), 3000)
    }
  }

  const tier = partner.tierOverride || autoTier(partner.rev)

  const now  = new Date("2026-04-01")
  const bday = partner.birthday ? new Date(partner.birthday) : null
  let bdayPill = ""
  if (bday) {
    const nb = new Date(now.getFullYear(), bday.getMonth(), bday.getDate())
    if (nb < now) nb.setFullYear(now.getFullYear() + 1)
    const du = Math.ceil((nb.getTime() - now.getTime()) / 86400000)
    if (du <= 30) bdayPill = `in ${du}d`
  }

  const followers   = fmt(partner.follower_count ?? partner.fol)
  const engRate     = partner.engagement_rate != null ? `${partner.engagement_rate}%`
                    : partner.eng != null ? `${partner.eng}%` : "—"

  // Same tabs as Post Tracker's drawer. Order, Post and Paid collab are view-only
  // here (edited in Post Tracker) and disabled until the influencer is there.
  const TABS = ["Basic", "Order", "Attribution", "Post", "Stats", "Paid collab details", "History"]
  const inPostTracker = partner.commSt === "For Order Creation"
  const { data: closedRows } = useClosedData(inPostTracker ? partner.brandId : undefined)
  const closedRow = inPostTracker ? closedRows.find((r) => r.id === partner.brandInfluencerId) : undefined
  const tabDisabledReason = (idx: number): string | null => {
    if (idx !== 1 && idx !== 3 && idx !== 5) return null
    if (!inPostTracker) return "Available once this influencer is in Post Tracker"
    if (idx === 5 && !PAID_COLLAB_TYPES.has(LABEL_TO_KANBAN_ID[collabType] ?? collabType)) return "Only for paid collaborations"
    return null
  }
  // Falls back to Basic if the open tab becomes unavailable (e.g. another influencer).
  const activeTab = tabDisabledReason(profileTab) ? 0 : profileTab


  // ── Collab type change handler ────────────────────────────────────────────
  const handleCollabTypeChange = (newType: string) => {
    setCollabType(newType)
    if (onCollabTypeChange && partner.brandInfluencerId) {
      onCollabTypeChange(partner.brandInfluencerId, LABEL_TO_KANBAN_ID[newType] ?? newType)
    }
  }

  // ── Pipeline dropdown change handler ─────────────────────────────────────
  const handlePipelineChange = (newStatus: string) => {
    if (newStatus === "Not Interested") {
      setPrevStatus(pipelineStatus)
      setShowNIModal(true)
      return
    }
    setPipelineStatus(newStatus)
    if (onPipelineStatusChange && partner.brandInfluencerId) {
      onPipelineStatusChange(partner.brandInfluencerId, newStatus)
    }
  }

  const handleNIConfirm = (reason: string, declineNotes?: string) => {
    setShowNIModal(false)
    setPipelineStatus("Not Interested")
    if (onPipelineStatusChange && partner.brandInfluencerId) {
      onPipelineStatusChange(partner.brandInfluencerId, "Not Interested", reason, declineNotes)
    }
  }

  const handleNICancel = () => {
    setShowNIModal(false)
    setPipelineStatus(prevStatus)
  }

  return (
    <>
      {/* ── Background overlay ── */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 400, cursor: "pointer" }}
      />

      {/* ── NI Modal ── */}
      {showNIModal && (
        <DeclineModal
          name={`${partner.firstName} ${partner.lastName}`.trim() || partner.handle}
          handle={partner.handle}
          profileImageUrl={partner.profileImageUrl ?? null}
          onConfirm={handleNIConfirm}
          onCancel={handleNICancel}
        />
      )}

      {/* ── Email Modal ── */}
      {showEmailModal && (
        <EmailModal
          partnerName={`${partner.firstName} ${partner.lastName}`.trim() || partner.handle}
          handle={partner.handle}
          platform={partner.plat}
          brandId={partner.brandId}
          defaultTo={partner.email || ""}
          onClose={() => setShowEmailModal(false)}
        />
      )}

      {/* ── Sidebar panel ── */}
      <div className="pp">
        {/* Header copied from Post Tracker's drawer so the two match. */}
        <button onClick={onClose} title="Close" className="close-btn">✕</button>
        <div className="pph">
          <div className="ppt" style={{ paddingRight: 40 }}>Influencer Profile</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12, paddingRight: 40 }}>
            <div className="pav">
              {partner.profileImageUrl ? (
                // Shared avatar component, so a broken or expired image falls
                // back to initials exactly as it does in the Influencer List.
                <ProfilePicture
                  src={partner.profileImageUrl}
                  name={`${partner.firstName} ${partner.lastName}`.trim()}
                  handle={partner.handle}
                  size={44}
                />
              ) : (
                partner.firstName ? partner.firstName[0] : partner.handle[1]?.toUpperCase()
              )}
            </div>
            <div style={{ flexGrow: 1, flexShrink: 0, flexBasis: "auto" }}>
              <div className="pnm">{partner.firstName} {partner.lastName}</div>
              <div className="phd">@{partner.handle.replace(/^@/, "")}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
              {/* STAGE dropdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Stage</span>
                <select
                  className="ssel"
                  value={pipelineStatus}
                  onChange={(e) => handlePipelineChange(e.target.value)}
                  style={{
                    borderColor: pipelineStatus === "Not Interested" ? "#fca5a5" : undefined,
                    background:  pipelineStatus === "Not Interested" ? "#fef2f2" : undefined,
                    color:       pipelineStatus === "Not Interested" ? "#dc2626" : undefined,
                  }}
                >
                  {/* The current stage, plus only the stages it may actually
                      move to (lib/pipeline-transitions.ts) — the same rule the
                      card's quick-move buttons render and the PATCH route
                      enforces.

                      This listed all six stages unconditionally, which is how
                      the panel could move a row from "For Outreach" straight to
                      "For Order Creation" — a jump the card refuses. The
                      current stage is always present so the select has a value
                      to show; it is disabled because re-selecting it is a
                      no-op. */}
                  <option value={pipelineStatus} disabled
                    style={pipelineStatus === "Not Interested" ? { color: "#dc2626", fontWeight: 600 } : undefined}>
                    {pipelineStatus}
                  </option>
                  {allowedTransitions(pipelineStatus).map((s) => (
                    <option key={s} value={s}
                      style={s === "Not Interested" ? { color: "#dc2626", fontWeight: 600 } : undefined}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* COLLABORATION TYPE dropdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Collaboration Type</span>
                <select
                  className="csel"
                  value={collabType}
                  onChange={(e) => handleCollabTypeChange(e.target.value)}
                >
                  {COLLAB_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.value}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* NI status pill */}
          {pipelineStatus === "Not Interested" && (
            <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 11, color: "#dc2626", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>✕</span> Marked as Not Interested
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="atag plat" style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, lineHeight: 1 }}>
              <PlatformIcon platform={partner.plat} size={14} className="shrink-0" />
              <span className="truncate">{getPlatformLabel(partner.plat) || "—"}</span>
            </button>
            <button className="atag" onClick={() => setShowEmailModal(true)}>Send Email</button>
            <button
              className="atag"
              onClick={() => {
                // getProfileUrl's map is keyed lowercase; partner.plat is capitalised here.
                const url = getProfileUrl(partner.plat?.toLowerCase() ?? "", partner.handle)
                if (url) window.open(url, "_blank", "noopener,noreferrer")
              }}
            >
              Send DM
            </button>
            <button className="atag">Follow up</button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="pit-bar">
          {TABS.map((tab, idx) => {
            const reason = tabDisabledReason(idx)
            return (
              <div key={idx} title={reason ?? undefined}
                className={`pit ${activeTab === idx ? "active" : ""} ${reason ? "pit-disabled" : ""}`}
                onClick={() => { if (!reason) setProfileTab(idx) }}>
                {tab}
              </div>
            )
          })}
        </div>

        {/* ── Body ── */}
        <div className="ppb">

          {/* ════ BASIC TAB ════ — Post Tracker's layout plus the Pipeline extras */}
          {activeTab === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <LastEditedBy brandId={partner.brandId} biId={partner.brandInfluencerId} />
              <div className="sr4">
                <div className="sbox"><div className="slb">Followers</div><div className="svl">{followers}</div></div>
                <div className="sbox"><div className="slb">Eng Rate</div><div className="svl" style={{ color: "#2c8ec4" }}>{engRate}</div></div>
                <div className="sbox"><div className="slb">Rate</div><div className="svl" style={{ color: "#1fae5b" }}>{partner.agreedRate ? formatMoney(partner.agreedRate) : "—"}</div></div>
                <div className="sbox"><div className="slb">Rating</div><div className="svl">{partner.internalRating ? `${partner.internalRating}/5` : "—"}</div></div>
              </div>
              <div>
                <div className="section-label">Avg Metrics</div>
                <div className="avg-row">
                  <div className="avg-card"><div className="avg-val">{(partner.likesCount ?? 0).toLocaleString()}</div><div className="avg-lbl">Likes</div></div>
                  <div className="avg-card"><div className="avg-val">{(partner.commentsCount ?? 0).toLocaleString()}</div><div className="avg-lbl">Comments</div></div>
                  <div className="avg-card"><div className="avg-val">{(partner.viewsCount ?? 0).toLocaleString()}</div><div className="avg-lbl">Views</div></div>
                </div>
              </div>
              <div className="fgrd">
                <div className="frow"><div className="flbl">Location</div><div className="fval">{partner.loc || "—"}</div></div>
                <div className="frow"><div className="flbl">Niche</div><div className="fval">{partner.niche || "—"}</div></div>
                <div className="frow"><div className="flbl">Platform</div><div className="fval">{partner.plat || "—"}</div></div>
                <div className="frow"><div className="flbl">Email</div><div className="fval">{partner.email || "—"}</div></div>
                <div className="frow"><div className="flbl">Order Status</div><div className="fval">{partner.orderStatus || "—"}</div></div>
                <div className="frow"><div className="flbl">Stage</div><div className="fval">{closedRow?.closedStatus ?? partner.commSt}</div></div>
                <div className="frow"><div className="flbl">Campaign</div><div className="fval">{partner.campaignName || "—"}</div></div>
                <div className="frow"><div className="flbl">Contact Status</div><div className="fval">{partner.contactStatus || "—"}</div></div>
                <div className="frow"><div className="flbl">Gender</div><div className="fval">{partner.gend || "—"}</div></div>
                <div className="frow">
                  <div className="flbl">Birthday</div>
                  <div className="fval">{partner.birthday || "—"}{bdayPill && <span className="bp">{bdayPill}</span>}</div>
                </div>
                <div className="frow"><div className="flbl">Commission</div><div className="fval">{partner.defComm > 0 ? partner.defComm + "%" : "—"}</div></div>
                <div className="frow"><div className="flbl">Tier</div><div className="fval">{tier}</div></div>
                <div className="frow"><div className="flbl">Community</div><div className="fval">{partner.commSt}</div></div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>Notes</div>
                <textarea
                  className="pfi"
                  style={{ minHeight: 80, resize: "vertical" }}
                  placeholder="Add notes..."
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    className="btn-primary"
                    onClick={handleNotesSave}
                    disabled={notesSaveState === "saving"}
                    style={{ opacity: notesSaveState === "saving" ? 0.6 : 1 }}
                  >
                    {notesSaveState === "saving" ? "Updating…" : notesSaveState === "saved" ? "Updated" : "Update"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════ ORDER / POST / PAID COLLAB — read-only, from Post Tracker's data ════ */}
          {(activeTab === 1 || activeTab === 3 || activeTab === 5) && !closedRow && (
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Loading…</div>
          )}
          {activeTab === 1 && closedRow && <ReadOnlyOrderTab inf={closedRow} brandId={partner.brandId} />}
          {activeTab === 3 && closedRow && <ReadOnlyPostTab inf={closedRow} brandId={partner.brandId} />}
          {activeTab === 5 && closedRow && <ReadOnlyPaidCollabTab inf={closedRow} brandId={partner.brandId} />}

          {/* ════ ATTRIBUTION TAB ════ */}
          {activeTab === 2 && (
            <AttributionTab
              brandId={partner.brandId}
              brandInfluencerId={partner.brandInfluencerId}
              firstName={partner.firstName}
              initial={{ coupon: partner.coupon, refCode: partner.ref_code, affiliateLink: partner.affiliate_link, sparkAds: partner.spark_ads }}
            />
          )}

          {/* ════ STATS TAB ════ */}
          {activeTab === 4 && (
            <InfluencerStatsTab brandId={partner.brandId} brandInfluencerId={partner.brandInfluencerId} />
          )}

          {/* ════ HISTORY TAB ════ */}
          {activeTab === 6 && (
            <HistoryTab brandId={partner.brandId} biId={partner.brandInfluencerId} />
          )}

        </div>

        <style jsx>{`
          .pp { position:fixed; top:0; right:0; width:520px; max-width:100vw; height:100%; background:#fff; box-shadow:-8px 0 40px rgba(0,0,0,0.14); z-index:500; display:flex; flex-direction:column; font-family:"Inter",system-ui,sans-serif; }
          .pph { padding:16px 20px; border-bottom:1px solid #f0f0f0; }
          .ppt { font-size:11px; font-weight:600; color:#9ca3af; letter-spacing:.1em; text-transform:uppercase; margin-bottom:12px; }
          .pav { width:44px; height:44px; border-radius:50%; background:#1fae5b; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; color:#fff; flex-shrink:0; box-shadow:0 0 0 3px #dcfce7; }
          .pnm { font-size:15px; font-weight:700; color:#111827; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .phd { font-size:12px; color:#6b7280; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

          /* Pipeline select */
          .ssel { font-size:11px; padding:5px 10px; border-radius:8px; border:.5px solid #f4b740; background:#fffbeb; color:#854f0b; cursor:pointer; font-family:inherit; font-weight:500; transition:all .15s; width:115px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

          /* Collab type select — adapts colour via inline style */
          .csel { font-size:11px; padding:5px 10px; border-radius:8px; border:1px solid #e5e7eb; background:#f9fafb; color:#374151; cursor:pointer; font-family:inherit; font-weight:600; transition:all .15s; width:115px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

          .close-btn { position:absolute; top:16px; right:20px; z-index:1; width:30px; height:30px; border-radius:50%; border:1.5px solid #e5e7eb; background:#f9fafb; color:#374151; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; line-height:1; transition:background .15s,border-color .15s,color .15s; }
          .close-btn:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
          .atag { font-size:12px; font-weight:500; padding:6px 14px; border-radius:20px; cursor:pointer; border:1px solid #e5e7eb; background:#f9fafb; color:#555; transition:background .15s,border-color .15s,color .15s; }
          .atag:not(.plat):hover { background:#eafaf1; border-color:#1fae5b; color:#1fae5b; }
          .atag.plat { background:#1fae5b; color:#fff; border-color:#1fae5b; }
          .pit-bar { display:flex; gap:0; padding:0 20px; border-bottom:1px solid #f0f0f0; overflow-x:auto; scrollbar-width:thin; scrollbar-color:#d1d5db transparent; }
          .pit-bar::-webkit-scrollbar { height:4px; }
          .pit-bar::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:4px; }
          .pit { font-size:12px; font-weight:600; padding:11px 14px; cursor:pointer; color:#9ca3af; border-bottom:2px solid transparent; white-space:nowrap; transition:color .15s; flex-shrink:0; }
          .pit.active { color:#1fae5b; border-bottom-color:#1fae5b; }
          .pit-disabled { color:#d1d5db; cursor:not-allowed; }
          .ppb { flex:1; overflow-y:auto; padding:18px 20px; }
          .sr4 { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; background:linear-gradient(135deg,#f0fdf4 0%,#f9fafb 100%); border-radius:12px; padding:14px; margin-bottom:4px; border:1px solid #dcfce7; }
          .sbox { text-align:center; }
          .slb { font-size:9px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:.07em; }
          .svl { font-size:16px; font-weight:700; color:#111827; margin-top:3px; }
          .section-label { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; padding-top:12px; border-top:1px solid #f3f4f6; }
          .avg-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
          .avg-card { background:#fff; border:1.5px solid #e5e7eb; border-radius:10px; padding:12px 8px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,.05); }
          .avg-val { font-size:18px; font-weight:700; color:#111827; }
          .avg-lbl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.07em; margin-top:3px; }
          .fgrd { display:grid; grid-template-columns:1fr 1fr; }
          .frow { padding:8px 0; border-bottom:.5px solid rgba(0,0,0,.05); }
          .flbl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
          .fval { font-size:13px; color:#111827; font-weight:500; }
          .bp { display:inline-block; font-size:10px; padding:1px 7px; border-radius:6px; background:#fce4ec; color:#880e4f; margin-left:6px; }
          .pfr { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
          .pfg { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
          .pfl { font-size:10px; font-weight:600; color:#6b7280; }
          .pfi { width:100%; font-size:12px; padding:8px 10px; border-radius:8px; border:1.5px solid #e5e7eb; background:#f9fafb; color:#111827; font-family:inherit; box-sizing:border-box; outline:none; transition:border-color .15s,background .15s; }
          .pfi:focus { border-color:#1fae5b; background:#fff; }
          .pfi::placeholder { color:#c4c4c4; }
          textarea.pfi { resize:vertical; min-height:70px; }
          .stit { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.08em; padding:12px 0 8px; border-bottom:1px solid #f3f4f6; margin-bottom:10px; }
          .skg { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
          .skc { background:#f9fafb; border-radius:10px; padding:10px 12px; text-align:center; border:1px solid #f3f4f6; }
          .skl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; margin-top:3px; }
          .skv-green { font-size:16px; font-weight:700; color:#1fae5b; }
          .skv-dark  { font-size:16px; font-weight:700; color:#111827; }
          .skv-blue  { font-size:16px; font-weight:700; color:#2c8ec4; }
          .skv-red   { font-size:16px; font-weight:700; color:#e24b4a; }
          .breakdown-box { background:#f9fafb; border-radius:8px; padding:10px; margin-bottom:14px; font-size:11px; color:#888; border:1px solid #f3f4f6; }
          .mg { display:grid; grid-template-columns:repeat(6,1fr); gap:6px; }
          .mc2 { background:#f9fafb; border-radius:6px; padding:8px 6px; text-align:center; border:1px solid #f3f4f6; }
          .mc2.best { background:#f0fdf4; border-color:#dcfce7; }
          .mn { font-size:10px; color:#888; }
          .mv { font-size:12px; font-weight:600; color:#1e1e1e; margin-top:2px; }
          .mv-best { color:#1fae5b; }
          .ms-txt { font-size:10px; color:#888; }
          .btn-primary { background:#1fae5b; color:#fff; border:none; padding:9px 20px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; font-family:inherit; transition:background .15s; }
          .btn-primary:hover { background:#0f6b3e; }
          .btn-secondary { background:transparent; color:#6b7280; border:1.5px solid #e5e7eb; padding:9px 18px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; font-family:inherit; transition:background .15s,border-color .15s; }
          .btn-secondary:hover { background:#f9fafb; border-color:#d1d5db; }
        `}</style>
      </div>
    </>
  )
}
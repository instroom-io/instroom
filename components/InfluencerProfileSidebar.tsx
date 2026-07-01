"use client"

import { useState, useEffect } from "react"

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
  brandInfluencerId?: string
  brandId?: string
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
    default:
      return ""
  }
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────
function HistoryTab({ brandId, biId }: { brandId?: string; biId?: string }) {
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

// ─── NI Reasons ───────────────────────────────────────────────────────────────
const NI_REASONS = [
  { r: "Fee too low / unpaid",                  bucket: "hard", color: "#E24B4A" },
  { r: "Brief too scripted",                    bucket: "hard", color: "#E8724A" },
  { r: "Won't allow content reuse",             bucket: "hard", color: "#F4A240" },
  { r: "Working with a competitor",             bucket: "hard", color: "#C97B3A" },
  { r: "Product doesn't fit their brand",       bucket: "hard", color: "#888780" },
  { r: "Wrong audience fit",                    bucket: "hard", color: "#6B7F7A" },
  { r: "Seen bad reviews about us",             bucket: "hard", color: "#A32D2D" },
  { r: "Fully booked",                          bucket: "soft", color: "#2C8EC4" },
  { r: "Temporarily unavailable / can't shoot", bucket: "soft", color: "#5BAFD4" },
  { r: "Can't ship to their location",          bucket: "soft", color: "#7DC4E4" },
  { r: "Ghosted / no longer active",            bucket: "soft", color: "#B4B2A9" },
  { r: "Rate / deadline too tight",             bucket: "soft", color: "#F4B740" },
  { r: "Others",                                bucket: "hard", color: "#D3D1C7" },
]

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

// Colour coding per collab type so the pill is visually distinct
const COLLAB_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "Gifting":            { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  "Paid":               { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  "Affiliate":          { bg: "#fef9c3", color: "#854d0e", border: "#fde68a" },
  "UGC":                { bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff" },
  "TikTok Shop":        { bg: "#fff1f2", color: "#be123c", border: "#fecdd3" },
  "Paid + Affiliate":   { bg: "#ecfeff", color: "#0e7490", border: "#a5f3fc" },
  "UGC + Paid":         { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  "TikTok Shop + Paid": { bg: "#fdf4ff", color: "#a21caf", border: "#f0abfc" },
}

// ─── NI Modal ────────────────────────────────────────────────────────────────
function NIModal({
  partnerName,
  handle,
  profileImageUrl,
  onConfirm,
  onCancel,
}: {
  partnerName:      string
  handle:           string
  profileImageUrl?: string | null
  onConfirm:        (reason: string) => void
  onCancel:         () => void
}) {
  const [sel, setSel] = useState<string | null>(null)
  const hard     = NI_REASONS.filter((r) => r.bucket === "hard")
  const soft     = NI_REASONS.filter((r) => r.bucket === "soft")
  const initials = partnerName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onCancel}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: 780, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", fontFamily: "'Inter',system-ui,sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 28px 16px", borderBottom: "1px solid #f3f4f6" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Mark as not interested</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>Select the reason why this influencer declined or is not moving forward.</div>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9ca3af", lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Influencer info */}
        <div style={{ padding: "20px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#f9fafb", borderRadius: 12, padding: "12px 16px", border: "1px solid #f3f4f6" }}>
            {profileImageUrl ? (
              <img src={profileImageUrl} alt={partnerName} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
                {initials}
              </div>
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{partnerName}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{handle}</div>
            </div>
          </div>
        </div>

        {/* Reasons grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", padding: "20px 28px 12px" }}>
          {/* Hard pass */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#b91c1c" }}>Hard pass</span>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>— don't reach out soon</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {hard.map((reason) => (
                <button key={reason.r} onClick={() => setSel(reason.r)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: sel === reason.r ? "1.5px solid #f87171" : "1px solid #f3f4f6", background: sel === reason.r ? "#fef2f2" : "#fff", cursor: "pointer", textAlign: "left", transition: "all .15s" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: reason.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#374151", flex: 1, lineHeight: 1.4 }}>{reason.r}</span>
                  {sel === reason.r && (
                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Soft pass */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1d4ed8" }}>Soft pass</span>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>— follow up next campaign</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {soft.map((reason) => (
                <button key={reason.r} onClick={() => setSel(reason.r)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: sel === reason.r ? "1.5px solid #93c5fd" : "1px solid #f3f4f6", background: sel === reason.r ? "#eff6ff" : "#fff", cursor: "pointer", textAlign: "left", transition: "all .15s" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: reason.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#374151", flex: 1, lineHeight: 1.4 }}>{reason.r}</span>
                  {sel === reason.r && (
                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  )}
                </button>
              ))}
            </div>

            {sel && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "#f9fafb", borderRadius: 10, border: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Selected reason</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{sel}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  {NI_REASONS.find((r) => r.r === sel)?.bucket === "soft"
                    ? "This influencer can be re-approached in a future campaign."
                    : "This influencer should not be contacted again soon."}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 28px", borderTop: "1px solid #f3f4f6" }}>
          <button onClick={onCancel}
            style={{ padding: "8px 16px", fontSize: 13, color: "#6b7280", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
          <button onClick={() => sel && onConfirm(sel)} disabled={!sel}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, color: "#fff", background: sel ? "#ef4444" : "#fca5a5", border: "none", borderRadius: 8, cursor: sel ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "background .15s" }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMoney(v: number) { return "$" + Math.round(v).toLocaleString() }
function formatROAS(rev: number, spend: number) { return spend > 0 ? (rev / spend).toFixed(1) + "x" : "—" }
function autoTier(rev: number) { return rev >= 10001 ? "Gold" : rev >= 2001 ? "Silver" : "Bronze" }

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—"
  const num = Number(n)
  if (isNaN(num)) return "—"
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M"
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K"
  return String(num)
}

const PIPELINE_STAGES = [
  "For Outreach",
  "Contacted",
  "In Conversation",
  "Deal Agreed",
  "For Order Creation",
  "Not Interested",
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InfluencerProfileSidebar({
  partner,
  campaigns,
  allPartners,
  onClose,
  onPipelineStatusChange,
  onCollabTypeChange,
}: {
  partner:                  Partner
  campaigns:                Campaign[]
  allPartners:              Partner[]
  onClose:                  () => void
  onPipelineStatusChange?:  (biId: string, newStatus: string, niReason?: string) => void
  /** Optional: called when collab type is changed, so parent can persist the value */
  onCollabTypeChange?:      (biId: string, newType: string) => void
}) {
  const [profileTab,     setProfileTab]     = useState(0)
  const [pipelineStatus, setPipelineStatus] = useState(partner.commSt || "For Outreach")
  // ── NEW: collaboration type state ──────────────────────────────────────────
  const [collabType,     setCollabType]     = useState("Gifting")
  const [showNIModal,    setShowNIModal]    = useState(false)
  const [prevStatus,     setPrevStatus]     = useState(partner.commSt || "For Outreach")

  const [orderData, setOrderData] = useState({
    firstName: partner.firstName, lastName: partner.lastName, contactNumber: "",
    productName: "", orderNumber: "", productCost: "",
    discountCode: "CODE" + partner.firstName.toUpperCase(),
    affiliateLink: "https://instroom.io/ref/" + partner.firstName.toLowerCase(),
    shippingAddress: "", trackingLink: "",
  })
  const [postData, setPostData] = useState({
    postLink: "", likes: "", sales: "", driveLink: "",
    comments: "", amount: "", usageRights: "", views: "", clicks: "",
  })

  const tier    = partner.tierOverride || autoTier(partner.rev)
  const postCVR = postData.clicks && parseFloat(postData.clicks) > 0
    ? ((parseFloat(postData.sales || "0") / parseFloat(postData.clicks)) * 100).toFixed(2) + "%" : ""

  const now  = new Date("2026-04-01")
  const bday = partner.birthday ? new Date(partner.birthday) : null
  let bdayPill = ""
  if (bday) {
    const nb = new Date(now.getFullYear(), bday.getMonth(), bday.getDate())
    if (nb < now) nb.setFullYear(now.getFullYear() + 1)
    const du = Math.ceil((nb.getTime() - now.getTime()) / 86400000)
    if (du <= 30) bdayPill = `in ${du}d`
  }

  const bestMonth = partner.monthly.reduce((a, x) => (x.rev > a.rev ? x : a), partner.monthly[0])
  const campCount = campaigns.filter(c => c.partners.some(cp => cp.pid === partner.id)).length

  const avgLikes    = fmt(partner.avg_likes)
  const avgComments = fmt(partner.avg_comments)
  const avgViews    = fmt(partner.avg_views ?? partner.avgV)
  const followers   = fmt(partner.follower_count ?? partner.fol)
  const engRate     = partner.engagement_rate != null ? `${partner.engagement_rate}%`
                    : partner.eng != null ? `${partner.eng}%` : "—"

  const TABS = ["Basic", "Order", "Post", "Stats", "History"]

  // Collab type implied text (shown under the pill)
  const selectedCollabMeta = COLLAB_TYPES.find(c => c.value === collabType)
  const collabColors = COLLAB_COLORS[collabType] ?? { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" }

  // ── Collab type change handler ────────────────────────────────────────────
  const handleCollabTypeChange = (newType: string) => {
    setCollabType(newType)
    if (onCollabTypeChange && partner.brandInfluencerId) {
      onCollabTypeChange(partner.brandInfluencerId, newType)
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

  const handleNIConfirm = (reason: string) => {
    setShowNIModal(false)
    setPipelineStatus("Not Interested")
    if (onPipelineStatusChange && partner.brandInfluencerId) {
      onPipelineStatusChange(partner.brandInfluencerId, "Not Interested", reason)
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
        <NIModal
          partnerName={`${partner.firstName} ${partner.lastName}`.trim() || partner.handle}
          handle={partner.handle}
          profileImageUrl={null}
          onConfirm={handleNIConfirm}
          onCancel={handleNICancel}
        />
      )}

      {/* ── Sidebar panel ── */}
      <div className="pp">
        {/* ── Header ── */}
        <div className="pph">
          <div className="ppt">Influencer Profile</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div className="pav">{partner.firstName ? partner.firstName[0] : partner.handle[1]?.toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div className="pnm">{partner.firstName} {partner.lastName}</div>
              <div className="phd">{partner.handle}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
              {/* PIPELINE dropdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pipeline</span>
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
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s}
                      style={s === "Not Interested" ? { color: "#dc2626", fontWeight: 600 } : undefined}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── NEW: COLLAB TYPE dropdown ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Collab Type</span>
                <select
                  className="csel"
                  value={collabType}
                  onChange={(e) => handleCollabTypeChange(e.target.value)}
                  style={{
                    borderColor: collabColors.border,
                    background:  collabColors.bg,
                    color:       collabColors.color,
                  }}
                >
                  {COLLAB_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.value}</option>
                  ))}
                </select>
              </div>

              <button onClick={onClose} title="Close" className="close-btn">✕</button>
            </div>
          </div>

          {/* ── NEW: Collab type implied pill ── */}
          {selectedCollabMeta && (
            <div
              className="collab-implied"
              style={{ background: collabColors.bg, border: `1px solid ${collabColors.border}`, color: collabColors.color }}
            >
              <span className="collab-implied-dot" style={{ background: collabColors.color }} />
              <span className="collab-implied-type">{collabType}</span>
              <span className="collab-implied-sep">·</span>
              <span className="collab-implied-text">{selectedCollabMeta.implied}</span>
            </div>
          )}

          {/* NI status pill */}
          {pipelineStatus === "Not Interested" && (
            <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 11, color: "#dc2626", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>✕</span> Marked as Not Interested
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="atag plat">{partner.plat}</button>
            <button className="atag">Send Email</button>
            <button className="atag">Send DM</button>
            <button className="atag">Follow up</button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="pit-bar">
          {TABS.map((tab, idx) => (
            <div key={idx} className={`pit ${profileTab === idx ? "active" : ""}`} onClick={() => setProfileTab(idx)}>
              {tab}
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="ppb">

          {/* ════ BASIC TAB ════ */}
          {profileTab === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="sr4">
                <div className="sbox"><div className="slb">Followers</div><div className="svl">{followers}</div></div>
                <div className="sbox"><div className="slb">Eng Rate</div><div className="svl" style={{ color: "#2c8ec4" }}>{engRate}</div></div>
                <div className="sbox"><div className="slb">Avg Views</div><div className="svl">{avgViews}</div></div>
                <div className="sbox"><div className="slb">GMV</div><div className="svl" style={{ color: "#1fae5b" }}>{formatMoney(partner.gmv)}</div></div>
              </div>
              <div>
                <div className="section-label">Avg Metrics</div>
                <div className="avg-row">
                  <div className="avg-card"><div className="avg-val">{avgLikes}</div><div className="avg-lbl">Avg Likes</div></div>
                  <div className="avg-card"><div className="avg-val">{avgComments}</div><div className="avg-lbl">Avg Comments</div></div>
                  <div className="avg-card"><div className="avg-val">{avgViews}</div><div className="avg-lbl">Avg Views</div></div>
                </div>
              </div>
              <div className="fgrd">
                <div className="frow"><div className="flbl">Location</div><div className="fval">{partner.loc || "—"}</div></div>
                <div className="frow"><div className="flbl">Niche</div><div className="fval">{partner.niche || "—"}</div></div>
                <div className="frow"><div className="flbl">Gender</div><div className="fval">{partner.gend || "—"}</div></div>
                <div className="frow"><div className="flbl">Platform</div><div className="fval">{partner.plat}</div></div>
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
                <textarea className="pfi" style={{ minHeight: 80, resize: "vertical" }} placeholder="Add notes..." />
              </div>
            </div>
          )}

          {/* ════ ORDER TAB ════ */}
          {profileTab === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="pfr">
                <div className="pfg"><div className="pfl">First name</div><input className="pfi" value={orderData.firstName} onChange={e => setOrderData(d => ({ ...d, firstName: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Last name</div><input className="pfi" value={orderData.lastName} onChange={e => setOrderData(d => ({ ...d, lastName: e.target.value }))} /></div>
              </div>
              <div className="pfg"><div className="pfl">Contact Number</div><input className="pfi" value={orderData.contactNumber} onChange={e => setOrderData(d => ({ ...d, contactNumber: e.target.value }))} placeholder="Contact Number" /></div>
              <div className="pfg"><div className="pfl">Product Name</div><input className="pfi" value={orderData.productName} onChange={e => setOrderData(d => ({ ...d, productName: e.target.value }))} placeholder="Product Name" /></div>
              <div className="pfg"><div className="pfl">Order Number</div><input className="pfi" value={orderData.orderNumber} onChange={e => setOrderData(d => ({ ...d, orderNumber: e.target.value }))} placeholder="Order Number" /></div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Product Cost</div><input className="pfi" value={orderData.productCost} onChange={e => setOrderData(d => ({ ...d, productCost: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Discount Code</div><input className="pfi" value={orderData.discountCode} onChange={e => setOrderData(d => ({ ...d, discountCode: e.target.value }))} /></div>
              </div>
              <div className="pfg"><div className="pfl">Affiliate Link</div><input className="pfi" value={orderData.affiliateLink} onChange={e => setOrderData(d => ({ ...d, affiliateLink: e.target.value }))} /></div>
              <div className="pfg"><div className="pfl">Shipping Address</div><input className="pfi" value={orderData.shippingAddress} onChange={e => setOrderData(d => ({ ...d, shippingAddress: e.target.value }))} placeholder="Shipping Address" /></div>
              <div className="pfg"><div className="pfl">Tracking Link</div><input className="pfi" value={orderData.trackingLink} onChange={e => setOrderData(d => ({ ...d, trackingLink: e.target.value }))} placeholder="Tracking Link" /></div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn-primary">Save</button></div>
            </div>
          )}

          {/* ════ POST TAB ════ */}
          {profileTab === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Post Link</div><input className="pfi" value={postData.postLink} onChange={e => setPostData(d => ({ ...d, postLink: e.target.value }))} placeholder="Post Link" /></div>
                <div className="pfg"><div className="pfl">Likes</div><input className="pfi" value={postData.likes} onChange={e => setPostData(d => ({ ...d, likes: e.target.value }))} /></div>
              </div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Sales</div><input className="pfi" value={postData.sales} onChange={e => setPostData(d => ({ ...d, sales: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Drive Link</div><input className="pfi" value={postData.driveLink} onChange={e => setPostData(d => ({ ...d, driveLink: e.target.value }))} /></div>
              </div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Comments</div><input className="pfi" value={postData.comments} onChange={e => setPostData(d => ({ ...d, comments: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Amount ($)</div><input className="pfi" value={postData.amount} onChange={e => setPostData(d => ({ ...d, amount: e.target.value }))} /></div>
              </div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Usage Rights</div>
                  <select className="pfi" value={postData.usageRights} onChange={e => setPostData(d => ({ ...d, usageRights: e.target.value }))}>
                    <option value="">Select...</option><option>Granted</option><option>Not Granted</option><option>Pending</option>
                  </select>
                </div>
                <div className="pfg"><div className="pfl">Views</div><input className="pfi" value={postData.views} onChange={e => setPostData(d => ({ ...d, views: e.target.value }))} /></div>
              </div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Clicks</div><input className="pfi" value={postData.clicks} onChange={e => setPostData(d => ({ ...d, clicks: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">CVR (auto)</div><input className="pfi" readOnly style={{ background: "#f0fdf4", color: "#1fae5b", fontWeight: 600 }} value={postCVR || "—"} /></div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn-primary">Save</button></div>
            </div>
          )}

          {/* ════ STATS TAB ════ */}
          {profileTab === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div className="stit">Performance — all campaigns combined</div>
              <div className="skg">
                <div className="skc"><div className="skv-dark">{(partner.hClicks || 0).toLocaleString()}</div><div className="skl">Total clicks</div></div>
                <div className="skc"><div className="skv-blue">{partner.hCVR || 0}%</div><div className="skl">CVR</div></div>
                <div className="skc"><div className="skv-dark">{(partner.hSales || 0).toLocaleString()}</div><div className="skl">Total sales</div></div>
                <div className="skc"><div className="skv-green">{formatMoney(partner.hRev || 0)}</div><div className="skl">Total revenue</div></div>
                <div className="skc"><div className="skv-green">{formatMoney(partner.totalSpend || 0)}</div><div className="skl">Total spend</div></div>
                <div className="skc"><div className={partner.roas_val >= 1 ? "skv-green" : "skv-red"}>{formatROAS(partner.rev, partner.totalSpend)}</div><div className="skl">ROAS</div></div>
              </div>
              <div className="breakdown-box">
                <strong>Spend breakdown:</strong>{" "}
                {formatMoney(partner.prodCost)} product COGS + {formatMoney(partner.feesPaid)} fees + {formatMoney(partner.commPaid)} commission
              </div>
              <div className="stit">Engagement</div>
              <div className="skg">
                <div className="skc"><div className="skv-dark">{followers}</div><div className="skl">Followers</div></div>
                <div className="skc"><div className="skv-blue">{engRate}</div><div className="skl">Eng. rate</div></div>
                <div className="skc"><div className="skv-dark">{avgViews}</div><div className="skl">Avg views/post</div></div>
                <div className="skc"><div className="skv-dark">{partner.ppm || 0}</div><div className="skl">Posts/month</div></div>
                <div className="skc"><div className="skv-green">{formatMoney(partner.gmv || 0)}</div><div className="skl">GMV</div></div>
                <div className="skc"><div className="skv-dark">{campCount}</div><div className="skl">Campaigns</div></div>
              </div>
              <div className="stit">Avg Metrics</div>
              <div className="skg">
                <div className="skc"><div className="skv-dark">{avgLikes}</div><div className="skl">Avg Likes</div></div>
                <div className="skc"><div className="skv-dark">{avgComments}</div><div className="skl">Avg Comments</div></div>
                <div className="skc"><div className="skv-dark">{avgViews}</div><div className="skl">Avg Views</div></div>
              </div>
              <div className="stit">Monthly breakdown</div>
              <div className="mg">
                {partner.monthly.map(m => (
                  <div key={m.month} className={`mc2 ${m.month === bestMonth.month ? "best" : ""}`}>
                    <div className="mn">{m.month}</div>
                    <div className={`mv ${m.month === bestMonth.month ? "mv-best" : ""}`}>{formatMoney(m.rev)}</div>
                    <div className="ms-txt">{m.posts} posts</div>
                    <div className="ms-txt">{m.sales} sales</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════ HISTORY TAB ════ */}
          {profileTab === 4 && (
            <HistoryTab brandId={partner.brandId} biId={partner.brandInfluencerId} />
          )}

        </div>

        <style jsx>{`
          .pp { position:fixed; top:0; right:0; width:520px; max-width:100vw; height:100%; background:#fff; box-shadow:-8px 0 40px rgba(0,0,0,0.14); z-index:500; display:flex; flex-direction:column; font-family:"Inter",system-ui,sans-serif; }
          .pph { padding:16px 20px; border-bottom:1px solid #f0f0f0; }
          .ppt { font-size:11px; font-weight:600; color:#9ca3af; letter-spacing:.1em; text-transform:uppercase; margin-bottom:12px; }
          .pav { width:44px; height:44px; border-radius:50%; background:#1fae5b; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; color:#fff; flex-shrink:0; box-shadow:0 0 0 3px #dcfce7; }
          .pnm { font-size:15px; font-weight:700; color:#111827; }
          .phd { font-size:12px; color:#6b7280; margin-top:2px; }

          /* Pipeline select */
          .ssel { font-size:11px; padding:5px 10px; border-radius:8px; border:.5px solid #f4b740; background:#fffbeb; color:#854f0b; cursor:pointer; font-family:inherit; font-weight:500; transition:all .15s; }

          /* Collab type select — adapts colour via inline style */
          .csel { font-size:11px; padding:5px 10px; border-radius:8px; border-width:1px; border-style:solid; cursor:pointer; font-family:inherit; font-weight:600; transition:all .15s; min-width:130px; }

          /* Collab implied pill */
          .collab-implied { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:20px; border-width:1px; border-style:solid; font-size:11px; margin-bottom:6px; flex-wrap:wrap; }
          .collab-implied-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
          .collab-implied-type { font-weight:700; font-size:11px; }
          .collab-implied-sep { opacity:.4; font-size:11px; }
          .collab-implied-text { font-size:11px; opacity:.75; }

          .close-btn { width:30px; height:30px; border-radius:50%; border:1.5px solid #e5e7eb; background:#f9fafb; color:#374151; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; flex-shrink:0; line-height:1; margin-top:14px; transition:background .15s,border-color .15s,color .15s; }
          .close-btn:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
          .atag { font-size:12px; font-weight:500; padding:6px 14px; border-radius:20px; cursor:pointer; border:1px solid #e5e7eb; background:#f9fafb; color:#555; }
          .atag.plat { background:#1fae5b; color:#fff; border-color:#1fae5b; }
          .pit-bar { display:flex; gap:0; padding:0 20px; border-bottom:1px solid #f0f0f0; overflow-x:auto; }
          .pit { font-size:12px; font-weight:600; padding:11px 14px; cursor:pointer; color:#9ca3af; border-bottom:2px solid transparent; white-space:nowrap; transition:color .15s; flex-shrink:0; }
          .pit.active { color:#1fae5b; border-bottom-color:#1fae5b; }
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
          .btn-primary { background:#1fae5b; color:#fff; border:none; padding:8px 18px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; font-family:inherit; transition:background .15s; }
          .btn-primary:hover { background:#0f6b3e; }
        `}</style>
      </div>
    </>
  )
}
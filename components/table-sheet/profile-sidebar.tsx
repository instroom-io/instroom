"use client"
// table-sheet/profile-sidebar.tsx

import React, { useState, useEffect } from "react"
import type { InfluencerRow, CustomColumn } from "./types"
import { platforms } from "./constants"
import { STATUS_LABEL } from "./constants"
import { getProfileUrl, handleApprovalChange, formatFollowers } from "./utils"
import { ProfilePicture } from "./ui-atoms"
import { DeclineConfirmationModal } from "./modals"

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

// ─── History Tab Component ────────────────────────────────────────────────────
function HistoryTab({ brandId, biId }: { brandId?: string; biId: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!brandId || !biId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/brand/${brandId}/influencers/${biId}/activity`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { setLogs(d.logs ?? []); setLoading(false) })
      .catch(err => { console.error("[HistoryTab]", err); setError("Failed to load history"); setLoading(false) })
  }, [brandId, biId])

  if (!brandId) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af", fontSize: 12 }}>
        Brand context required to view history
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", fontSize: 13 }}>
        Loading history…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px" }}>
        <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 4 }}>{error}</div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>bi.id: {biId}</div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px" }}>
        <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.2 }}>🕐</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>
          No activity yet
        </div>
        <div style={{ fontSize: 11, color: "#d1d5db", maxWidth: 220, margin: "0 auto" }}>
          Actions like adding, approving, or moving this influencer will appear here
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Timeline line */}
      <div style={{
        position: "absolute", left: 19, top: 8, bottom: 8,
        width: 1, background: "#f3f4f6",
      }} />

      <div style={{ display: "flex", flexDirection: "column" }}>
        {logs.map(log => {
          const colorScheme = ACTION_COLORS[log.action] ?? { bg: "#f3f4f6", color: "#374151" }
          const detail = formatActivityDetails(log.action, log.details)

          return (
            <div key={log.id} style={{ display: "flex", gap: 14, paddingBottom: 22, position: "relative" }}>
              {/* Avatar */}
              <div style={{ flexShrink: 0, zIndex: 1 }}>
                {log.user?.image ? (
                  <img
                    src={log.user.image}
                    alt={log.user.name ?? ""}
                    style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "2px solid #f0fdf4" }}
                  />
                ) : (
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: "#dcfce7", border: "2px solid #f0fdf4",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#1fae5b",
                  }}>
                    {log.user?.initials ?? "?"}
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                      {log.user?.name ?? "Unknown user"}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px",
                      borderRadius: 20, background: colorScheme.bg, color: colorScheme.color,
                    }}>
                      {log.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {formatActivityDate(log.created_at)}
                  </span>
                </div>
                {detail && (
                  <div style={{
                    fontSize: 11, color: "#6b7280",
                    background: "#f9fafb", borderRadius: 8,
                    padding: "5px 10px", display: "inline-block", marginTop: 2,
                  }}>
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
  const [editedRow, setEditedRow] = useState<InfluencerRow | null>(row ? { ...row } : null)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [orderData, setOrderData] = useState({
    productName: "", orderNumber: "", productCost: "",
    discountCode: row ? "CODE" + (row.first_name || row.handle).toUpperCase().replace(/[^A-Z]/g, "") : "",
    affiliateLink: row ? "https://instroom.io/ref/" + (row.first_name || row.handle).toLowerCase().replace(/[^a-z]/g, "") : "",
    shippingAddress: "", trackingLink: "",
  })
  const [postData, setPostData] = useState({
    postLink: "", likes: "", sales: "", driveLink: "",
    comments: "", amount: "", usageRights: "", views: "", clicks: "",
  })

  useEffect(() => {
    if (row) {
      setEditedRow({ ...row }); setProfileTab(0)
      setOrderData(d => ({
        ...d,
        discountCode: "CODE" + (row.first_name || row.handle).toUpperCase().replace(/[^A-Z]/g, ""),
        affiliateLink: "https://instroom.io/ref/" + (row.first_name || row.handle).toLowerCase().replace(/[^a-z]/g, ""),
      }))
      setPostData({ postLink: "", likes: "", sales: "", driveLink: "", comments: "", amount: "", usageRights: "", views: "", clicks: "" })
    }
  }, [row])

  if (!row || !editedRow) return null

  const platformLabel = platforms.find(p => p.value === editedRow.platform)?.name || editedRow.platform
  const postCVR = postData.clicks && parseFloat(postData.clicks) > 0
    ? ((parseFloat(postData.sales || "0") / parseFloat(postData.clicks)) * 100).toFixed(2) + "%"
    : ""

  const handleFieldChange = (field: string, value: string) => {
    if (!editedRow) return
    if (field === "approval_status") {
      if (value === "Declined") { setShowDeclineModal(true); return }
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

  const handleSave = async () => {
    if (!editedRow || !row?.id) return
    if (row.id.trim() === "") { onToast?.("error", "Cannot save: Influencer ID is missing."); return }
    setIsSaving(true)
    try {
      const url = brandId ? `/api/brand/${brandId}/influencers/${row.id}` : `/api/influencers/${row.id}`
      const existingLastName = editedRow.full_name ? editedRow.full_name.split(" ").slice(1).join(" ") : ""
      const rebuiltFullName = editedRow.first_name
        ? existingLastName ? `${editedRow.first_name} ${existingLastName}` : editedRow.first_name
        : editedRow.full_name || null

      const payload = {
        handle: editedRow.handle, platform: editedRow.platform, full_name: rebuiltFullName,
        email: editedRow.contact_info || editedRow.email || null,
        gender: editedRow.gender || null, niche: editedRow.niche || null,
        location: editedRow.location || null, bio: editedRow.bio || null,
        profile_image_url: editedRow.profile_image_url || null, social_link: editedRow.social_link || null,
        follower_count: parseInt(String(editedRow.follower_count)) || 0,
        engagement_rate: parseFloat(String(editedRow.engagement_rate)) || 0,
        avg_likes: parseInt(String(editedRow.avg_likes)) || 0,
        avg_comments: parseInt(String(editedRow.avg_comments)) || 0,
        avg_views: parseInt(String(editedRow.avg_views)) || 0,
        approval_status: editedRow.approval_status, approval_notes: editedRow.approval_notes || null,
        contact_status: editedRow.contact_status, agreed_rate: editedRow.agreed_rate || null,
        notes: editedRow.notes || null, stage: editedRow.stage, transferred_date: editedRow.transferred_date || null,
      }

      const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (response.ok) {
        const synced = { ...editedRow, full_name: rebuiltFullName || editedRow.full_name }
        setEditedRow(synced); onUpdate(synced); onToast?.("success", "Saved successfully")
      } else if (response.status === 404) {
        onToast?.("error", "Influencer not found. Try refreshing.")
      } else {
        const error = await response.json(); onToast?.("error", error.error || "Failed to save")
      }
    } catch { onToast?.("error", "Failed to save. Check your connection.") }
    finally { setIsSaving(false) }
  }

  const S = {
    overlay: { position: "fixed" as const, inset: 0, zIndex: 400, cursor: "pointer" },
    panel: { position: "fixed" as const, top: 0, right: 0, width: 520, maxWidth: "100vw", height: "100%", background: "#fff", boxShadow: "-8px 0 40px rgba(0,0,0,0.14)", zIndex: 500, display: "flex", flexDirection: "column" as const, fontFamily: "'Inter',system-ui,sans-serif" },
    header: { padding: "16px 20px", borderBottom: "1px solid #f0f0f0" },
    pipeSel: { fontSize: 11, padding: "5px 10px", borderRadius: 8, border: "0.5px solid #f4b740", background: "#fffbeb", color: "#854f0b", cursor: "pointer", fontWeight: 500 },
    atag: { fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 20, cursor: "pointer", border: "1px solid #e5e7eb", background: "#f9fafb", color: "#555", transition: "all 0.15s" },
    atagPlat: { fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 20, cursor: "pointer", border: "1px solid #1fae5b", background: "#1fae5b", color: "#fff" },
    tabBar: { display: "flex", gap: 0, padding: "0 20px", borderBottom: "1px solid #f0f0f0", overflowX: "auto" as const },
    tab: (a: boolean) => ({ fontSize: 12, fontWeight: 600, padding: "11px 16px", cursor: "pointer", color: a ? "#1fae5b" : "#9ca3af", borderBottom: a ? "2px solid #1fae5b" : "2px solid transparent", whiteSpace: "nowrap" as const, transition: "color 0.15s" }),
    body: { flex: 1, overflowY: "auto" as const, padding: "20px" },
    statRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, background: "linear-gradient(135deg, #f0fdf4 0%, #f9fafb 100%)", borderRadius: 12, padding: 14, marginBottom: 18, border: "1px solid #dcfce7" },
    statBox: { textAlign: "center" as const },
    statLabel: { fontSize: 9, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.07em" },
    statVal: { fontSize: 16, fontWeight: 700, color: "#111827", marginTop: 3 },
    formInput: { width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#f9fafb", color: "#111827", boxSizing: "border-box" as const, outline: "none", transition: "border-color 0.15s, background 0.15s" },
    saveBtn: { background: "#1fae5b", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "background 0.15s" },
    sectionTitle: { fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.08em", padding: "14px 0 8px", marginBottom: 10, borderBottom: "1px solid #f3f4f6" },
    metricBox: { background: "#f9fafb", borderRadius: 10, padding: "12px 10px", textAlign: "center" as const, border: "1px solid #f3f4f6" },
    metricVal: { fontSize: 16, fontWeight: 700, color: "#111827" },
    metricLabel: { fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginTop: 3 },
    formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    formGroup: { display: "flex", flexDirection: "column" as const, gap: 4, marginBottom: 10 },
    formLabel: { fontSize: 10, fontWeight: 600, color: "#6b7280" },
  }

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

  // Tabs: 0=Basic, 1=Order, 2=Post, 3=Stats, 4=History
  const TABS = ["Basic", "Order", "Post", "Stats", "History"]

  return (
    <>
      <DeclineConfirmationModal isOpen={showDeclineModal} onClose={() => setShowDeclineModal(false)}
        onConfirm={r => { if (editedRow) setEditedRow(handleApprovalChange(editedRow, "Declined", r)) }}
        influencerName={editedRow.full_name || editedRow.handle || "this influencer"} />

      <div style={S.overlay} onClick={onClose} />

      <div style={S.panel}>
        {/* ── Header ── */}
        <div style={S.header}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Influencer Profile</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#1fae5b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 0 3px #dcfce7" }}>
              <ProfilePicture src={editedRow.profile_image_url} socialLink={editedRow.social_link || getProfileUrl(editedRow.platform, editedRow.handle)} name={editedRow.full_name || editedRow.handle} handle={editedRow.handle} size={52} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{editedRow.full_name || editedRow.first_name || ""}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>@{editedRow.handle.replace(/^@/, "")}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pipeline</span>
                <select style={S.pipeSel} value={editedRow.contact_status} onChange={e => handleFieldChange("contact_status", e.target.value)}>
                  <option value="not_contacted">For Outreach</option>
                  <option value="contacted">In Conversation</option>
                  <option value="interested">Interested</option>
                  <option value="agreed">Agreed</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Approval</span>
                <select
                  style={{ ...S.pipeSel, borderColor: editedRow.approval_status === "Approved" ? "#16a34a" : editedRow.approval_status === "Declined" ? "#dc2626" : "#f4b740", background: editedRow.approval_status === "Approved" ? "#f0fdf4" : editedRow.approval_status === "Declined" ? "#fef2f2" : "#fffbeb", color: editedRow.approval_status === "Approved" ? "#166534" : editedRow.approval_status === "Declined" ? "#991b1b" : "#854f0b" }}
                  value={editedRow.approval_status || "Pending"} onChange={e => handleFieldChange("approval_status", e.target.value)}>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Declined">Declined</option>
                </select>
              </div>
              <button
                onClick={onClose} title="Close"
                style={{ width: 30, height: 30, borderRadius: "50%", border: "1.5px solid #e5e7eb", background: "#f9fafb", color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flexShrink: 0, lineHeight: 1, marginTop: 14 }}
                onMouseEnter={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.borderColor = "#fca5a5" }}
                onMouseLeave={e => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.color = "#374151"; e.currentTarget.style.borderColor = "#e5e7eb" }}
              >✕</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={S.atagPlat}>{platformLabel}</button>
            <button style={S.atag}>Send Email</button>
            <button style={S.atag}>Send DM</button>
            <button style={S.atag}>Follow up</button>
          </div>
        </div>

        {/* ── Tab bar — now 5 tabs ── */}
        <div style={S.tabBar}>
          {TABS.map((tab, idx) => (
            <div key={idx} style={S.tab(profileTab === idx)} onClick={() => setProfileTab(idx)}>
              {tab === "History" ? "History" : tab}
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={S.body}>

          {/* ════ BASIC TAB ════ */}
          {profileTab === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={S.statRow}>
                <div style={S.statBox}><div style={S.statLabel}>Followers</div><div style={S.statVal}>{displayMetric(editedRow.follower_count)}</div></div>
                <div style={S.statBox}><div style={S.statLabel}>Eng Rate</div><div style={{ ...S.statVal, color: "#2c8ec4" }}>{editedRow.engagement_rate ? `${editedRow.engagement_rate}%` : "—"}</div></div>
                <div style={S.statBox}><div style={S.statLabel}>Tier</div><div style={{ ...S.statVal, fontSize: 13 }}>{editedRow.tier || "Bronze"}</div></div>
                <div style={S.statBox}><div style={S.statLabel}>Rate</div><div style={{ ...S.statVal, color: "#1fae5b" }}>{editedRow.agreed_rate ? "$" + Number(editedRow.agreed_rate).toLocaleString() : "—"}</div></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <FieldSelect label="Location" icon="" value={editedRow.location || ""} options={locationOptions} onChange={v => handleFieldChange("location", v)} readOnly={readOnly} />
                <FieldSelect label="Niche" icon="" value={editedRow.niche || ""} options={nicheOptions} onChange={v => handleFieldChange("niche", v)} readOnly={readOnly} />
                <FieldSelect label="Gender" icon="" value={editedRow.gender || ""} options={genderOptions} onChange={v => handleFieldChange("gender", v)} readOnly={readOnly} />
                <FieldSelect label="Platform" icon="" value={editedRow.platform} options={platformOptions} onChange={v => handleFieldChange("platform", v)} readOnly={readOnly} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", border: "1px solid #f3f4f6" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 5 }}>Email</div>
                  {editedRow.contact_info ? (
                    <a href={`mailto:${editedRow.contact_info}`} style={{ fontSize: 12, fontWeight: 500, color: "#374151", textDecoration: "none", wordBreak: "break-all" as const, display: "block" }}>{editedRow.contact_info}</a>
                  ) : <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>}
                </div>
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", border: "1px solid #f3f4f6" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 5 }}>Social Link</div>
                  {editedRow.social_link ? (
                    <a href={editedRow.social_link.startsWith("http") ? editedRow.social_link : `https://${editedRow.social_link}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 500, color: "#1fae5b", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, display: "block" }} title={editedRow.social_link}>{editedRow.social_link.replace(/^https?:\/\//, "").slice(0, 28)}{editedRow.social_link.replace(/^https?:\/\//, "").length > 28 ? "…" : ""}</a>
                  ) : <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>Approval Notes</div>
                {readOnly
                  ? <div style={{ fontSize: 12, color: "#374151", background: "#f9fafb", borderRadius: 8, padding: 10, minHeight: 38, border: "1px solid #f3f4f6" }}>{editedRow.approval_notes || <span style={{ color: "#d1d5db" }}>No notes</span>}</div>
                  : <textarea style={{ ...S.formInput, minHeight: 60, resize: "vertical" as const, fontFamily: "inherit" }} value={editedRow.approval_notes || ""} onChange={e => handleFieldChange("approval_notes", e.target.value)} placeholder="Add approval notes…" onFocus={e => { e.currentTarget.style.borderColor = "#1fae5b"; e.currentTarget.style.background = "#fff" }} onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb" }} />
                }
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>Notes</div>
                {readOnly
                  ? <div style={{ fontSize: 12, color: "#374151", background: "#f9fafb", borderRadius: 8, padding: 10, minHeight: 56, border: "1px solid #f3f4f6" }}>{editedRow.notes || <span style={{ color: "#d1d5db" }}>No notes</span>}</div>
                  : <textarea style={{ ...S.formInput, minHeight: 80, resize: "vertical" as const, fontFamily: "inherit" }} value={editedRow.notes} onChange={e => handleFieldChange("notes", e.target.value)} placeholder="Add notes…" onFocus={e => { e.currentTarget.style.borderColor = "#1fae5b"; e.currentTarget.style.background = "#fff" }} onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb" }} />
                }
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
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button style={{ ...S.saveBtn, opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "not-allowed" : "pointer" }} onClick={handleSave} disabled={isSaving} onMouseEnter={e => { if (!isSaving) e.currentTarget.style.background = "#0f6b3e" }} onMouseLeave={e => { e.currentTarget.style.background = "#1fae5b" }}>{isSaving ? "Saving…" : "Save Changes"}</button>
                </div>
              )}
            </div>
          )}

          {/* ════ ORDER TAB ════ */}
          {profileTab === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={S.formRow}>
                <div style={S.formGroup}><div style={S.formLabel}>First name</div><input style={S.formInput} value={editedRow.first_name || ""} onChange={e => handleFieldChange("first_name", e.target.value)} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div>
                <div style={S.formGroup}><div style={S.formLabel}>Last name</div><input style={{ ...S.formInput, background: "#f3f4f6", color: "#9ca3af" }} value={editedRow.full_name?.split(" ").slice(1).join(" ") || ""} readOnly /></div>
              </div>
              <div style={S.formGroup}><div style={S.formLabel}>Email</div><input style={S.formInput} value={editedRow.contact_info || editedRow.email || ""} onChange={e => handleFieldChange("contact_info", e.target.value)} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div>
              <div style={S.formGroup}><div style={S.formLabel}>Product Name</div><input style={S.formInput} value={orderData.productName} onChange={e => setOrderData(d => ({ ...d, productName: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div>
              <div style={S.formGroup}><div style={S.formLabel}>Order Number</div><input style={S.formInput} value={orderData.orderNumber} onChange={e => setOrderData(d => ({ ...d, orderNumber: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div>
              <div style={S.formRow}>
                <div style={S.formGroup}><div style={S.formLabel}>Product Cost</div><input style={S.formInput} value={orderData.productCost} onChange={e => setOrderData(d => ({ ...d, productCost: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div>
                <div style={S.formGroup}><div style={S.formLabel}>Discount Code</div><input style={S.formInput} value={orderData.discountCode} onChange={e => setOrderData(d => ({ ...d, discountCode: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div>
              </div>
              <div style={S.formGroup}><div style={S.formLabel}>Affiliate Link</div><input style={S.formInput} value={orderData.affiliateLink} onChange={e => setOrderData(d => ({ ...d, affiliateLink: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div>
              <div style={S.formGroup}><div style={S.formLabel}>Shipping Address</div><input style={S.formInput} value={orderData.shippingAddress} onChange={e => setOrderData(d => ({ ...d, shippingAddress: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div>
              <div style={S.formGroup}><div style={S.formLabel}>Tracking Link</div><input style={S.formInput} value={orderData.trackingLink} onChange={e => setOrderData(d => ({ ...d, trackingLink: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <button style={{ ...S.saveBtn, opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "not-allowed" : "pointer" }} onClick={handleSave} disabled={isSaving}>{isSaving ? "Saving…" : "Save Changes"}</button>
              </div>
            </div>
          )}

          {/* ════ POST TAB ════ */}
          {profileTab === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={S.formRow}><div style={S.formGroup}><div style={S.formLabel}>Post Link</div><input style={S.formInput} value={postData.postLink} onChange={e => setPostData(d => ({ ...d, postLink: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div><div style={S.formGroup}><div style={S.formLabel}>Likes</div><input style={S.formInput} value={postData.likes} onChange={e => setPostData(d => ({ ...d, likes: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div></div>
              <div style={S.formRow}><div style={S.formGroup}><div style={S.formLabel}>Sales</div><input style={S.formInput} value={postData.sales} onChange={e => setPostData(d => ({ ...d, sales: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div><div style={S.formGroup}><div style={S.formLabel}>Drive Link</div><input style={S.formInput} value={postData.driveLink} onChange={e => setPostData(d => ({ ...d, driveLink: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div></div>
              <div style={S.formRow}><div style={S.formGroup}><div style={S.formLabel}>Comments</div><input style={S.formInput} value={postData.comments} onChange={e => setPostData(d => ({ ...d, comments: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div><div style={S.formGroup}><div style={S.formLabel}>Amount ($)</div><input style={S.formInput} value={postData.amount} onChange={e => setPostData(d => ({ ...d, amount: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div></div>
              <div style={S.formRow}><div style={S.formGroup}><div style={S.formLabel}>Usage Rights</div><select style={S.formInput} value={postData.usageRights} onChange={e => setPostData(d => ({ ...d, usageRights: e.target.value }))}><option value="">Select…</option><option>Granted</option><option>Not Granted</option><option>Pending</option></select></div><div style={S.formGroup}><div style={S.formLabel}>Views</div><input style={S.formInput} value={postData.views} onChange={e => setPostData(d => ({ ...d, views: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div></div>
              <div style={S.formRow}><div style={S.formGroup}><div style={S.formLabel}>Clicks</div><input style={S.formInput} value={postData.clicks} onChange={e => setPostData(d => ({ ...d, clicks: e.target.value }))} onFocus={e => { e.currentTarget.style.borderColor="#1fae5b"; e.currentTarget.style.background="#fff" }} onBlur={e => { e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.background="#f9fafb" }} /></div><div style={S.formGroup}><div style={S.formLabel}>CVR (auto)</div><input style={{ ...S.formInput, background: "#f0fdf4", color: "#1fae5b", fontWeight: 600 }} readOnly value={postCVR || "—"} /></div></div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <button style={{ ...S.saveBtn, opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "not-allowed" : "pointer" }} onClick={handleSave} disabled={isSaving}>{isSaving ? "Saving…" : "Save Changes"}</button>
              </div>
            </div>
          )}

          {/* ════ STATS TAB ════ */}
          {profileTab === 3 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={S.sectionTitle}>Performance</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                <div style={S.metricBox}><div style={S.metricVal}>{displayMetric(editedRow.follower_count)}</div><div style={S.metricLabel}>Followers</div></div>
                <div style={S.metricBox}><div style={{ ...S.metricVal, color: "#2c8ec4" }}>{editedRow.engagement_rate ? `${editedRow.engagement_rate}%` : "—"}</div><div style={S.metricLabel}>Eng. Rate</div></div>
                <div style={S.metricBox}><div style={{ ...S.metricVal, color: "#1fae5b" }}>{editedRow.agreed_rate ? "$" + Number(editedRow.agreed_rate).toLocaleString() : "—"}</div><div style={S.metricLabel}>Agreed Rate</div></div>
              </div>
              <div style={S.sectionTitle}>Avg Metrics</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                <div style={S.metricBox}><div style={S.metricVal}>{displayMetric(editedRow.avg_likes)}</div><div style={S.metricLabel}>Avg Likes</div></div>
                <div style={S.metricBox}><div style={S.metricVal}>{displayMetric(editedRow.avg_comments)}</div><div style={S.metricLabel}>Avg Comments</div></div>
                <div style={S.metricBox}><div style={S.metricVal}>{displayMetric(editedRow.avg_views)}</div><div style={S.metricLabel}>Avg Views</div></div>
              </div>
              <div style={S.sectionTitle}>Status</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                <div style={S.metricBox}><div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{editedRow.tier || "Bronze"}</div><div style={S.metricLabel}>Tier</div></div>
                <div style={S.metricBox}><div style={{ fontSize: 14, fontWeight: 700, color: editedRow.approval_status === "Approved" ? "#1fae5b" : editedRow.approval_status === "Declined" ? "#e24b4a" : "#854f0b" }}>{editedRow.approval_status || "Pending"}</div><div style={S.metricLabel}>Approval</div></div>
                <div style={S.metricBox}><div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{STATUS_LABEL[editedRow.contact_status] || editedRow.contact_status}</div><div style={S.metricLabel}>Pipeline</div></div>
              </div>
              {editedRow.transferred_date && (
                <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#166534", border: "1px solid #dcfce7", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>✅</span>
                  <span><strong>Transferred:</strong> {new Date(editedRow.transferred_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {/* ════ HISTORY TAB ════ */}
          {profileTab === 4 && (
            <HistoryTab
              brandId={brandId}
              biId={row.id}
            />
          )}

        </div>
      </div>
    </>
  )
}
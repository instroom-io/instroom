"use client"

import { useState, useEffect } from "react"

// ─── Types (mirrors what BrandPartnersPage passes) ────────────────────────────

interface MonthlyRow {
  month: string
  rev: number
  clicks: number
  sales: number
}

interface SidebarPartner {
  id: string
  influencer_id: string
  handle: string
  firstName: string
  lastName: string
  plat: string
  niche: string
  gend: string
  loc: string
  email: string | null
  bio: string | null
  profile_image_url: string | null
  social_link: string | null
  tier: string
  tierOverride: string | null
  stage: number
  contact_status: string
  content_posted: boolean
  post_url: string | null
  notes: string | null
  agreed_rate: number | null
  internal_rating: number | null
  campaign_id: string | null
  fol: number
  follower_count: number
  eng: number
  engagement_rate: number
  avgV: number
  avg_likes: number
  avg_comments: number
  avg_views: number
  likes_count: number
  comments_count: number
  engagement_count: number
  clicks: number
  cvr: number
  sales: number
  aov: number
  rev: number
  gmv: number
  totalSpend: number
  prodCost: number
  feesPaid: number
  commPaid: number
  roas_val: number
  defComm: number
  affiliate_id: string | null
  ref_code: string | null
  coupon: string | null
  affiliate_link: string | null
  brandId?: string
  brandInfluencerId?: string
  monthly: MonthlyRow[]   // always an array — BrandPartnersPage sets [] as default
  added: Date
  [key: string]: any
}

interface SidebarCampaign {
  id: string
  name: string
  status: string
  partners?: { pid: string }[]
  [key: string]: any
}

interface Props {
  partner: SidebarPartner
  campaigns: SidebarCampaign[]
  allPartners: SidebarPartner[]
  onClose: () => void
}

// ─── Activity log types (History tab) ─────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMoney(v: number) { return "$" + Math.round(v || 0).toLocaleString() }
function formatROAS(rev: number, spend: number) { return spend > 0 ? (rev / spend).toFixed(1) + "x" : "—" }

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—"
  const num = Number(n)
  if (isNaN(num)) return "—"
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M"
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K"
  return String(num)
}

const STATUS_LABELS: Record<string, string> = {
  not_contacted: "Not Contacted",
  contacted:     "Contacted",
  interested:    "Interested",
  agreed:        "Agreed",
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  not_contacted: { bg: "#f0f0f0", color: "#888" },
  contacted:     { bg: "#fff8e1", color: "#854F0B" },
  interested:    { bg: "#e6f1fb", color: "#185FA5" },
  agreed:        { bg: "#e6f9ee", color: "#0F6B3E" },
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InfluencerProfileSidebar({ partner, campaigns, onClose }: Props) {
  const [profileTab, setProfileTab] = useState(0)

  const [orderData, setOrderData] = useState({
    firstName: partner.firstName, lastName: partner.lastName, contactNumber: "",
    productName: "", orderNumber: "", productCost: "",
    discountCode: partner.coupon || partner.ref_code || "CODE" + partner.firstName.toUpperCase(),
    affiliateLink: partner.affiliate_link || "https://instroom.io/ref/" + partner.firstName.toLowerCase(),
    shippingAddress: "", trackingLink: "",
  })
  const [postData, setPostData] = useState({
    postLink: partner.post_url || "",
    likes: partner.likes_count ? String(partner.likes_count) : "",
    sales: "",
    driveLink: "",
    comments: partner.comments_count ? String(partner.comments_count) : "",
    amount: "",
    usageRights: "",
    views: "",
    clicks: partner.clicks ? String(partner.clicks) : "",
  })

  const postCVR = postData.clicks && parseFloat(postData.clicks) > 0
    ? ((parseFloat(postData.sales || "0") / parseFloat(postData.clicks)) * 100).toFixed(2) + "%" : ""

  const bestMonth = partner.monthly.length > 0
    ? partner.monthly.reduce((a, x) => (x.rev > a.rev ? x : a), partner.monthly[0])
    : null
  const campCount = campaigns.filter(c => {
    if (partner.campaign_id && c.id === partner.campaign_id) return true
    if (Array.isArray(c.partners)) return c.partners.some(cp => cp.pid === partner.id)
    return false
  }).length

  const avgLikes    = fmt(partner.avg_likes)
  const avgComments = fmt(partner.avg_comments)
  const avgViews    = fmt(partner.avg_views ?? partner.avgV)
  const followers   = fmt(partner.follower_count ?? partner.fol)
  const engRate     = partner.engagement_rate != null ? `${partner.engagement_rate}%`
                    : partner.eng != null ? `${partner.eng}%` : "—"

  const statusStyle = STATUS_COLORS[partner.contact_status] ?? STATUS_COLORS.not_contacted
  const statusLabel = STATUS_LABELS[partner.contact_status] ?? partner.contact_status?.replace(/_/g, " ") ?? "Not Contacted"

  const TABS = ["Basic", "Order", "Attribution", "Post", "Stats", "History"]

  return (
    <>
      {/* ── Background overlay ── */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 400, cursor: "pointer" }}
      />

      {/* ── Sidebar panel ── */}
      <div className="pp">
        {/* ── Header ── */}
        <div className="pph">
          <button onClick={onClose} title="Close" className="close-btn">✕</button>
          <div className="ppt">Influencer Profile</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div
              className="pav"
              style={partner.profile_image_url ? {
                background: `url(${partner.profile_image_url}) center/cover`,
              } : undefined}
            >
              {!partner.profile_image_url && (partner.firstName ? partner.firstName[0] : partner.handle[1]?.toUpperCase())}
            </div>
            <div style={{ flex: 1 }}>
              <div className="pnm">{partner.firstName} {partner.lastName}</div>
              <div className="phd">{partner.handle}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="ro-lbl">Status</span>
                <div className="ro-box" style={{ borderColor: statusStyle.color + "40", background: statusStyle.bg, color: statusStyle.color }}>
                  {statusLabel}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="ro-lbl">Tier</span>
                <div className="ro-box">{partner.tierOverride || partner.tier}</div>
              </div>
            </div>
          </div>

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
                <div className="frow"><div className="flbl">Commission</div><div className="fval">{partner.defComm > 0 ? partner.defComm + "%" : "—"}</div></div>
                <div className="frow"><div className="flbl">Tier</div><div className="fval">{partner.tierOverride || partner.tier}</div></div>
                <div className="frow"><div className="flbl">Email</div><div className="fval">{partner.email || "—"}</div></div>
                <div className="frow">
                  <div className="flbl">Social</div>
                  <div className="fval">
                    {partner.social_link ? (
                      <a href={partner.social_link} target="_blank" rel="noopener noreferrer" style={{ color: "#1fae5b", textDecoration: "none" }}>
                        View profile ↗
                      </a>
                    ) : "—"}
                  </div>
                </div>
              </div>
              {partner.bio && (
                <div>
                  <div className="section-label" style={{ borderTop: "none", paddingTop: 0 }}>Bio</div>
                  <p style={{ fontSize: 12, color: "#555", lineHeight: 1.5, margin: 0 }}>{partner.bio}</p>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>Notes</div>
                <textarea className="pfi" style={{ minHeight: 80, resize: "vertical" }} defaultValue={partner.notes || ""} placeholder="Add notes..." />
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
              <div className="pfg"><div className="pfl">Product Cost</div><input className="pfi" value={orderData.productCost} onChange={e => setOrderData(d => ({ ...d, productCost: e.target.value }))} /></div>
              <div className="pfg"><div className="pfl">Shipping Address</div><input className="pfi" value={orderData.shippingAddress} onChange={e => setOrderData(d => ({ ...d, shippingAddress: e.target.value }))} placeholder="Shipping Address" /></div>
              <div className="pfg"><div className="pfl">Tracking Link</div><input className="pfi" value={orderData.trackingLink} onChange={e => setOrderData(d => ({ ...d, trackingLink: e.target.value }))} placeholder="Tracking Link" /></div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn-primary">Save</button></div>
            </div>
          )}

          {/* ════ ATTRIBUTION TAB ════ */}
          {profileTab === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Discount Code</div><input className="pfi" value={orderData.discountCode} onChange={e => setOrderData(d => ({ ...d, discountCode: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Ad Code/Spark Ads Code</div><input className="pfi" placeholder="Ad Code/Spark Ads Code" /></div>
              </div>
              <div className="pfg"><div className="pfl">Affiliate Link</div><input className="pfi" value={orderData.affiliateLink} onChange={e => setOrderData(d => ({ ...d, affiliateLink: e.target.value }))} /></div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn-primary">Save</button></div>
            </div>
          )}

          {/* ════ POST TAB ════ */}
          {profileTab === 3 && (
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
          {profileTab === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div className="stit">Performance</div>
              <div className="skg">
                <div className="skc"><div className="skv-dark">{(partner.clicks || 0).toLocaleString()}</div><div className="skl">Total clicks</div></div>
                <div className="skc"><div className="skv-blue">{(partner.cvr || 0).toFixed(2)}%</div><div className="skl">CVR</div></div>
                <div className="skc"><div className="skv-dark">{(partner.sales || 0).toLocaleString()}</div><div className="skl">Total sales</div></div>
                <div className="skc"><div className="skv-green">{formatMoney(partner.rev)}</div><div className="skl">Total revenue</div></div>
                <div className="skc"><div className="skv-green">{formatMoney(partner.totalSpend)}</div><div className="skl">Total spend</div></div>
                <div className="skc"><div className={(partner.roas_val || 0) >= 1 ? "skv-green" : "skv-red"}>{formatROAS(partner.rev || partner.gmv || 0, partner.totalSpend)}</div><div className="skl">ROAS</div></div>
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
                <div className="skc"><div className="skv-green">{formatMoney(partner.gmv || partner.rev || 0)}</div><div className="skl">GMV</div></div>
                <div className="skc"><div className="skv-dark">{campCount}</div><div className="skl">Campaigns</div></div>
              </div>
              <div className="stit">Avg Metrics</div>
              <div className="skg">
                <div className="skc"><div className="skv-dark">{avgLikes}</div><div className="skl">Avg Likes</div></div>
                <div className="skc"><div className="skv-dark">{avgComments}</div><div className="skl">Avg Comments</div></div>
                <div className="skc"><div className="skv-dark">{avgViews}</div><div className="skl">Avg Views</div></div>
              </div>
              {partner.monthly.length > 0 ? (
                <>
                  <div className="stit">Monthly breakdown</div>
                  <div className="mg">
                    {partner.monthly.map(m => (
                      <div key={m.month} className={`mc2 ${bestMonth && m.month === bestMonth.month ? "best" : ""}`}>
                        <div className="mn">{m.month}</div>
                        <div className={`mv ${bestMonth && m.month === bestMonth.month ? "mv-best" : ""}`}>{formatMoney(m.rev)}</div>
                        <div className="ms-txt">{m.sales} sales</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#bbb", fontSize: 12 }}>
                  No monthly performance data yet
                </div>
              )}
            </div>
          )}

          {/* ════ HISTORY TAB ════ */}
          {profileTab === 5 && (
            <HistoryTab brandId={partner.brandId} biId={partner.brandInfluencerId} />
          )}

        </div>

        <style jsx>{`
          .pp { position:fixed; top:0; right:0; width:520px; max-width:100vw; height:100%; background:#fff; box-shadow:-8px 0 40px rgba(0,0,0,0.14); z-index:500; display:flex; flex-direction:column; font-family:"Inter",system-ui,sans-serif; }
          .pph { position:relative; padding:16px 20px; border-bottom:1px solid #f0f0f0; }
          .ppt { font-size:11px; font-weight:600; color:#9ca3af; letter-spacing:.1em; text-transform:uppercase; margin-bottom:12px; }
          .pav { width:44px; height:44px; border-radius:50%; background:#1fae5b; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; color:#fff; flex-shrink:0; box-shadow:0 0 0 3px #dcfce7; background-size:cover; background-position:center; }
          .pnm { font-size:15px; font-weight:700; color:#111827; }
          .phd { font-size:12px; color:#6b7280; margin-top:2px; }
          .ro-lbl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; }
          .ro-box { font-size:11px; font-weight:600; padding:5px 10px; border-radius:8px; border:.5px solid #e5e7eb; background:#f9fafb; color:#374151; white-space:nowrap; }

          .close-btn { position:absolute; top:16px; right:20px; width:30px; height:30px; border-radius:50%; border:1.5px solid #e5e7eb; background:#f9fafb; color:#374151; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; flex-shrink:0; line-height:1; transition:background .15s,border-color .15s,color .15s; }
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

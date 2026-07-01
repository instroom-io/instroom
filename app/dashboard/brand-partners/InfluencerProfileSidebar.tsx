"use client"

// ─────────────────────────────────────────────────────────────────────────────
// InfluencerProfileSidebar — SAFE DB-WIRED VERSION
//
// Fixes from crash report:
//   • partner.monthly is optional — all .reduce() calls are guarded
//   • campaigns.partners is optional — filter uses safe fallback
//   • avg_likes / avg_comments / avg_views default to 0 when missing
//   • profile_image_url, bio, social_link, email all optional
//   • All numeric fields coerced with Number() before display
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react"

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
  rev: number
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: unknown): string {
  const v = Number(n)
  if (!v || isNaN(v)) return "—"
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M"
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K"
  return String(Math.round(v))
}

function fmtMoney(n: unknown): string {
  const v = Number(n)
  if (!v || isNaN(v)) return "—"
  return "$" + Math.round(v).toLocaleString()
}

function fmtPct(n: unknown): string {
  const v = Number(n)
  if (!v || isNaN(v)) return "—"
  return v.toFixed(2) + "%"
}

const STAGE_LABELS: Record<number, string> = {
  1: "Listed",
  2: "Contacted",
  3: "Agreed",
  4: "Product Sent",
  5: "Content Posted",
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  not_contacted:  { bg: "#f0f0f0",  color: "#888"    },
  contacted:      { bg: "#fff8e1",  color: "#854F0B" },
  interested:     { bg: "#e6f1fb",  color: "#185FA5" },
  agreed:         { bg: "#e6f9ee",  color: "#0F6B3E" },
  negotiating:    { bg: "#f3e8ff",  color: "#6d28d9" },
  no_response:    { bg: "#fef2f2",  color: "#b91c1c" },
  not_interested: { bg: "#fef2f2",  color: "#b91c1c" },
}

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "#E1306C",
  tiktok:    "#000000",
  youtube:   "#FF0000",
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InfluencerProfileSidebar({ partner, campaigns, allPartners, onClose }: Props) {
  const [activeSection, setActiveSection] = useState<"overview" | "performance" | "content" | "notes">("overview")

  // ── Safe derived values ────────────────────────────────────────────────────

  // monthly is guaranteed to be [] from BrandPartnersPage, but guard anyway
  const monthly: MonthlyRow[] = Array.isArray(partner.monthly) ? partner.monthly : []

  const bestMonth: MonthlyRow | null = monthly.length > 0
    ? monthly.reduce((a, x) => (x.rev > a.rev ? x : a), monthly[0])
    : null

  // Count campaigns this partner belongs to — supports both real DB and mock shapes
  const campCount = campaigns.filter(c => {
    if (partner.campaign_id && c.id === partner.campaign_id) return true
    if (Array.isArray(c.partners)) return c.partners.some(cp => cp.pid === partner.id)
    return false
  }).length

  const avgLikes    = fmt(partner.avg_likes    ?? partner.likes_count    ?? 0)
  const avgComments = fmt(partner.avg_comments ?? partner.comments_count ?? 0)
  const avgViews    = fmt(partner.avg_views    ?? partner.avgV           ?? 0)
  const followers   = fmt(partner.fol          ?? partner.follower_count ?? 0)
  const engRate     = fmtPct(partner.eng       ?? partner.engagement_rate ?? 0)

  const tierLabel = partner.tierOverride || partner.tier || "Bronze"
  const tierIcon  = tierLabel === "Gold" ? "🥇" : tierLabel === "Silver" ? "🥈" : "🥉"

  const statusStyle = STATUS_COLORS[partner.contact_status] ?? STATUS_COLORS.not_contacted
  const platColor   = PLATFORM_COLOR[partner.plat?.toLowerCase()] ?? "#888"

  const addedDate = partner.added instanceof Date
    ? partner.added.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)",
          zIndex: 300, backdropFilter: "blur(2px)",
        }}
      />

      {/* Sidebar panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "#fff", zIndex: 301, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", fontFamily: "'Inter', sans-serif",
        overflowY: "auto",
      }}>

        {/* ── Header ── */}
        <div style={{ padding: "16px 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: partner.profile_image_url ? `url(${partner.profile_image_url}) center/cover` : "#f0faf5",
              border: `2px solid ${platColor}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, color: platColor, flexShrink: 0,
              backgroundSize: "cover", backgroundPosition: "center",
            }}>
              {!partner.profile_image_url && (partner.handle?.[1]?.toUpperCase() ?? partner.handle?.[0]?.toUpperCase() ?? "?")}
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{partner.handle}</div>
              {(partner.firstName || partner.lastName) && (
                <div style={{ fontSize: 12, color: "#888", marginTop: 1 }}>
                  {[partner.firstName, partner.lastName].filter(Boolean).join(" ")}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${platColor}15`, color: platColor }}>
                  {partner.plat}
                </span>
                {partner.niche && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#f0f0f0", color: "#555" }}>
                    {partner.niche}
                  </span>
                )}
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: statusStyle.bg, color: statusStyle.color, fontWeight: 600 }}>
                  {partner.contact_status?.replace(/_/g, " ") || "not contacted"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 18, padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* ── Quick stats bar ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          {[
            { label: "Followers",  value: followers },
            { label: "Eng. rate",  value: engRate   },
            { label: "Avg likes",  value: avgLikes  },
            { label: "Avg views",  value: avgViews  },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: "10px 12px", textAlign: "center", borderRight: "0.5px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1E1E1E" }}>{value}</div>
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Section nav ── */}
        <div style={{ display: "flex", borderBottom: "0.5px solid rgba(0,0,0,0.06)", background: "#fafaf9" }}>
          {(["overview", "performance", "content", "notes"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              style={{
                flex: 1, padding: "9px 4px", background: "none", border: "none",
                borderBottom: activeSection === s ? "2px solid #1FAE5B" : "2px solid transparent",
                fontSize: 11, fontWeight: 500, cursor: "pointer",
                color: activeSection === s ? "#1FAE5B" : "#888",
                fontFamily: "'Inter', sans-serif", textTransform: "capitalize",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── Section body ── */}
        <div style={{ padding: "16px 20px", flex: 1 }}>

          {/* ── OVERVIEW ── */}
          {activeSection === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Collaboration status */}
              <Section title="Collaboration">
                <Row label="Stage"        value={`Stage ${partner.stage} — ${STAGE_LABELS[partner.stage] ?? "Unknown"}`} />
                <Row label="Tier"         value={`${tierIcon} ${tierLabel}`} />
                <Row label="Agreed rate"  value={fmtMoney(partner.agreed_rate)} highlight />
                <Row label="Rating"       value={partner.internal_rating ? `${partner.internal_rating}/5` : "—"} />
                <Row label="Campaign"     value={campCount > 0 ? `${campCount} campaign${campCount > 1 ? "s" : ""}` : "No campaign"} />
                <Row label="Added"        value={addedDate} />
              </Section>

              {/* Influencer info */}
              <Section title="Profile">
                <Row label="Gender"   value={partner.gend    || "—"} />
                <Row label="Location" value={partner.loc     || "—"} />
                <Row label="Email"    value={partner.email   || "—"} />
                {partner.social_link && (
                  <div style={{ marginTop: 4 }}>
                    <a href={partner.social_link} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "#1FAE5B", textDecoration: "none" }}>
                      View profile ↗
                    </a>
                  </div>
                )}
              </Section>

              {/* Bio */}
              {partner.bio && (
                <Section title="Bio">
                  <p style={{ fontSize: 12, color: "#555", lineHeight: 1.5, margin: 0 }}>{partner.bio}</p>
                </Section>
              )}

              {/* Delivery */}
              <Section title="Delivery">
                <Row label="Content posted" value={partner.content_posted ? "✅ Yes" : "Not yet"} />
                {partner.post_url && (
                  <div style={{ marginTop: 4 }}>
                    <a href={partner.post_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "#1FAE5B", textDecoration: "none" }}>
                      View post ↗
                    </a>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ── PERFORMANCE ── */}
          {activeSection === "performance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              <Section title="Engagement">
                <Row label="Followers"    value={followers}   />
                <Row label="Eng. rate"    value={engRate}     />
                <Row label="Avg likes"    value={avgLikes}    />
                <Row label="Avg comments" value={avgComments} />
                <Row label="Avg views"    value={avgViews}    />
              </Section>

              <Section title="Post metrics">
                <Row label="Likes"       value={fmt(partner.likes_count)}       />
                <Row label="Comments"    value={fmt(partner.comments_count)}     />
                <Row label="Engagements" value={fmt(partner.engagement_count)}   />
              </Section>

              {/* Monthly breakdown — only shown when data exists */}
              {monthly.length > 0 && (
                <Section title="Monthly breakdown">
                  {bestMonth && (
                    <div style={{ marginBottom: 8, padding: "8px 10px", background: "#f0faf5", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: "#888" }}>Best month</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1FAE5B" }}>{bestMonth.month}</div>
                      <div style={{ fontSize: 11, color: "#555" }}>{fmtMoney(bestMonth.rev)} revenue</div>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {monthly.map((m) => (
                      <div key={m.month} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0", borderBottom: "0.5px solid rgba(0,0,0,0.05)" }}>
                        <span style={{ color: "#888" }}>{m.month}</span>
                        <span style={{ fontWeight: 600 }}>{fmtMoney(m.rev)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {monthly.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "#bbb", fontSize: 12 }}>
                  No monthly performance data yet
                </div>
              )}
            </div>
          )}

          {/* ── CONTENT ── */}
          {activeSection === "content" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Section title="Content">
                <Row label="Posted"    value={partner.content_posted ? "Yes ✅" : "Not yet"} />
                <Row label="Post URL"  value={partner.post_url ? "Set" : "—"} />
              </Section>

              {partner.post_url && (
                <div style={{ background: "#f7f9f8", borderRadius: 10, padding: 12, border: "0.5px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>Post link</div>
                  <a
                    href={partner.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "#1FAE5B", wordBreak: "break-all", textDecoration: "none" }}
                  >
                    {partner.post_url} ↗
                  </a>
                </div>
              )}

              {!partner.post_url && !partner.content_posted && (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "#bbb", fontSize: 12 }}>
                  No content posted yet
                </div>
              )}
            </div>
          )}

          {/* ── NOTES ── */}
          {activeSection === "notes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Section title="Notes">
                {partner.notes ? (
                  <p style={{ fontSize: 12, color: "#444", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                    {partner.notes}
                  </p>
                ) : (
                  <div style={{ color: "#bbb", fontSize: 12, padding: "16px 0", textAlign: "center" }}>
                    No notes added
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fafaf9", borderRadius: 10, padding: "12px 14px", border: "0.5px solid rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "0.5px solid rgba(0,0,0,0.04)" }}>
      <span style={{ fontSize: 11, color: "#888" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: highlight ? 700 : 500, color: highlight ? "#1FAE5B" : "#1E1E1E" }}>
        {value}
      </span>
    </div>
  )
}
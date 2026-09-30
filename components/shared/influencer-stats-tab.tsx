"use client"

import { useEffect, useState } from "react"

type Stats = {
  clicks: number; sales: number; revenue: number
  productCost: number; feesPaid: number; commissionPaid: number; totalSpend: number
  followers: number | null; engagementRate: number | null
  likes: number; comments: number; views: number; agreedRate: number | null
  avgLikes: number | null; avgComments: number | null; avgViews: number | null
  shippedAt: string | null; deliveredAt: string | null; postedAt: string | null
}

const money = (v: number) => "$" + Math.round(v).toLocaleString()
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—")
const compact = (n: number | null) => {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  const v = Number(n)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M"
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K"
  return String(v)
}

/**
 * Stats tab shared by the Pipeline and Post Tracker drawers. Loads its own
 * numbers; carries its own styles, since the drawers' styles are scoped.
 */
export function InfluencerStatsTab({ brandId, brandInfluencerId }: { brandId?: string; brandInfluencerId?: string }) {
  // Tagged with the influencer it belongs to, so a switch never shows the previous one's numbers.
  const key = `${brandId}/${brandInfluencerId}`
  const [loaded, setLoaded] = useState<{ key: string; stats: Stats | null; error: boolean } | null>(null)

  useEffect(() => {
    if (!brandId || !brandInfluencerId) return
    let cancelled = false
    fetch(`/api/brand/${brandId}/stats/${brandInfluencerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json) => { if (!cancelled) setLoaded({ key, stats: json.data, error: false }) })
      .catch(() => { if (!cancelled) setLoaded({ key, stats: null, error: true }) })
    return () => { cancelled = true }
  }, [brandId, brandInfluencerId, key])

  const current = loaded?.key === key ? loaded : null
  if (current?.error) return <div style={{ fontSize: 12, color: "#B42318" }}>Couldn&apos;t load stats</div>
  const stats = current?.stats
  if (!stats) return <div style={{ fontSize: 12, color: "#9ca3af" }}>Loading…</div>

  const cvr = stats.clicks > 0 ? (stats.sales / stats.clicks) * 100 : 0
  const roas = stats.totalSpend > 0 ? stats.revenue / stats.totalSpend : null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="stit">Performance — all campaigns combined</div>
      <div className="skg">
        <div className="skc"><div className="skv-dark">{stats.clicks.toLocaleString()}</div><div className="skl">Total clicks</div></div>
        <div className="skc"><div className="skv-blue">{cvr.toFixed(1)}%</div><div className="skl">CVR</div></div>
        <div className="skc"><div className="skv-dark">{stats.sales.toLocaleString()}</div><div className="skl">Total sales</div></div>
        <div className="skc"><div className="skv-green">{money(stats.revenue)}</div><div className="skl">Total revenue</div></div>
        <div className="skc"><div className="skv-green">{money(stats.totalSpend)}</div><div className="skl">Total spend</div></div>
        <div className="skc"><div className={roas != null && roas >= 1 ? "skv-green" : "skv-red"}>{roas != null ? roas.toFixed(1) + "x" : "—"}</div><div className="skl">ROAS</div></div>
      </div>
      <div className="breakdown-box">
        <strong>Spend breakdown:</strong>{" "}
        {money(stats.productCost)} product COGS + {money(stats.feesPaid)} fees + {money(stats.commissionPaid)} commission
      </div>

      <div className="stit">Engagement</div>
      <div className="skg">
        <div className="skc"><div className="skv-dark">{compact(stats.followers)}</div><div className="skl">Followers</div></div>
        <div className="skc"><div className="skv-blue">{stats.engagementRate != null ? `${stats.engagementRate.toFixed(1)}%` : "—"}</div><div className="skl">Eng. rate</div></div>
        <div className="skc"><div className="skv-dark">{stats.likes.toLocaleString()}</div><div className="skl">Likes</div></div>
        <div className="skc"><div className="skv-dark">{stats.comments.toLocaleString()}</div><div className="skl">Comments</div></div>
        <div className="skc"><div className="skv-dark">{stats.views.toLocaleString()}</div><div className="skl">Views</div></div>
        <div className="skc"><div className="skv-green">{stats.agreedRate ? money(stats.agreedRate) : "—"}</div><div className="skl">Rate</div></div>
      </div>

      <div className="stit">Avg Metrics</div>
      <div className="skg">
        <div className="skc"><div className="skv-dark">{compact(stats.avgLikes)}</div><div className="skl">Avg Likes</div></div>
        <div className="skc"><div className="skv-dark">{compact(stats.avgComments)}</div><div className="skl">Avg Comments</div></div>
        <div className="skc"><div className="skv-dark">{compact(stats.avgViews)}</div><div className="skl">Avg Views</div></div>
      </div>

      <div className="stit">Timeline</div>
      <div className="skg">
        <div className="skc"><div className="skv-dark">{date(stats.shippedAt)}</div><div className="skl">Shipped</div></div>
        <div className="skc"><div className="skv-dark">{date(stats.deliveredAt)}</div><div className="skl">Delivered</div></div>
        <div className="skc"><div className="skv-dark">{date(stats.postedAt)}</div><div className="skl">Posted</div></div>
      </div>

      {/* Kept for later: needs order data grouped by month. */}
      <div className="stit">Monthly breakdown</div>
      <div className="breakdown-box">Not available yet.</div>

      <style jsx>{`
        .stit { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.08em; padding:12px 0 8px; border-bottom:1px solid #f3f4f6; margin-bottom:10px; }
        .skg { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
        .skc { background:#f9fafb; border-radius:10px; padding:10px 12px; text-align:center; border:1px solid #f3f4f6; }
        .skl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; margin-top:3px; }
        .skv-green { font-size:16px; font-weight:700; color:#1fae5b; }
        .skv-dark  { font-size:16px; font-weight:700; color:#111827; }
        .skv-blue  { font-size:16px; font-weight:700; color:#2c8ec4; }
        .skv-red   { font-size:16px; font-weight:700; color:#e24b4a; }
        .breakdown-box { background:#f9fafb; border-radius:8px; padding:10px; margin-bottom:14px; font-size:11px; color:#888; border:1px solid #f3f4f6; }
      `}</style>
    </div>
  )
}

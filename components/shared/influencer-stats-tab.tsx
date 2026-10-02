"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchCached, getCachedData } from "@/lib/data-cache"

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

const statsKey = (brandId: string, biId: string) => `/api/brand/${brandId}/stats/${biId}`

const loadStats = (brandId: string, biId: string, force = false) =>
  fetchCached<Stats>(statsKey(brandId, biId), async () => {
    const r = await fetch(statsKey(brandId, biId))
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return (await r.json()).data as Stats
  }, { force })

/**
 * Start loading an influencer's stats as soon as their drawer opens, so the
 * tab is ready by the time it is clicked. Shared cache: no double request.
 */
export function prefetchStats(brandId?: string, biId?: string) {
  if (brandId && biId) loadStats(brandId, biId).catch(() => {})
}

/** Placeholder in the tab's own shape — three rows of stat boxes. */
function StatsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }} aria-busy="true" aria-label="Loading stats">
      {[6, 6, 3].map((boxes, section) => (
        <div key={section} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton className="h-2.5 w-36 bg-gray-100" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {Array.from({ length: boxes }, (_, i) => <Skeleton key={i} className="h-[58px] w-full rounded-[10px] bg-gray-100" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Stats tab shared by the Pipeline and Post Tracker drawers. Loads its own
 * numbers; carries its own styles, since the drawers' styles are scoped.
 */
export function InfluencerStatsTab({ brandId, brandInfluencerId, allowManualEntry = false }: { brandId?: string; brandInfluencerId?: string; allowManualEntry?: boolean }) {
  // Tagged with the influencer it belongs to, so a switch never shows the previous one's numbers.
  const key = `${brandId}/${brandInfluencerId}`
  const [loaded, setLoaded] = useState<{ key: string; stats: Stats | null; error: boolean } | null>(null)
  // A cached copy (an earlier open, or the drawer's prefetch) shows at once.
  const cached = brandId && brandInfluencerId ? getCachedData<Stats>(statsKey(brandId, brandInfluencerId)) : undefined
  const [reload, setReload] = useState(0)
  // Manual entry, for brands not using GoAffPro or another tracking tool.
  const [manual, setManual] = useState<{ clicks: string; sales: string; revenue: string; productCost: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!brandId || !brandInfluencerId) return
    let cancelled = false
    // After a manual save (reload > 0) the cached numbers are out of date.
    loadStats(brandId, brandInfluencerId, reload > 0)
      .then((data) => { if (!cancelled) setLoaded({ key, stats: data, error: false }) })
      .catch(() => { if (!cancelled) setLoaded({ key, stats: null, error: true }) })
    return () => { cancelled = true }
  }, [brandId, brandInfluencerId, key, reload])

  // A different influencer never inherits an open form.
  useEffect(() => { setManual(null); setSaveError(null) }, [key])

  const current = loaded?.key === key ? loaded : null
  const stats = current?.stats ?? cached
  if (!stats && current?.error) return <div style={{ fontSize: 12, color: "#B42318" }}>Couldn&apos;t load stats</div>
  if (!stats) return <StatsSkeleton />

  const cvr = stats.clicks > 0 ? (stats.sales / stats.clicks) * 100 : 0
  const roas = stats.totalSpend > 0 ? stats.revenue / stats.totalSpend : null

  const saveManual = async () => {
    if (!manual) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/brand/${brandId}/attribution/${brandInfluencerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manual),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setSaveError(json.error || "Failed to save"); return }
      setManual(null)
      setReload((n) => n + 1)
    } catch {
      setSaveError("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="stit" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Performance — all campaigns combined</span>
        {allowManualEntry && !manual && (
          <button type="button" className="manual-link"
            onClick={() => setManual({ clicks: String(stats.clicks), sales: String(stats.sales), revenue: String(stats.revenue), productCost: String(stats.productCost) })}>
            Enter manually
          </button>
        )}
      </div>
      {manual && (
        <div className="breakdown-box">
          <div className="manual-grid">
            <label>Total clicks<input className="manual-input" inputMode="numeric" value={manual.clicks} onChange={(e) => setManual((m) => m && { ...m, clicks: e.target.value })} /></label>
            <label>Total sales<input className="manual-input" inputMode="numeric" value={manual.sales} onChange={(e) => setManual((m) => m && { ...m, sales: e.target.value })} /></label>
            <label>Total revenue<input className="manual-input" inputMode="decimal" value={manual.revenue} onChange={(e) => setManual((m) => m && { ...m, revenue: e.target.value })} /></label>
            <label>Product cost<input className="manual-input" inputMode="decimal" value={manual.productCost} onChange={(e) => setManual((m) => m && { ...m, productCost: e.target.value })} /></label>
          </div>
          {saveError && <div style={{ color: "#B42318", marginTop: 6 }}>{saveError}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
            <button type="button" className="manual-cancel" onClick={() => { setManual(null); setSaveError(null) }} disabled={saving}>Cancel</button>
            <button type="button" className="manual-save" onClick={saveManual} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      )}
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
        .manual-link { font-size:10px; font-weight:600; color:#0F6B3E; text-transform:none; letter-spacing:0; background:none; border:none; cursor:pointer; }
        .manual-link:hover { color:#1FAE5B; text-decoration:underline; }
        .manual-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .manual-grid label { display:flex; flex-direction:column; gap:4px; font-size:10px; font-weight:600; color:#6b7280; }
        .manual-input { width:100%; font-size:12px; padding:6px 8px; border-radius:8px; border:1.5px solid #e5e7eb; background:#fff; color:#111827; box-sizing:border-box; outline:none; }
        .manual-input:focus { border-color:#1fae5b; }
        .manual-cancel { font-size:11px; padding:5px 12px; border-radius:7px; border:1px solid #e5e7eb; background:#fff; color:#6b7280; cursor:pointer; }
        .manual-save { font-size:11px; padding:5px 12px; border-radius:7px; border:none; background:#1FAE5B; color:#fff; cursor:pointer; }
        .manual-save:disabled, .manual-cancel:disabled { opacity:.5; cursor:default; }
        .breakdown-box { background:#f9fafb; border-radius:8px; padding:10px; margin-bottom:14px; font-size:11px; color:#888; border:1px solid #f3f4f6; }
      `}</style>
    </div>
  )
}

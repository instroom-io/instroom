"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchCached, getCachedData, setCachedData, invalidateCache } from "@/lib/data-cache"
import { invalidateInfluencerDerivedCaches } from "@/lib/cache-invalidation"

type Attribution = {
  coupon?: string | null
  refCode?: string | null
  affiliateLink?: string | null
  sparkAds?: string | null
  /** undefined = not loaded */
  commissionRate?: number | null
  /** null = calculated */
  commissionPaid?: number | null
  commissionCalculated?: { amount: number; source: "goaffpro" | "estimated" | "none" | "paid" }
}

function calculatedHint(calc: Attribution["commissionCalculated"]): string {
  if (!calc) return "Blank = calculated"
  const amount = "$" + calc.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (calc.source === "goaffpro") return `${amount} · from GoAffPro`
  if (calc.source === "estimated") return `${amount} · revenue × rate`
  return `${amount} · no sales yet`
}

/** Commission loaded, so a save can't blank it. */
const hasCommission = (a?: Attribution): a is Attribution =>
  a !== undefined && a.commissionRate !== undefined && a.commissionCalculated !== undefined

const attributionKey = (brandId: string, biId: string) => `/api/brand/${brandId}/attribution/${biId}`

const loadAttribution = (brandId: string, biId: string, force = false) =>
  fetchCached<Attribution>(attributionKey(brandId, biId), async () => {
    const r = await fetch(attributionKey(brandId, biId))
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return ((await r.json()).data ?? {}) as Attribution
  }, { force })

/**
 * Start loading an influencer's attribution as soon as their drawer opens, so
 * the tab is ready by the time it is clicked. Shared cache: no double request.
 */
export function prefetchAttribution(brandId?: string, biId?: string) {
  if (brandId && biId) loadAttribution(brandId, biId).catch(() => {})
}

/**
 * Discount code, ad code, affiliate link and commission for one influencer. Shared by the
 * Pipeline and Post Tracker drawers; loads its own values when `initial` isn't
 * given. Carries its own styles, since the drawers' styles are scoped.
 */
export function AttributionTab({
  brandId,
  brandInfluencerId,
  firstName,
  initial,
  onSaved,
}: {
  brandId?: string
  brandInfluencerId?: string
  firstName: string
  initial?: Attribution
  onSaved?: () => void
}) {
  // Suggestions are placeholders only, so nothing made-up is saved.
  const defaults = (a: Attribution) => ({
    discountCode: a.coupon || a.refCode || "",
    affiliateLink: a.affiliateLink || "",
    sparkAds: a.sparkAds || "",
    commissionRate: a.commissionRate != null ? String(a.commissionRate) : "",
    commissionPaid: a.commissionPaid != null ? String(a.commissionPaid) : "",
  })
  const suggestedCode = "CODE" + firstName.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const suggestedLink = "https://instroom.io/ref/" + firstName.toLowerCase().replace(/[^a-z0-9]/g, "")

  // A cached copy (from an earlier open, or the drawer's prefetch) renders at once.
  const cached = brandId && brandInfluencerId ? getCachedData<Attribution>(attributionKey(brandId, brandInfluencerId)) : undefined
  const ready = hasCommission(initial) ? initial : hasCommission(cached) ? cached : undefined
  const [form, setForm] = useState(() => defaults(ready ?? initial ?? {}))
  const [commissionKnown, setCommissionKnown] = useState(ready !== undefined)
  const [calc, setCalc] = useState(ready?.commissionCalculated)
  const [loading, setLoading] = useState(!ready)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (ready || !brandId || !brandInfluencerId) { setLoading(false); return }
    let cancelled = false
    loadAttribution(brandId, brandInfluencerId)
      .then((data) => { if (!cancelled) { setForm(defaults(data)); setCommissionKnown(hasCommission(data)); setCalc(data.commissionCalculated) } })
      .catch(() => { if (!cancelled) setMessage("Couldn't load the saved values") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, brandInfluencerId])

  const save = async () => {
    if (!brandId || !brandInfluencerId) return
    setSaveState("saving")
    setMessage(null)
    try {
      const res = await fetch(`/api/brand/${brandId}/attribution/${brandInfluencerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coupon: form.discountCode || null,
          affiliateLink: form.affiliateLink || null,
          sparkAds: form.sparkAds || null,
          // Blank clears, so only once loaded.
          ...(commissionKnown ? { commissionRate: form.commissionRate, commissionPaid: form.commissionPaid } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setSaveState("error"); setMessage(json.error || "Failed to update"); return }
      const money = (v: string) => { const n = Number(v.replace(/[$,%\s]/g, "")); return v.trim() !== "" && Number.isFinite(n) ? n : null }
      // Keep the cache in step, so reopening shows what was just saved.
      setCachedData(attributionKey(brandId, brandInfluencerId), {
        coupon: json.data?.coupon ?? (form.discountCode || null),
        affiliateLink: json.data?.affiliateLink ?? (form.affiliateLink || null),
        sparkAds: json.data?.sparkAds ?? (form.sparkAds || null),
        ...(commissionKnown ? { commissionRate: money(form.commissionRate), commissionPaid: money(form.commissionPaid) } : {}),
      })
      if (commissionKnown) {
        invalidateCache(`/api/brand/${brandId}/stats/${brandInfluencerId}`)
        invalidateInfluencerDerivedCaches(brandId)
        loadAttribution(brandId, brandInfluencerId, true).then(d => setCalc(d.commissionCalculated)).catch(() => {})
      }
      setSaveState("saved")
      onSaved?.()
      if (json.goAffPro?.synced === false && json.goAffPro?.reason) {
        setMessage(`Updated — GoAffPro sync skipped: ${json.goAffPro.reason}`)
      } else if (json.goAffPro?.synced) {
        setMessage("Updated and synced to GoAffPro")
      }
    } catch {
      setSaveState("error")
      setMessage("Failed to update")
    } finally {
      setTimeout(() => setSaveState("idle"), 3000)
    }
  }

  // Same shape as the form below, so nothing jumps when the values arrive.
  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-busy="true" aria-label="Loading attribution">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Skeleton className="h-2.5 w-24 bg-gray-100" />
            <Skeleton className="h-9 w-full bg-gray-100" />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton className="h-2.5 w-20 bg-gray-100" />
        <Skeleton className="h-9 w-full bg-gray-100" />
      </div>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="pfr">
        <div className="pfg"><div className="pfl">Discount Code</div><input className="pfi" value={form.discountCode} onChange={e => setForm(d => ({ ...d, discountCode: e.target.value }))} placeholder={`e.g. ${suggestedCode}`} /></div>
        <div className="pfg"><div className="pfl">Ad Code/Spark Ads Code</div><input className="pfi" value={form.sparkAds} onChange={e => setForm(d => ({ ...d, sparkAds: e.target.value }))} placeholder="Ad Code/Spark Ads Code" /></div>
      </div>
      <div className="pfg"><div className="pfl">Affiliate Link</div><input className="pfi" value={form.affiliateLink} onChange={e => setForm(d => ({ ...d, affiliateLink: e.target.value }))} placeholder={`e.g. ${suggestedLink}`} /></div>
      {commissionKnown && (
        <div className="pfr">
          <div className="pfg"><div className="pfl">Commission rate (%)</div><input className="pfi" inputMode="decimal" value={form.commissionRate} onChange={e => setForm(d => ({ ...d, commissionRate: e.target.value }))} placeholder="e.g. 10" /></div>
          <div className="pfg"><div className="pfl">Commission paid ($)</div><input className="pfi" inputMode="decimal" value={form.commissionPaid} onChange={e => setForm(d => ({ ...d, commissionPaid: e.target.value }))} placeholder={calculatedHint(calc)} title="Leave blank to use the calculated figure (GoAffPro, else revenue × rate). Type an amount to override it." /></div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
        {message && (
          <div style={{ fontSize: 12, color: saveState === "error" ? "#B42318" : "#667085" }}>{message}</div>
        )}
        <button
          className="btn-primary"
          onClick={save}
          disabled={saveState === "saving"}
          style={{ opacity: saveState === "saving" ? 0.6 : 1 }}
        >
          {saveState === "saving" ? "Updating…" : saveState === "saved" ? "Updated" : "Update"}
        </button>
      </div>
      <style jsx>{`
        .pfr { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .pfg { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
        .pfl { font-size:10px; font-weight:600; color:#6b7280; }
        .pfi { width:100%; font-size:12px; padding:8px 10px; border-radius:8px; border:1.5px solid #e5e7eb; background:#f9fafb; color:#111827; font-family:inherit; box-sizing:border-box; outline:none; transition:border-color .15s,background .15s; }
        .pfi:focus { border-color:#1fae5b; background:#fff; }
        .pfi::placeholder { color:#c4c4c4; }
        .btn-primary { background:#1fae5b; color:#fff; border:none; padding:9px 20px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; font-family:inherit; transition:background .15s; }
        .btn-primary:hover { background:#0f6b3e; }
      `}</style>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"

type Attribution = {
  coupon?: string | null
  refCode?: string | null
  affiliateLink?: string | null
  sparkAds?: string | null
}

/**
 * Discount code, ad code and affiliate link for one influencer. Shared by the
 * Pipeline and Post Tracker drawers; loads its own values when `initial` isn't
 * given. Carries its own styles, since the drawers' styles are scoped.
 */
export function AttributionTab({
  brandId,
  brandInfluencerId,
  firstName,
  initial,
}: {
  brandId?: string
  brandInfluencerId?: string
  firstName: string
  initial?: Attribution
}) {
  const defaults = (a: Attribution) => ({
    discountCode: a.coupon || a.refCode || "CODE" + firstName.toUpperCase(),
    affiliateLink: a.affiliateLink || "https://instroom.io/ref/" + firstName.toLowerCase(),
    sparkAds: a.sparkAds || "",
  })

  const [form, setForm] = useState(() => defaults(initial ?? {}))
  const [loading, setLoading] = useState(!initial)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (initial || !brandId || !brandInfluencerId) { setLoading(false); return }
    let cancelled = false
    fetch(`/api/brand/${brandId}/attribution/${brandInfluencerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json) => { if (!cancelled) setForm(defaults(json.data ?? {})) })
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
        }),
      })
      if (!res.ok) throw new Error("Failed to update")
      const json = await res.json()
      setSaveState("saved")
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

  if (loading) return <div style={{ fontSize: 12, color: "#9ca3af" }}>Loading…</div>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="pfr">
        <div className="pfg"><div className="pfl">Discount Code</div><input className="pfi" value={form.discountCode} onChange={e => setForm(d => ({ ...d, discountCode: e.target.value }))} /></div>
        <div className="pfg"><div className="pfl">Ad Code/Spark Ads Code</div><input className="pfi" value={form.sparkAds} onChange={e => setForm(d => ({ ...d, sparkAds: e.target.value }))} placeholder="Ad Code/Spark Ads Code" /></div>
      </div>
      <div className="pfg"><div className="pfl">Affiliate Link</div><input className="pfi" value={form.affiliateLink} onChange={e => setForm(d => ({ ...d, affiliateLink: e.target.value }))} /></div>
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

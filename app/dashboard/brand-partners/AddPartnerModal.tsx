"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useBrandTaxonomy } from "@/hooks/useBrandTaxonomy"

interface AddPartnerModalProps {
  isOpen: boolean
  onClose: () => void
  brandId: string
  onAdded: () => void
}

interface BrandInfluencerPreview {
  id: string
  influencer_id: string
  influencer: {
    id: string
    handle: string
    platform: string
    full_name: string | null
    niche: string | null
    location: string | null
    follower_count: number
    engagement_rate: number
  }
}

const TIER_OPTIONS = [
  { value: "auto",     label: "Auto (based on revenue)" },
  { value: "bronze",   label: "Bronze" },
  { value: "silver",   label: "Silver" },
  { value: "gold",     label: "Gold" },
  { value: "platinum", label: "Platinum" },
]

export default function AddPartnerModal({ isOpen, onClose, brandId, onAdded }: AddPartnerModalProps) {
  const [mode, setMode] = useState<"search" | "manual">("search")

  // Search mode
  const [searchQuery,    setSearchQuery]    = useState("")
  const [results,        setResults]        = useState<BrandInfluencerPreview[]>([])
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [searching,      setSearching]      = useState(false)
  const [searchNotes,    setSearchNotes]    = useState("")
  const [assignTier,     setAssignTier]     = useState("auto")
  const [commissionPct,  setCommissionPct]  = useState("")

  // Manual mode
  const [handle,   setHandle]   = useState("")
  const [platform, setPlatform] = useState("")
  const [niche,    setNiche]    = useState("")
  const [location, setLocation] = useState("")
  const [email,    setEmail]    = useState("")
  const [notes,    setNotes]    = useState("")

  // Inline "add new" taxonomy inputs
  const [newNicheInput,    setNewNicheInput]    = useState("")
  const [newLocationInput, setNewLocationInput] = useState("")
  const [addingNiche,    setAddingNiche]    = useState(false)
  const [addingLocation, setAddingLocation] = useState(false)
  const nicheInputRef    = useRef<HTMLInputElement>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)

  // Status
  const [saving,  setSaving]  = useState(false)
  const [errMsg,  setErrMsg]  = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── Taxonomy ──────────────────────────────────────────────────────────────
  const { niches, locations, isLoading: taxonomyLoading, addNiche, addLocation } = useBrandTaxonomy(
    isOpen ? brandId : null
  )

  // Focus inline inputs when shown
  useEffect(() => { if (addingNiche)    nicheInputRef.current?.focus()    }, [addingNiche])
  useEffect(() => { if (addingLocation) locationInputRef.current?.focus() }, [addingLocation])

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    setMode("search")
    setSearchQuery(""); setResults([]); setSelectedIds(new Set()); setSearchNotes("")
    setAssignTier("auto"); setCommissionPct("")
    setHandle(""); setPlatform(""); setNiche(""); setLocation(""); setEmail(""); setNotes("")
    setNewNicheInput(""); setNewLocationInput("")
    setAddingNiche(false); setAddingLocation(false)
    setSaving(false); setErrMsg(null); setSuccess(false)
  }, [isOpen])

  // ── Debounced search ──────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    setSearching(true)
    try {
      const p = new URLSearchParams({ unpartnered_only: "true" })
      if (q.trim()) p.set("search", q.trim())
      const res  = await fetch(`/api/brand/${brandId}/influencers?${p}`)
      const json = await res.json()
      setResults(Array.isArray(json.influencers) ? json.influencers : [])
    } catch { setResults([]) }
    finally  { setSearching(false) }
  }, [brandId])

  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(() => doSearch(searchQuery), searchQuery ? 300 : 0)
    return () => clearTimeout(t)
  }, [isOpen, searchQuery, doSearch])

  const toggle = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  // ── Inline add niche ──────────────────────────────────────────────────────
  const handleAddNiche = async () => {
    const trimmed = newNicheInput.trim()
    if (!trimmed) { setAddingNiche(false); return }
    const created = await addNiche(trimmed)
    if (created) {
      setNiche(created.name)
      setNewNicheInput("")
      setAddingNiche(false)
    }
  }

  // ── Inline add location ───────────────────────────────────────────────────
  const handleAddLocation = async () => {
    const trimmed = newLocationInput.trim()
    if (!trimmed) { setAddingLocation(false); return }
    const created = await addLocation(trimmed)
    if (created) {
      setLocation(created.name)
      setNewLocationInput("")
      setAddingLocation(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setErrMsg(null); setSaving(true)
    try {
      if (mode === "search") {
        if (selectedIds.size === 0) { setErrMsg("Select at least one influencer."); setSaving(false); return }
        const errs: string[] = []
        for (const partnerId of Array.from(selectedIds)) {
          let noteError: string | null = null

          if (searchNotes.trim()) {
            const noteRes = await fetch(`/api/brands/${brandId}/partners/${partnerId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes: searchNotes.trim() }),
            })

            const noteJson = await noteRes.json()
            if (!noteRes.ok) {
              noteError = noteJson.error || "Failed to save notes"
            }
          }

          const res  = await fetch(`/api/brands/${brandId}/partners/${partnerId}/financials`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tier_override: assignTier !== "auto" ? assignTier : null,
              default_commission: commissionPct ? parseFloat(commissionPct) : null,
            }),
          })
          const json = await res.json()
          if (!res.ok) errs.push(json.error || "Failed")
          if (noteError) errs.push(noteError)
        }
        if (errs.length) { setErrMsg(errs.join(" · ")); setSaving(false); return }

      } else {
        if (!handle.trim() || !platform || !niche || !location) {
          setErrMsg("Handle, platform, niche and location are required.")
          setSaving(false); return
        }
        const res  = await fetch("/api/influencers/create", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            handle: handle.trim(), platform: platform.toLowerCase(),
            email: email || null, niche: niche || null,
            location: location || null, notes: notes || null,
          }),
        })
        const json = await res.json()

        if (res.status === 403) { setErrMsg(json.error || "Influencer limit reached."); setSaving(false); return }

        if (!res.ok) {
          setErrMsg(json.error || `Error ${res.status}`)
          setSaving(false); return
        }

        if (!json.id) {
          setErrMsg("Influencer was created, but no influencer id was returned.")
          setSaving(false)
          return
        }

        const link = await fetch(`/api/brands/${brandId}/partners`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ influencer_id: json.id, notes: notes || null }),
        })
        const linkJson = await link.json()
        if (!link.ok && link.status !== 409) {
          setErrMsg(linkJson.error || "Failed to add brand partner.")
          setSaving(false); return
        }
      }

      setSuccess(true)
      setTimeout(() => { onAdded(); onClose() }, 700)
    } catch (e: any) {
      setErrMsg(e.message || "Unexpected error.")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const fs: React.CSSProperties = {
    width: "100%", padding: "6px 10px", borderRadius: 7,
    border: "0.5px solid rgba(0,0,0,0.15)", fontSize: 12,
    fontFamily: "inherit", boxSizing: "border-box",
  }

  // ── Taxonomy select + inline add row ─────────────────────────────────────
  const TaxonomySelect = ({
    label, required, value, onChange,
    options, loading,
    adding, setAdding,
    inputVal, setInputVal,
    inputRef, onCommit,
  }: {
    label: string
    required?: boolean
    value: string
    onChange: (v: string) => void
    options: { id: string; name: string }[]
    loading: boolean
    adding: boolean
    setAdding: (v: boolean) => void
    inputVal: string
    setInputVal: (v: string) => void
    inputRef: React.RefObject<HTMLInputElement | null>
    onCommit: () => void
  }) => (
    <div>
      <div style={{ fontSize: 11, color: "#555", fontWeight: 500, marginBottom: 4 }}>
        {label}{" "}
        {required && <span style={{ color: "#E24B4A", fontSize: 10 }}>*</span>}
      </div>

      {!adding ? (
        <div style={{ display: "flex", gap: 6 }}>
          <select style={{ ...fs, flex: 1 }} value={value} onChange={e => onChange(e.target.value)}>
            <option value="">
              {loading ? "Loading…" : options.length === 0 ? `No ${label.toLowerCase()}s yet` : "Select…"}
            </option>
            {options.map(o => (
              <option key={o.id} value={o.name}>{o.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAdding(true)}
            title={`Add new ${label.toLowerCase()}`}
            style={{
              flexShrink: 0, padding: "0 10px", borderRadius: 7, fontSize: 14, fontWeight: 600,
              border: "0.5px solid rgba(0,0,0,0.15)", background: "transparent",
              color: "#1FAE5B", cursor: "pointer", lineHeight: 1,
            }}
          >
            +
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            ref={inputRef}
            style={{ ...fs, flex: 1 }}
            placeholder={`New ${label.toLowerCase()} name…`}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); onCommit() }
              if (e.key === "Escape") { setAdding(false); setInputVal("") }
            }}
          />
          <button
            type="button"
            onClick={onCommit}
            style={{
              flexShrink: 0, padding: "0 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
              border: "none", background: "#1FAE5B", color: "#fff", cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setInputVal("") }}
            style={{
              flexShrink: 0, padding: "0 8px", borderRadius: 7, fontSize: 11,
              border: "0.5px solid rgba(0,0,0,0.15)", background: "transparent",
              color: "#888", cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 14, width: 580, maxWidth: "90%", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Add Brand Partner</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Promote brand influencers to Brand Partners or add manually</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#888", cursor: "pointer" }}>×</button>
        </div>

        {/* Mode toggle */}
        <div style={{ padding: "12px 20px 0" }}>
          <div style={{ display: "flex", gap: 8, background: "#f7f9f8", padding: 4, borderRadius: 10 }}>
            {(["search", "manual"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "inherit", background: mode === m ? "#fff" : "transparent", color: mode === m ? "#1FAE5B" : "#555", boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                {m === "search" ? "🔍 Search influencer list" : "✏️ Add manually"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── Search mode ── */}
          {mode === "search" && (<>
            <div style={{ fontSize: 12, color: "#888" }}>Select brand influencers that do not already have a Brand Partner record.</div>

            {/* Search input */}
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
              <input style={{ ...fs, paddingLeft: 30 }} placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            {/* Results list */}
            <div style={{ border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 8, maxHeight: 240, overflowY: "auto" }}>
              {searching ? (
                <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>Searching…</div>
              ) : results.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>
                  {searchQuery ? "No matching brand influencers found" : "No brand influencers are available to promote yet"}
                </div>
              ) : results.map(inf => (
                <div key={inf.id} onClick={() => toggle(inf.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: selectedIds.has(inf.id) ? "#f0faf5" : "transparent", borderBottom: "0.5px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${selectedIds.has(inf.id) ? "#1FAE5B" : "#ccc"}`, background: selectedIds.has(inf.id) ? "#1FAE5B" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>
                    {selectedIds.has(inf.id) ? "✓" : ""}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 12 }}>@{inf.influencer.handle}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{inf.influencer.platform} · {inf.influencer.niche || "—"} · {inf.influencer.location || "—"}</div>
                    <div style={{ fontSize: 10, color: "#aaa" }}>
                      {inf.influencer.follower_count >= 1000 ? (inf.influencer.follower_count / 1000).toFixed(1) + "K" : inf.influencer.follower_count} followers
                      {inf.influencer.engagement_rate ? ` · ${inf.influencer.engagement_rate}% eng` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#888" }}>{selectedIds.size} selected</div>

            {/* Assign tier + Commission % */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#555", fontWeight: 500, marginBottom: 4 }}>
                  Assign tier <span style={{ color: "#aaa", fontWeight: 400 }}>(or auto-suggested)</span>
                </div>
                <select style={fs} value={assignTier} onChange={e => setAssignTier(e.target.value)}>
                  {TIER_OPTIONS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#555", fontWeight: 500, marginBottom: 4 }}>
                  Commission % <span style={{ color: "#aaa", fontWeight: 400 }}>(optional — affiliate only)</span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  style={fs}
                  placeholder="e.g. 15"
                  value={commissionPct}
                  onChange={e => setCommissionPct(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={{ fontSize: 11, color: "#555", fontWeight: 500, marginBottom: 4 }}>Notes <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span></div>
              <textarea style={{ ...fs, minHeight: 60, resize: "vertical" }} placeholder="e.g. Proven performer…" value={searchNotes} onChange={e => setSearchNotes(e.target.value)} />
            </div>
          </>)}

          {/* ── Manual mode ── */}
          {mode === "manual" && (<>
            <div style={{ fontSize: 12, color: "#888" }}>Creates a new influencer record and links them to this brand.</div>

            {/* Row 1: Handle + Platform */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#555", fontWeight: 500, marginBottom: 4 }}>Handle <span style={{ color: "#E24B4A", fontSize: 10 }}>*</span></div>
                <input style={fs} placeholder="@creatorname" value={handle} onChange={e => setHandle(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#555", fontWeight: 500, marginBottom: 4 }}>Platform <span style={{ color: "#E24B4A", fontSize: 10 }}>*</span></div>
                <select style={fs} value={platform} onChange={e => setPlatform(e.target.value)}>
                  <option value="">Select…</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                  <option value="twitter">Twitter/X</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Row 2: Niche + Location */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <TaxonomySelect
                label="Niche"
                required
                value={niche}
                onChange={setNiche}
                options={niches}
                loading={taxonomyLoading}
                adding={addingNiche}
                setAdding={setAddingNiche}
                inputVal={newNicheInput}
                setInputVal={setNewNicheInput}
                inputRef={nicheInputRef}
                onCommit={handleAddNiche}
              />
              <TaxonomySelect
                label="Location"
                required
                value={location}
                onChange={setLocation}
                options={locations}
                loading={taxonomyLoading}
                adding={addingLocation}
                setAdding={setAddingLocation}
                inputVal={newLocationInput}
                setInputVal={setNewLocationInput}
                inputRef={locationInputRef}
                onCommit={handleAddLocation}
              />
            </div>

            {/* Email */}
            <div>
              <div style={{ fontSize: 11, color: "#555", fontWeight: 500, marginBottom: 4 }}>Email <span style={{ color: "#aaa", fontWeight: 400, fontSize: 10 }}>(optional)</span></div>
              <input type="email" style={fs} placeholder="creator@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            {/* Notes */}
            <div>
              <div style={{ fontSize: 11, color: "#555", fontWeight: 500, marginBottom: 4 }}>Notes <span style={{ color: "#aaa", fontWeight: 400, fontSize: 10 }}>(optional)</span></div>
              <textarea style={{ ...fs, minHeight: 60, resize: "vertical" }} placeholder="Relationship context…" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </>)}

          {errMsg  && <div style={{ padding: "8px 12px", background: "#fdecea", border: "0.5px solid #E24B4A", borderRadius: 8, fontSize: 12, color: "#a32d2d" }}>⚠ {errMsg}</div>}
          {success && <div style={{ padding: "8px 12px", background: "#e6f9ee", border: "0.5px solid #1FAE5B", borderRadius: 8, fontSize: 12, color: "#0F6B3E" }}>✓ Partner added successfully!</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "0.5px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.2)", background: "transparent", color: "#555", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || success} style={{ fontSize: 11, padding: "6px 16px", borderRadius: 8, border: "none", background: saving || success ? "#aaa" : "#1FAE5B", color: "#fff", cursor: saving || success ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 500 }}>
            {saving ? "Saving…" : success ? "✓ Saved!" : "+ Add as Brand Partner"}
          </button>
        </div>
      </div>
    </div>
  )
}
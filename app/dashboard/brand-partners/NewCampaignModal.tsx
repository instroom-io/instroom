"use client"

import { useState, useEffect } from "react"

interface Partner {
  id: string
  handle: string
  plat: string
  niche: string
}

interface NewCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  brandId: string
  partners: Partner[]
  onCreated: () => void
}

interface Deliverable { id: string; name: string }

export default function NewCampaignModal({ isOpen, onClose, brandId, partners, onCreated }: NewCampaignModalProps) {
  const [step, setStep]     = useState(0)
  const [search, setSearch] = useState("")

  // Step 1
  const [name,      setName]      = useState("")
  const [type,      setType]      = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [budget,    setBudget]    = useState("")
  const [notes,     setNotes]     = useState("")

  // Step 2
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Step 3
  const [deliverables,   setDeliverables]   = useState<Deliverable[]>([])
  const [newDeliverable, setNewDeliverable] = useState("")
  const [fees, setFees] = useState<Map<string, { deliverables: string[]; fee: number }>>(new Map())

  // Status
  const [saving,  setSaving]  = useState(false)
  const [errMsg,  setErrMsg]  = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setStep(0); setSearch(""); setName(""); setType(""); setStartDate(""); setEndDate("")
      setBudget(""); setNotes(""); setSelectedIds(new Set()); setDeliverables([])
      setNewDeliverable(""); setFees(new Map()); setSaving(false); setErrMsg(null); setSuccess(false)
    }
  }, [isOpen])

  const togglePartner = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id); setFees(f => { const m = new Map(f); m.delete(id); return m }) }
      else           { s.add(id);    setFees(f => { const m = new Map(f); m.set(id, { deliverables: [], fee: 0 }); return m }) }
      return s
    })
  }

  const addDeliverable = () => {
    if (!newDeliverable.trim()) return
    setDeliverables(prev => [...prev, { id: Date.now().toString(), name: newDeliverable.trim() }])
    setNewDeliverable("")
  }

  const toggleDeliverable = (partnerId: string, dName: string, checked: boolean) =>
    setFees(prev => { const m = new Map(prev); const c = m.get(partnerId) || { deliverables: [], fee: 0 }; c.deliverables = checked ? [...c.deliverables, dName] : c.deliverables.filter(d => d !== dName); m.set(partnerId, c); return m })

  const setFee = (partnerId: string, fee: number) =>
    setFees(prev => { const m = new Map(prev); const c = m.get(partnerId) || { deliverables: [], fee: 0 }; m.set(partnerId, { ...c, fee }); return m })

  const handleNext = () => {
    setErrMsg(null)
    if (step === 0) {
      if (!name.trim() || !type || !startDate) { setErrMsg("Campaign name, type and start date are required."); return }
      setStep(1)
    } else if (step === 1) {
      if (selectedIds.size === 0) { setErrMsg("Select at least one partner."); return }
      setStep(2)
    } else {
      handleCreate()
    }
  }

  const handleCreate = async () => {
    setSaving(true); setErrMsg(null)
    try {
      const res = await fetch(`/api/brands/${brandId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description:    notes      || null,
          status:         "draft",
          type:           type       || null,
          budget:         budget     || null,
          start_date:     startDate  || null,
          end_date:       endDate    || null,
          influencer_ids: Array.from(selectedIds),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setErrMsg(json.error || `Error ${res.status}`); setSaving(false); return }

      const campaignId = json.data?.id
      if (!campaignId) { setErrMsg("Campaign created but ID not returned."); setSaving(false); return }

      for (const [partnerId, data] of Array.from(fees.entries())) {
        if (data.fee > 0 || data.deliverables.length > 0) {
          await fetch(`/api/brands/${brandId}/partners/${partnerId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campaign_id:  campaignId,
              agreed_rate:  data.fee > 0          ? data.fee                          : undefined,
              deliverables: data.deliverables.length > 0 ? data.deliverables.join(", ") : undefined,
            }),
          }).catch(() => {/* non-fatal */})
        }
      }

      setSuccess(true)
      setTimeout(() => { onCreated(); onClose() }, 700)
    } catch (e: any) {
      setErrMsg(e.message || "Unexpected error.")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const filtered = search
    ? partners.filter(p => `${p.handle} ${p.niche} ${p.plat}`.toLowerCase().includes(search.toLowerCase()))
    : partners

  const selectedList = Array.from(selectedIds).map(id => partners.find(p => p.id === id)).filter(Boolean) as Partner[]

  const fs: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 8,
    border: "0.5px solid rgba(0,0,0,0.15)", fontSize: 12,
    fontFamily: "inherit", boxSizing: "border-box",
  }

  const STEPS = ["Details", "Select partners", "Deliverables & fees"]

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 700, maxWidth: "90%", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>New Campaign</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Saved as Draft</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#888", cursor: "pointer" }}>×</button>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "16px 24px", background: "#fafaf9", borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {i > 0 && <div style={{ width: 40, height: 1, background: "#ddd" }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: step === i ? "#1FAE5B" : "#aaa", fontSize: 12 }}>
                <div style={{ width: 26, height: 26, borderRadius: 13, background: step === i ? "#1FAE5B" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: step === i ? "#fff" : "#666" }}>{i + 1}</div>
                <span>{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>

          {/* Step 1 */}
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Campaign name <span style={{ color: "#E24B4A" }}>*</span></div>
                  <input style={fs} placeholder="e.g. Black Friday 2026" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Type <span style={{ color: "#E24B4A" }}>*</span></div>
                  <select style={fs} value={type} onChange={e => setType(e.target.value)}>
                    <option value="">Select…</option>
                    <option>Gifting</option>
                    <option>Paid</option>
                    <option>Affiliate</option>
                    <option>Paid + Gifting</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Start date <span style={{ color: "#E24B4A" }}>*</span></div>
                  <input type="date" style={fs} value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 5 }}>End date <span style={{ fontSize: 10, color: "#888", fontWeight: 400 }}>(blank = open-ended)</span></div>
                  <input type="date" style={fs} value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Budget <span style={{ fontSize: 10, color: "#888", fontWeight: 400 }}>(optional)</span></div>
                <input type="number" style={fs} placeholder="0" value={budget} onChange={e => setBudget(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Goals / notes <span style={{ fontSize: 10, color: "#888", fontWeight: 400 }}>(optional)</span></div>
                <textarea style={{ ...fs, minHeight: 70, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: "#888" }}>Select which brand partners to include in this campaign.</div>
              <input style={fs} placeholder="Search partners…" value={search} onChange={e => setSearch(e.target.value)} />
              <div style={{ border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 8, maxHeight: 300, overflowY: "auto" }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>No partners found</div>
                ) : filtered.map(p => (
                  <div key={p.id} onClick={() => togglePartner(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: selectedIds.has(p.id) ? "#f0faf5" : "transparent", borderBottom: "0.5px solid rgba(0,0,0,0.04)" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${selectedIds.has(p.id) ? "#1FAE5B" : "#ccc"}`, background: selectedIds.has(p.id) ? "#1FAE5B" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>
                      {selectedIds.has(p.id) ? "✓" : ""}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 12 }}>{p.handle}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{p.plat} · {p.niche}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>{selectedIds.size} selected</div>
            </div>
          )}

          {/* Step 3 */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Deliverables</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {deliverables.map(d => (
                    <span key={d.id} style={{ background: "#f0f0f0", padding: "3px 10px", borderRadius: 16, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {d.name}
                      <button onClick={() => setDeliverables(p => p.filter(x => x.id !== d.id))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...fs, flex: 1 }} placeholder="e.g. 1x IG Reel" value={newDeliverable} onChange={e => setNewDeliverable(e.target.value)} onKeyDown={e => e.key === "Enter" && addDeliverable()} />
                  <button onClick={addDeliverable} style={{ padding: "6px 14px", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.2)", background: "transparent", fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Add</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>Per-creator fees</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "0.5px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, color: "#666", fontWeight: 600 }}>Creator</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, color: "#666", fontWeight: 600 }}>Deliverables</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, color: "#666", fontWeight: 600 }}>Agreed fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedList.map(p => {
                      const d = fees.get(p.id)
                      return (
                        <tr key={p.id} style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                          <td style={{ padding: "8px", fontWeight: 500 }}>{p.handle}</td>
                          <td style={{ padding: "8px" }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {deliverables.map(dl => (
                                <label key={dl.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, cursor: "pointer" }}>
                                  <input type="checkbox" checked={d?.deliverables.includes(dl.name) || false} onChange={e => toggleDeliverable(p.id, dl.name, e.target.checked)} />
                                  {dl.name}
                                </label>
                              ))}
                              {deliverables.length === 0 && <span style={{ fontSize: 11, color: "#aaa" }}>Add deliverables above</span>}
                            </div>
                          </td>
                          <td style={{ padding: "8px" }}>
                            <input type="number" style={{ ...fs, width: 110 }} placeholder="$0" value={d?.fee || ""} onChange={e => setFee(p.id, parseFloat(e.target.value) || 0)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {errMsg  && <div style={{ marginTop: 12, padding: "8px 12px", background: "#fdecea", border: "0.5px solid #E24B4A", borderRadius: 8, fontSize: 12, color: "#a32d2d" }}>⚠ {errMsg}</div>}
          {success && <div style={{ marginTop: 12, padding: "8px 12px", background: "#e6f9ee", border: "0.5px solid #1FAE5B", borderRadius: 8, fontSize: 12, color: "#0F6B3E" }}>✓ Campaign created!</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "0.5px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ padding: "7px 16px", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.2)", background: "transparent", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#888" }}>Will save as Draft</span>
            <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.2)", background: "transparent", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={handleNext} disabled={saving || success} style={{ padding: "7px 20px", borderRadius: 8, border: "none", background: saving || success ? "#aaa" : "#1FAE5B", color: "#fff", fontSize: 12, fontWeight: 500, cursor: saving || success ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {saving ? "Saving…" : success ? "✓ Saved!" : step === 2 ? "Save Draft →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
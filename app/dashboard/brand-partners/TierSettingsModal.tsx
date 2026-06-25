"use client"

import { useState, useEffect } from "react"

interface TierSettings {
  bronzeMin: number
  bronzeMax: number
  silverMin: number
  silverMax: number
  goldMin: number
}

interface TierSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (settings: TierSettings) => void
  initialSettings?: TierSettings
  brandId: string
}

export default function TierSettingsModal({
  isOpen,
  onClose,
  onSave,
  initialSettings = { bronzeMin: 0, bronzeMax: 2000, silverMin: 2001, silverMax: 10000, goldMin: 10001 },
  brandId,
}: TierSettingsModalProps) {
  const [bronzeMin, setBronzeMin] = useState(initialSettings.bronzeMin)
  const [bronzeMax, setBronzeMax] = useState(initialSettings.bronzeMax)
  const [silverMin, setSilverMin] = useState(initialSettings.silverMin)
  const [silverMax, setSilverMax] = useState(initialSettings.silverMax)
  const [goldMin, setGoldMin] = useState(initialSettings.goldMin)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setBronzeMin(initialSettings.bronzeMin)
      setBronzeMax(initialSettings.bronzeMax)
      setSilverMin(initialSettings.silverMin)
      setSilverMax(initialSettings.silverMax)
      setGoldMin(initialSettings.goldMin)
      setSaveError(null)
    }
  }, [isOpen, initialSettings])

  // Auto-adjust ranges when values change
  const handleBronzeMaxChange = (value: number) => {
    setBronzeMax(value)
    setSilverMin(value + 1)
  }

  const handleSilverMaxChange = (value: number) => {
    setSilverMax(value)
    setGoldMin(value + 1)
  }

  const handleSilverMinChange = (value: number) => {
    setSilverMin(value)
    setBronzeMax(value - 1)
  }

  const handleGoldMinChange = (value: number) => {
    setGoldMin(value)
    setSilverMax(value - 1)
  }

  const isInvalid = bronzeMax >= silverMin || silverMax >= goldMin

  const handleSave = async () => {
    if (isInvalid) return
    setSaving(true)
    setSaveError(null)

    try {
      const res = await fetch(`/api/brand/brand-tier-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          bronze_max: bronzeMax,
          silver_max: silverMax,
          gold_min: goldMin,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `Server error ${res.status}`)
      }

      onSave({ bronzeMin, bronzeMax, silverMin, silverMax, goldMin })
      onClose()
    } catch (e: any) {
      setSaveError(e.message || "Failed to save tier settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`mo ${isOpen ? "open" : ""}`} onClick={onClose}>
      <div className="md" onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <div>
            <div className="mt">Tier Settings</div>
            <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
              Auto-assign tiers based on cumulative revenue. You can always override manually.
            </div>
          </div>
          <button className="mc" onClick={onClose}>×</button>
        </div>

        <div className="mb">
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>
            Partners are automatically tiered by their total revenue generated.
            Customize your revenue thresholds below:
          </div>

          <div style={{ background: "#f7f9f8", borderRadius: "8px", padding: "12px", marginBottom: "14px" }}>
            {/* Header */}
            <div className="tier-header">
              <span style={{ fontSize: "10px", color: "#888", fontWeight: "600", width: "80px" }}>TIER</span>
              <span style={{ fontSize: "10px", color: "#888", fontWeight: "600", flex: 1 }}>MIN REVENUE</span>
              <span style={{ fontSize: "10px", color: "#888", fontWeight: "600", flex: 1 }}>MAX REVENUE</span>
            </div>

            {/* Bronze Tier */}
            <div className="tier-row">
              <span className="tier-label" style={{ color: "#cd7f32" }}>🥉 Bronze</span>
              <input
                className="tier-input"
                type="number"
                value={bronzeMin}
                onChange={(e) => setBronzeMin(parseInt(e.target.value) || 0)}
                placeholder="Min"
              />
              <input
                className="tier-input"
                type="number"
                value={bronzeMax}
                onChange={(e) => handleBronzeMaxChange(parseInt(e.target.value) || 0)}
                placeholder="Max"
              />
            </div>

            {/* Silver Tier */}
            <div className="tier-row">
              <span className="tier-label" style={{ color: "#888" }}>🥈 Silver</span>
              <input
                className="tier-input"
                type="number"
                value={silverMin}
                onChange={(e) => handleSilverMinChange(parseInt(e.target.value) || 0)}
                placeholder="Min"
              />
              <input
                className="tier-input"
                type="number"
                value={silverMax}
                onChange={(e) => handleSilverMaxChange(parseInt(e.target.value) || 0)}
                placeholder="Max"
              />
            </div>

            {/* Gold Tier */}
            <div className="tier-row">
              <span className="tier-label" style={{ color: "#854F0B" }}>🥇 Gold</span>
              <input
                className="tier-input"
                type="number"
                value={goldMin}
                onChange={(e) => handleGoldMinChange(parseInt(e.target.value) || 0)}
                placeholder="Min"
              />
              <span style={{ fontSize: "11px", color: "#888", padding: "6px 10px", background: "#fff", borderRadius: "7px", border: "0.5px solid rgba(0,0,0,0.15)" }}>
                No limit
              </span>
            </div>
          </div>

          {/* Validation Warning */}
          {isInvalid && (
            <div
              style={{
                fontSize: "11px",
                color: "#E24B4A",
                padding: "10px",
                background: "#fff5f5",
                borderRadius: "8px",
                border: "0.5px solid #E24B4A",
                marginBottom: "14px",
              }}
            >
              ⚠️ Tier ranges should not overlap. Please ensure each tier has a unique revenue range.
            </div>
          )}

          {/* Save Error */}
          {saveError && (
            <div
              style={{
                fontSize: "11px",
                color: "#E24B4A",
                padding: "10px",
                background: "#fff5f5",
                borderRadius: "8px",
                border: "0.5px solid #E24B4A",
                marginBottom: "14px",
              }}
            >
              ⚠️ {saveError}
            </div>
          )}

          {/* Info Banner */}
          <div
            style={{
              fontSize: "11px",
              color: "#888",
              padding: "10px",
              background: "#fffbeb",
              borderRadius: "8px",
              border: "0.5px solid #F4B740",
            }}
          >
            💡 Tiers update automatically when a partner's revenue crosses a threshold.
            You can always override a partner's tier manually by clicking their tier badge.
          </div>
        </div>

        <div className="mf">
          <button className="btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || isInvalid}
            style={{ opacity: saving || isInvalid ? 0.6 : 1, cursor: saving || isInvalid ? "not-allowed" : "pointer" }}
          >
            {saving ? "Saving…" : "Save thresholds"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .mo {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          z-index: 600;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .mo.open { display: flex; }
        .md {
          background: #fff;
          border-radius: 14px;
          width: 580px;
          max-width: 90%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
        }
        .mh {
          padding: 18px 20px 14px;
          border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }
        .mt { font-size: 15px; font-weight: 600; color: #1e1e1e; }
        .mc { background: none; border: none; font-size: 20px; color: #888; cursor: pointer; }
        .mb { padding: 20px; overflow-y: auto; flex: 1; }
        .mf {
          padding: 14px 20px;
          border-top: 0.5px solid rgba(0, 0, 0, 0.08);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .btn-outline {
          font-size: 11px;
          padding: 6px 14px;
          border-radius: 8px;
          border: 0.5px solid rgba(0, 0, 0, 0.2);
          background: transparent;
          color: #555;
          cursor: pointer;
        }
        .btn-primary {
          font-size: 11px;
          padding: 6px 14px;
          border-radius: 8px;
          border: none;
          background: #1fae5b;
          color: #fff;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-primary:hover:not(:disabled) { background: #0f6b3e; }
        .tier-header {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
        }
        .tier-row { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
        .tier-label { font-size: 12px; font-weight: 600; width: 80px; }
        .tier-input {
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 7px;
          border: 0.5px solid rgba(0, 0, 0, 0.15);
          width: 100%;
          flex: 1;
        }
        .tier-input:focus { outline: none; border-color: #1fae5b; }
      `}</style>
    </div>
  )
}
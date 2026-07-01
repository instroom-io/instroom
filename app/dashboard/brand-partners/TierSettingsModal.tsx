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
  brandId: string
}

export default function TierSettingsModal({
  isOpen,
  onClose,
  onSave,
  brandId,
}: TierSettingsModalProps) {
  const [bronzeMin] = useState(0)
  const [bronzeMax, setBronzeMax] = useState(2000)
  const [silverMin, setSilverMin] = useState(2001)
  const [silverMax, setSilverMax] = useState(10000)
  const [goldMin, setGoldMin] = useState(10001)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !brandId) return

    const fetchSettings = async () => {
      setLoading(true)
      setSaveError(null)
      try {
        const res = await fetch(`/api/brands/${brandId}/tier-settings`)
        if (!res.ok) throw new Error("Failed to load tier settings")
        const { data } = await res.json()

        const bMax = Number(data.bronze_max)
        const sMax = Number(data.silver_max)

        setBronzeMax(bMax)
        setSilverMin(bMax + 1)
        setSilverMax(sMax)
        setGoldMin(sMax + 1)
      } catch (e: any) {
        setSaveError(e.message || "Failed to load tier settings")
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [isOpen, brandId])

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
      const res = await fetch(`/api/brands/${brandId}/tier-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bronze_max: bronzeMax,
          silver_max: silverMax,
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

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/45 p-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-[580px] max-w-[90%] max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-black/[0.08]">
          <div>
            <div className="text-[15px] font-semibold text-[#1e1e1e]">Tier Settings</div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Auto-assign tiers based on cumulative revenue. You can always override manually.
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xl text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-10 text-[13px] text-gray-400">
              Loading tier settings…
            </div>
          ) : (
            <>
              <p className="text-[12px] text-gray-400 mb-3">
                Partners are automatically tiered by their total revenue generated.
                Customize your revenue thresholds below:
              </p>

              <div className="bg-[#f7f9f8] rounded-xl p-3 mb-4">
                {/* Column Headers */}
                <div className="flex gap-2.5 items-center mb-3 pb-2 border-b border-black/10">
                  <span className="text-[10px] text-gray-400 font-semibold w-20">TIER</span>
                  <span className="text-[10px] text-gray-400 font-semibold flex-1">MIN REVENUE</span>
                  <span className="text-[10px] text-gray-400 font-semibold flex-1">MAX REVENUE</span>
                </div>

                {/* Bronze */}
                <div className="flex gap-2.5 items-center mb-3">
                  <span className="text-[12px] font-semibold w-20 text-[#cd7f32]">🥉 Bronze</span>
                  <input
                    type="number"
                    value={bronzeMin}
                    disabled
                    className="flex-1 text-[12px] px-2.5 py-1.5 rounded-lg border border-black/15 bg-[#f0f0f0] text-gray-400 cursor-not-allowed"
                  />
                  <input
                    type="number"
                    value={bronzeMax}
                    onChange={(e) => handleBronzeMaxChange(parseInt(e.target.value) || 0)}
                    className="flex-1 text-[12px] px-2.5 py-1.5 rounded-lg border border-black/15 focus:outline-none focus:border-[#1fae5b]"
                  />
                </div>

                {/* Silver */}
                <div className="flex gap-2.5 items-center mb-3">
                  <span className="text-[12px] font-semibold w-20 text-gray-500">🥈 Silver</span>
                  <input
                    type="number"
                    value={silverMin}
                    onChange={(e) => handleSilverMinChange(parseInt(e.target.value) || 0)}
                    className="flex-1 text-[12px] px-2.5 py-1.5 rounded-lg border border-black/15 focus:outline-none focus:border-[#1fae5b]"
                  />
                  <input
                    type="number"
                    value={silverMax}
                    onChange={(e) => handleSilverMaxChange(parseInt(e.target.value) || 0)}
                    className="flex-1 text-[12px] px-2.5 py-1.5 rounded-lg border border-black/15 focus:outline-none focus:border-[#1fae5b]"
                  />
                </div>

                {/* Gold */}
                <div className="flex gap-2.5 items-center">
                  <span className="text-[12px] font-semibold w-20 text-[#854F0B]">🥇 Gold</span>
                  <input
                    type="number"
                    value={goldMin}
                    onChange={(e) => handleGoldMinChange(parseInt(e.target.value) || 0)}
                    className="flex-1 text-[12px] px-2.5 py-1.5 rounded-lg border border-black/15 focus:outline-none focus:border-[#1fae5b]"
                  />
                  <div className="flex-1 text-[11px] text-gray-400 px-2.5 py-1.5 bg-white rounded-lg border border-black/15 text-center">
                    No limit
                  </div>
                </div>
              </div>

              {/* Validation Warning */}
              {isInvalid && (
                <div className="text-[11px] text-red-500 px-3 py-2.5 bg-red-50 rounded-lg border border-red-400 mb-4">
                  ⚠️ Tier ranges should not overlap. Please ensure each tier has a unique revenue range.
                </div>
              )}

              {/* Save Error */}
              {saveError && (
                <div className="text-[11px] text-red-500 px-3 py-2.5 bg-red-50 rounded-lg border border-red-400 mb-4">
                  ⚠️ {saveError}
                </div>
              )}

              {/* Info Banner */}
              <div className="text-[11px] text-gray-400 px-3 py-2.5 bg-yellow-50 rounded-lg border border-yellow-300">
                💡 Tiers update automatically when a partner's revenue crosses a threshold.
                You can always override a partner's tier manually by clicking their tier badge.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-black/[0.08]">
          <button
            onClick={onClose}
            disabled={saving || loading}
            className="text-[11px] px-4 py-1.5 rounded-lg border border-black/20 bg-transparent text-gray-500 cursor-pointer hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || isInvalid}
            className="text-[11px] px-4 py-1.5 rounded-lg border-none bg-[#1fae5b] text-white cursor-pointer hover:bg-[#0f6b3e] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save thresholds"}
          </button>
        </div>
      </div>
    </div>
  )
}
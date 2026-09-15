"use client"

import { useState } from "react"
import { IconX } from "@tabler/icons-react"
import { DECLINE_REASONS } from "@/lib/decline-reasons"

/**
 * The one decline modal.
 *
 * Declining an influencer is a single decision with a single vocabulary, so the
 * Pipeline board ("Mark as not interested") and the Influencer List ("Decline")
 * both render THIS component over the shared reason list in
 * lib/decline-reasons.ts. It used to be a Pipeline-only component, with the
 * Influencer List showing its own free-text box — which recorded reasons
 * Analytics could not bucket and let a decline through with no reason at all.
 *
 * It takes the influencer as plain fields rather than a PipelineInfluencer so
 * the Influencer List's row shape can pass its own values without a conversion
 * layer.
 */
export interface DeclineModalProps {
  name: string
  handle?: string
  profileImageUrl?: string | null
  /** Receives the chosen reason text, exactly as stored in `approval_notes`. */
  onConfirm: (reason: string) => void
  onCancel: () => void
  /** Set when the modal drives a bulk move — the single-influencer card is
   *  swapped for a "N influencers" summary and one reason applies to all. */
  bulkCount?: number
  /**
   * Stacking level, for the callers that open this over something already
   * lifted above the normal `z-50` layer.
   *
   * The Influencer List's profile sidebar is an inline-styled panel at
   * zIndex 500, so the modal opened FROM that sidebar rendered behind it — the
   * sidebar stayed visible on the right, over the reason columns. Those call
   * sites pass a level above the sidebar; the Pipeline board keeps the default
   * so it stays in step with its own overlays.
   */
  zIndex?: number
}

export function DeclineModal({ name, handle, profileImageUrl, onConfirm, onCancel, bulkCount, zIndex }: DeclineModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const hardReasons = DECLINE_REASONS.filter((r) => r.bucket === "hard")
  const softReasons = DECLINE_REASONS.filter((r) => r.bucket === "soft")
  const initials = (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const selected = DECLINE_REASONS.find((r) => r.r === selectedReason)

  // Same shell, padding rhythm and footer as the Collaboration Type ("Deal
  // Agreed") modal; the card scrolls when the two reason columns run long.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4" style={zIndex !== undefined ? { zIndex } : undefined} onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-[760px] max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Mark as not interested</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {bulkCount
                ? `Select the reason to apply to all ${bulkCount} selected influencers.`
                : "Select the reason why this influencer declined or is not moving forward."}
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition ml-4 mt-0.5"><IconX size={18} /></button>
        </div>

        {/* Influencer Info */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2">
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-xl px-3 sm:px-4 py-3 border border-gray-100">
            {bulkCount ? (
              <>
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-semibold text-sm">{bulkCount}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{bulkCount} influencers selected</p>
                  <p className="text-xs text-gray-500">The reason below applies to all of them</p>
                </div>
              </>
            ) : (
              <>
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt={name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-semibold text-sm">{initials}</div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{name}</p>
                  {handle && <p className="text-xs text-gray-500">{handle}</p>}
                </div>
              </>
            )}
            {selected && (
              <div className="ml-auto text-right">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Selected reason</p>
                <div className="flex items-center justify-end gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: selected.color }} />
                  <span className="text-sm font-semibold text-gray-900">{selected.r}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {selected.bucket === "soft"
                    ? "Can be re-approached in a future campaign"
                    : "Should not be contacted again soon"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reasons */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Reason</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-700">Hard pass</span>
                <span className="text-[10px] text-gray-400">&mdash; don&apos;t reach out soon</span>
              </div>
              <div className="flex flex-col gap-2">
                {hardReasons.map((reason) => (
                  <button key={reason.r} onClick={() => setSelectedReason(reason.r)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all w-full ${selectedReason === reason.r ? "border-red-400 bg-red-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"}`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: reason.color }} />
                    <span className="text-sm text-gray-700 flex-1 leading-snug">{reason.r}</span>
                    {selectedReason === reason.r && (
                      <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Soft pass</span>
                <span className="text-[10px] text-gray-400">&mdash; follow up next campaign</span>
              </div>
              <div className="flex flex-col gap-2">
                {softReasons.map((reason) => (
                  <button key={reason.r} onClick={() => setSelectedReason(reason.r)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all w-full ${selectedReason === reason.r ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"}`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: reason.color }} />
                    <span className="text-sm text-gray-700 flex-1 leading-snug">{reason.r}</span>
                    {selectedReason === reason.r && (
                      <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer — caption on the left, actions on the right */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <span className="text-[11px] text-gray-400">
            This marks the influencer as Not Interested and removes them from the active pipeline
          </span>
          <div className="flex items-center justify-end gap-2">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition bg-white">Cancel</button>
            <button onClick={() => selectedReason && onConfirm(selectedReason)} disabled={!selectedReason}
              className="px-4 sm:px-6 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeclineModal

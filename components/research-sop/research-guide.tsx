"use client"

// The Research guide: a researcher opens it from an influencer's profile and
// reads the team's published SOPs while researching that influencer.
//
// Read-only documentation. It shows the procedure; it does not run anything,
// fill any field or save anything.

import { useEffect, useState } from "react"
import { FileSearch, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { SopDocument, type SopDocumentData } from "./sop-document"

type GuideSop = SopDocumentData & { id: string; status: string }

export function ResearchGuideModal({
  brandId,
  influencerLabel,
  onClose,
}: {
  brandId: string
  /** Shown in the header, e.g. "@handle", so it's clear who is being researched. */
  influencerLabel: string
  onClose: () => void
}) {
  const [sops, setSops] = useState<GuideSop[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/brand/${brandId}/research-sops`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return
        // Nothing set up yet reads the same as nothing published: an empty guide.
        if (j.notReady) { setSops([]); return }
        if (!ok) { setMessage("Couldn't load the research guide. Please try again."); setSops([]); return }
        // Only published procedures are shown to researchers.
        setSops((j.data as GuideSop[]).filter((s) => s.status === "active"))
      })
      .catch(() => { if (!cancelled) { setMessage("Couldn't load the research guide. Please try again."); setSops([]) } })
    return () => { cancelled = true }
  }, [brandId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const selected = sops?.find((s) => s.id === selectedId) ?? sops?.[0] ?? null

  return (
    // Above the profile drawer (z-index 500).
    <div className="fixed inset-0 z-[600] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Research guide"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:w-[640px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Research guide</p>
            <p className="truncate text-[11px] text-gray-500">Follow your team&apos;s procedure while researching {influencerLabel}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {sops === null ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading research guide">
              <Skeleton className="h-4 w-1/2 bg-gray-100" />
              <Skeleton className="h-3 w-3/4 bg-gray-100" />
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg bg-gray-100" />)}
            </div>
          ) : !selected ? (
            message ? (
              <p className="py-8 text-center text-sm text-gray-500">{message}</p>
            ) : (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#1FAE5B]/10">
                  <FileSearch className="h-5 w-5 text-[#0F6B3E]" />
                </div>
                <p className="text-sm font-semibold text-gray-900">No research guide yet</p>
                <p className="mt-1 max-w-sm text-[13px] text-gray-500">
                  Once your team publishes an SOP, the step-by-step research procedure will show up here.
                </p>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-4">
              {sops.length > 1 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Procedure</label>
                  <select
                    value={selected.id}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]"
                  >
                    {sops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <SopDocument key={selected.id} sop={selected} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

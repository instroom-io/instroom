"use client"

// components/save-status-pill.tsx
//
// The small pill that sits in a dashboard's bottom-right dock (`.notice-dock`,
// app/globals.css) while a save is happening:
//
//   ◌ Saving changes…   a write is in flight RIGHT NOW
//   ✓ Saved             that write came back OK — shown briefly, then it goes
//   (nothing)           idle, or the write failed
//
// The processing wording is standardised app-wide: "Saving changes…" is the
// default for a save or update, and a caller passes an action-specific line
// only where the operation is not a plain save — "Adding…", "Removing…",
// "Updating…" for a bulk status/stage move, "Updating profile…" for an
// enrichment. The success wording stays with the page's own notification, so
// the two are never saying the same thing twice.
//
// One component for the Influencer List, the Pipeline board, the Post Tracker
// and Brand Partners, for the same reason DataSyncStatus is one component: the
// markup used to be copy-pasted into each of them, so the geometry and the
// wording could — and did — drift apart between screens.
//
// It reports the REAL request, not a timer someone started on mount: `saving`
// is the caller's own in-flight flag, and "Saved" is only ever reached by that
// flag falling back to false without `failed` being set. A failed save shows
// nothing here; the outcome the user has to act on belongs in the page's
// notification (`.notice-dock-top`), which this deliberately does not touch.

import { useEffect, useRef, useState } from "react"
import { IconCheck, IconLoader2 } from "@tabler/icons-react"

/** How long "Saved" stays up once a write lands. */
const SAVED_VISIBLE_MS = 1600

/** What a plain save or update says. Every other wording is opt-in. */
export const DEFAULT_SAVING_MESSAGE = "Saving changes…"

export function SaveStatusPill({
  saving,
  failed = false,
  message = DEFAULT_SAVING_MESSAGE,
}: {
  /** True while a write is in flight. */
  saving: boolean
  /**
   * What the pill says while the write is in flight. Defaults to
   * "Saving changes…" — pass one of the action-specific lines above only when
   * the operation is not a plain save.
   */
  message?: string
  /**
   * True when the write that just finished failed, so "Saved" is skipped.
   * Read only on the moment `saving` goes false; pages that keep a persistent
   * error flag can leave it set afterwards without pinning the pill open.
   */
  failed?: boolean
}) {
  const [showSaved, setShowSaved] = useState(false)
  const wasSaving = useRef(false)
  // Read inside the effect below rather than listed as a dependency, so a page
  // clearing its error flag later cannot re-trigger a "Saved".
  const failedRef = useRef(failed)
  failedRef.current = failed

  useEffect(() => {
    if (saving) {
      // A new write supersedes the previous confirmation.
      setShowSaved(false)
      wasSaving.current = true
      return
    }
    if (!wasSaving.current) return
    wasSaving.current = false
    if (failedRef.current) return

    setShowSaved(true)
    const timer = setTimeout(() => setShowSaved(false), SAVED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [saving])

  if (!saving && !showSaved) return null

  return (
    <div
      // Glass-black: dark translucent ground, blurred backdrop, hairline border
      // and white text — the one processing treatment across every screen.
      // Geometry (gap, padding, radius, type scale, entrance) is unchanged, so
      // it still sits exactly where the dock has always put it.
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white text-xs font-medium shadow-lg animate-in fade-in"
      // Announced politely: it changes on its own and must not interrupt.
      aria-live="polite"
    >
      {saving ? (
        <>
          <IconLoader2 size={12} className="animate-spin" />
          {message}
        </>
      ) : (
        <>
          <IconCheck size={12} />
          Saved
        </>
      )}
    </div>
  )
}

"use client"
// A modal confirmation, used for the two actions in Community that throw
// something away: disconnecting the brand's server, and unlinking your own
// Discord account.
//
// Both are recoverable — you can reconnect either at any time — so this is a
// speed bump against a misclick, not a scare screen. That is why the body text
// says what will happen and that it's reversible, and why the destructive
// button is red but not shouty.
//
// Behaviour that matters and is easy to get wrong:
//   • Cancel is focused on open, so Enter dismisses rather than confirms.
//   • Escape and a backdrop click both cancel, but only while not busy —
//     dismissing mid-request would leave the user unsure whether it happened.
//   • Focus is restored to whatever opened the dialog on close.

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { IconLoader2, IconAlertTriangle } from "@tabler/icons-react"

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  busyLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  /** Request in flight — buttons lock and the dialog can't be dismissed. */
  busy?: boolean
  busyLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    // rAF: the node isn't focusable until the enter animation has mounted it.
    const id = requestAnimationFrame(() => cancelRef.current?.focus())
    return () => {
      cancelAnimationFrame(id)
      restoreRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, busy, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => !busy && onCancel()}
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
            aria-hidden
          />

          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-body"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[400px] rounded-2xl bg-white p-5 shadow-2xl shadow-gray-900/20"
          >
            <div className="flex gap-3.5">
              <span
                aria-hidden
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500"
              >
                <IconAlertTriangle size={18} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="confirm-title" className="text-[14.5px] font-semibold text-gray-900">
                  {title}
                </h2>
                <p id="confirm-body" className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500">
                  {body}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="h-9 rounded-lg border border-gray-200 px-3.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-70"
              >
                {busy && <IconLoader2 size={14} className="animate-spin" aria-hidden />}
                {busy ? busyLabel ?? confirmLabel : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

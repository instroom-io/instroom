"use client"
// The poll-creation modal, opened from the composer's attach menu.
//
// Same modal shell ConfirmDialog already established (backdrop, escape to
// close, focus restored on close) — a poll's own question/options fields are
// the only thing genuinely new here.
//
// Split into an outer shell (always mounted, owns `open`/backdrop/escape) and
// an inner PollForm rendered ONLY while open. That split is what resets the
// fields to blank on every open with no reset effect: PollForm's useState
// only exists while it is actually mounted, so a fresh mount is a fresh form
// by construction — there is no state on a closed modal that would need
// resetting when it opens again.

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { IconLoader2, IconX, IconPlus, IconGripVertical, IconListDetails } from "@tabler/icons-react"

const MAX_OPTIONS = 10
const MIN_OPTIONS = 2

export type NewPoll = {
  question: string
  answers: string[]
  allowMultiselect: boolean
  durationHours: number
}

export function PollComposer({
  open,
  channelName,
  busy = false,
  onSubmit,
  onCancel,
}: {
  open: boolean
  channelName: string | null
  busy?: boolean
  onSubmit: (poll: NewPoll) => void
  onCancel: () => void
}) {
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    return () => restoreRef.current?.focus?.()
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
          <PollForm channelName={channelName} busy={busy} onSubmit={onSubmit} onCancel={onCancel} />
        </div>
      )}
    </AnimatePresence>
  )
}

/** The actual form. Mounted only while the shell above has `open`, which is
 *  what gives every open a blank form — see the module comment. */
function PollForm({
  channelName,
  busy,
  onSubmit,
  onCancel,
}: {
  channelName: string | null
  busy: boolean
  onSubmit: (poll: NewPoll) => void
  onCancel: () => void
}) {
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState<string[]>(["", ""])
  const [allowMultiselect, setAllowMultiselect] = useState(false)
  const [durationHours, setDurationHours] = useState(24)
  const questionRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => questionRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  const validOptions = options.map((o) => o.trim()).filter(Boolean)
  const canSubmit = question.trim().length > 0 && validOptions.length >= MIN_OPTIONS && !busy

  const setOption = (i: number, value: string) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)))
  }
  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return
    setOptions((prev) => [...prev, ""])
  }
  const removeOption = (i: number) => {
    setOptions((prev) => (prev.length <= MIN_OPTIONS ? prev : prev.filter((_, idx) => idx !== i)))
  }

  const submit = () => {
    if (!canSubmit) return
    onSubmit({ question: question.trim(), answers: validOptions, allowMultiselect, durationHours })
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="poll-composer-title"
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex max-h-[85vh] w-full max-w-[420px] flex-col rounded-2xl bg-white shadow-2xl shadow-gray-900/20"
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <IconListDetails size={17} className="text-[#0F6B3E]" aria-hidden />
          <h2 id="poll-composer-title" className="text-[14px] font-semibold text-gray-900">
            Create a poll
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {channelName && <p className="mb-3 text-[11.5px] text-gray-400">Posting in #{channelName}</p>}

        <label className="mb-1 block text-[11.5px] font-medium text-gray-500">Question</label>
        <input
          ref={questionRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="What should we call the new feature?"
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-800 outline-none focus:border-[#0F6B3E]/40"
        />

        <label className="mb-1 block text-[11.5px] font-medium text-gray-500">Options</label>
        <div className="flex flex-col gap-1.5">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <IconGripVertical size={14} className="flex-shrink-0 text-gray-300" aria-hidden />
              <input
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                maxLength={55}
                placeholder={`Option ${i + 1}`}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] text-gray-800 outline-none focus:border-[#0F6B3E]/40"
              />
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  aria-label={`Remove option ${i + 1}`}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <IconX size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={addOption}
            className="mt-2 flex items-center gap-1 text-[12px] font-medium text-[#0F6B3E] hover:underline"
          >
            <IconPlus size={13} /> Add option
          </button>
        )}

        <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <span className="text-[12.5px] text-gray-700">Allow multiple choices</span>
          <button
            type="button"
            onClick={() => setAllowMultiselect((v) => !v)}
            role="switch"
            aria-checked={allowMultiselect}
            className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
              allowMultiselect ? "bg-[#0F6B3E]" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                allowMultiselect ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-[11.5px] font-medium text-gray-500">Duration</label>
          <select
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] text-gray-800 outline-none focus:border-[#0F6B3E]/40"
          >
            <option value={1}>1 hour</option>
            <option value={8}>8 hours</option>
            <option value={24}>1 day</option>
            <option value={72}>3 days</option>
            <option value={168}>1 week</option>
            <option value={768}>32 days (maximum)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="flex items-center gap-1.5 rounded-lg bg-[#0F6B3E] px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#0a5a2f] disabled:opacity-40"
        >
          {busy && <IconLoader2 size={13} className="animate-spin" />}
          {busy ? "Posting…" : "Create poll"}
        </button>
      </div>
    </motion.div>
  )
}

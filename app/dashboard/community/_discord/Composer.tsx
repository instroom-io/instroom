"use client"

import { useRef, useEffect, useState, useCallback, useMemo, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconSend, IconLoader2, IconPlus, IconMoodSmile, IconX, IconFile,
  IconCornerUpLeft, IconLock, IconListDetails,
} from "@tabler/icons-react"
import { EmojiPicker } from "@/components/shared/emoji-picker"
import type { Member, Message } from "./types"

/** Discord's own hard limit; the attribution prefix eats into it server-side. */
const MAX_LENGTH = 1900
const MAX_FILES = 10

export type PendingFile = { id: string; file: File; previewUrl: string | null }

/* ── Attachment tray ──────────────────────────────────────────────────────── */

const FileChip = memo(function FileChip({
  pending,
  onRemove,
}: {
  pending: PendingFile
  onRemove: (id: string) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.14 }}
      className="relative flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white"
    >
      {pending.previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={pending.previewUrl} alt={pending.file.name} className="h-16 w-16 object-cover" />
      ) : (
        <div className="flex h-16 w-[104px] flex-col justify-center gap-0.5 px-2">
          <IconFile size={15} className="text-gray-400" aria-hidden />
          <span className="truncate text-[10.5px] font-medium text-gray-600">{pending.file.name}</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => onRemove(pending.id)}
        aria-label={`Remove ${pending.file.name}`}
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900/70 text-white transition-colors hover:bg-gray-900"
      >
        <IconX size={11} />
      </button>
    </motion.div>
  )
})

/* ── Typing indicator ─────────────────────────────────────────────────────── */

/**
 * Renders who is typing.
 *
 * Note on completeness: Discord only delivers other people's typing events over
 * the Gateway — there is no REST endpoint to poll for them. So this renders
 * real names when a Gateway feed supplies them, and stays empty otherwise,
 * rather than animating dots that correspond to nobody.
 */
export const TypingIndicator = memo(function TypingIndicator({ names }: { names: string[] }) {
  return (
    <div className="flex h-4 items-center gap-1.5 px-1 text-[11px] text-gray-500" aria-live="polite">
      <AnimatePresence>
        {names.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            className="flex items-center gap-1.5"
          >
            <span className="flex items-end gap-[2px]" aria-hidden>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-[3px] w-[3px] rounded-full bg-gray-400"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                />
              ))}
            </span>
            <span className="truncate">
              <span className="font-medium text-gray-700">
                {names.length === 1
                  ? names[0]
                  : names.length === 2
                    ? `${names[0]} and ${names[1]}`
                    : `${names[0]} and ${names.length - 1} others`}
              </span>{" "}
              {names.length === 1 ? "is" : "are"} typing…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

/* ── Mention autocomplete ─────────────────────────────────────────────────── */

/**
 * The `@query` currently under the caret, if any.
 *
 * Only triggers when the `@` starts a word — after whitespace, a newline, or
 * the start of the message — so an email address or a mid-word "@" (neither of
 * which is a mention) never opens the popup. The query itself may not contain
 * whitespace: typing a space ends the mention attempt, matching Discord.
 */
function activeMentionQuery(value: string, caret: number): { start: number; query: string } | null {
  const upToCaret = value.slice(0, caret)
  const match = /(?:^|[\s\n])@([^\s@]*)$/.exec(upToCaret)
  if (!match) return null
  return { start: caret - match[1].length - 1, query: match[1] }
}

/** The member list, filtered to a mention query and capped like Discord's own popup. */
function filterMentionCandidates(members: Member[], query: string): Member[] {
  const q = query.trim().toLowerCase()
  const list = q
    ? members.filter(
        (m) => m.displayName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)
      )
    : members
  return list.slice(0, 8)
}

const MentionPopup = memo(function MentionPopup({
  results,
  activeIdx,
  onHover,
  onPick,
  onClose,
}: {
  results: Member[]
  activeIdx: number
  onHover: (i: number) => void
  onPick: (member: Member) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Same dismissal pattern as EmojiPicker: outside click. Escape and the
  // arrow/Enter keys are handled by the textarea's own onKeyDown below, since
  // it already owns keyboard handling for the whole composer.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      role="listbox"
      aria-label="Mention a member"
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      className="absolute bottom-full left-0 z-40 mb-2 w-[260px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
    >
      {results.map((m, i) => (
        <button
          key={m.id}
          type="button"
          role="option"
          aria-selected={i === activeIdx}
          onMouseEnter={() => onHover(i)}
          // mousedown, not click: the textarea's blur (which would close the
          // popup) fires before click, but preventDefault on mousedown stops
          // the blur from ever happening, so the pick lands cleanly.
          onMouseDown={(e) => { e.preventDefault(); onPick(m) }}
          className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] transition-colors ${
            i === activeIdx ? "bg-[#0F6B3E]/10" : "hover:bg-gray-50"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.avatarUrl} alt="" className="h-6 w-6 flex-shrink-0 rounded-full" />
          <span className="min-w-0 truncate font-medium text-gray-800">{m.displayName}</span>
          {m.displayName !== m.username && (
            <span className="min-w-0 truncate text-[11px] text-gray-400">@{m.username}</span>
          )}
        </button>
      ))}
    </motion.div>
  )
})

/* ── Composer ─────────────────────────────────────────────────────────────── */

export function Composer({
  channelName,
  canSend,
  sending,
  draft,
  files,
  replyTo,
  typingNames,
  members,
  onDraftChange,
  onAddFiles,
  onRemoveFile,
  onCancelReply,
  onSend,
  onOpenPollComposer,
}: {
  channelName: string | null
  canSend: boolean
  sending: boolean
  draft: string
  files: PendingFile[]
  replyTo: Message | null
  typingNames: string[]
  /** For @mention autocomplete. Absent (or empty) simply disables the popup. */
  members?: Member[]
  onDraftChange: (v: string) => void
  onAddFiles: (files: File[]) => void
  onRemoveFile: (id: string) => void
  onCancelReply: () => void
  onSend: () => void
  /** Opens the poll-creation modal. Absent hides "Create poll" from the attach menu. */
  onOpenPollComposer?: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!showAttachMenu) return
    function onDown(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setShowAttachMenu(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [showAttachMenu])

  // ── Mention autocomplete ──────────────────────────────────────────────────
  // `mention` is non-null exactly while the caret sits inside an "@query" — see
  // activeMentionQuery. Recomputed on every keystroke from the CURRENT caret
  // position rather than tracked as its own piece of typed state, so it can
  // never drift from what the textarea actually shows.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0)
  const mentionResults = useMemo(
    () => (mention && members?.length ? filterMentionCandidates(members, mention.query) : []),
    [mention, members]
  )
  // The popup only actually shows once there is something to show — an "@" with
  // zero matches (a name nobody on this brand has) closes it instead of hanging
  // an empty box under the cursor.
  const mentionOpen = Boolean(mention) && mentionResults.length > 0
  // Clamped against the CURRENT result set rather than reset via an effect: the
  // set changes on every keystroke, so a highlighted row from the previous set
  // could otherwise point past the end of a shorter one, or linger on a stale
  // index once the query has moved on. No effect and no extra render — this is
  // the value used below, not state that needs to be kept in sync with it.
  const clampedMentionIdx = Math.min(mentionActiveIdx, Math.max(0, mentionResults.length - 1))

  const pickMention = useCallback(
    (member: Member) => {
      const el = textareaRef.current
      if (!mention || !el) return
      // Replaces the "@query" span with "@DisplayName " — a trailing space so
      // typing continues past it rather than into the same mention. The stored
      // draft stays human-readable text throughout composing; DiscordClient's
      // send() is what turns a matched "@DisplayName" into Discord's <@id>
      // syntax at the moment the message actually goes out.
      const caret = mention.start + 1 + mention.query.length
      const next = draft.slice(0, mention.start) + `@${member.displayName} ` + draft.slice(caret)
      onDraftChange(next)
      setMention(null)
      const newCaret = mention.start + member.displayName.length + 2
      requestAnimationFrame(() => {
        el.focus()
        el.selectionStart = el.selectionEnd = newCaret
      })
    },
    [mention, draft, onDraftChange]
  )

  // Auto-resize: reset to auto first so the box can also shrink when text is
  // deleted, not only grow.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [draft])

  // Opening a reply should put the cursor in the box — otherwise the user has
  // to click twice to answer someone.
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus()
  }, [replyTo])

  const insertEmoji = useCallback(
    (emoji: string) => {
      const el = textareaRef.current
      if (!el) {
        onDraftChange(draft + emoji)
        return
      }
      // Insert at the caret rather than appending, and leave the caret after it.
      const start = el.selectionStart ?? draft.length
      const end = el.selectionEnd ?? draft.length
      onDraftChange(draft.slice(0, start) + emoji + draft.slice(end))
      requestAnimationFrame(() => {
        el.focus()
        el.selectionStart = el.selectionEnd = start + emoji.length
      })
    },
    [draft, onDraftChange]
  )

  const canSubmit = (draft.trim().length > 0 || files.length > 0) && canSend && !sending

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // The mention popup takes priority over every other key it uses: Enter and
    // Escape mean something different while it is open (pick / dismiss rather
    // than send / cancel-reply), and the arrows move its selection instead of
    // the caret. Checked first, and each branch returns so nothing below
    // double-handles the same keystroke.
    if (mentionOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionActiveIdx((i) => Math.min(mentionResults.length - 1, i + 1)); return }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionActiveIdx((i) => Math.max(0, i - 1)); return }
      if ((e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) {
        e.preventDefault()
        const picked = mentionResults[clampedMentionIdx]
        if (picked) pickMention(picked)
        return
      }
      if (e.key === "Escape") { e.preventDefault(); setMention(null); return }
    }

    // Enter sends; Shift+Enter (and IME composition) inserts a newline.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (canSubmit) onSend()
    }
    // Escape abandons the reply, matching Discord.
    if (e.key === "Escape" && replyTo) {
      e.preventDefault()
      onCancelReply()
    }
  }

  /**
   * Re-derive the mention popup's state from the caret's CURRENT position.
   *
   * Fired from onChange/onClick/onKeyUp rather than only onChange, because a
   * click or an arrow key can move the caret out of (or into) an "@query" span
   * without the text itself changing — onChange alone would leave the popup
   * open over the wrong word, or missing entirely after a click back into one.
   */
  function syncMentionState(el: HTMLTextAreaElement) {
    if (!members?.length) return
    const caret = el.selectionStart ?? 0
    setMention(activeMentionQuery(el.value, caret))
  }

  function onPaste(e: React.ClipboardEvent) {
    const pasted = Array.from(e.clipboardData.files)
    if (pasted.length > 0) {
      e.preventDefault()
      onAddFiles(pasted)
    }
  }

  const overLimit = draft.length > MAX_LENGTH

  return (
    <div className="flex-shrink-0 px-3 pb-2.5 sm:px-5">
      <TypingIndicator names={typingNames} />

      <div
        onDragOver={(e) => { e.preventDefault(); if (canSend) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (canSend) onAddFiles(Array.from(e.dataTransfer.files))
        }}
        className={`overflow-visible rounded-xl border bg-gray-50 transition-colors ${
          dragging
            ? "border-[#0F6B3E] bg-[#0F6B3E]/5"
            : "border-gray-200 focus-within:border-[#0F6B3E]/40 focus-within:bg-white"
        }`}
      >
        {/* Reply banner sits inside the composer shell so it reads as one control. */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-1.5 border-b border-gray-200 px-3 py-1.5 text-[11.5px] text-gray-500">
                <IconCornerUpLeft size={12} className="flex-shrink-0 text-gray-400" aria-hidden />
                <span className="flex-shrink-0">Replying to</span>
                <span className="flex-shrink-0 font-medium text-gray-800">{replyTo.authorName}</span>
                <span className="min-w-0 truncate text-gray-400">
                  {replyTo.content.replace(/^\*\*[^*]+\*\*:\s/, "")}
                </span>
                <button
                  type="button"
                  onClick={onCancelReply}
                  aria-label="Cancel reply"
                  className="ml-auto flex-shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                >
                  <IconX size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 overflow-x-auto border-b border-gray-200 p-2">
                <AnimatePresence initial={false}>
                  {files.map((f) => (
                    <FileChip key={f.id} pending={f} onRemove={onRemoveFile} />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-1 p-1.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              onAddFiles(Array.from(e.target.files ?? []))
              // Reset so picking the same file twice in a row still fires.
              e.target.value = ""
            }}
          />
          <div className="relative flex-shrink-0" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => (onOpenPollComposer ? setShowAttachMenu((v) => !v) : fileInputRef.current?.click())}
              disabled={!canSend || files.length >= MAX_FILES}
              aria-label="Attach"
              aria-expanded={onOpenPollComposer ? showAttachMenu : undefined}
              title={files.length >= MAX_FILES ? `Up to ${MAX_FILES} files` : "Attach"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <IconPlus size={17} />
            </button>
            <AnimatePresence>
              {showAttachMenu && onOpenPollComposer && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className="absolute bottom-full left-0 z-40 mb-2 w-[180px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click() }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <IconFile size={14} className="text-gray-400" /> Attach file
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAttachMenu(false); onOpenPollComposer() }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <IconListDetails size={14} className="text-gray-400" /> Create poll
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative min-w-0 flex-1">
            <AnimatePresence>
              {mentionOpen && (
                <MentionPopup
                  results={mentionResults}
                  activeIdx={clampedMentionIdx}
                  onHover={setMentionActiveIdx}
                  onPick={pickMention}
                  onClose={() => setMention(null)}
                />
              )}
            </AnimatePresence>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => { onDraftChange(e.target.value); syncMentionState(e.target) }}
              onKeyDown={onKeyDown}
              onKeyUp={(e) => syncMentionState(e.currentTarget)}
              onClick={(e) => syncMentionState(e.currentTarget)}
              onBlur={() => setMention(null)}
              onPaste={onPaste}
              rows={1}
              disabled={!canSend || sending}
              aria-label={channelName ? `Message #${channelName}` : "Message"}
              placeholder={
                !channelName
                  ? "Select a channel"
                  : canSend
                    ? `Message #${channelName}`
                    : "You don't have permission to post here"
              }
              className="max-h-[200px] min-h-[32px] w-full resize-none bg-transparent px-1.5 py-[7px] text-[13.5px] leading-[1.45] text-gray-800 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
            />
          </div>

          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              disabled={!canSend}
              aria-label="Insert emoji"
              aria-expanded={showEmoji}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-700 disabled:opacity-40"
            >
              <IconMoodSmile size={17} />
            </button>
            <AnimatePresence>
              {showEmoji && (
                <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={onSend}
            disabled={!canSubmit || overLimit}
            aria-label="Send message"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#0F6B3E] text-white transition-all hover:bg-[#0a5a2f] active:scale-95 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {sending ? <IconLoader2 size={15} className="animate-spin" /> : <IconSend size={15} />}
          </button>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2 px-1">
        <p className="flex min-w-0 items-center gap-1 truncate text-[10.5px] text-gray-400">
          {canSend ? (
            <>
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1 font-sans text-[9.5px] text-gray-500">
                Enter
              </kbd>
              to send,
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1 font-sans text-[9.5px] text-gray-500">
                Shift + Enter
              </kbd>
              for a new line
            </>
          ) : channelName ? (
            <>
              <IconLock size={10} aria-hidden /> Read-only channel
            </>
          ) : null}
        </p>
        {/* Only appears near the limit, so it isn't permanent noise. */}
        {draft.length > MAX_LENGTH - 200 && (
          <span className={`ml-auto flex-shrink-0 text-[10.5px] tabular-nums ${overLimit ? "font-medium text-red-500" : "text-gray-400"}`}>
            {draft.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
    </div>
  )
}

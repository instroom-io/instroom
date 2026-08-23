"use client"
// The message river.
//
// Two things drive the density here. Consecutive messages from one author within
// a few minutes collapse into a single block — one avatar, one header, the rest
// as bare lines with the timestamp appearing in the gutter on hover. And date
// dividers replace repeating the date on every row.
//
// Every row is memoised. The channel poll replaces the message array every few
// seconds, so without memoisation each tick would re-render every message, every
// attachment and every reaction in the viewport.

import { memo, useMemo, useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconCornerUpLeft, IconMoodPlus, IconLink, IconDots, IconLoader2,
  IconCornerDownRight, IconPin, IconMessageReply, IconBrandDiscord,
  IconFile, IconDownload, IconX, IconCopy, IconPlayerPlayFilled, IconBolt,
} from "@tabler/icons-react"
import { RichText, type MentionResolver } from "./markdown"
import { EmojiPicker, QUICK_REACTIONS, rememberEmoji } from "./EmojiPicker"
import type { Message, Attachment, MessageGroup } from "./types"
import { Skeleton } from "./ui"

/** Same author, and within this window, means "keep the block going". */
const GROUP_WINDOW_MS = 7 * 60 * 1000

/* ── Formatting ───────────────────────────────────────────────────────────── */

function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function headerTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const days = Math.round((now.setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days === 0) return `Today at ${clockTime(iso)}`
  if (days === 1) return `Yesterday at ${clockTime(iso)}`
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" })
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" })
}

function bytes(n: number) {
  if (n <= 0) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Instroom posts through the bot, so a message sent from here arrives as
 * `**Display Name**: text`. Unwrapping that shows the real author in the header
 * instead of every Instroom message appearing to come from "Instroom Bot".
 */
const ATTRIBUTION = /^\*\*([^*\n]{1,64})\*\*:\s([\s\S]*)$/

/**
 * Three kinds of author, which look different because they ARE different:
 *
 *   human     — a person posting in Discord
 *   relayed   — a person posting through Instroom; the bot carried it, but a
 *               human wrote it, so it should read as that human
 *   automated — the bot speaking for itself, with no human behind it
 *
 * Collapsing the last two into one "BOT" badge is what made automated notices
 * indistinguishable from a colleague's message.
 */
type AuthorKind = "human" | "relayed" | "automated"

function unwrapAttribution(m: Message): { name: string; content: string; kind: AuthorKind } {
  if (m.authorIsBot) {
    const match = m.content.match(ATTRIBUTION)
    if (match) return { name: match[1], content: match[2], kind: "relayed" }
    return { name: m.authorName, content: m.content, kind: "automated" }
  }
  return { name: m.authorName, content: m.content, kind: "human" }
}

/* ── Grouping ─────────────────────────────────────────────────────────────── */

type Group = MessageGroup & { authorKind: AuthorKind }

type Row =
  | { kind: "divider"; key: string; label: string }
  | { kind: "group"; key: string; group: Group }

function buildRows(messages: Message[]): Row[] {
  const rows: Row[] = []
  let lastDay = ""
  let current: Group | null = null

  for (const m of messages) {
    const { name, kind } = unwrapAttribution(m)
    const day = new Date(m.createdAt).toDateString()

    if (day !== lastDay) {
      rows.push({ kind: "divider", key: `d-${day}`, label: dayLabel(m.createdAt) })
      lastDay = day
      current = null // a date change always starts a new block
    }

    const prev = current?.messages[current.messages.length - 1]
    const continues =
      current !== null &&
      prev !== undefined &&
      // Compare the unwrapped name: two people posting via the bot are two
      // authors, even though Discord reports the same bot id for both.
      current.authorName === name &&
      // A reply is a deliberate new thought — it always gets its own header.
      !m.replyTo &&
      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS

    if (continues) {
      current!.messages.push(m)
    } else {
      current = {
        key: `g-${m.id}`,
        authorId: m.authorId,
        authorName: name,
        authorAvatarUrl: m.authorAvatarUrl,
        authorIsBot: m.authorIsBot,
        authorKind: kind,
        messages: [m],
      }
      rows.push({ kind: "group", key: current.key, group: current })
    }
  }

  return rows
}

/* ── Attachments ──────────────────────────────────────────────────────────── */

const VIDEO_TYPES = /^video\/(mp4|webm|ogg|quicktime)$/i

const AttachmentView = memo(function AttachmentView({
  attachment: a,
  onOpenImage,
}: {
  attachment: Attachment
  onOpenImage: (a: Attachment) => void
}) {
  if (a.isImage) {
    // Reserve the real aspect ratio so the list doesn't jump as images decode —
    // which would otherwise fight the scroll anchoring on every load.
    const ratio = a.width && a.height ? a.width / a.height : undefined
    return (
      <button
        type="button"
        onClick={() => onOpenImage(a)}
        className="group/att block overflow-hidden rounded-lg border border-gray-200 transition-opacity hover:opacity-95"
        style={{ maxWidth: "min(420px, 100%)" }}
        aria-label={`Open ${a.filename}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.proxyUrl}
          alt={a.filename}
          loading="lazy"
          width={a.width ?? undefined}
          height={a.height ?? undefined}
          className="block max-h-[340px] w-auto max-w-full object-contain"
          style={ratio ? { aspectRatio: String(ratio) } : undefined}
        />
      </button>
    )
  }

  if (VIDEO_TYPES.test(a.contentType ?? "")) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-black" style={{ maxWidth: "min(420px, 100%)" }}>
        <video
          src={a.url}
          controls
          preload="metadata"
          className="block max-h-[340px] w-full"
          aria-label={a.filename}
        />
      </div>
    )
  }

  if (a.contentType?.startsWith("audio/")) {
    return (
      <div className="flex w-full max-w-[420px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2">
        <IconPlayerPlayFilled size={14} className="flex-shrink-0 text-gray-400" aria-hidden />
        <audio src={a.url} controls className="h-8 min-w-0 flex-1" aria-label={a.filename} />
      </div>
    )
  }

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/file flex max-w-[340px] items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 transition-colors hover:border-[#0F6B3E]/40 hover:bg-white"
    >
      <IconFile size={17} className="flex-shrink-0 text-gray-400" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-[#0F6B3E]">{a.filename}</span>
        {bytes(a.size) && <span className="block text-[10.5px] text-gray-400">{bytes(a.size)}</span>}
      </span>
      <IconDownload size={14} className="flex-shrink-0 text-gray-300 group-hover/file:text-gray-500" aria-hidden />
    </a>
  )
})

/* ── Lightbox ─────────────────────────────────────────────────────────────── */

function Lightbox({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    // Prevent the message list scrolling behind the overlay.
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={attachment.filename}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.img
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        src={attachment.url}
        alt={attachment.filename}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
      />
      <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <span className="max-w-[50vw] truncate text-[12px] text-white/70">{attachment.filename}</span>
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-medium text-white/90 underline hover:text-white"
        >
          Open original
        </a>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <IconX size={20} />
      </button>
    </motion.div>
  )
}

/* ── Reactions ────────────────────────────────────────────────────────────── */

const ReactionBar = memo(function ReactionBar({
  message,
  onToggle,
  onOpenPicker,
}: {
  message: Message
  onToggle: (m: Message, emoji: string, on: boolean) => void
  onOpenPicker: (id: string) => void
}) {
  if (message.reactions.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {message.reactions.map((r) => (
        <button
          key={`${r.emoji}-${r.emojiId ?? ""}`}
          type="button"
          onClick={() => onToggle(message, r.emojiId ? `${r.emoji}:${r.emojiId}` : r.emoji, !r.me)}
          aria-pressed={r.me}
          aria-label={`${r.emoji} ${r.count} reaction${r.count === 1 ? "" : "s"}`}
          className={`flex h-[22px] items-center gap-1 rounded-full border px-1.5 text-[11.5px] transition-all active:scale-95 ${
            r.me
              ? "border-[#0F6B3E]/50 bg-[#0F6B3E]/10 text-[#0F6B3E]"
              : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100"
          }`}
        >
          {r.emojiId ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`https://cdn.discordapp.com/emojis/${r.emojiId}.png?size=32`}
              alt={r.emoji}
              className="h-[14px] w-[14px]"
              loading="lazy"
            />
          ) : (
            <span className="text-[13px] leading-none">{r.emoji}</span>
          )}
          <span className="font-medium tabular-nums">{r.count}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => onOpenPicker(message.id)}
        aria-label="Add a reaction"
        className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-600 focus-visible:opacity-100 group-hover/msg:opacity-100"
      >
        <IconMoodPlus size={12} />
      </button>
    </div>
  )
})

/* ── Hover actions ────────────────────────────────────────────────────────── */

const HoverActions = memo(function HoverActions({
  message,
  canSend,
  onReply,
  onReact,
  onCopyLink,
  onCopyText,
}: {
  message: Message
  canSend: boolean
  onReply: (m: Message) => void
  onReact: (m: Message, emoji: string) => void
  onCopyLink: (m: Message) => void
  onCopyText: (m: Message) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMore) return
    function onDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [showMore])

  const btn =
    "flex h-7 w-7 items-center justify-center text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"

  return (
    // Floats over the top-right of the row, as Discord does, so it never
    // reflows the message text when it appears.
    <div
      className={`absolute -top-3 right-2 z-20 flex items-center overflow-visible rounded-lg border border-gray-200 bg-white shadow-sm transition-opacity ${
        showPicker || showMore ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover/msg:opacity-100"
      }`}
    >
      {/* Quick reactions: the common case is one tap, not opening a picker. */}
      {QUICK_REACTIONS.slice(0, 3).map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => { rememberEmoji(e); onReact(message, e) }}
          aria-label={`React with ${e}`}
          className="flex h-7 w-7 items-center justify-center text-[15px] leading-none transition-transform hover:scale-125"
        >
          {e}
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          aria-label="Add a reaction"
          aria-expanded={showPicker}
          className={btn}
        >
          <IconMoodPlus size={15} />
        </button>
        <AnimatePresence>
          {showPicker && (
            <EmojiPicker
              onPick={(e) => { onReact(message, e); setShowPicker(false) }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {canSend && (
        <button type="button" onClick={() => onReply(message)} aria-label="Reply" title="Reply" className={btn}>
          <IconCornerUpLeft size={15} />
        </button>
      )}

      <button
        type="button"
        onClick={() => onCopyLink(message)}
        aria-label="Copy message link"
        title="Copy link"
        className={btn}
      >
        <IconLink size={15} />
      </button>

      <div className="relative" ref={moreRef}>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-label="More actions"
          aria-expanded={showMore}
          className={`${btn} rounded-r-lg`}
        >
          <IconDots size={15} />
        </button>
        <AnimatePresence>
          {showMore && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              role="menu"
              className="absolute right-0 top-full z-40 mt-1 w-[188px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
            >
              <MenuItem icon={<IconCopy size={14} />} onClick={() => { onCopyText(message); setShowMore(false) }}>
                Copy text
              </MenuItem>
              <MenuItem icon={<IconLink size={14} />} onClick={() => { onCopyLink(message); setShowMore(false) }}>
                Copy message link
              </MenuItem>
              <MenuItem
                icon={<IconBrandDiscord size={14} />}
                onClick={() => { window.open(message.link, "_blank", "noopener,noreferrer"); setShowMore(false) }}
              >
                Open in Discord
              </MenuItem>
              <div className="my-1 h-px bg-gray-100" />
              <div className="px-3 py-1 text-[10.5px] leading-relaxed text-gray-400">
                {message.pinned ? "Pinned in Discord" : "Editing and deleting happen in Discord."}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
})

function MenuItem({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-gray-700 transition-colors hover:bg-gray-50"
    >
      <span className="flex-shrink-0 text-gray-400">{icon}</span>
      {children}
    </button>
  )
}

/* ── One message block ────────────────────────────────────────────────────── */

const GroupView = memo(function GroupView({
  group,
  canSend,
  resolve,
  highlight,
  activePickerId,
  onSetPicker,
  onReply,
  onToggleReaction,
  onCopyLink,
  onCopyText,
  onOpenImage,
  onJumpToReply,
}: {
  group: Group
  canSend: boolean
  resolve: MentionResolver
  highlight: string
  activePickerId: string | null
  onSetPicker: (id: string | null) => void
  onReply: (m: Message) => void
  onToggleReaction: (m: Message, emoji: string, on: boolean) => void
  onCopyLink: (m: Message) => void
  onCopyText: (m: Message) => void
  onOpenImage: (a: Attachment) => void
  onJumpToReply: (id: string) => void
}) {
  const first = group.messages[0]

  const react = useCallback(
    (m: Message, emoji: string) => {
      const existing = m.reactions.find((r) => (r.emojiId ? `${r.emoji}:${r.emojiId}` : r.emoji) === emoji)
      onToggleReaction(m, emoji, !existing?.me)
    },
    [onToggleReaction]
  )

  const automated = group.authorKind === "automated"

  return (
    // Automated messages use the SAME container as everything else. They were
    // previously a tinted, accent-bordered card, which broke the river of the
    // conversation into disconnected blocks. Identification is carried entirely
    // by the BOT badge and the muted subtitle below the name — enough to be
    // unmistakable, light enough to still read as part of the conversation.
    <div className="pt-[13px] first:pt-1">
      {/* Reply reference sits above the header, indented into the avatar gutter. */}
      {first.replyTo && (
        <button
          type="button"
          onClick={() => onJumpToReply(first.replyTo!.id)}
          className="mb-0.5 flex w-full items-center gap-1.5 pl-[26px] text-left text-[11.5px] text-gray-400 transition-colors hover:text-gray-600"
        >
          <IconCornerDownRight size={12} className="flex-shrink-0" aria-hidden />
          <span className="flex-shrink-0 font-medium text-gray-500">{first.replyTo.authorName}</span>
          <span className="truncate">{first.replyTo.excerpt || "Click to see the original"}</span>
        </button>
      )}

      <div className="flex gap-3">
        <span className="relative mt-0.5 flex-shrink-0">
          {/* Identical to a person's avatar — no ring, no corner mark. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={group.authorAvatarUrl ?? ""}
            alt=""
            loading="lazy"
            className="h-9 w-9 rounded-full bg-gray-100 object-cover"
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            {/* Same weight, size and colour for every author. */}
            <span className="text-[14px] font-semibold text-gray-900">
              {group.authorName}
            </span>

            {group.authorKind === "relayed" ? (
              // A human wrote this; Instroom only carried it. Quiet badge.
              <span
                title="Sent from Instroom by this person"
                className="rounded bg-[#0F6B3E]/10 px-1 text-[9px] font-bold uppercase tracking-wide text-[#0F6B3E]"
              >
                Instroom
              </span>
            ) : automated ? (
              <span className="inline-flex items-center gap-[3px] rounded bg-[#0F6B3E] px-1 py-[1px] text-[9px] font-bold uppercase tracking-wide text-white">
                <IconBolt size={8} fill="currentColor" aria-hidden />
                Bot
              </span>
            ) : null}

            <span className="text-[11px] tabular-nums text-gray-400">{headerTime(first.createdAt)}</span>
          </div>

          {automated && (
            // The only remaining signal besides the badge. Tight leading and no
            // bottom margin beyond the normal line gap, so it reads as a
            // subtitle on the name rather than adding a blank row.
            <p className="-mt-px text-[10.5px] leading-[1.35] text-gray-400">
              Automated by Instroom Bot
            </p>
          )}

          <div className="flex flex-col">
            {group.messages.map((m, i) => {
              const { content } = unwrapAttribution(m)
              return (
                <div
                  key={m.id}
                  id={`msg-${m.id}`}
                  className="group/msg relative -mx-2 rounded-md px-2 py-[1px] transition-colors hover:bg-gray-50/80"
                >
                  {/* Continuation lines get their time in the left gutter on
                      hover — the same affordance Discord uses. */}
                  {i > 0 && (
                    <span
                      aria-hidden
                      className="absolute -left-[42px] top-[3px] w-[38px] text-right text-[10px] tabular-nums text-gray-400 opacity-0 transition-opacity group-hover/msg:opacity-100"
                    >
                      {clockTime(m.createdAt)}
                    </span>
                  )}

                  {content && (
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <RichText content={content} resolve={resolve} highlight={highlight} />
                      {m.editedAt && <span className="text-[10px] text-gray-400">(edited)</span>}
                      {m.pinned && <IconPin size={10} className="text-gray-400" aria-label="Pinned" />}
                    </div>
                  )}

                  {m.attachments.length > 0 && (
                    <div className="mt-1 flex flex-col items-start gap-1.5">
                      {m.attachments.map((a) => (
                        <AttachmentView key={a.id} attachment={a} onOpenImage={onOpenImage} />
                      ))}
                    </div>
                  )}

                  <ReactionBar message={m} onToggle={onToggleReaction} onOpenPicker={onSetPicker} />

                  {m.thread && (
                    <a
                      href={`https://discord.com/channels/@me/${m.thread.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-gray-100"
                    >
                      <IconMessageReply size={11} aria-hidden />
                      <span className="font-medium">{m.thread.name}</span>
                      <span className="text-gray-400">
                        {m.thread.messageCount} {m.thread.messageCount === 1 ? "reply" : "replies"}
                      </span>
                    </a>
                  )}

                  <HoverActions
                    message={m}
                    canSend={canSend}
                    onReply={onReply}
                    onReact={react}
                    onCopyLink={onCopyLink}
                    onCopyText={onCopyText}
                  />

                  {/* Picker opened from the reaction bar's "+" rather than the
                      hover toolbar. */}
                  <AnimatePresence>
                    {activePickerId === m.id && (
                      <div className="relative">
                        <EmojiPicker
                          align="left"
                          onPick={(e) => { react(m, e); onSetPicker(null) }}
                          onClose={() => onSetPicker(null)}
                        />
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
})

/* ── List ─────────────────────────────────────────────────────────────────── */

export function MessageList({
  messages,
  loading,
  loadingOlder,
  hasMore,
  canSend,
  channelName,
  search,
  resolve,
  scrollRef,
  onScroll,
  onReply,
  onToggleReaction,
  onCopyLink,
  onCopyText,
}: {
  messages: Message[]
  loading: boolean
  loadingOlder: boolean
  hasMore: boolean
  canSend: boolean
  channelName: string | null
  search: string
  resolve: MentionResolver
  scrollRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  onReply: (m: Message) => void
  onToggleReaction: (m: Message, emoji: string, on: boolean) => void
  onCopyLink: (m: Message) => void
  onCopyText: (m: Message) => void
}) {
  const [lightbox, setLightbox] = useState<Attachment | null>(null)
  const [pickerId, setPickerId] = useState<string | null>(null)

  const rows = useMemo(() => buildRows(messages), [messages])

  /** Scrolls to a replied-to message if it's already loaded, and flashes it. */
  const jumpToReply = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("bg-amber-50")
    setTimeout(() => el.classList.remove("bg-amber-50"), 1200)
  }, [])

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        // overflow-anchor:none — the browser's own scroll anchoring fights the
        // manual position restore used when prepending older history.
        style={{ overflowAnchor: "none" }}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 sm:px-5"
      >
        {loadingOlder && (
          <div className="flex justify-center py-3">
            <IconLoader2 size={15} className="animate-spin text-gray-300" />
          </div>
        )}

        {!hasMore && !loading && messages.length > 0 && (
          <div className="px-1 pb-3 pt-5">
            <p className="text-[15px] font-semibold text-gray-900">
              Welcome to #{channelName}
            </p>
            <p className="mt-0.5 text-[12.5px] text-gray-400">
              This is the beginning of the channel.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-4 py-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton rounded="rounded-full" className="flex-shrink-0" width={36} delayMs={i * 70} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3" width={112} delayMs={i * 70} />
                  <Skeleton className="h-3" width={`${55 + ((i * 13) % 40)}%`} delayMs={i * 70} />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 py-16 text-center">
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0F6B3E]/10">
              <IconMessageReply size={20} className="text-[#0F6B3E]" aria-hidden />
            </div>
            <p className="text-[13.5px] font-medium text-gray-700">
              {search ? "No messages match your search" : `No messages in #${channelName ?? "this channel"} yet`}
            </p>
            <p className="max-w-xs text-[12px] leading-relaxed text-gray-400">
              {search ? "Try a different word, or clear the search." : "Be the first to say something."}
            </p>
          </div>
        ) : (
          rows.map((row) =>
            row.kind === "divider" ? (
              <div key={row.key} className="relative flex items-center py-3.5">
                <span className="h-px flex-1 bg-gray-100" aria-hidden />
                <span className="px-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-gray-400">
                  {row.label}
                </span>
                <span className="h-px flex-1 bg-gray-100" aria-hidden />
              </div>
            ) : (
              <GroupView
                key={row.key}
                group={row.group}
                canSend={canSend}
                resolve={resolve}
                highlight={search}
                activePickerId={pickerId}
                onSetPicker={setPickerId}
                onReply={onReply}
                onToggleReaction={onToggleReaction}
                onCopyLink={onCopyLink}
                onCopyText={onCopyText}
                onOpenImage={setLightbox}
                onJumpToReply={jumpToReply}
              />
            )
          )
        )}
      </div>

      <AnimatePresence>
        {lightbox && <Lightbox attachment={lightbox} onClose={() => setLightbox(null)} />}
      </AnimatePresence>
    </>
  )
}

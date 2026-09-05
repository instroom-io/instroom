"use client"
// A thread's own conversation view, opened over the main channel rather than
// navigating away from it — the same way Discord's own thread panel behaves.
//
// Deliberately simpler than the main channel's message pipeline: no
// scroll-back pagination, no reply-threading INSIDE a thread (Discord itself
// doesn't nest threads), no merge-window logic for a background poll racing a
// send. Thread volumes are small, and everything a thread message needs to
// render — reactions, mentions, attachments — already comes through
// normaliseMessage exactly like a channel message does, so MessageList is
// reused as-is rather than re-implemented here.

import { useState, useEffect, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import { IconX, IconLoader2, IconSend } from "@tabler/icons-react"
import { MessageList } from "./MessageList"
import type { Message } from "./types"
import type { MentionResolver } from "./markdown"

const THREAD_POLL_MS = 5_000

export function ThreadPanel({
  base,
  threadId,
  threadName,
  originMessage,
  resolve,
  onClose,
  showToast,
}: {
  /** `/api/brands/:brandId/integrations/discord` — same base DiscordClient builds. */
  base: string
  threadId: string
  threadName: string
  originMessage: Message
  resolve: MentionResolver
  onClose: () => void
  showToast: (m: string) => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const aliveRef = useRef(true)
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false } }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${base}/threads/messages?threadId=${encodeURIComponent(threadId)}&limit=50`)
      const data = await res.json()
      if (!aliveRef.current) return
      if (res.ok) setMessages(data.messages ?? [])
    } catch {
      /* a failed poll just leaves the panel showing the last-known messages */
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  }, [base, threadId])

  useEffect(() => {
    setLoading(true)
    load()
    const timer = setInterval(load, THREAD_POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  const send = useCallback(async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setDraft("")
    try {
      const res = await fetch(`${base}/threads/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, content }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDraft(content)
        showToast(data.error ?? "Couldn't send")
        return
      }
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]))
    } catch {
      setDraft(content)
      showToast("Couldn't send")
    } finally {
      setSending(false)
    }
  }, [draft, sending, base, threadId, showToast])

  // Actions the main channel supports (edit/delete/pin/react/reply-within) are
  // deliberately absent here for this first pass — a thread's OWN message
  // history is the feature this task asks for; those actions can extend into
  // threads the same way they extended into the main channel, as a follow-up.
  const noop = useCallback(() => {}, [])
  const noopBool = useCallback(() => false, [])

  /**
   * Voting, same optimistic pattern DiscordClient's own votePoll uses. Kept
   * here rather than threaded in as a prop: this panel already owns its own
   * `messages` state independently of the main channel's, so the update has
   * to apply to THIS state either way — there is nothing to share.
   *
   * `channelId` in the request is the THREAD id, not its parent's — a thread
   * IS a channel in Discord's model, and a poll message inside one lives in
   * the thread. bot-provider's getMessage/syncPollBotVote both fall back to
   * assertThreadAccess for exactly this id.
   */
  const votePoll = useCallback(
    async (m: Message, answerId: number, on: boolean) => {
      if (!m.poll) return
      const previous = m
      setMessages((prev) =>
        prev.map((x) => {
          if (x.id !== m.id || !x.poll) return x
          const nextMyVotes = x.poll.allowMultiselect
            ? on
              ? [...x.myVotes.filter((id) => id !== answerId), answerId]
              : x.myVotes.filter((id) => id !== answerId)
            : on
              ? [answerId]
              : []
          const delta = (id: number) => (nextMyVotes.includes(id) ? 1 : 0) - (x.myVotes.includes(id) ? 1 : 0)
          const options = x.poll.options.map((o) => ({ ...o, count: Math.max(0, o.count + delta(o.answerId)) }))
          return {
            ...x,
            myVotes: nextMyVotes,
            poll: { ...x.poll, options, totalVotes: options.reduce((sum, o) => sum + o.count, 0) },
          }
        })
      )
      try {
        const res = await fetch(`${base}/polls/votes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: threadId, messageId: m.id, answerId, on }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setMessages((prev) => prev.map((x) => (x.id === m.id ? previous : x)))
          showToast(data.error ?? "Couldn't update your vote")
          return
        }
        setMessages((prev) =>
          prev.map((x) => (x.id === m.id && x.poll ? { ...x, myVotes: data.myVotes ?? x.myVotes } : x))
        )
      } catch {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? previous : x)))
        showToast("Couldn't update your vote")
      }
    },
    [base, threadId, showToast]
  )

  return (
    <motion.aside
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-gray-200 bg-white shadow-xl sm:w-[380px]"
      aria-label={`Thread: ${threadName}`}
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-gray-900">{threadName}</p>
          <p className="truncate text-[11px] text-gray-400">Thread</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close thread"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <IconX size={16} />
        </button>
      </div>

      {/* The message this thread branched from, so it stays visibly attached
          even after scrolling through the thread's own replies. */}
      <div className="flex-shrink-0 border-b border-gray-100 bg-gray-50/60 px-4 py-2">
        <p className="text-[11px] text-gray-400">Started from</p>
        <p className="line-clamp-2 text-[12.5px] text-gray-600">
          {originMessage.content.replace(/^\*\*[^*]+\*\*:\s/, "")}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-gray-400">
          <IconLoader2 size={18} className="animate-spin" />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <MessageList
            messages={messages}
            loading={false}
            loadingOlder={false}
            hasMore={false}
            canSend={false}
            channelName={threadName}
            search=""
            resolve={resolve}
            scrollRef={{ current: null }}
            onScroll={noop}
            onReply={noop}
            onToggleReaction={noop}
            onCopyLink={noop}
            onCopyText={noop}
            isOwnMessage={noopBool}
            onEdit={noop}
            onDelete={noop}
            onTogglePin={noop}
            onStartThread={noop}
            onOpenThread={noop}
            onVote={votePoll}
            editingId={null}
            editDraft=""
            onEditDraftChange={noop}
            onSubmitEdit={noop}
            onCancelEdit={noop}
          />
        </div>
      )}

      <div className="flex-shrink-0 border-t border-gray-100 p-2">
        <div className="flex items-end gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1.5 focus-within:border-[#0F6B3E]/40 focus-within:bg-white">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                if (draft.trim() && !sending) send()
              }
            }}
            rows={1}
            placeholder="Reply in thread…"
            disabled={sending}
            className="max-h-[120px] min-h-[32px] flex-1 resize-none bg-transparent px-1.5 py-[7px] text-[13px] leading-[1.45] text-gray-800 outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#0F6B3E] text-white transition-all hover:bg-[#0a5a2f] active:scale-95 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {sending ? <IconLoader2 size={15} className="animate-spin" /> : <IconSend size={15} />}
          </button>
        </div>
      </div>
    </motion.aside>
  )
}

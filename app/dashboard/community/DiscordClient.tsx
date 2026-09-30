"use client"
// Discord client embedded in Instroom.
//
// Discord is the backend and the single source of truth — nothing here is
// mirrored into our database. Every call goes through the brand-scoped routes
// under /api/brands/:brandId/integrations/discord/*, which resolve the guild
// from BrandDiscordConnection. This component never sees a guild ID or a bot
// token, and cannot request another brand's server.
//
// Real-time is polling for now (messages 5s, channels 30s), paused while the
// tab is hidden. The Gateway worker replaces the message poll without touching
// anything else in this file — and is also what will light up the two features
// REST cannot provide: other people's typing events and member presence. Both
// are wired through here already and render only when a real feed supplies
// them, rather than being faked.
//
// This file is the orchestrator: state, fetching, and layout. The presentation
// lives in ./_discord/* so a poll tick re-renders as little as possible.

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import type { MouseEvent as ReactMouseEvent } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconHash, IconVolume, IconSpeakerphone, IconLoader2, IconAlertTriangle,
  IconBrandDiscord, IconLink, IconSearch, IconX, IconMenu2, IconUsers,
  IconLock, IconCheck,
} from "@tabler/icons-react"

import { ChannelList } from "./_discord/ChannelList"
import { MessageList } from "./_discord/MessageList"
import { Composer, type PendingFile } from "./_discord/Composer"
import { PollComposer, type NewPoll } from "./_discord/PollComposer"
import { MemberList, type Presence } from "./_discord/MemberList"
import { CommunitySkeleton } from "./_discord/CommunitySkeleton"
import { rememberBrand } from "./_discord/ServerSwitcher"
import { ConfirmDialog } from "./_discord/ConfirmDialog"
import { ThreadPanel } from "./_discord/ThreadPanel"
import { DiscordCta } from "./_discord/ui"
import type { Channel, Message, Member } from "./_discord/types"
import type { MentionResolver } from "./_discord/markdown"
import { useUnread } from "./_discord/useUnread"
import { getCachedData, useRestoredCache, setCachedData } from "@/lib/data-cache"

const MESSAGE_POLL_MS = 5_000
const CHANNEL_POLL_MS = 30_000
/** Discord's typing indicator lasts ~10s, so re-trigger below that. */
const TYPING_THROTTLE_MS = 8_000

/** Where Discord sends the user back to after an authorization round trip. */
const RETURN_TO = encodeURIComponent("/dashboard/community")
/** Starts the account link. Used by first-run setup, the gate, and Reconnect. */
const ACCOUNT_LINK_URL = `/api/community/discord/oauth/start?returnTo=${RETURN_TO}`

/**
 * Where the authorization tab should come back to — the CURRENT url, query and
 * all, exactly as the inbox builds it (`pathname + search`).
 *
 * RETURN_TO above is the bare "/dashboard/community" with no brandId, which
 * lands the user on a page that has to re-pick a brand before it can mount
 * DiscordClient — so the workspace they started in is not necessarily the one
 * they come back to, and the ?discordLinked=1 verdict is dropped by that
 * redirect. Carrying the current query through means Discord returns them to
 * exactly the page they left.
 */
function currentReturnTo(): string {
  return encodeURIComponent(window.location.pathname + window.location.search)
}

/* ── Setup progress ───────────────────────────────────────────────────────── */
// Shows both steps at once — done, current, or pending — so the user can see
// where they are and what's left rather than discovering step 2 only after
// finishing step 1.

function StepProgress({
  current,
  serverDone,
  accountDone,
}: {
  current: 1 | 2
  serverDone: boolean
  accountDone: boolean
}) {
  // Account first: linking the account is what identifies the user in Discord,
  // so it is the prerequisite the server step reads from.
  const steps = [
    { n: 1, label: "Connect Discord Account", done: accountDone },
    { n: 2, label: "Connect Discord Server", done: serverDone },
  ]

  return (
    <ol className="flex items-center gap-2" aria-label={`Setup step ${current} of 2`}>
      {steps.map((s, i) => {
        const isCurrent = s.n === current && !s.done
        return (
          <li key={s.n} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                  s.done
                    ? "bg-[#1FAE5B] text-white"
                    : isCurrent
                      ? "bg-[#0F6B3E] text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {s.done ? <IconCheck size={13} /> : s.n}
              </span>
              <span
                className={`text-[12px] font-medium ${
                  s.done ? "text-gray-400 line-through" : isCurrent ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i === 0 && <span aria-hidden className={`h-px w-6 ${accountDone ? "bg-[#1FAE5B]" : "bg-gray-200"}`} />}
          </li>
        )
      })}
    </ol>
  )
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function DiscordClient({ brandId }: { brandId: string }) {
  const base = `/api/brands/${encodeURIComponent(brandId)}/integrations/discord`
  const router = useRouter()

  // Community data is seeded from the shared cache, so coming back to this page
  // renders the last known channels / members / messages immediately while the
  // existing polls refresh them in the background.
  const [channels, setChannels] = useState<Channel[] | null>(
    () => getCachedData<Channel[]>(`${base}/channels`) ?? null
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [members, setMembers] = useState<Member[]>(
    () => getCachedData<Member[]>(`${base}/members`) ?? []
  )
  const [membersLoading, setMembersLoading] = useState(
    () => getCachedData<Member[]>(`${base}/members`) === undefined
  )
  const [membersError, setMembersError] = useState<string | null>(null)
  const [presenceById, setPresenceById] = useState<Record<string, Presence>>({})
  // Who is currently typing in the active channel.
  //
  // This stays empty today, and that is deliberate rather than unfinished:
  // Discord emits TYPING_START only over the Gateway. There is no REST endpoint
  // to poll for it, so the honest options are an empty list or an animation
  // representing nobody. The indicator is built and wired; the Gateway worker
  // populates this state and it starts working with no other change here.
  // (Our own outbound typing already works — see onDraftChange.)
  const [typingNames] = useState<string[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [draft, setDraft] = useState("")
  const [files, setFiles] = useState<PendingFile[]>([])
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  /** id of the message currently being edited in place, if any. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  /** The open thread's own conversation view, or null when none is open. */
  const [activeThread, setActiveThread] = useState<{ id: string; name: string; originMessage: Message } | null>(null)
  /** Message awaiting delete confirmation — its own dialog, not the shared `confirm` union above, since it has to carry WHICH message. */
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<Message | null>(null)
  const [deletingMessage, setDeletingMessage] = useState(false)
  const [pollComposerOpen, setPollComposerOpen] = useState(false)
  const [creatingPoll, setCreatingPoll] = useState(false)
  const [search, setSearch] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [gate, setGate] = useState<{ code: string; error: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // Off-canvas rails on small screens. Desktop renders both inline.
  const [channelsOpen, setChannelsOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [status, setStatus] = useState<{
    connected: boolean
    connection: { guildName: string; guildIconUrl: string | null; status: string; statusError: string | null } | null
    discordLinked: boolean
    /** Which Discord account is linked — shown in the account menu. */
    discordUsername: string | null
    /** The `**DisplayName**: ` prefix this user's own sent messages carry. */
    displayName: string | null
    botConfigured: boolean
    /** Last status request failed — state below is the last known good. */
    unreachable?: boolean
    lastError?: string | null
  } | null>(() => getCachedData(`${base}/status`) ?? null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastTypingRef = useRef(0)
  const aliveRef = useRef(true)
  /** Pinned to the bottom? Governs whether new messages auto-scroll. */
  const atBottomRef = useRef(true)

  const active = useMemo(() => channels?.find((c) => c.id === activeId) ?? null, [channels, activeId])

  const showToast = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2500)
  }, [])

  const { unread, markRead, markAllRead } = useUnread(brandId, channels, activeId)

  /* ── Connection status, checked FIRST ───────────────────────────────────── */
  // Nothing else runs until we know a server is connected. Calling /channels
  // for an unconfigured brand would produce "Failed to load channels", which
  // reads as a bug when it is really just first-time setup.
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${base}/status`)

      // A failed request tells us NOTHING about configuration. Previously this
      // parsed the body regardless of status: an error payload like
      // {"error":"Unauthorized"} has no botConfigured field, so Boolean(undefined)
      // became false and the UI announced "Discord isn't configured on this
      // deployment yet" — a configuration verdict invented from a 401. That is
      // what made the onboarding flap between states on refresh and on poll.
      if (!res.ok) {
        const body = await res.text().catch(() => "")
        console.error(`[community] GET ${base}/status -> HTTP ${res.status}: ${body.slice(0, 300)}`)
        if (!aliveRef.current) return
        // Hold the last known-good state and report the transport failure
        // separately. Never downgrade a working setup because one poll failed.
        setStatus((prev) =>
          prev
            ? { ...prev, unreachable: true, lastError: `Status check failed (HTTP ${res.status})` }
            : {
                connected: false,
                connection: null,
                discordLinked: false,
                discordUsername: null,
                displayName: null,
                // Unknown, not false — the button stays available.
                botConfigured: true,
                unreachable: true,
                lastError: `Status check failed (HTTP ${res.status})`,
              }
        )
        return
      }

      const data = await res.json()
      if (!aliveRef.current) return
      setCachedData(`${base}/status`, {
        connected: Boolean(data.connected),
        connection: data.connection ?? null,
        discordLinked: Boolean(data.discordLinked ?? data.accountLinked),
        discordUsername: data.discordUsername ?? null,
        displayName: data.displayName ?? null,
        botConfigured: data.botConfigured !== false,
        unreachable: false,
        lastError: null,
      })
      setStatus({
        connected: Boolean(data.connected),
        connection: data.connection ?? null,
        discordLinked: Boolean(data.discordLinked ?? data.accountLinked),
        discordUsername: data.discordUsername ?? null,
        displayName: data.displayName ?? null,
        // Only an explicit `false` from a successful response counts as
        // unconfigured. A missing field means the server didn't say.
        botConfigured: data.botConfigured !== false,
        unreachable: false,
        lastError: null,
      })
    } catch (err) {
      console.error(`[community] GET ${base}/status threw:`, err)
      if (!aliveRef.current) return
      setStatus((prev) =>
        prev
          ? { ...prev, unreachable: true, lastError: "Couldn't reach the server." }
          : {
              connected: false,
              connection: null,
              discordLinked: false,
              discordUsername: null,
              displayName: null,
              botConfigured: true,
              unreachable: true,
              lastError: "Couldn't reach the server.",
            }
      )
    }
  }, [base])

  // Both requirements must be met before any Discord data is requested.
  const setupComplete = Boolean(status?.connected && status?.discordLinked)

  useEffect(() => { loadStatus() }, [loadStatus])

  // While setup is incomplete, re-check on an interval. That's what makes the
  // flow advance on its own — including when a step is completed in another
  // tab — so the user never has to refresh to move forward.
  useEffect(() => {
    if (status === null || setupComplete) return
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadStatus()
    }, 4000)
    return () => clearInterval(id)
  }, [status, setupComplete, loadStatus])

  // Returning from Discord's authorization screen. Surface the outcome and
  // strip the params so a refresh doesn't replay the message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("discordConnected")
    const linked = params.get("discordLinked")
    const error = params.get("discordError")
    const cancelled = params.get("discordCancelled")
    if (!connected && !linked && !error && !cancelled) return

    if (connected) { showToast("Discord server connected"); loadStatus() }
    else if (linked) { showToast("Discord account connected"); loadStatus() }
    else if (error) showToast(error)
    else showToast("Discord connection cancelled")

    for (const k of ["discordConnected", "discordLinked", "discordError", "discordCancelled"]) {
      params.delete(k)
    }
    const qs = params.toString()
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Channels ───────────────────────────────────────────────────────────── */
  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch(`${base}/channels`)
      const data = await res.json()
      if (!aliveRef.current) return
      if (!res.ok) {
        // 409/503 here are configuration states (not linked, bot missing, no
        // server connected) — each needs its own call to action, not an error.
        setGate({ code: data.code ?? "error", error: data.error ?? "Couldn't load channels" })
        setChannels([])
        return
      }
      setGate(null)
      const list: Channel[] = data.channels ?? []
      setCachedData(`${base}/channels`, list)
      setChannels((prev) => {
        // Replace only on a real change, so the 30s channel poll doesn't
        // re-render the rail (and reset its collapse state) for nothing.
        if (
          prev &&
          prev.length === list.length &&
          prev.every((p, i) =>
            p.id === list[i].id &&
            p.name === list[i].name &&
            p.canSend === list[i].canSend &&
            p.lastMessageId === list[i].lastMessageId
          )
        ) {
          return prev
        }
        return list
      })
      setActiveId((cur) => cur ?? list.find((c) => c.type !== "voice" && c.type !== "forum")?.id ?? null)
    } catch {
      if (aliveRef.current) setGate({ code: "network", error: "Couldn't reach the server." })
    }
  }, [base])

  // Gated on a live connection — no server, no channel requests at all.
  useEffect(() => {
    aliveRef.current = true
    if (!setupComplete) return
    loadChannels()
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadChannels()
    }, CHANNEL_POLL_MS)
    return () => { aliveRef.current = false; clearInterval(id) }
  }, [loadChannels, setupComplete])

  /* ── Members ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (gate || !setupComplete) return
    let cancelled = false
    setMembersLoading(true)
    fetch(`${base}/members`)
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled || !aliveRef.current) return
        if (!ok) {
          setMembersError(data.error ?? "Couldn't load members.")
          setMembers([])
          return
        }
        setMembersError(null)
        setCachedData(`${base}/members`, data.members ?? [])
        setMembers(data.members ?? [])
        // Presence arrives only if a Gateway feed is supplying it. When the
        // route reports presenceAvailable:false the map stays empty and no
        // status dots render — see MemberList's note.
        if (data.presenceAvailable) {
          const map: Record<string, Presence> = {}
          for (const m of data.members ?? []) if (m.status) map[m.id] = m.status
          setPresenceById(map)
        }
      })
      .catch(() => {
        if (!cancelled && aliveRef.current) setMembersError("Couldn't load members.")
      })
      .finally(() => {
        if (!cancelled && aliveRef.current) setMembersLoading(false)
      })
    return () => { cancelled = true }
  }, [base, gate, setupComplete])

  /* ── Messages: initial + poll ───────────────────────────────────────────── */
  const loadMessages = useCallback(async (channelId: string, spinner: boolean) => {
    if (spinner) setLoadingMessages(true)
    try {
      const res = await fetch(`${base}/messages?channelId=${encodeURIComponent(channelId)}&limit=50`)
      const data = await res.json()
      if (!aliveRef.current) return
      if (!res.ok) {
        setGate({ code: data.code ?? "error", error: data.error ?? "Couldn't load messages" })
        return
      }
      setMessages((prev) => {
        const next: Message[] = data.messages ?? []
        // A poll returns only the newest 50. If the user has scrolled back and
        // loaded older history, replacing the array would throw that away and
        // yank them forward — so merge the fresh window into what's already
        // there instead, keyed by id.
        const merged = (() => {
          if (prev.length === 0) return next
          const oldest = next[0]?.id
          const newest = next[next.length - 1]?.id
          if (!oldest || !newest) return prev
          const older: Message[] = []
          // Anything newer than the window too: a message we just sent can beat
          // the poll's own request, and dropping it would make it flicker out
          // and back a few seconds later.
          const newer: Message[] = []
          for (const m of prev) {
            try {
              if (BigInt(m.id) < BigInt(oldest)) older.push(m)
              else if (BigInt(m.id) > BigInt(newest)) newer.push(m)
            } catch {
              /* non-snowflake id — let the server's window win */
            }
          }
          return older.length === 0 && newer.length === 0 ? next : [...older, ...next, ...newer]
        })()

        // Only replace when something actually changed, so a quiet poll doesn't
        // re-render the list and fight the user's scroll position.
        if (prev.length === merged.length) {
          const same = prev.every(
            (p, i) =>
              p.id === merged[i]?.id &&
              p.content === merged[i]?.content &&
              p.editedAt === merged[i]?.editedAt &&
              p.reactions.length === merged[i]?.reactions.length &&
              p.reactions.every((r, ri) => r.count === merged[i].reactions[ri]?.count && r.me === merged[i].reactions[ri]?.me)
          )
          if (same) return prev
        }
        return merged
      })
      setHasMore(Boolean(data.hasMore))
      setCachedData(`${base}/messages?channelId=${channelId}`, (data.messages ?? []) as Message[])
    } catch {
      /* transient — next tick retries */
    } finally {
      if (aliveRef.current) setLoadingMessages(false)
    }
  }, [base])

  // Persisted payloads are handed over after mount: the initializers above read
  // the cache during render, which must stay empty while React hydrates or the
  // server's skeleton and the client's populated markup disagree. Every poll
  // below still runs and refreshes these in the background.
  useRestoredCache<Channel[]>(`${base}/channels`, (data) => {
    setChannels((prev) => prev ?? data)
  })
  useRestoredCache<Member[]>(`${base}/members`, (data) => {
    setMembers((prev) => (prev.length ? prev : data))
    setMembersLoading(false)
  })
  useRestoredCache<any>(`${base}/status`, (data) => {
    setStatus((prev) => prev ?? data)
  })
  // Keyed on the active channel, so switching channels promotes that channel's
  // own persisted history before the effect below reads it.
  useRestoredCache<Message[]>(
    activeId ? `${base}/messages?channelId=${activeId}` : null,
    (data) => { setMessages((prev) => (prev.length ? prev : data)) }
  )

  useEffect(() => {
    if (!activeId) return
    const cachedMessages = getCachedData<Message[]>(`${base}/messages?channelId=${activeId}`)
    setMessages(cachedMessages ?? [])
    setReplyTo(null)
    setSearch("")
    atBottomRef.current = true
    // Spinner only when this channel has nothing cached yet.
    loadMessages(activeId, cachedMessages === undefined)
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadMessages(activeId, false)
    }, MESSAGE_POLL_MS)
    return () => clearInterval(id)
  }, [activeId, loadMessages, base])

  // Auto-scroll only when already pinned to the bottom — otherwise reading
  // history would be yanked away every poll.
  useEffect(() => {
    if (atBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }
  }, [messages])

  // Seeing the newest message in the open channel is what marks it read.
  useEffect(() => {
    if (!activeId || messages.length === 0) return
    markRead(activeId, messages[messages.length - 1].id)
  }, [activeId, messages, markRead])

  /* ── Infinite scroll (older) ────────────────────────────────────────────── */
  const onScroll = useCallback(async () => {
    const el = scrollRef.current
    if (!el || !activeId) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80

    if (el.scrollTop < 120 && hasMore && !loadingOlder && messages.length > 0) {
      setLoadingOlder(true)
      const before = messages[0].id
      // Anchor on distance-from-bottom rather than a height delta: it stays
      // correct even if images finish decoding mid-fetch and change the height.
      const prevFromBottom = el.scrollHeight - el.scrollTop
      try {
        const res = await fetch(`${base}/messages?channelId=${encodeURIComponent(activeId)}&before=${before}&limit=50`)
        const data = await res.json()
        if (res.ok && data.messages?.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id))
            return [...data.messages.filter((m: Message) => !seen.has(m.id)), ...prev]
          })
          setHasMore(Boolean(data.hasMore))
          // Keep the reading position stable as content is prepended.
          requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevFromBottom })
        } else {
          setHasMore(false)
        }
      } catch {
        /* leave hasMore alone — a retry on the next scroll is fine */
      } finally {
        setLoadingOlder(false)
      }
    }
  }, [activeId, base, hasMore, loadingOlder, messages])

  /* ── Attachments ────────────────────────────────────────────────────────── */
  const addFiles = useCallback((incoming: File[]) => {
    const accepted = incoming.filter((f) => f.size > 0)
    if (accepted.length === 0) return
    setFiles((prev) => {
      const room = 10 - prev.length
      if (room <= 0) return prev
      const next = accepted.slice(0, room).map((file) => ({
        id: `${file.name}-${file.size}-${prev.length}-${file.lastModified}`,
        file,
        // Object URLs are revoked on removal and on unmount so previews of
        // discarded files don't leak for the life of the page.
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      }))
      if (accepted.length > room) showToast(`Only ${room} more file${room === 1 ? "" : "s"} fit on one message.`)
      return [...prev, ...next]
    })
  }, [showToast])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  useEffect(() => {
    // Revoke on unmount. The ref-free closure is fine because `files` is in the
    // dependency-free cleanup of the final render.
    return () => {
      for (const f of files) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Send + typing ──────────────────────────────────────────────────────── */
  /**
   * Turn the human-readable "@DisplayName" the mention popup inserted into
   * Discord's own `<@id>` syntax, which is what the composer stores and shows
   * throughout typing — matching every other piece of text in the box.
   *
   * `sendMessage` in lib/discord/bot-provider already sets
   * `allowed_mentions: { parse: ["users"] }`, so once the id lands in the
   * outgoing content Discord notifies that user itself; nothing else has to.
   *
   * Matched against the CURRENT member list only, longest display name first,
   * so "@Ann" cannot match inside a message meant for "@Annabelle" and a plain
   * "@word" that names nobody on this brand is left as ordinary text rather
   * than silently swallowed.
   */
  const encodeMentions = useCallback(
    (text: string) => {
      if (!members.length) return text
      const byLength = [...members].sort((a, b) => b.displayName.length - a.displayName.length)
      let out = text
      for (const m of byLength) {
        if (!m.displayName) continue
        // Boundaries either side: whitespace/start and whitespace/punctuation/
        // end, so "@Ann" only matches the whole name, never a prefix of it.
        const escaped = m.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const re = new RegExp(`(^|\\s)@${escaped}(?=$|\\s|[.,!?;:])`, "g")
        out = out.replace(re, `$1<@${m.id}>`)
      }
      return out
    },
    [members]
  )

  const send = useCallback(async () => {
    // `draft` is what the box shows and what a failed send restores — always
    // the human-readable "@DisplayName" form. `content` is only what goes over
    // the wire; encoding happens once, here, so the composer itself never has
    // to know Discord's mention syntax exists.
    const typed = draft.trim()
    const content = encodeMentions(typed)
    const attachments = files
    if ((!typed && attachments.length === 0) || !activeId || sending) return

    setSending(true)
    setDraft("")
    setFiles([])
    const replyId = replyTo?.id
    setReplyTo(null)

    try {
      let res: Response
      if (attachments.length > 0) {
        const form = new FormData()
        form.append("channelId", activeId)
        form.append("content", content)
        if (replyId) form.append("replyToId", replyId)
        for (const a of attachments) form.append("files", a.file, a.file.name)
        res = await fetch(`${base}/messages`, { method: "POST", body: form })
      } else {
        res = await fetch(`${base}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeId, content, replyToId: replyId }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        // Give the text back rather than losing it — the ORIGINAL typed text,
        // not the encoded wire form, so a retry still shows "@DisplayName"
        // rather than a raw <@id>. Files can't be restored into an <input>,
        // so the user is told explicitly.
        setDraft(typed)
        if (replyTo) setReplyTo(replyTo)
        showToast(data.error ?? "Couldn't send")
        if (attachments.length > 0) showToast("Couldn't send — please re-attach your files.")
        return
      }

      for (const a of attachments) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
      // Append immediately; the next poll reconciles with Discord.
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]))
      atBottomRef.current = true
    } catch {
      setDraft(typed)
      showToast("Couldn't send")
    } finally {
      setSending(false)
    }
  }, [draft, files, activeId, sending, replyTo, base, showToast, encodeMentions])

  const onDraftChange = useCallback((value: string) => {
    setDraft(value)
    const now = Date.now()
    if (activeId && value && now - lastTypingRef.current > TYPING_THROTTLE_MS) {
      lastTypingRef.current = now
      fetch(`${base}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: activeId }),
      }).catch(() => {})
    }
  }, [activeId, base])

  /* ── Reactions ──────────────────────────────────────────────────────────── */
  // Optimistic: the count moves on click and is reverted if Discord refuses.
  // The 5s poll is authoritative either way.
  const toggleReaction = useCallback(
    async (message: Message, emoji: string, on: boolean) => {
      if (!activeId) return
      const [name] = emoji.split(":")

      const apply = (delta: 1 | -1, me: boolean) =>
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== message.id) return m
            const existing = m.reactions.find((r) => r.emoji === name)
            if (existing) {
              const count = Math.max(0, existing.count + delta)
              return {
                ...m,
                reactions:
                  count === 0
                    ? m.reactions.filter((r) => r.emoji !== name)
                    : m.reactions.map((r) => (r.emoji === name ? { ...r, count, me } : r)),
              }
            }
            if (delta < 0) return m
            return { ...m, reactions: [...m.reactions, { emoji: name, emojiId: null, count: 1, me }] }
          })
        )

      apply(on ? 1 : -1, on)

      try {
        const res = await fetch(`${base}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeId, messageId: message.id, emoji, on }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          apply(on ? -1 : 1, !on)
          showToast(data.error ?? "Couldn't update the reaction")
        }
      } catch {
        apply(on ? -1 : 1, !on)
        showToast("Couldn't update the reaction")
      }
    },
    [activeId, base, showToast]
  )

  const copyLink = useCallback((m: Message) => {
    navigator.clipboard?.writeText(m.link)
    showToast("Message link copied")
  }, [showToast])

  const copyText = useCallback((m: Message) => {
    navigator.clipboard?.writeText(m.content.replace(/^\*\*[^*]+\*\*:\s/, ""))
    showToast("Message text copied")
  }, [showToast])

  /* ── Edit ───────────────────────────────────────────────────────────────── */
  // Own-message check on the client is a DISPLAY decision only — it decides
  // whether the Edit/Delete buttons even render. The server re-derives and
  // re-checks the identical thing (bot-provider's isOwnMessage) before either
  // action is allowed to run, so this being wrong or stale can only hide a
  // button a user was entitled to see, never grant one they weren't.
  const isOwnMessage = useCallback(
    (m: Message) => Boolean(m.authorIsBot) && Boolean(status?.displayName) && m.content.startsWith(`**${status?.displayName}**: `),
    [status?.displayName]
  )

  const startEdit = useCallback((m: Message) => {
    setEditingId(m.id)
    setEditDraft(m.content.replace(/^\*\*[^*]+\*\*:\s/, ""))
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditDraft("")
  }, [])

  const submitEdit = useCallback(async () => {
    if (!editingId || !activeId) return
    const trimmed = editDraft.trim()
    if (!trimmed) return

    const messageId = editingId
    const previous = messages.find((m) => m.id === messageId)
    // Optimistic — the same pattern toggleReaction uses: applied immediately,
    // rolled back only if the request actually fails.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: `${m.content.match(/^\*\*[^*]+\*\*:\s/)?.[0] ?? ""}${trimmed}`, editedAt: new Date().toISOString() }
          : m
      )
    )
    setEditingId(null)
    setEditDraft("")

    try {
      const res = await fetch(`${base}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: activeId, messageId, content: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (previous) setMessages((prev) => prev.map((m) => (m.id === messageId ? previous : m)))
        showToast(data.error ?? "Couldn't edit message")
        return
      }
      // Reconciled from what Discord actually stored — matters if the server
      // trimmed the content to Discord's 2000-char cap.
      setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)))
    } catch {
      if (previous) setMessages((prev) => prev.map((m) => (m.id === messageId ? previous : m)))
      showToast("Couldn't edit message")
    }
  }, [editingId, editDraft, activeId, messages, base, showToast])

  /* ── Delete ─────────────────────────────────────────────────────────────── */
  // Gated behind ConfirmDialog rather than optimistic-and-reversible like
  // reactions/pins: unlike those, there is no toggling back — the message and
  // whatever replies point at it are genuinely gone once this runs.
  const confirmDeleteMessageHandler = useCallback(async () => {
    const m = confirmDeleteMessage
    if (!m || !activeId) return
    setDeletingMessage(true)
    try {
      const res = await fetch(`${base}/messages`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: activeId, messageId: m.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error ?? "Couldn't delete message")
        return
      }
      setMessages((prev) => prev.filter((x) => x.id !== m.id))
      setConfirmDeleteMessage(null)
    } catch {
      showToast("Couldn't delete message")
    } finally {
      setDeletingMessage(false)
    }
  }, [confirmDeleteMessage, activeId, base, showToast])

  /* ── Pin / unpin ────────────────────────────────────────────────────────── */
  const togglePin = useCallback(
    async (m: Message, on: boolean) => {
      if (!activeId) return
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, pinned: on } : x)))

      try {
        const res = await fetch(`${base}/pins`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeId, messageId: m.id, on }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, pinned: !on } : x)))
          showToast(data.error ?? "Couldn't update pin")
        } else {
          showToast(on ? "Message pinned" : "Message unpinned")
        }
      } catch {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, pinned: !on } : x)))
        showToast("Couldn't update pin")
      }
    },
    [activeId, base, showToast]
  )

  /* ── Poll votes ─────────────────────────────────────────────────────────── */
  // Optimistic, same pattern as togglePin/toggleReaction: the vote counts and
  // this user's own picks are what the poll renders from, so applying the
  // change locally first is what makes a vote feel instant. Rolled back only
  // if the request actually fails.
  const votePoll = useCallback(
    async (m: Message, answerId: number, on: boolean) => {
      if (!activeId || !m.poll) return
      const previous = m

      setMessages((prev) =>
        prev.map((x) => {
          if (x.id !== m.id || !x.poll) return x
          // Single-select: turning ONE option on clears any other the user had.
          const nextMyVotes = x.poll.allowMultiselect
            ? on
              ? [...x.myVotes.filter((id) => id !== answerId), answerId]
              : x.myVotes.filter((id) => id !== answerId)
            : on
              ? [answerId]
              : []
          const delta = (id: number) =>
            (nextMyVotes.includes(id) ? 1 : 0) - (x.myVotes.includes(id) ? 1 : 0)
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
          body: JSON.stringify({ channelId: activeId, messageId: m.id, answerId, on }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setMessages((prev) => prev.map((x) => (x.id === m.id ? previous : x)))
          showToast(data.error ?? "Couldn't update your vote")
          return
        }
        // Reconciled from the server's own tally rather than trusted from the
        // optimistic guess above — the source of truth for counts is
        // CommunityPollVote, and another user's vote could have landed between
        // this request going out and its response coming back.
        setMessages((prev) =>
          prev.map((x) => (x.id === m.id && x.poll ? { ...x, myVotes: data.myVotes ?? x.myVotes } : x))
        )
      } catch {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? previous : x)))
        showToast("Couldn't update your vote")
      }
    },
    [activeId, base, showToast]
  )

  /* ── Threads ────────────────────────────────────────────────────────────── */
  // Not optimistic — a real thread id from Discord is what the "own
  // conversation view" opens against, and there is nothing sensible to show
  // before that id exists.
  const startThread = useCallback(
    async (m: Message) => {
      if (!activeId) return
      try {
        const res = await fetch(`${base}/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeId, messageId: m.id }),
        })
        const data = await res.json()
        if (!res.ok) {
          showToast(data.error ?? "Couldn't create thread")
          return
        }
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, thread: data.thread } : x)))
        setActiveThread({ id: data.thread.id, name: data.thread.name, originMessage: m })
      } catch {
        showToast("Couldn't create thread")
      }
    },
    [activeId, base, showToast]
  )

  /* ── Polls ──────────────────────────────────────────────────────────────── */
  // Not optimistic, same reasoning as startThread: a poll's answer_ids come
  // from Discord and there is nothing sensible to render before they exist.
  const createPoll = useCallback(
    async (poll: NewPoll) => {
      if (!activeId) return
      setCreatingPoll(true)
      try {
        const res = await fetch(`${base}/polls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeId, ...poll }),
        })
        const data = await res.json()
        if (!res.ok) {
          showToast(data.error ?? "Couldn't create poll")
          return
        }
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]))
        atBottomRef.current = true
        setPollComposerOpen(false)
      } catch {
        showToast("Couldn't create poll")
      } finally {
        setCreatingPoll(false)
      }
    },
    [activeId, base, showToast]
  )

  const selectChannel = useCallback((id: string) => {
    setActiveId(id)
    setChannelsOpen(false)
  }, [])

  /**
   * Switching server = switching brand, because a brand owns exactly one guild.
   *
   * Only the search param moves. page.tsx keys this component on brandId, so
   * React unmounts the whole client and mounts a fresh one: no channel,
   * message, member or unread state can survive the switch into another
   * brand's view. Every subsequent request goes to the new brand's routes and
   * is re-authorised there, so the isolation guarantee is the server's, not
   * this component's.
   */
  const switchServer = useCallback((nextBrandId: string) => {
    if (nextBrandId === brandId) return
    const params = new URLSearchParams(window.location.search)
    params.set("brandId", nextBrandId)
    router.push(`${window.location.pathname}?${params}`)
  }, [brandId, router])

  // Restore this on the next visit that arrives without an explicit brandId.
  useEffect(() => { rememberBrand(brandId) }, [brandId])

  /* ── Disconnect / log out ───────────────────────────────────────────────── */
  // Two different scopes, and keeping them distinct is the whole point:
  //
  //   Disconnect Server — deletes THIS brand's BrandDiscordConnection. Affects
  //     everyone in this workspace, and no other workspace, because the route
  //     is brand-scoped and guardBrand has already verified membership.
  //   Log Out Discord   — clears only the calling user's Discord link. The
  //     brand's server stays connected for everybody, including this user once
  //     they reconnect.
  //
  // Neither touches Discord itself: the bot stays in the server, and the user's
  // Discord account is untouched. Both are reversible from the setup screen,
  // which is what the confirmation copy promises.

  const [confirm, setConfirm] = useState<null | "server" | "account" | "all">(null)
  const [working, setWorking] = useState(false)

  /** Drop everything from the old connection so the setup screen isn't drawn
   *  over a stale channel list for a frame. */
  const resetClientState = useCallback(() => {
    setChannels(null)
    setActiveId(null)
    setMessages([])
    setMembers([])
    setGate(null)
    setDraft("")
    setFiles([])
    setReplyTo(null)
    setSearch("")
  }, [])

  const disconnectServer = useCallback(async () => {
    setWorking(true)
    try {
      const res = await fetch(`${base}/disconnect`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error ?? "Couldn't disconnect the server")
        return
      }
      setConfirm(null)
      resetClientState()
      // Re-read rather than assuming: loadStatus is what moves the UI back to
      // the setup screen, and it also picks up anything else that changed.
      await loadStatus()
      showToast("Discord server disconnected")
    } catch {
      showToast("Couldn't disconnect the server")
    } finally {
      setWorking(false)
    }
  }, [base, loadStatus, resetClientState, showToast])

  const logoutAccount = useCallback(async () => {
    setWorking(true)
    try {
      const res = await fetch("/api/community/discord/account", { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error ?? "Couldn't log out of Discord")
        return
      }
      setConfirm(null)
      resetClientState()
      await loadStatus()
      showToast("Logged out of Discord")
    } catch {
      showToast("Couldn't log out of Discord")
    } finally {
      setWorking(false)
    }
  }, [loadStatus, resetClientState, showToast])

  /**
   * Log out of both at once.
   *
   * Calls the SAME two routes the individual actions call — no new endpoint and
   * no second copy of the disconnect logic. This action only sequences them and
   * reports one combined outcome.
   *
   * Run together rather than one-then-the-other: they are independent
   * (`.../disconnect` authorizes on brand membership via guardBrand, not on the
   * Discord link), so neither ordering can make the other fail.
   *
   * Both halves are reported even when one fails, because a partial result is
   * exactly what the user needs to know — and `loadStatus` runs either way, so
   * the UI reflects whatever actually happened instead of assuming both worked.
   */
  const logoutAll = useCallback(async () => {
    setWorking(true)
    try {
      const attempt = async (url: string, label: string): Promise<string | null> => {
        try {
          const res = await fetch(url, { method: "DELETE" })
          if (res.ok) return null
          const data = await res.json().catch(() => ({}))
          return (data.error as string | undefined) ?? `Couldn't disconnect the Discord ${label}`
        } catch {
          return `Couldn't disconnect the Discord ${label}`
        }
      }

      const [serverError, accountError] = await Promise.all([
        attempt(`${base}/disconnect`, "server"),
        attempt("/api/community/discord/account", "account"),
      ])

      setConfirm(null)
      resetClientState()
      // Re-read rather than assuming: this is what returns the UI to the setup
      // screen at step 1, and it also picks up a half-completed logout.
      await loadStatus()

      const failures = [serverError, accountError].filter((e): e is string => Boolean(e))
      showToast(failures.length === 0 ? "Logged out of Discord" : failures.join(" · "))
    } finally {
      setWorking(false)
    }
  }, [base, loadStatus, resetClientState, showToast])

  const reconnectAccount = useCallback(() => {
    // Same entry point as first-time linking — prompt=consent makes Discord
    // show the account chooser rather than silently re-linking the same one.
    window.location.href = ACCOUNT_LINK_URL
  }, [])

  /* ── Derived ────────────────────────────────────────────────────────────── */

  // Turns raw Discord ids in message bodies into names. Rebuilt only when the
  // member or channel lists actually change.
  const resolve = useMemo<MentionResolver>(() => {
    const byUser = new Map(members.map((m) => [m.id, m.displayName]))
    const byChannel = new Map((channels ?? []).map((c) => [c.id, c.name]))
    // Roles aren't fetched separately; the member list carries top-role names,
    // which covers the roles people actually get mentioned by.
    const byRole = new Map(
      members.filter((m) => m.roleName).map((m) => [m.roleName as string, m.roleName as string])
    )
    return {
      user: (id) => byUser.get(id) ?? null,
      channel: (id) => byChannel.get(id) ?? null,
      role: (id) => byRole.get(id) ?? null,
    }
  }, [members, channels])

  const visibleMessages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return messages
    return messages.filter(
      (m) => m.content.toLowerCase().includes(q) || m.authorName.toLowerCase().includes(q)
    )
  }, [messages, search])

  // Shared by the client and the setup screen. Disconnecting moves the user
  // from one to the other, and the confirmation toast has to survive that
  // transition — if this only lived in the client's JSX, the one toast the user
  // most needs ("Discord server disconnected") would unmount before painting.
  const toastEl = (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-6 right-4 z-[70] max-w-[calc(100vw-2rem)] rounded-lg bg-gray-900 px-4 py-2 text-[12px] text-white shadow-lg sm:right-6"
          role="status"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  )

  /* ── First paint ────────────────────────────────────────────────────────── */
  // The full layout as a skeleton, never a spinner and never a blank frame. The
  // status check has to finish before we know whether to show the client or the
  // setup flow, and this is what fills that gap with something the right shape.
  if (status === null) return <CommunitySkeleton />

  /* ── First-run: no Discord server connected ─────────────────────────────── */
  // Deliberately before the error branches. This is setup, not failure — no
  // error styling, no "Failed to load channels", nothing red.

  // ── Guided setup ─────────────────────────────────────────────────────────
  // Two ordered requirements. The screen always states which step you're on,
  // which is done, and what the single next action is — and it advances by
  // itself when a step completes (the 4s status poll above), so there is never
  // a "now refresh the page" moment.
  if (!setupComplete) {
    // Step 1 is the account link; the server step unlocks only once it is done.
    const step = !status.discordLinked ? 1 : 2
    const botMissing = status.connection?.status === "bot_missing"
    // Same URL construction as before, except returnTo now carries this page's
    // brandId so the authorization tab lands on a page that actually mounts
    // DiscordClient and can therefore close itself.
    const serverInstallUrl = `/api/community/discord/install?brandId=${encodeURIComponent(brandId)}&returnTo=${currentReturnTo()}`
    const accountLinkUrl = `/api/community/discord/oauth/start?returnTo=${currentReturnTo()}`

    return (
      // Fades/rises in so arriving here by disconnecting reads as a transition
      // rather than the page blinking to a different screen.
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center justify-center gap-5 rounded-xl border border-gray-100 bg-white px-6 py-16 text-center"
      >
        {toastEl}
        <div data-tour="community-setup-progress">
          <StepProgress current={step} serverDone={status.connected} accountDone={status.discordLinked} />
        </div>

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2]">
          <IconBrandDiscord size={28} className="text-white" />
        </div>

        {step === 1 ? (
          <>
            <div className="flex flex-col gap-1.5" data-tour="community-setup-heading">
              <h2 className="text-[16px] font-semibold text-gray-900">No Discord account connected.</h2>
              <p className="max-w-md text-[13px] leading-relaxed text-gray-500">
                Start by linking your own Discord account. It&apos;s how we know who you are in Discord, so we can show
                you exactly the channels you have access to — and nothing you don&apos;t.
              </p>
            </div>
            {status.botConfigured ? (
              <DiscordCta
                href={accountLinkUrl}
                icon={<IconLink size={16} />}
                dataTour="community-connect-server"
              >
                Connect Discord Account
              </DiscordCta>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                Discord isn&apos;t configured on this deployment yet. Ask an administrator to set it up.
              </p>
            )}
            <p className="max-w-sm text-[11px] leading-relaxed text-gray-400">
              We only read your Discord username and your roles. We never post as you.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5" data-tour="community-setup-heading">
              <h2 className="text-[16px] font-semibold text-gray-900">
                {botMissing ? "Finish connecting your Discord server" : "Connect your Discord server"}
              </h2>
              <p className="max-w-md text-[13px] leading-relaxed text-gray-500">
                {botMissing
                  ? `We found ${status.connection?.guildName ?? "your server"}, but the Instroom bot hasn't been added yet. Authorize it to continue.`
                  : "Community runs on your own Discord server. Each workspace connects its own server, so your conversations stay in one place — and stay yours."}
              </p>
            </div>
            {status.botConfigured ? (
              <DiscordCta
                href={serverInstallUrl}
                dataTour="community-connect-server"
              >
                {botMissing ? "Authorize Instroom Bot" : "Connect Discord Server"}
              </DiscordCta>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                Discord isn&apos;t configured on this deployment yet. Ask an administrator to set it up.
              </p>
            )}
            <p className="max-w-sm text-[11px] leading-relaxed text-gray-400">
              You&apos;ll pick your server on Discord and authorize the Instroom bot.
            </p>
          </>
        )}

        {status.connection?.statusError && (
          <p className="max-w-md text-[11px] text-gray-400">{status.connection.statusError}</p>
        )}
      </motion.div>
    )
  }

  /* ── Post-connection gates (account linking, permissions) ───────────────── */
  if (gate && ["not_linked", "not_connected", "bot_missing", "not_member", "not_configured"].includes(gate.code)) {
    const linkNeeded = gate.code === "not_linked"
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-100 bg-white px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#5865F2]">
          <IconBrandDiscord size={24} className="text-white" />
        </div>
        <p className="text-[14px] font-semibold text-gray-900">
          {linkNeeded ? "Link your Discord account" : "Discord isn't ready yet"}
        </p>
        <p className="max-w-sm text-[12px] leading-relaxed text-gray-500">{gate.error}</p>
        {linkNeeded && (
          <DiscordCta href={ACCOUNT_LINK_URL} size="md" icon={<IconLink size={15} />} className="mt-1">
            Connect Discord
          </DiscordCta>
        )}
        {gate.code === "not_connected" && (
          <a href="/dashboard/settings/integrations" className="text-[12px] font-medium text-[#0F6B3E] hover:underline">
            Go to Settings → Integrations
          </a>
        )}
      </div>
    )
  }

  /* ── Client ─────────────────────────────────────────────────────────────── */

  const rail = (
    <ChannelList
      channels={channels}
      activeId={activeId}
      unread={unread}
      brandId={brandId}
      guildName={status.connection?.guildName ?? null}
      guildIconUrl={status.connection?.guildIconUrl ?? null}
      discordUsername={status.discordUsername ?? null}
      onSelect={selectChannel}
      onSwitchServer={switchServer}
      onRefresh={loadChannels}
      onMarkAllRead={markAllRead}
      onDisconnectServer={() => setConfirm("server")}
      onReconnectAccount={reconnectAccount}
      onLogoutAccount={() => setConfirm("account")}
      onLogoutAll={() => setConfirm("all")}
    />
  )

  const memberRail = (
    <MemberList
      members={members}
      loading={membersLoading}
      error={membersError}
      presenceById={presenceById}
    />
  )

  const ActiveIcon =
    active?.type === "voice" ? IconVolume
    : active?.type === "announcement" ? IconSpeakerphone
    : active && !active.canSend ? IconLock
    : IconHash

  return (
    // Full-bleed: the Discord surface owns the whole content area rather than
    // sitting in a card, which is what makes it read as an embedded client.
    // svh, not vh, so mobile browser chrome doesn't clip the composer.
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 overflow-hidden border-t border-gray-100 bg-white">
      {toastEl}

      {/* ── Channels: inline from md up, drawer below ─────────────────────── */}
      <aside className="hidden w-[228px] flex-shrink-0 border-r border-gray-100 md:block">
        {rail}
      </aside>

      <AnimatePresence>
        {channelsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChannelsOpen(false)}
              className="fixed inset-0 z-40 bg-gray-900/40 md:hidden"
              aria-hidden
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-full w-[268px] border-r border-gray-200 shadow-xl md:hidden"
              aria-label="Channels"
            >
              {rail}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-gray-100 px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setChannelsOpen(true)}
            aria-label="Open channels"
            className="-ml-1 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 md:hidden"
          >
            <IconMenu2 size={18} />
          </button>

          <ActiveIcon size={17} className="flex-shrink-0 text-gray-400" aria-hidden />
          <h2 className="flex-shrink-0 truncate text-[14.5px] font-semibold text-gray-900">
            {active?.name ?? "Select a channel"}
          </h2>
          {active?.topic && (
            <p className="hidden min-w-0 truncate border-l border-gray-200 pl-2.5 text-[11.5px] text-gray-400 lg:block">
              {active.topic}
            </p>
          )}

          <div className="ml-auto flex flex-shrink-0 items-center gap-1">
            {/* Collapsed to an icon on small screens so the channel name keeps
                its space; expands in place when opened. */}
            <div className="relative">
              <AnimatePresence initial={false} mode="wait">
                {searchOpen || search ? (
                  <motion.div
                    key="input"
                    initial={{ width: 34, opacity: 0 }}
                    animate={{ width: 168, opacity: 1 }}
                    exit={{ width: 34, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="relative"
                  >
                    <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onBlur={() => !search && setSearchOpen(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setSearch(""); setSearchOpen(false) }
                      }}
                      placeholder="Search this channel"
                      aria-label="Search messages in this channel"
                      className="h-8 w-full rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-7 text-[12.5px] outline-none focus:border-[#0F6B3E]/40 focus:bg-white"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => { setSearch(""); setSearchOpen(false) }}
                        aria-label="Clear search"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                      >
                        <IconX size={12} />
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <motion.button
                    key="button"
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    aria-label="Search messages"
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <IconSearch size={17} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => setMembersOpen((v) => !v)}
              aria-label="Toggle members"
              aria-pressed={membersOpen}
              className={`rounded-lg p-1.5 transition-colors lg:hidden ${
                membersOpen ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              }`}
            >
              <IconUsers size={17} />
            </button>
          </div>
        </header>

        {search && (
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-amber-100 bg-amber-50/70 px-4 py-1.5 text-[11.5px] text-amber-900">
            <IconSearch size={12} className="flex-shrink-0" aria-hidden />
            {visibleMessages.length === 0
              ? "No matches in the loaded history."
              : `${visibleMessages.length} match${visibleMessages.length === 1 ? "" : "es"} in the loaded history`}
            <span className="text-amber-700/70">— scroll up to load more, then search again.</span>
          </div>
        )}

        {gate && (
          <div className="flex flex-shrink-0 items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2 text-[12px] text-amber-900">
            <IconAlertTriangle size={14} className="mt-0.5 flex-shrink-0" aria-hidden />
            {gate.error}
          </div>
        )}

        {status.unreachable && (
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[11.5px] text-gray-500">
            <IconLoader2 size={12} className="flex-shrink-0 animate-spin" aria-hidden />
            Reconnecting… showing the last known state.
          </div>
        )}

        <MessageList
          messages={visibleMessages}
          loading={loadingMessages}
          loadingOlder={loadingOlder}
          hasMore={hasMore}
          canSend={Boolean(active?.canSend)}
          channelName={active?.name ?? null}
          search={search.trim()}
          resolve={resolve}
          scrollRef={scrollRef}
          onScroll={onScroll}
          onReply={setReplyTo}
          onToggleReaction={toggleReaction}
          onCopyLink={copyLink}
          onCopyText={copyText}
          isOwnMessage={isOwnMessage}
          onEdit={startEdit}
          onDelete={setConfirmDeleteMessage}
          onTogglePin={togglePin}
          onStartThread={startThread}
          onOpenThread={(m) =>
            m.thread && setActiveThread({ id: m.thread.id, name: m.thread.name, originMessage: m })
          }
          onVote={votePoll}
          editingId={editingId}
          editDraft={editDraft}
          onEditDraftChange={setEditDraft}
          onSubmitEdit={submitEdit}
          onCancelEdit={cancelEdit}
        />

        <Composer
          channelName={active?.name ?? null}
          canSend={Boolean(active?.canSend)}
          sending={sending}
          draft={draft}
          files={files}
          replyTo={replyTo}
          typingNames={typingNames}
          members={members}
          onDraftChange={onDraftChange}
          onAddFiles={addFiles}
          onRemoveFile={removeFile}
          onCancelReply={() => setReplyTo(null)}
          onSend={send}
          onOpenPollComposer={active?.canSend ? () => setPollComposerOpen(true) : undefined}
        />
      </main>

      {/* ── Members: inline from lg up, overlay below ─────────────────────── */}
      <aside className="hidden w-[212px] flex-shrink-0 border-l border-gray-100 lg:block">
        {memberRail}
      </aside>

      <AnimatePresence>
        {membersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMembersOpen(false)}
              className="fixed inset-0 z-40 bg-gray-900/40 lg:hidden"
              aria-hidden
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 h-full w-[248px] border-l border-gray-200 shadow-xl lg:hidden"
              aria-label="Members"
            >
              {memberRail}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeThread && (
          <ThreadPanel
            base={base}
            threadId={activeThread.id}
            threadName={activeThread.name}
            originMessage={activeThread.originMessage}
            resolve={resolve}
            onClose={() => setActiveThread(null)}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      <PollComposer
        open={pollComposerOpen}
        channelName={active?.name ?? null}
        busy={creatingPoll}
        onSubmit={createPoll}
        onCancel={() => setPollComposerOpen(false)}
      />

      <ConfirmDialog
        open={confirm === "server"}
        title="Disconnect Discord Server?"
        body="This will remove this Discord server from the current workspace. You can reconnect it at any time."
        confirmLabel="Disconnect"
        busyLabel="Disconnecting…"
        busy={working}
        onConfirm={disconnectServer}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === "account"}
        title="Log out of Discord?"
        body="You'll need to reconnect your Discord account to access Discord messages again. The server stays connected for your workspace."
        confirmLabel="Log Out"
        busyLabel="Logging out…"
        busy={working}
        onConfirm={logoutAccount}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === "all"}
        title="Log out all Discord connections?"
        body="This disconnects both your Discord account and this workspace's Discord server, returning Community to first-run setup. Removing the server affects everyone in this workspace. Nothing changes in Discord itself, and you can reconnect both at any time."
        confirmLabel="Log Out All"
        busyLabel="Logging out…"
        busy={working}
        onConfirm={logoutAll}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirmDeleteMessage !== null}
        title="Delete message?"
        body="This permanently deletes the message from Discord. This cannot be undone."
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={deletingMessage}
        onConfirm={confirmDeleteMessageHandler}
        onCancel={() => setConfirmDeleteMessage(null)}
      />
    </div>
  )
}

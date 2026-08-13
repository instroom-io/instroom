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
import { MemberList, type Presence } from "./_discord/MemberList"
import { CommunitySkeleton } from "./_discord/CommunitySkeleton"
import { rememberBrand } from "./_discord/ServerSwitcher"
import { ConfirmDialog } from "./_discord/ConfirmDialog"
import { DiscordCta } from "./_discord/ui"
import type { Channel, Message, Member } from "./_discord/types"
import type { MentionResolver } from "./_discord/markdown"
import { useUnread } from "./_discord/useUnread"

const MESSAGE_POLL_MS = 5_000
const CHANNEL_POLL_MS = 30_000
/** Discord's typing indicator lasts ~10s, so re-trigger below that. */
const TYPING_THROTTLE_MS = 8_000

/** Where Discord sends the user back to after an authorization round trip. */
const RETURN_TO = encodeURIComponent("/dashboard/community")
/** Starts the account link. Used by first-run setup, the gate, and Reconnect. */
const ACCOUNT_LINK_URL = `/api/community/discord/oauth/start?returnTo=${RETURN_TO}`

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
  const steps = [
    { n: 1, label: "Connect Discord Server", done: serverDone },
    { n: 2, label: "Connect Discord Account", done: accountDone },
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
                      ? "bg-[#5865F2] text-white"
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
            {i === 0 && <span aria-hidden className={`h-px w-6 ${serverDone ? "bg-[#1FAE5B]" : "bg-gray-200"}`} />}
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

  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
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
    botConfigured: boolean
    /** Last status request failed — state below is the last known good. */
    unreachable?: boolean
    lastError?: string | null
  } | null>(null)

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
      setStatus({
        connected: Boolean(data.connected),
        connection: data.connection ?? null,
        discordLinked: Boolean(data.discordLinked ?? data.accountLinked),
        discordUsername: data.discordUsername ?? null,
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
    const error = params.get("discordError")
    const cancelled = params.get("discordCancelled")
    if (!connected && !error && !cancelled) return

    if (connected) { showToast("Discord server connected"); loadStatus() }
    else if (error) showToast(error)
    else showToast("Discord connection cancelled")

    for (const k of ["discordConnected", "discordError", "discordCancelled"]) params.delete(k)
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
    } catch {
      /* transient — next tick retries */
    } finally {
      if (aliveRef.current) setLoadingMessages(false)
    }
  }, [base])

  useEffect(() => {
    if (!activeId) return
    setMessages([])
    setReplyTo(null)
    setSearch("")
    atBottomRef.current = true
    loadMessages(activeId, true)
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadMessages(activeId, false)
    }, MESSAGE_POLL_MS)
    return () => clearInterval(id)
  }, [activeId, loadMessages])

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
  const send = useCallback(async () => {
    const content = draft.trim()
    const attachments = files
    if ((!content && attachments.length === 0) || !activeId || sending) return

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
        // Give the text back rather than losing it. Files can't be restored
        // into an <input>, so the user is told explicitly.
        setDraft(content)
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
      setDraft(content)
      showToast("Couldn't send")
    } finally {
      setSending(false)
    }
  }, [draft, files, activeId, sending, replyTo, base, showToast])

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

  const [confirm, setConfirm] = useState<null | "server" | "account">(null)
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
          className="fixed bottom-6 left-1/2 z-[70] max-w-[90vw] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-[12px] text-white shadow-lg"
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
    const step = !status.connected ? 1 : 2
    const botMissing = status.connection?.status === "bot_missing"

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
              <h2 className="text-[16px] font-semibold text-gray-900">
                {botMissing ? "Finish connecting your Discord server" : "No Discord server connected."}
              </h2>
              <p className="max-w-md text-[13px] leading-relaxed text-gray-500">
                {botMissing
                  ? `We found ${status.connection?.guildName ?? "your server"}, but the Instroom bot hasn't been added yet. Authorize it to continue.`
                  : "Community runs on your own Discord server. Each workspace connects its own server, so your conversations stay in one place — and stay yours."}
              </p>
            </div>
            {status.botConfigured ? (
              <DiscordCta
                href={`/api/community/discord/install?brandId=${encodeURIComponent(brandId)}&returnTo=${RETURN_TO}`}
                icon={<IconBrandDiscord size={17} />}
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
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[16px] font-semibold text-gray-900">Connect your Discord account</h2>
              <p className="max-w-md text-[13px] leading-relaxed text-gray-500">
                <span className="font-medium text-gray-700">{status.connection?.guildName ?? "Your server"}</span> is
                connected. Now link your own Discord account so we can show you exactly the channels you have access
                to — and nothing you don&apos;t.
              </p>
            </div>
            <DiscordCta href={ACCOUNT_LINK_URL} icon={<IconLink size={16} />}>
              Connect Discord Account
            </DiscordCta>
            <p className="max-w-sm text-[11px] leading-relaxed text-gray-400">
              We only read your Discord username and your roles in this server. We never post as you.
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
        />

        <Composer
          channelName={active?.name ?? null}
          canSend={Boolean(active?.canSend)}
          sending={sending}
          draft={draft}
          files={files}
          replyTo={replyTo}
          typingNames={typingNames}
          onDraftChange={onDraftChange}
          onAddFiles={addFiles}
          onRemoveFile={removeFile}
          onCancelReply={() => setReplyTo(null)}
          onSend={send}
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
    </div>
  )
}

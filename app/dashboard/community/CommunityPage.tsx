"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  IconHash,
  IconUsers,
  IconSend,
  IconBrandDiscord,
  IconLoader2,
  IconCircleCheck,
  IconAlertCircle,
  IconExternalLink,
  IconPlugConnected,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ListSkeleton } from "@/components/shared/skeletons"

// ─── Types ───────────────────────────────────────────────────────────────────

type Channel = {
  id: string
  name: string
  description: string | null
  is_default: boolean
}

type MessageUser = {
  id: string
  name: string | null
  image: string | null
  email: string | null
}

type Message = {
  id: string
  body: string
  createdAt: string
  user: MessageUser
}

type Member = MessageUser & { role: string }

type DiscordStatus =
  | { state: "loading" }
  | { state: "disconnected" }
  | { state: "connecting" }
  | { state: "error"; message: string }
  | { state: "connected"; serverName: string; inviteUrl: string; connectedAs: string | null }

const MESSAGE_POLL_MS = 6000

function initials(name: string | null, email: string | null) {
  const source = name || email || "?"
  return source
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommunityPage({ brandId }: { brandId: string }) {
  const { data: session } = useSession()

  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [composerText, setComposerText] = useState("")
  const [sending, setSending] = useState(false)

  const [members, setMembers] = useState<Member[] | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)

  const [discordOpen, setDiscordOpen] = useState(false)
  const [discordStatus, setDiscordStatus] = useState<DiscordStatus>({ state: "loading" })
  const [discordForm, setDiscordForm] = useState({ serverName: "", inviteUrl: "" })
  const [discordFormError, setDiscordFormError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Channel id whose messages came bundled in the /channels response — the
  // messages-loading effect skips its initial fetch for this one channel.
  const preloadedChannelIdRef = useRef<string | null>(null)

  const activeChannel = channels?.find((c) => c.id === activeChannelId) ?? null

  // ── Load channels ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setChannels(null)
    setActiveChannelId(null)

    fetch(`/api/community/channels?brandId=${encodeURIComponent(brandId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const list: Channel[] = data.channels ?? []
        setChannels(list)
        if (data.initialChannelId && Array.isArray(data.initialMessages)) {
          preloadedChannelIdRef.current = data.initialChannelId
          setMessages(data.initialMessages)
          setMessagesLoading(false)
        }
        if (list.length > 0) setActiveChannelId(list[0].id)
      })
      .catch(() => {
        if (!cancelled) setChannels([])
      })

    return () => {
      cancelled = true
    }
  }, [brandId])

  // ── Load members ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/community/members?brandId=${encodeURIComponent(brandId)}`)
      .then((r) => r.json())
      .then((data) => setMembers(data.members ?? []))
      .catch(() => setMembers([]))
  }, [brandId])

  // ── Load Discord status ────────────────────────────────────────────────────
  const loadDiscordStatus = useCallback(() => {
    fetch(`/api/community/discord?brandId=${encodeURIComponent(brandId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setDiscordStatus({
            state: "connected",
            serverName: data.serverName ?? "Discord community",
            inviteUrl: data.inviteUrl ?? "",
            connectedAs: data.connectedAs ?? null,
          })
        } else {
          setDiscordStatus({ state: "disconnected" })
        }
      })
      .catch(() => setDiscordStatus({ state: "error", message: "Couldn't load Discord status" }))
  }, [brandId])

  useEffect(() => {
    loadDiscordStatus()
  }, [loadDiscordStatus])

  // ── Load + poll messages for the active channel ────────────────────────────
  const loadMessages = useCallback((channelId: string, showLoading: boolean) => {
    if (showLoading) setMessagesLoading(true)
    fetch(`/api/community/messages?brandId=${encodeURIComponent(brandId)}&channelId=${encodeURIComponent(channelId)}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => {})
      .finally(() => setMessagesLoading(false))
  }, [brandId])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (!activeChannelId) return

    // Messages for this channel already arrived bundled in the /channels
    // response — refresh quietly in the background instead of re-showing
    // the loading skeleton.
    const alreadyPreloaded = preloadedChannelIdRef.current === activeChannelId
    if (alreadyPreloaded) preloadedChannelIdRef.current = null
    loadMessages(activeChannelId, !alreadyPreloaded)
    // Simple polling for now — swap for a websocket/SSE subscription later
    // without touching any of the surrounding UI code.
    pollRef.current = setInterval(() => loadMessages(activeChannelId, false), MESSAGE_POLL_MS)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeChannelId, loadMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function handleSend() {
    const body = composerText.trim()
    if (!body || !activeChannelId || sending) return

    setSending(true)
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      body,
      createdAt: new Date().toISOString(),
      user: {
        id: session?.user?.id ?? "me",
        name: session?.user?.name ?? null,
        image: session?.user?.image ?? null,
        email: session?.user?.email ?? null,
      },
    }
    setMessages((prev) => [...prev, optimistic])
    setComposerText("")

    try {
      const res = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, channelId: activeChannelId, body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")

      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data.message : m)))
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setComposerText(body)
    } finally {
      setSending(false)
    }
  }

  async function handleDiscordConnect() {
    setDiscordFormError(null)
    if (!discordForm.serverName.trim() || !discordForm.inviteUrl.trim()) {
      setDiscordFormError("Server name and invite link are required")
      return
    }

    setDiscordStatus({ state: "connecting" })
    try {
      const res = await fetch("/api/community/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, ...discordForm }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to connect")

      setDiscordStatus({
        state: "connected",
        serverName: data.serverName,
        inviteUrl: data.inviteUrl,
        connectedAs: data.connectedAs ?? null,
      })
      setDiscordForm({ serverName: "", inviteUrl: "" })
    } catch (err: any) {
      setDiscordStatus({ state: "error", message: err.message || "Failed to connect Discord" })
    }
  }

  async function handleDiscordDisconnect() {
    setDiscordStatus({ state: "connecting" })
    try {
      await fetch(`/api/community/discord?brandId=${encodeURIComponent(brandId)}`, { method: "DELETE" })
      setDiscordStatus({ state: "disconnected" })
    } catch {
      loadDiscordStatus()
    }
  }

  const isDiscordConnected = discordStatus.state === "connected"

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] overflow-hidden bg-white">
      {/* ── Desktop channel rail ── */}
      <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 border-r border-gray-100 bg-gray-50/60">
        <div className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Channels
        </div>
        <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-0.5">
          {channels === null ? (
            <div className="flex flex-col gap-1 px-1 py-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 rounded-lg bg-gray-200 animate-pulse"
                  style={{ animationDelay: `${i * 30}ms` }}
                />
              ))}
            </div>
          ) : (
            channels.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveChannelId(c.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors",
                  c.id === activeChannelId
                    ? "bg-[#0F6B3E]/10 text-[#0F6B3E]"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <IconHash size={15} className="flex-shrink-0 opacity-60" />
                <span className="truncate">{c.name}</span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-gray-100 p-2 flex flex-col gap-1">
          <button
            onClick={() => setMembersOpen(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <IconUsers size={15} className="opacity-60" />
            Members
            <span className="ml-auto text-xs text-gray-400">{members?.length ?? "…"}</span>
          </button>
          <button
            onClick={() => setDiscordOpen(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <IconBrandDiscord size={15} className="opacity-60" />
            Discord
            <span
              className={cn(
                "ml-auto h-1.5 w-1.5 rounded-full",
                isDiscordConnected ? "bg-[#1FAE5B]" : "bg-gray-300"
              )}
            />
          </button>
        </div>
      </aside>

      {/* ── Main chat column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-2 border-b border-gray-100 px-3 py-2">
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(channels ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveChannelId(c.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  c.id === activeChannelId
                    ? "bg-[#0F6B3E] text-white"
                    : "bg-gray-100 text-gray-600"
                )}
              >
                <IconHash size={12} />
                {c.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setMembersOpen(true)}
            aria-label="Members"
            className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <IconUsers size={18} />
          </button>
          <button
            onClick={() => setDiscordOpen(true)}
            aria-label="Discord"
            className="relative flex-shrink-0 p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <IconBrandDiscord size={18} />
            <span
              className={cn(
                "absolute top-1 right-1 h-1.5 w-1.5 rounded-full",
                isDiscordConnected ? "bg-[#1FAE5B]" : "bg-gray-300"
              )}
            />
          </button>
        </div>

        {/* Desktop channel header */}
        <div className="hidden lg:flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <IconHash size={15} className="text-gray-400" />
              {activeChannel?.name ?? "—"}
            </div>
            {activeChannel?.description && (
              <div className="text-xs text-gray-400 truncate">{activeChannel.description}</div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 flex flex-col gap-4">
          {messagesLoading ? (
            <ListSkeleton rows={5} />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-6">
              <div className="w-11 h-11 rounded-xl bg-[#0F6B3E]/10 flex items-center justify-center">
                <IconHash size={20} className="text-[#0F6B3E]" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                No messages in #{activeChannel?.name} yet
              </p>
              <p className="text-xs text-gray-400 max-w-xs">
                Be the first to say something to the community.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex items-start gap-3">
                <Avatar>
                  {m.user.image && <AvatarImage src={m.user.image} alt={m.user.name ?? ""} />}
                  <AvatarFallback>{initials(m.user.name, m.user.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {m.user.name || m.user.email || "Unknown"}
                    </span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{formatTime(m.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-gray-100 p-3 flex items-end gap-2">
          <textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={activeChannel ? `Message #${activeChannel.name}` : "Message…"}
            rows={1}
            disabled={!activeChannelId}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B3E]/20 focus:border-[#0F6B3E]/40 max-h-32 disabled:bg-gray-50"
          />
          <Button
            onClick={handleSend}
            disabled={!composerText.trim() || sending || !activeChannelId}
            className="h-10 w-10 rounded-xl bg-[#0F6B3E] hover:bg-[#0a5a2f] p-0 flex-shrink-0"
          >
            {sending ? <IconLoader2 size={16} className="animate-spin" /> : <IconSend size={16} />}
          </Button>
        </div>
      </div>

      {/* ── Members dialog ── */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Community members</DialogTitle>
            <DialogDescription>Everyone with access to this brand's community.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 max-h-96 overflow-y-auto -mx-2 px-2">
            {members === null ? (
              <div className="flex flex-col gap-2 py-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                    <div className="h-3 w-1/2 rounded-md bg-gray-200 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">No members yet</div>
            ) : (
              members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                  <Avatar>
                    {m.image && <AvatarImage src={m.image} alt={m.name ?? ""} />}
                    <AvatarFallback>{initials(m.name, m.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{m.name || m.email}</div>
                    <div className="text-xs text-gray-400 capitalize">{m.role}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Discord dialog ── */}
      <Dialog open={discordOpen} onOpenChange={setDiscordOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconBrandDiscord size={20} className="text-[#5865F2]" />
              Discord
            </DialogTitle>
            <DialogDescription>
              Connect a Discord server so your community can chat there too.
            </DialogDescription>
          </DialogHeader>

          {discordStatus.state === "loading" && (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-400">
              <IconLoader2 size={16} className="animate-spin" />
              Checking connection…
            </div>
          )}

          {discordStatus.state === "connecting" && (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-400">
              <IconLoader2 size={16} className="animate-spin" />
              Connecting…
            </div>
          )}

          {discordStatus.state === "connected" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                <div className="w-10 h-10 rounded-lg bg-[#5865F2] flex items-center justify-center flex-shrink-0">
                  <IconBrandDiscord size={20} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{discordStatus.serverName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-[#0F6B3E]">
                    <IconCircleCheck size={13} />
                    Connected{discordStatus.connectedAs ? ` by ${discordStatus.connectedAs}` : ""}
                  </div>
                </div>
              </div>

              <a href={discordStatus.inviteUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-[#5865F2] hover:bg-[#4752C4] gap-2">
                  <IconExternalLink size={15} />
                  Open Discord community
                </Button>
              </a>

              <Button variant="outline" onClick={handleDiscordDisconnect} className="w-full text-red-600 border-red-200 hover:bg-red-50">
                Disconnect
              </Button>
            </div>
          )}

          {(discordStatus.state === "disconnected" || discordStatus.state === "error") && (
            <div className="flex flex-col gap-4">
              {discordStatus.state === "error" && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                  <IconAlertCircle size={14} className="flex-shrink-0" />
                  {discordStatus.message}
                </div>
              )}

              <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 p-3.5">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <IconPlugConnected size={18} className="text-gray-400" />
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  Not connected yet. Paste your server's invite link below to connect it to this community.
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Server name</label>
                  <Input
                    placeholder="e.g. Instroom Creators"
                    value={discordForm.serverName}
                    onChange={(e) => setDiscordForm((f) => ({ ...f, serverName: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Invite link</label>
                  <Input
                    placeholder="https://discord.gg/..."
                    value={discordForm.inviteUrl}
                    onChange={(e) => setDiscordForm((f) => ({ ...f, inviteUrl: e.target.value }))}
                  />
                </div>
                {discordFormError && (
                  <p className="text-xs text-red-600">{discordFormError}</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDiscordOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleDiscordConnect} className="bg-[#5865F2] hover:bg-[#4752C4] gap-2">
                  <IconBrandDiscord size={15} />
                  Connect Discord
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

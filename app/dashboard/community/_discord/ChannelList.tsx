"use client"
// The channel rail.
//
// Deliberately has no "Community" header of its own — the page header already
// says Community, and repeating it inside the panel wastes the most valuable
// row in the sidebar. Channels start at the very top, the way Discord does it.

import { memo, useCallback, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconHash, IconVolume, IconSpeakerphone, IconChevronDown, IconLock,
} from "@tabler/icons-react"
import type { Channel, ChannelCategory } from "./types"
import { ServerSwitcher } from "./ServerSwitcher"
import { SectionLabel, Skeleton } from "./ui"

const UNCATEGORISED = "__none__"

/** Groups channels by category, preserving the server-side ordering. */
function groupChannels(channels: Channel[]): ChannelCategory[] {
  const order: string[] = []
  const map = new Map<string, ChannelCategory>()

  for (const c of channels) {
    // Forums can't be rendered as a message list — they're threads all the way
    // down. Hidden rather than shown as something that won't open.
    if (c.type === "forum") continue
    const id = c.parentId ?? UNCATEGORISED
    if (!map.has(id)) {
      map.set(id, { id, name: c.parentName ?? "Channels", channels: [] })
      order.push(id)
    }
    map.get(id)!.channels.push(c)
  }

  return order.map((id) => map.get(id)!)
}

function ChannelIcon({ channel }: { channel: Channel }) {
  const cls = "flex-shrink-0 text-gray-400"
  if (channel.type === "voice") return <IconVolume size={15} className={cls} aria-hidden />
  if (channel.type === "announcement") return <IconSpeakerphone size={15} className={cls} aria-hidden />
  if (!channel.canSend) return <IconLock size={14} className={cls} aria-hidden />
  return <IconHash size={15} className={cls} aria-hidden />
}

/* ── One row ──────────────────────────────────────────────────────────────── */
// Memoised on the three things that can change its appearance. Without this,
// every message poll would re-render the whole rail.

const ChannelRow = memo(function ChannelRow({
  channel,
  isActive,
  isUnread,
  onSelect,
}: {
  channel: Channel
  isActive: boolean
  isUnread: boolean
  onSelect: (id: string) => void
}) {
  const isVoice = channel.type === "voice"

  return (
    <div className="relative">
      {/* Discord's unread pill: a white bar on the rail edge, not a dot in the row. */}
      {isUnread && !isActive && (
        <motion.span
          layout
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          className="absolute -left-2 top-1/2 h-2 w-1 -translate-y-1/2 rounded-r-full bg-gray-900"
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={() => !isVoice && onSelect(channel.id)}
        disabled={isVoice}
        aria-current={isActive ? "true" : undefined}
        title={isVoice ? `${channel.name} — voice channels open in Discord` : channel.topic ?? channel.name}
        className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-[5px] text-left text-[13.5px] transition-colors ${
          isActive
            ? "bg-[#0F6B3E]/10 font-medium text-[#0F6B3E]"
            : isUnread
              ? "font-medium text-gray-900 hover:bg-gray-100"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        } ${isVoice ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <ChannelIcon channel={channel} />
        <span className="truncate">{channel.name}</span>
        {channel.nsfw && (
          <span className="ml-auto rounded bg-red-50 px-1 text-[9px] font-semibold uppercase text-red-500">
            18+
          </span>
        )}
      </button>
    </div>
  )
})

/* ── Category ─────────────────────────────────────────────────────────────── */

const Category = memo(function Category({
  category,
  activeId,
  unread,
  collapsed,
  onToggle,
  onSelect,
}: {
  category: ChannelCategory
  activeId: string | null
  unread: Set<string>
  collapsed: boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}) {
  // A collapsed category still has to reveal that something happened inside it,
  // otherwise collapsing a category would silently hide new messages.
  const hiddenUnread = useMemo(
    () => collapsed && category.channels.some((c) => unread.has(c.id) && c.id !== activeId),
    [collapsed, category.channels, unread, activeId]
  )

  // Collapsing hides everything except the channel you're currently reading —
  // losing sight of the open channel would be disorienting.
  const visible = collapsed
    ? category.channels.filter((c) => c.id === activeId || unread.has(c.id))
    : category.channels

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => onToggle(category.id)}
        aria-expanded={!collapsed}
        className="group/cat flex w-full items-center gap-0.5 px-1 pb-1 text-gray-400 transition-colors hover:text-gray-600"
      >
        <motion.span animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.15 }} className="flex">
          <IconChevronDown size={12} aria-hidden />
        </motion.span>
        <SectionLabel className="truncate text-current">{category.name}</SectionLabel>
        {hiddenUnread && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-gray-900" aria-label="unread messages" />}
      </button>

      <AnimatePresence initial={false}>
        <motion.div layout className="flex flex-col gap-[1px] pl-1">
          {visible.map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              isActive={c.id === activeId}
              isUnread={unread.has(c.id)}
              onSelect={onSelect}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
})

/* ── Rail ─────────────────────────────────────────────────────────────────── */

export function ChannelList({
  channels,
  activeId,
  unread,
  brandId,
  guildName,
  guildIconUrl,
  discordUsername,
  onSelect,
  onSwitchServer,
  onRefresh,
  onMarkAllRead,
  onDisconnectServer,
  onReconnectAccount,
  onLogoutAccount,
  onLogoutAll,
}: {
  channels: Channel[] | null
  activeId: string | null
  unread: Set<string>
  brandId: string
  guildName: string | null
  guildIconUrl: string | null
  discordUsername: string | null
  onSelect: (id: string) => void
  onSwitchServer: (brandId: string) => void
  onRefresh: () => void
  onMarkAllRead: () => void
  onDisconnectServer: () => void
  onReconnectAccount: () => void
  onLogoutAccount: () => void
  onLogoutAll: () => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const categories = useMemo(() => groupChannels(channels ?? []), [channels])
  const hasUnread = unread.size > 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F7F9F8]">
      {/* The server identity, and the control for changing it. Mark-all-read and
          refresh live inside it so the rail still opens straight onto channels. */}
      <ServerSwitcher
        brandId={brandId}
        guildName={guildName}
        guildIconUrl={guildIconUrl}
        hasUnread={hasUnread}
        discordUsername={discordUsername}
        onSwitch={onSwitchServer}
        onRefresh={onRefresh}
        onMarkAllRead={onMarkAllRead}
        onDisconnectServer={onDisconnectServer}
        onReconnectAccount={onReconnectAccount}
        onLogoutAccount={onLogoutAccount}
        onLogoutAll={onLogoutAll}
      />

      <nav aria-label="Channels" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {channels === null ? (
          <div className="flex flex-col gap-1 px-1">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} rounded="rounded-md" className="h-7" delayMs={i * 60} />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] leading-relaxed text-gray-400">
            No channels you can see yet.
          </p>
        ) : (
          categories.map((cat) => (
            <Category
              key={cat.id}
              category={cat}
              activeId={activeId}
              unread={unread}
              collapsed={collapsed.has(cat.id)}
              onToggle={toggle}
              onSelect={onSelect}
            />
          ))
        )}
      </nav>
    </div>
  )
}

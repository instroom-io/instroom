"use client"
// The member rail.
//
// Grouped by top role with role-coloured names, the way Discord does it, so the
// hierarchy of a server is visible at a glance rather than being a flat list.
//
// On presence: Discord delivers online/offline only over the Gateway — REST has
// no presence field at all, and the members route reports `presenceAvailable`
// accordingly. So the status ring renders only when a real presence feed exists.
// The alternative — showing everyone as "online", or picking a colour per
// member — would be a decorative lie about who is actually around.

import { memo, useMemo, useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { IconBrandDiscord, IconCopy } from "@tabler/icons-react"
import type { Member } from "./types"
import { SectionLabel, SkeletonRow } from "./ui"

export type Presence = "online" | "idle" | "dnd" | "offline"

const PRESENCE_COLOR: Record<Presence, string> = {
  online: "#1FAE5B",
  idle: "#F0B232",
  dnd: "#F23F43",
  offline: "#B5BAC1",
}

/* ── Popover ──────────────────────────────────────────────────────────────── */

function MemberPopover({
  member,
  presence,
  anchor,
  onClose,
}: {
  member: Member
  presence: Presence | null
  anchor: DOMRect
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  // Fixed positioning off the trigger's rect, clamped into the viewport so a
  // member near the bottom of a long list still opens fully visible.
  const WIDTH = 244
  const ESTIMATED_HEIGHT = 200
  const top = Math.min(anchor.top, Math.max(8, window.innerHeight - ESTIMATED_HEIGHT - 8))
  const left = Math.max(8, anchor.left - WIDTH - 8)

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={`${member.displayName} profile`}
      initial={{ opacity: 0, scale: 0.96, x: 6 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.96, x: 6 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      style={{ position: "fixed", top, left, width: WIDTH }}
      className="z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
    >
      <div className="h-14" style={{ backgroundColor: member.roleColor ?? "#0F6B3E" }} />
      <div className="px-3 pb-3">
        <div className="-mt-7 mb-2 flex items-end justify-between">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={member.avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full border-[3px] border-white bg-gray-100 object-cover"
            />
            {presence && (
              <span
                className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-white"
                style={{ backgroundColor: PRESENCE_COLOR[presence] }}
                aria-label={presence}
              />
            )}
          </div>
          {member.bot && (
            <span className="mb-1 rounded bg-[#0F6B3E] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              Bot
            </span>
          )}
        </div>

        <p className="truncate text-[15px] font-semibold text-gray-900">{member.displayName}</p>
        <p className="truncate text-[11.5px] text-gray-400">@{member.username}</p>

        {member.roleName && (
          <div className="mt-2.5">
            <SectionLabel className="mb-1 block">Role</SectionLabel>
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11.5px] font-medium text-gray-700"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: member.roleColor ?? "#B5BAC1" }}
              />
              {member.roleName}
            </span>
          </div>
        )}

        <div className="mt-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(member.username)
              setCopied(true)
              setTimeout(() => setCopied(false), 1400)
            }}
            className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11.5px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <IconCopy size={12} aria-hidden />
            {copied ? "Copied" : "Username"}
          </button>
          <a
            href={`https://discord.com/users/${member.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0F6B3E] text-[11.5px] font-medium text-white transition-colors hover:bg-[#166534]"
          >
            <IconBrandDiscord size={12} aria-hidden />
            Profile
          </a>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Row ──────────────────────────────────────────────────────────────────── */

const MemberRow = memo(function MemberRow({
  member,
  presence,
  dim,
  onOpen,
}: {
  member: Member
  presence: Presence | null
  /** Offline members are faded, and brighten on hover so they stay usable. */
  dim?: boolean
  onOpen: (m: Member, rect: DOMRect) => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => onOpen(member, e.currentTarget.getBoundingClientRect())}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-all hover:bg-gray-200/60 ${
        dim ? "opacity-40 hover:opacity-100" : ""
      }`}
    >
      <span className="relative flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={member.avatarUrl}
          alt=""
          loading="lazy"
          className="h-[26px] w-[26px] rounded-full bg-gray-200 object-cover"
        />
        {presence && (
          <span
            className="absolute -bottom-px -right-px h-[9px] w-[9px] rounded-full border-2 border-[#F7F9F8]"
            style={{ backgroundColor: PRESENCE_COLOR[presence] }}
            aria-label={presence}
          />
        )}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-[13px] font-medium"
        style={{ color: member.roleColor ?? "#4B5563" }}
      >
        {member.displayName}
      </span>
      {member.bot && (
        <span className="flex-shrink-0 rounded bg-[#0F6B3E] px-1 text-[8.5px] font-bold uppercase text-white">
          Bot
        </span>
      )}
    </button>
  )
})

/* ── Rail ─────────────────────────────────────────────────────────────────── */

export function MemberList({
  members,
  loading,
  error,
  presenceById,
}: {
  members: Member[]
  loading: boolean
  error: string | null
  /** Populated only when a real presence source exists; empty means unknown. */
  presenceById: Record<string, Presence>
}) {
  const [open, setOpen] = useState<{ member: Member; rect: DOMRect } | null>(null)

  // Presence splits the list into ONLINE / OFFLINE / BOTS. Without a presence
  // feed there is no honest way to fill those two buckets, so humans collapse
  // into one MEMBERS section grouped by role — real information instead of a
  // guess at who is around. The moment presence arrives, the split appears with
  // no other change.
  const hasPresence = Object.keys(presenceById).length > 0

  const sections = useMemo(() => {
    const bots = members.filter((m) => m.bot)
    const humans = members.filter((m) => !m.bot)
    const out: { name: string; list: Member[]; dim?: boolean }[] = []

    if (hasPresence) {
      const online = humans.filter((m) => (presenceById[m.id] ?? "offline") !== "offline")
      const offline = humans.filter((m) => (presenceById[m.id] ?? "offline") === "offline")
      if (online.length > 0) out.push({ name: "Online", list: online })
      if (offline.length > 0) out.push({ name: "Offline", list: offline, dim: true })
    } else {
      // Grouped by top role, ordered by size (a proxy for hierarchy — the
      // members route returns the top role's name but not its position).
      const byRole = new Map<string, Member[]>()
      for (const m of humans) {
        const key = m.roleName ?? "Members"
        byRole.set(key, [...(byRole.get(key) ?? []), m])
      }
      out.push(
        ...[...byRole.entries()]
          .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
          .map(([name, list]) => ({ name, list }))
      )
    }

    // Bots last either way — they aren't part of the human hierarchy.
    if (bots.length > 0) out.push({ name: "Bots", list: bots })
    return out
  }, [members, presenceById, hasPresence])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F7F9F8]">
      <div className="flex items-center gap-1.5 border-b border-gray-200/70 px-3 py-2.5">
        <SectionLabel>Members</SectionLabel>
        {members.length > 0 && (
          <span className="rounded-full bg-gray-200/80 px-1.5 text-[10px] font-semibold tabular-nums text-gray-600">
            {members.length}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          // Skeleton rows, not a spinner — the member rail loads inside an
          // already-visible layout, so it should fill in rather than blink.
          <div className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, i) => (
              <SkeletonRow
                key={i}
                className="px-2 py-1"
                width={`${46 + ((i * 19) % 44)}%`}
                delayMs={i * 60}
              />
            ))}
          </div>
        ) : error ? (
          <p className="px-2 py-4 text-[11px] leading-relaxed text-gray-400">{error}</p>
        ) : members.length === 0 ? (
          <p className="px-2 py-4 text-center text-[11px] text-gray-400">No members to show.</p>
        ) : (
          sections.map((s) => (
            <div key={s.name} className="mb-3.5">
              <div className="flex items-center gap-1 px-2 pb-1">
                <SectionLabel className="truncate">{s.name}</SectionLabel>
                <span className="text-[10px] tabular-nums text-gray-400">— {s.list.length}</span>
              </div>
              <div className="flex flex-col gap-[1px]">
                {s.list.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    presence={presenceById[m.id] ?? null}
                    dim={s.dim}
                    onOpen={(member, rect) => setOpen({ member, rect })}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {open && (
          <MemberPopover
            member={open.member}
            presence={presenceById[open.member.id] ?? null}
            anchor={open.rect}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

"use client"
// The server header, as a switcher.
//
// One brand owns exactly one Discord server — that is enforced in the schema
// (BrandDiscordConnection.brand_id is unique, and guild_id is unique across the
// table so two tenants can never claim the same guild). So "which server am I
// looking at" and "which brand am I in" are the same question, and switching
// server means pointing the page at a different brandId.
//
// That matters for isolation: this component never sends a guild id anywhere.
// It changes one search param, and every existing brand-scoped route re-runs
// guardBrand against the new brand. A user who picks a brand they aren't a
// member of gets the same 403 they would get by typing the id by hand.
//
// The server list is fetched lazily — nothing is requested until the menu is
// opened for the first time — so the common case (never touching the switcher)
// costs no requests at all.

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  IconChevronDown, IconCheck, IconLoader2, IconRefresh, IconChecks,
  IconPlugConnectedX, IconDotsVertical, IconArrowsLeftRight, IconBrandDiscord,
  IconRefreshDot, IconLogout,
} from "@tabler/icons-react"
import { INSTROOM_GREEN } from "./types"
import { DropdownPanel, SectionLabel, SkeletonRow } from "./ui"

/** localStorage key holding the last brand opened in Community. */
const LAST_BRAND_KEY = "instroom:community:lastBrandId"

export function rememberBrand(brandId: string) {
  try {
    window.localStorage.setItem(LAST_BRAND_KEY, brandId)
  } catch {
    /* private mode / storage disabled — the switcher still works, it just
       won't restore. Never let this throw into a render path. */
  }
}

function recallBrand(): string | null {
  try {
    return window.localStorage.getItem(LAST_BRAND_KEY)
  } catch {
    return null
  }
}

/** Nothing mutates the key while a single Community page is mounted. */
const noopSubscribe = () => () => {}

/**
 * The remembered brand, read without an effect.
 *
 * This is the supported way to read a browser-only store during render:
 * getServerSnapshot supplies null for the prerender and the hydration pass, and
 * React then re-renders with the real value. Reading localStorage directly in
 * render would be a hydration mismatch, and reading it in an effect would mean
 * a setState and a second render just to learn something already known.
 */
export function useLastBrand(): string | null {
  return useSyncExternalStore(noopSubscribe, recallBrand, () => null)
}

/* ── Data ─────────────────────────────────────────────────────────────────── */

type BrandRow = {
  id: string
  name: string
  /** Null until this brand's status has been fetched. */
  guildName: string | null
  guildIconUrl: string | null
  /** False when the brand has no Discord server connected yet. */
  connected: boolean
  /** The status lookup for this row hasn't returned yet. */
  pending: boolean
}

type ApiBrand = { id: string; name: string }

/**
 * Brand list first, then each brand's Discord status in parallel.
 *
 * Both endpoints already exist and are unchanged: GET /api/brands/me is what
 * the rest of the dashboard uses to enumerate brands, and the per-brand status
 * route is the same one this page already calls for the active brand. Statuses
 * resolve independently so one slow brand doesn't hold up the whole menu.
 */
function useServerList(open: boolean, currentBrandId: string) {
  const [rows, setRows] = useState<BrandRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Fetch once per mount. Reopening the menu shows what we already have.
  const loadedRef = useRef(false)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  useEffect(() => {
    if (!open || loadedRef.current) return
    loadedRef.current = true

    ;(async () => {
      try {
        const res = await fetch("/api/brands/me")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const brands: ApiBrand[] = data.brands ?? []
        if (!aliveRef.current) return

        if (brands.length === 0) {
          setRows([])
          return
        }

        // Render the names immediately; server identity fills in per row.
        setRows(
          brands.map((b) => ({
            id: b.id,
            name: b.name,
            guildName: null,
            guildIconUrl: null,
            connected: false,
            pending: true,
          }))
        )

        await Promise.all(
          brands.map(async (b) => {
            try {
              const r = await fetch(
                `/api/brands/${encodeURIComponent(b.id)}/integrations/discord/status`
              )
              const d = r.ok ? await r.json() : null
              if (!aliveRef.current) return
              setRows((prev) =>
                (prev ?? []).map((row) =>
                  row.id === b.id
                    ? {
                        ...row,
                        guildName: d?.connection?.guildName ?? null,
                        guildIconUrl: d?.connection?.guildIconUrl ?? null,
                        connected: Boolean(d?.connected),
                        pending: false,
                      }
                    : row
                )
              )
            } catch {
              if (!aliveRef.current) return
              // A failed status check is "unknown", not "disconnected" — the
              // row stays selectable rather than being greyed out on a blip.
              setRows((prev) =>
                (prev ?? []).map((row) => (row.id === b.id ? { ...row, pending: false } : row))
              )
            }
          })
        )
      } catch {
        if (aliveRef.current) setError("Couldn't load your servers.")
      }
    })()
  }, [open, currentBrandId])

  return { rows, error }
}

/* ── Icon ─────────────────────────────────────────────────────────────────── */

const ServerIcon = memo(function ServerIcon({
  name,
  iconUrl,
  size,
}: {
  name: string
  iconUrl: string | null
  size: number
}) {
  if (iconUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        className="flex-shrink-0 rounded-lg object-cover"
        style={{ height: size, width: size }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="flex flex-shrink-0 items-center justify-center rounded-lg font-bold text-white"
      style={{
        height: size,
        width: size,
        backgroundColor: INSTROOM_GREEN,
        fontSize: Math.round(size * 0.44),
      }}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  )
})

/* ── Row ──────────────────────────────────────────────────────────────────── */

const ServerRow = memo(function ServerRow({
  row,
  isCurrent,
  isSwitching,
  onPick,
}: {
  row: BrandRow
  isCurrent: boolean
  isSwitching: boolean
  onPick: (id: string) => void
}) {
  // The Discord server name is the identity the user recognises; the brand name
  // is the secondary line. Before status resolves, the brand name is all we
  // have, so it takes the primary slot rather than showing a blank row.
  const primary = row.guildName ?? row.name
  const secondary = row.guildName && row.guildName !== row.name ? row.name : null

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => onPick(row.id)}
      disabled={isSwitching}
      aria-current={isCurrent ? "true" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
        isCurrent ? "bg-[#0F6B3E]/10" : "hover:bg-gray-100"
      } ${isSwitching ? "cursor-wait opacity-60" : ""}`}
    >
      <ServerIcon name={primary} iconUrl={row.guildIconUrl} size={26} />

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[13px] ${
            isCurrent ? "font-semibold text-[#0F6B3E]" : "font-medium text-gray-800"
          }`}
        >
          {primary}
        </span>
        {secondary ? (
          <span className="block truncate text-[10.5px] text-gray-400">{secondary}</span>
        ) : !row.pending && !row.connected ? (
          <span className="flex items-center gap-1 text-[10.5px] text-gray-400">
            <IconPlugConnectedX size={10} aria-hidden />
            Not connected
          </span>
        ) : null}
      </span>

      {isSwitching ? (
        <IconLoader2 size={13} className="flex-shrink-0 animate-spin text-gray-400" aria-hidden />
      ) : row.pending ? (
        <span className="h-3 w-3 flex-shrink-0 animate-pulse rounded-full bg-gray-200" aria-hidden />
      ) : isCurrent ? (
        <IconCheck size={14} className="flex-shrink-0 text-[#0F6B3E]" aria-hidden />
      ) : null}
    </button>
  )
})

/* ── Switcher ─────────────────────────────────────────────────────────────── */

/** One row in the actions menu. */
function MenuItem({
  icon,
  label,
  hint,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
        danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span className={`flex-shrink-0 ${danger ? "text-red-500" : "text-gray-400"}`} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium">{label}</span>
        {hint && <span className="block truncate text-[10.5px] text-gray-400">{hint}</span>}
      </span>
    </button>
  )
}

/** Which dropdown is open. Only ever one — they share the same anchor. */
type OpenMenu = null | "servers" | "actions"

export function ServerSwitcher({
  brandId,
  guildName,
  guildIconUrl,
  hasUnread,
  discordUsername,
  onSwitch,
  onRefresh,
  onMarkAllRead,
  onDisconnectServer,
  onReconnectAccount,
  onLogoutAccount,
  onLogoutAll,
}: {
  brandId: string
  guildName: string | null
  guildIconUrl: string | null
  hasUnread: boolean
  /** The linked Discord account's display name, if any. */
  discordUsername: string | null
  /** Called with the chosen brand id. The parent owns navigation. */
  onSwitch: (brandId: string) => void
  onRefresh: () => void
  onMarkAllRead: () => void
  /** Opens the disconnect confirmation. The parent owns the request. */
  onDisconnectServer: () => void
  onReconnectAccount: () => void
  /** Opens the log-out confirmation. The parent owns the request. */
  onLogoutAccount: () => void
  onLogoutAll: () => void
}) {
  const [menu, setMenu] = useState<OpenMenu>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const open = menu === "servers"
  const { rows, error } = useServerList(open, brandId)

  // Close on outside click and on Escape. Both listeners exist only while a
  // menu is open, so a closed switcher costs nothing.
  useEffect(() => {
    if (menu === null) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [menu])

  const pick = useCallback(
    (id: string) => {
      if (id === brandId) {
        setMenu(null)
        return
      }
      // The spinner stays on the row until this component unmounts with the
      // page — switching remounts the client, so there is no "done" callback
      // to wait for and no state to clear.
      setSwitching(id)
      rememberBrand(id)
      onSwitch(id)
    },
    [brandId, onSwitch]
  )

  const label = guildName ?? "Select a server"

  return (
    <div ref={wrapRef} className="relative border-b border-gray-200/70">
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          type="button"
          onClick={() => setMenu((m) => (m === "servers" ? null : "servers"))}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Current server: ${label}. Switch server`}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors ${
            open ? "bg-gray-200/70" : "hover:bg-gray-200/60"
          }`}
        >
          <ServerIcon name={label} iconUrl={guildIconUrl} size={24} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-900">
            {label}
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-shrink-0 text-gray-400"
            aria-hidden
          >
            <IconChevronDown size={14} />
          </motion.span>
        </button>

        {hasUnread && (
          <button
            type="button"
            onClick={onMarkAllRead}
            title="Mark all as read"
            aria-label="Mark all channels as read"
            className="flex-shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-600"
          >
            <IconChecks size={14} />
          </button>
        )}
        {/* Refresh moved in here rather than sitting beside it: three icons in
            a 228px rail crowded out the server name. */}
        <button
          type="button"
          onClick={() => setMenu((m) => (m === "actions" ? null : "actions"))}
          title="Server options"
          aria-label="Server options"
          aria-haspopup="menu"
          aria-expanded={menu === "actions"}
          className={`flex-shrink-0 rounded p-1 transition-colors ${
            menu === "actions"
              ? "bg-gray-200/70 text-gray-600"
              : "text-gray-400 hover:bg-gray-200/70 hover:text-gray-600"
          }`}
        >
          <IconDotsVertical size={14} />
        </button>
      </div>

      <AnimatePresence>
        {menu === "actions" && (
          <DropdownPanel label="Server options" origin="top right">
            <SectionLabel className="block px-2 pb-1 pt-0.5">Server</SectionLabel>
            <MenuItem
              icon={<IconArrowsLeftRight size={15} />}
              label="Switch Server"
              onClick={() => setMenu("servers")}
            />
            <MenuItem
              icon={<IconRefresh size={15} />}
              label="Refresh"
              onClick={() => { setMenu(null); onRefresh() }}
            />
            <MenuItem
              icon={<IconPlugConnectedX size={15} />}
              label="Disconnect Server"
              hint="Removes it from this workspace only"
              danger
              onClick={() => { setMenu(null); onDisconnectServer() }}
            />

            <div className="my-1 h-px bg-gray-100" />

            <SectionLabel className="block px-2 pb-1 pt-0.5">Your Discord account</SectionLabel>
            {/* Not a button — it's the answer to "which account am I signed in
                as", which is the first thing you want before logging out. */}
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <IconBrandDiscord size={15} className="flex-shrink-0 text-[#5865F2]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-gray-700">
                  {discordUsername ?? "Connected"}
                </span>
                <span className="block text-[10.5px] text-gray-400">Connected account</span>
              </span>
            </div>
            <MenuItem
              icon={<IconRefreshDot size={15} />}
              label="Reconnect Discord"
              hint="Re-run the account link"
              onClick={() => { setMenu(null); onReconnectAccount() }}
            />
            <MenuItem
              icon={<IconLogout size={15} />}
              label="Log Out Discord"
              hint="Keeps the server connected"
              danger
              onClick={() => { setMenu(null); onLogoutAccount() }}
            />

            <div className="my-1 h-px bg-gray-100" />

            {/* Last, and separated: it is the widest-reaching action in this
                menu — both connections at once, back to first-run setup. */}
            <MenuItem
              icon={<IconLogout size={15} />}
              label="Log Out All"
              hint="Disconnects the account and the server"
              danger
              onClick={() => { setMenu(null); onLogoutAll() }}
            />
          </DropdownPanel>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <DropdownPanel label="Your servers" className="max-h-[320px] overflow-y-auto">
            <SectionLabel className="block px-2 pb-1 pt-0.5">Your servers</SectionLabel>

            {error ? (
              <p className="px-2 py-3 text-[11.5px] leading-relaxed text-gray-400">{error}</p>
            ) : rows === null ? (
              <div className="flex flex-col gap-1 p-1">
                {[0, 1, 2].map((i) => (
                  <SkeletonRow
                    key={i}
                    className="px-1 py-1"
                    avatarRounded="rounded-lg"
                    width={`${52 + i * 14}%`}
                    delayMs={i * 70}
                  />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="px-2 py-3 text-[11.5px] leading-relaxed text-gray-400">
                No other servers available.
              </p>
            ) : (
              <div className="flex flex-col gap-[1px]">
                {rows.map((r) => (
                  <ServerRow
                    key={r.id}
                    row={r}
                    isCurrent={r.id === brandId}
                    isSwitching={switching === r.id}
                    onPick={pick}
                  />
                ))}
              </div>
            )}
          </DropdownPanel>
        )}
      </AnimatePresence>
    </div>
  )
}

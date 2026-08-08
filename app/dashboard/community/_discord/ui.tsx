"use client"
// Shared presentation primitives for the Discord surface.
//
// These exist because the same four things were being re-typed in every panel,
// and drifting each time they were: section labels rendered at 10px in one rail
// and 10.5px in the next, in gray-400 here and gray-500 there; skeleton bars
// picked their own grey; two dropdowns animated with the same numbers written
// twice. None of that is visible as a bug, which is exactly why it accumulates.
//
// Anything used by two or more components in this folder belongs here. Anything
// used once should stay where it is used.

import type { CSSProperties, ReactNode } from "react"
import { motion } from "framer-motion"

/** Shared easing for panels and dialogs, so they feel like one system. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

/**
 * One shimmering placeholder bar.
 *
 * `delayMs` staggers a column of them so a loading list reads as a wave rather
 * than one block pulsing in unison.
 */
export function Skeleton({
  className = "",
  width,
  delayMs = 0,
  rounded = "rounded",
}: {
  className?: string
  /** Any CSS width — percentages are typical for text bars. */
  width?: string | number
  delayMs?: number
  rounded?: string
}) {
  const style: CSSProperties = {}
  if (width !== undefined) style.width = width
  if (delayMs) style.animationDelay = `${delayMs}ms`

  return (
    <div
      aria-hidden
      className={`animate-pulse bg-gray-200/70 ${rounded} ${className}`}
      style={style}
    />
  )
}

/** Avatar-and-two-lines row, the shape every loading list in here needs. */
export function SkeletonRow({
  avatarSize = 26,
  avatarRounded = "rounded-full",
  width,
  delayMs = 0,
  className = "",
}: {
  avatarSize?: number
  avatarRounded?: string
  width?: string
  delayMs?: number
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Skeleton
        rounded={avatarRounded}
        className="flex-shrink-0"
        width={avatarSize}
        delayMs={delayMs}
      />
      <Skeleton className="h-3" width={width} delayMs={delayMs} />
    </div>
  )
}

/* ── Section label ────────────────────────────────────────────────────────── */

/**
 * The small uppercase heading above a group of rows — channel categories,
 * member sections, menu sections. One size and one colour everywhere.
 */
export function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 ${className}`}
    >
      {children}
    </span>
  )
}

/* ── Dropdown panel ───────────────────────────────────────────────────────── */

/**
 * A menu surface anchored under the rail header. Both the server list and the
 * options menu are this; only their contents differ.
 */
export function DropdownPanel({
  label,
  origin = "top center",
  className = "",
  children,
}: {
  /** Accessible name for the menu. */
  label: string
  origin?: string
  className?: string
  children: ReactNode
}) {
  return (
    <motion.div
      role="menu"
      aria-label={label}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15, ease: EASE_OUT }}
      style={{ transformOrigin: origin }}
      className={`absolute left-2 right-2 top-[calc(100%-2px)] z-50 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg shadow-gray-900/10 ${className}`}
    >
      {children}
    </motion.div>
  )
}

/* ── Discord CTA ──────────────────────────────────────────────────────────── */

/**
 * The blurple "connect something to Discord" link.
 *
 * Discord's own brand colour, deliberately, rather than Instroom green: it
 * marks the actions that hand the user off to discord.com, which is worth
 * signalling before they click.
 */
export function DiscordCta({
  href,
  size = "lg",
  icon,
  children,
  className = "",
}: {
  href: string
  size?: "lg" | "md"
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  const sizing =
    size === "lg" ? "h-11 rounded-xl px-5 text-[14px]" : "h-10 rounded-lg px-4 text-[13px]"

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 bg-[#5865F2] font-medium text-white transition-colors hover:bg-[#4752C4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${sizing} ${className}`}
    >
      {icon}
      {children}
    </a>
  )
}

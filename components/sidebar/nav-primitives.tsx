"use client"
// components/sidebar/nav-primitives.tsx
// Shared building blocks for the app's two navigation rails: the user
// dashboard (components/app-sidebar.tsx) and the admin panel
// (components/admin-sidebar.tsx).
//
// Both rails previously hand-rolled their own paddings, type sizes, icon sizes
// and active states, which is exactly how they drifted apart. Everything here
// reads from the --sb-* design tokens in app/globals.css, so the two are
// identical by construction and a token change updates both.
//
// Tokens consumed: --sb-bg, --sb-accent, --sb-item-h, --sb-item-px,
// --sb-item-radius, --sb-icon-gap, --sb-icon-size, --sb-font-size,
// --sb-line-height, --sb-label-size, --sb-transition.

import * as React from "react"
import { Logo } from "@/components/brand/logo"
import Link from "next/link"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

/* ── Brand ────────────────────────────────────────────────────────────────
   Compact logo block. Renders a Link when given `href`, a button when given
   `onClick` — the dashboard needs the button form for its view switcher.
   ------------------------------------------------------------------------ */
export function SidebarBrand({
  href,
  onClick,
  badge,
  alt = "Instroom",
}: {
  href?: string
  onClick?: () => void
  badge?: string
  alt?: string
}) {
  const inner = (
    <>
      {/* size="brand" = 40px tall, up from 32px (+25%). Height token only —
          width stays auto off the asset's real 1.834 ratio, so the wordmark
          cannot stretch or compress. The token also raises the `sizes` hint to
          128px, so Next serves a large enough file to stay crisp at 2x DPR. */}
      <Logo variant="fullWhite" size="lg" alt={alt} priority />
      {badge && (
        <span className="mt-1 shrink-0 whitespace-nowrap rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-white/70">
          {badge}
        </span>
      )}
    </>
  )

  const className =
    "flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/60"

  return href ? (
    <Link href={href} onClick={onClick} className={className}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>{inner}</button>
  )
}

/* ── Section label ────────────────────────────────────────────────────────── */

export function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 px-3 font-semibold uppercase tracking-[0.16em] text-white/55 text-[length:var(--sb-label-size)]">
      {children}
    </p>
  )
}

/* ── Navigation item ──────────────────────────────────────────────────────
   The single definition of a rail row: height, padding, radius, type, icon
   size, hover motion and active treatment. Active = translucent green fill,
   soft shadow, green icon, white text — no button-like solid fill, no border.
   ------------------------------------------------------------------------ */
export function SidebarNavItem({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number; className?: string }>
  active: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center rounded-[var(--sb-item-radius)]",
        "h-[var(--sb-item-h)] gap-[var(--sb-icon-gap)] px-[var(--sb-item-px)]",
        "text-[length:var(--sb-font-size)] leading-[var(--sb-line-height)] font-medium",
        "transition-all duration-[var(--sb-transition)] ease-out",
        "outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0",
        active
          ? "bg-[var(--sb-accent)]/15 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
          : "text-white/75 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white"
      )}
    >
      {/* Accent rail as an element, not a border: a real border adds to the
          box, so every row would shift horizontally as the active item moved. */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[var(--sb-accent)]"
        />
      )}
      <Icon
        size={18}
        strokeWidth={1.8}
        className={cn("shrink-0", active ? "text-[var(--sb-accent)]" : "text-current")}
      />
      <span className="truncate">{label}</span>
    </Link>
  )
}

/* ── User card ────────────────────────────────────────────────────────────
   Compact identity block with a single Logout action.
   ------------------------------------------------------------------------ */
export function SidebarUserCard({
  name,
  email,
  image,
  onSignOut,
}: {
  name: string
  email?: string
  image?: string | null
  onSignOut: () => void
}) {
  const initials =
    (name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "A").toUpperCase()

  return (
    <div className="flex h-16 items-center gap-2.5 rounded-[var(--sb-item-radius)] border border-white/10 bg-white/[0.05] px-2.5">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sb-accent)]/20 text-[11px] font-semibold text-[var(--sb-accent)]">
          {initials}
        </span>
      )}

      {/* min-w-0 + truncate: a long email must not widen the rail */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight text-white">{name}</p>
        {email && <p className="mt-0.5 truncate text-[11px] leading-tight text-white/55">{email}</p>}
      </div>

      <button
        type="button"
        onClick={onSignOut}
        aria-label="Sign out"
        title="Sign out"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/60 outline-none transition-colors duration-[var(--sb-transition)] hover:bg-red-500/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <LogOut size={16} strokeWidth={1.8} />
      </button>
    </div>
  )
}

/* ── Shell class names ────────────────────────────────────────────────────
   Shared by both <Sidebar> instances so background, font and the
   single-scroll-region rule are defined once.
   ------------------------------------------------------------------------ */
// One continuous green surface. The positioner and the panel it contains carry
// the SAME background, so the `inset` variant's p-3 gutter is indistinguishable
// from the panel and the rail reads as a single sheet.
//
// shadow-none! is what keeps it that way. The `inset` variant puts shadow-sm on
// the panel, which casts onto the gutter and turns that 12px band into a
// visibly darker strip — a seam that looks like a second container, most
// obviously down the right edge. The important flag is required: the variant's
// rule is a group-data selector that outranks a plain utility.
export const SIDEBAR_ROOT_CLASS =
  "border-none bg-[var(--sb-bg)] font-[family-name:var(--font-inter)] text-white " +
  "[&>[data-sidebar=sidebar]]:overflow-hidden [&>[data-sidebar=sidebar]]:bg-[var(--sb-bg)] " +
  "[&>[data-sidebar=sidebar]]:shadow-none!"

// px-5/py-5 = 20px all round: enough for the 40px logo to breathe without
// making the rail header tall. pb-5 is what sets the gap between the logo and
// the divider; mb-3 sets the gap between the divider and the first nav item.
export const SIDEBAR_HEADER_CLASS =
  "shrink-0 border-b border-white/10 bg-[var(--sb-bg)] px-5 py-5 mb-3"

/** The one scrollable region in the rail. */
export const SIDEBAR_CONTENT_CLASS =
  "min-h-0 flex-1 gap-0 overflow-y-auto overflow-x-hidden bg-[var(--sb-bg)] px-3"

export const SIDEBAR_FOOTER_CLASS = "shrink-0 bg-[var(--sb-bg)] p-2 pt-1"

"use client"
// components/mobile/primitives.tsx
// The mobile design system for the authenticated app.
//
// One place defining spacing, radii, shadows, touch targets and typography for
// phone layouts, so pages compose these instead of each re-inventing padding
// and chip styles. Everything here is phone-first and opt-in — nothing leaks
// into desktop, and no global selectors are used.
//
// Tokens (kept deliberately small):
//   gutter        16px (px-4), 20px from sm
//   card radius   rounded-2xl
//   shadow        shadow-sm, border-gray-200
//   touch target  44px minimum (h-11)
//   stack rhythm  gap-2.5 between cards, gap-4 between sections

import * as React from "react"
import { Drawer as Vaul } from "vaul"
import { cn } from "@/lib/utils"

/* ── Page scaffolding ─────────────────────────────────────────────────────── */

/** Standard phone gutter. Desktop padding is left to the page. */
export function MobileGutter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-4 sm:px-5", className)}>{children}</div>
}

/** Section heading with the app's mobile type hierarchy. */
export function MobileSectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2.5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">{children}</h2>
      {action}
    </div>
  )
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

export function MobileCard({
  className,
  interactive,
  selected,
  children,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean; selected?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm transition-colors",
        selected ? "border-[#1FAE5B] ring-1 ring-[#1FAE5B]/30 bg-[#1FAE5B]/[0.03]" : "border-gray-200",
        interactive && "active:bg-gray-50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ── Chip ─────────────────────────────────────────────────────────────────── */

const CHIP_TONE = {
  neutral: "bg-gray-50 text-gray-600 border-gray-200",
  brand:   "bg-[#1FAE5B]/10 text-[#0F6B3E] border-[#1FAE5B]/30",
  amber:   "bg-amber-50 text-amber-700 border-amber-200",
  red:     "bg-red-50 text-red-700 border-red-200",
  blue:    "bg-blue-50 text-blue-700 border-blue-200",
  purple:  "bg-purple-50 text-purple-700 border-purple-200",
} as const

export type ChipTone = keyof typeof CHIP_TONE

export function MobileChip({
  tone = "neutral",
  icon,
  className,
  children,
}: {
  tone?: ChipTone
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        CHIP_TONE[tone],
        className
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}

/* ── Icon button with a guaranteed 44px hit area ──────────────────────────── */

export function MobileIconButton({
  label,
  tone = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string; tone?: "neutral" | "danger" }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
        tone === "danger"
          ? "text-gray-400 hover:bg-red-50 hover:text-red-600 active:bg-red-100"
          : "text-gray-500 hover:bg-gray-100 active:bg-gray-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1FAE5B] focus-visible:ring-offset-1",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* ── Full-width action button ─────────────────────────────────────────────── */

export function MobileButton({
  variant = "secondary",
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        variant === "primary" && "bg-[#1FAE5B] text-white active:bg-[#178a48] focus-visible:ring-[#1FAE5B]",
        variant === "secondary" && "border border-gray-200 bg-white text-gray-700 shadow-sm active:bg-gray-50 focus-visible:ring-gray-400",
        variant === "danger" && "border border-red-200 bg-white text-red-600 active:bg-red-50 focus-visible:ring-red-400",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* ── Scrollable tab strip ─────────────────────────────────────────────────── */
// Start-aligned on purpose: `justify-center` inside an overflow-x container
// makes the leading items unreachable by scrolling.

export function MobileTabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: string; count?: number }[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn("mobile-tabs -mx-4 flex snap-x snap-proximity gap-1.5 overflow-x-auto px-4 pb-0.5", className)}>
      <style>{`
        .mobile-tabs { scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }
        .mobile-tabs::-webkit-scrollbar { display: none; }
      `}</style>
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-pressed={active}
            className={cn(
              "flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              active
                ? "border-transparent bg-[#0F6B3E] text-white"
                : "border-gray-200 bg-white text-gray-600 active:bg-gray-50"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-white/20" : "bg-gray-100 text-gray-500")}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ── Bottom sheet (filters, secondary actions) ────────────────────────────── */
// Built on vaul, already a dependency. Handles drag-to-dismiss, scroll lock and
// focus trapping — the things hand-rolled overlays in this codebase all miss.

export function MobileSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Vaul.Root open={open} onOpenChange={onOpenChange}>
      <Vaul.Portal>
        <Vaul.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Vaul.Content
          className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[88svh] flex-col rounded-t-2xl bg-white outline-none"
          // Respects the iOS home indicator
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-300" />
          <div className="px-4 pt-3 pb-2">
            <Vaul.Title className="text-[15px] font-semibold text-gray-900">{title}</Vaul.Title>
            {description && <Vaul.Description className="mt-0.5 text-[13px] text-gray-500">{description}</Vaul.Description>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer && <div className="border-t border-gray-100 p-4">{footer}</div>}
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  )
}

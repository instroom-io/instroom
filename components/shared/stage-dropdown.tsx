"use client"
// components/shared/stage-dropdown.tsx
// Badge-style stage dropdown used by the Post Tracker list view.
//
// Modelled on the Pipeline board's StatusDropdown (portal rendering, fixed-width
// badge trigger, dot-per-option menu) but deliberately a separate component:
// the Pipeline keeps its own local implementation, so changes here can never
// affect it. Callers supply their own option list and colours; no stage
// vocabulary is hard-coded here.

import { useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { IconChevronDown } from "@tabler/icons-react"

export interface StageOption {
  value: string
  label: string
  /** Tailwind bg-* class for the dot shown beside the option in the menu */
  dotColor: string
  /** Tailwind bg / text / border classes for the badge trigger when selected */
  badgeClass: string
}

const MENU_MIN_WIDTH  = 200
const MENU_MAX_HEIGHT = 300

export function StageDropdown({
  value,
  options,
  onChange,
  disabled = false,
  disabledTitle,
  ariaLabel = "Change stage",
  widthClass = "w-[150px]",
}: {
  value: string
  options: StageOption[]
  onChange: (value: string) => void
  disabled?: boolean
  disabledTitle?: string
  ariaLabel?: string
  /** Fixed width of the badge trigger — keep uniform across a column */
  widthClass?: string
}) {
  const [isOpen, setIsOpen]               = useState(false)
  const [menuStyle, setMenuStyle]         = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef   = useRef<HTMLDivElement>(null)

  const current      = options.find((o) => o.value === value)
  const currentLabel = current?.label ?? value
  const badgeClass   = current?.badgeClass ?? "bg-gray-100 text-gray-700 border-gray-300"

  // Position is measured on open (and on scroll/resize while open) rather than
  // in a render effect, so opening never costs a second render pass.
  const measure = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceRight = window.innerWidth - rect.left
    const top  = spaceBelow >= MENU_MAX_HEIGHT ? rect.bottom + 4 : rect.top - MENU_MAX_HEIGHT - 4
    const left = spaceRight >= MENU_MIN_WIDTH  ? rect.left       : rect.right - MENU_MIN_WIDTH
    setMenuStyle({
      position: "fixed",
      top:      Math.max(8, top),
      left:     Math.max(8, left),
      zIndex:   9999,
      // Never narrower than the trigger, so the menu lines up with the badge
      minWidth: Math.max(MENU_MIN_WIDTH, rect.width),
    })
  }

  const openMenu = () => { measure(); setIsOpen(true) }

  const closeMenu = (refocus = false) => {
    setIsOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  // Close on outside pointer down; keep the menu glued to the trigger while
  // the page scrolls or resizes underneath it.
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setIsOpen(false)
    }
    const onReflow = () => measure()
    document.addEventListener("mousedown", onPointerDown)
    window.addEventListener("scroll", onReflow, true)
    window.addEventListener("resize", onReflow)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      window.removeEventListener("scroll", onReflow, true)
      window.removeEventListener("resize", onReflow)
    }
  }, [isOpen])

  // Roving focus inside the menu: ↑/↓ move, Escape closes and returns focus.
  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); closeMenu(true); return }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    e.preventDefault()
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [])
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const next  = e.key === "ArrowDown"
      ? (index + 1) % items.length
      : (index <= 0 ? items.length - 1 : index - 1)
    items[next]?.focus()
  }

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!isOpen) openMenu()
      // Focus the first item once the menu has painted
      requestAnimationFrame(() => {
        menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus()
      })
      return
    }
    if (e.key === "Escape" && isOpen) { e.preventDefault(); closeMenu() }
  }

  const select = (next: string) => {
    closeMenu(true)
    if (next !== value) onChange(next)
  }

  const menu = isOpen ? (
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      style={menuStyle}
      onKeyDown={onMenuKeyDown}
      className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="menuitem"
          onClick={(e) => { e.stopPropagation(); select(option.value) }}
          className={`w-full text-left px-3 py-2 text-xs cursor-pointer transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none flex items-center gap-2 ${
            index !== options.length - 1 ? "border-b border-gray-100" : ""
          } ${option.value === value ? "bg-gray-50 font-semibold" : ""}`}
        >
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${option.dotColor}`} />
          <span className="text-gray-700 whitespace-nowrap">{option.label}</span>
        </button>
      ))}
    </div>
  ) : null

  return (
    <>
      {/* Fixed width (sized to the longest stage label) so every row's badge
          lines up; `max-w-full` lets it shrink inside a narrow cell, where the
          label truncates rather than wrapping. */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); if (disabled) return; isOpen ? closeMenu() : openMenu() }}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={disabled ? disabledTitle : currentLabel}
        className={`inline-flex items-center justify-between gap-1 ${widthClass} max-w-full px-2 py-1 rounded text-xs font-medium text-left whitespace-nowrap border transition-colors ${badgeClass} ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
        }`}
      >
        <span className="truncate">{currentLabel}</span>
        <IconChevronDown size={12} className={`transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {menu && typeof document !== "undefined" ? ReactDOM.createPortal(menu, document.body) : null}
    </>
  )
}

"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"

/**
 * Shared positioning for the hover/focus tooltips on the Pipeline and Post
 * Tracker boards.
 *
 * Both boards scroll in two directions at once — the board horizontally, each
 * column vertically — and their cards set `content-visibility: auto`. A bubble
 * positioned inside that tree is clipped by those ancestors, so the bubble is
 * portalled to document.body and positioned `fixed` in viewport coordinates.
 *
 * Portalling alone is what left bubbles floating detached near the top of the
 * page: the bubble followed its trigger even after the trigger had scrolled out
 * of its column, and a missed `mouseleave` (the pointer never "leaves" when the
 * column scrolls the button out from under a still cursor, and disabled buttons
 * are unreliable about it) left it open indefinitely. So this hook also:
 *
 *   - hides the bubble while the trigger is clipped out of any scrolling
 *     ancestor, instead of pinning it to an invisible element
 *   - closes a hover-opened bubble as soon as the pointer is no longer over the
 *     trigger, checked on every pointer move AND every scroll
 *   - keeps only one bubble open at a time across the page
 *   - measures the rendered bubble, flips it when there is no room on the
 *     preferred side, and clamps it inside the viewport horizontally
 */

export type TooltipSide = "top" | "bottom"
export type TooltipAlign = "start" | "center" | "end"

export interface AnchoredTooltipOptions {
  /** Preferred side; flipped when the bubble does not fit there. */
  side?: TooltipSide
  /** Horizontal alignment against the trigger. */
  align?: TooltipAlign
  /** Gap between trigger and bubble, in px. */
  offset?: number
}

/** Keeps the bubble off the very edge of the viewport. */
const VIEWPORT_MARGIN = 8

// Only one tooltip on the page is open at a time.
let closeActive: (() => void) | null = null

function isClipping(el: Element) {
  const s = getComputedStyle(el)
  return /(auto|scroll|hidden|clip)/.test(s.overflow + s.overflowX + s.overflowY)
}

function clippingAncestors(el: HTMLElement): Element[] {
  const out: Element[] = []
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (isClipping(p)) out.push(p)
  }
  return out
}

/** True when at least half of the trigger is visible through every clipping ancestor. */
function isTriggerVisible(r: DOMRect, ancestors: Element[]) {
  let top = 0, left = 0, bottom = window.innerHeight, right = window.innerWidth
  for (const a of ancestors) {
    const c = a.getBoundingClientRect()
    top = Math.max(top, c.top); left = Math.max(left, c.left)
    bottom = Math.min(bottom, c.bottom); right = Math.min(right, c.right)
  }
  const visH = Math.min(r.bottom, bottom) - Math.max(r.top, top)
  const visW = Math.min(r.right, right) - Math.max(r.left, left)
  return visH >= r.height / 2 && visW >= r.width / 2 && visH > 0 && visW > 0
}

function pointInside(r: DOMRect, x: number, y: number) {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

interface Placement {
  top: number
  left: number
  side: TooltipSide
  hidden: boolean
}

export function useAnchoredTooltip<T extends HTMLElement = HTMLElement>({
  side = "top",
  align = "center",
  offset = 8,
}: AnchoredTooltipOptions = {}) {
  const triggerRef = useRef<T>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const ancestorsRef = useRef<Element[]>([])
  const viaHoverRef = useRef(false)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const frameRef = useRef(0)

  // `open` is only ever set from a browser event, so the portal can never be
  // rendered during SSR or hydration.
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<Placement | null>(null)

  const hide = useCallback(() => {
    setOpen(false)
    setPlacement(null)
  }, [])

  const show = useCallback((viaHover: boolean) => {
    const el = triggerRef.current
    if (!el) return
    if (closeActive && closeActive !== hide) closeActive()
    closeActive = hide
    viaHoverRef.current = viaHover
    ancestorsRef.current = clippingAncestors(el)
    setOpen(true)
  }, [hide])

  const place = useCallback(() => {
    const el = triggerRef.current
    const bubble = bubbleRef.current
    if (!el || !bubble) return
    const r = el.getBoundingClientRect()

    // Hover-opened and the pointer is no longer on the trigger (e.g. a column
    // scrolled it away under a still cursor): close rather than follow.
    const p = pointerRef.current
    if (viaHoverRef.current && p && !pointInside(r, p.x, p.y)) { hide(); return }

    const w = bubble.offsetWidth
    const h = bubble.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    const fitsTop = r.top - offset - h >= VIEWPORT_MARGIN
    const fitsBottom = r.bottom + offset + h <= vh - VIEWPORT_MARGIN
    const finalSide: TooltipSide =
      side === "top" ? (fitsTop || !fitsBottom ? "top" : "bottom")
                     : (fitsBottom || !fitsTop ? "bottom" : "top")

    let left = align === "start" ? r.left
             : align === "end"   ? r.right - w
             : r.left + r.width / 2 - w / 2
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, vw - w - VIEWPORT_MARGIN))

    const top = finalSide === "top" ? r.top - offset - h : r.bottom + offset

    setPlacement({ top, left, side: finalSide, hidden: !isTriggerVisible(r, ancestorsRef.current) })
  }, [align, hide, offset, side])

  // First placement happens as soon as the bubble mounts (invisibly), so its
  // real size is known, and before paint so it never flashes in the wrong spot.
  // Stable identity, so it runs on mount only — not on every re-placement.
  const setBubble = useCallback((node: HTMLDivElement | null) => {
    bubbleRef.current = node
    if (node) place()
  }, [place])

  useEffect(() => {
    if (!open) return
    const schedule = () => {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(place)
    }
    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY }
      if (!viaHoverRef.current) return
      const el = triggerRef.current
      if (!el || !pointInside(el.getBoundingClientRect(), e.clientX, e.clientY)) hide()
    }
    const onPointerDown = (e: PointerEvent) => {
      const el = triggerRef.current
      if (!el || !el.contains(e.target as Node)) hide()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hide() }

    // Capture phase so a scroll of a column or the board is caught, not just
    // the window.
    window.addEventListener("scroll", schedule, true)
    window.addEventListener("resize", schedule)
    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("keydown", onKey)
    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener("scroll", schedule, true)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("keydown", onKey)
      if (closeActive === hide) closeActive = null
    }
  }, [open, place, hide])

  /** Spread onto the trigger element. */
  const triggerProps = {
    onMouseEnter: (e: React.MouseEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY }
      show(true)
    },
    onMouseLeave: hide,
    // Keyboard focus only — a plain focus also fires on click, which reopened
    // the bubble right after onPointerDown closed it.
    onFocus: (e: React.FocusEvent) => { if (e.target.matches(":focus-visible")) show(false) },
    onBlur: hide,
  }

  /** Renders the bubble into document.body. `className` carries its look. */
  const renderTooltip = (content: React.ReactNode, className: string, style?: React.CSSProperties) =>
    open
      ? ReactDOM.createPortal(
          <div
            ref={setBubble}
            role="tooltip"
            style={{
              ...style,
              position: "fixed",
              top: placement?.top ?? 0,
              left: placement?.left ?? 0,
              visibility: !placement || placement.hidden ? "hidden" : "visible",
              zIndex: 10000,
              maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
            }}
            className={`pointer-events-none ${className}`}
          >
            {content}
          </div>,
          document.body
        )
      : null

  return { triggerRef, triggerProps, open, show, hide, renderTooltip }
}

/**
 * The column-header "i" icon on both boards, with its explanation panel.
 * The panel used to be an absolutely positioned CSS-hover child of the header,
 * so the board's horizontal scroll container clipped it; it now goes through
 * the same portal/positioning as every other board tooltip.
 */
export function InfoTooltip({ iconClassName, children }: {
  /** Border/text colour classes for the "i" circle. */
  iconClassName: string
  /** Panel content. */
  children: React.ReactNode
}) {
  const { triggerRef, triggerProps, renderTooltip } =
    useAnchoredTooltip<HTMLSpanElement>({ side: "bottom", align: "end", offset: 6 })

  return (
    <div className="relative flex-shrink-0">
      <span
        ref={triggerRef}
        {...triggerProps}
        tabIndex={0}
        aria-label="Column info"
        className={`text-[10px] font-medium border ${iconClassName} rounded-full w-4 h-4 flex items-center justify-center opacity-70 cursor-default select-none hover:opacity-100 focus-visible:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 transition-opacity`}
      >
        i
      </span>
      {renderTooltip(
        children,
        "w-64 bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-700 leading-relaxed shadow-lg"
      )}
    </div>
  )
}

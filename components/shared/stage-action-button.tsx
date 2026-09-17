"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"

/**
 * The one movement button used by the Pipeline and Post Tracker cards.
 *
 * Both boards rendered their quick-move actions as pale pills — `bg-[#EAF7EF]`
 * with a light border — which read as status badges rather than controls. The
 * cards also carry real badges in exactly that treatment ("In Post Tracker",
 * "Content live", the collab-type pill), so the only thing separating an action
 * from a label was the arrow glyph. This component makes the actions solid and
 * leaves every badge alone, so weight alone now tells them apart.
 *
 * `tone` follows the meaning already attached to each move rather than
 * introducing a new palette:
 *
 *   forward  advancing to the next stage — the brand green used by every other
 *            primary button on these pages (Retry, Move to Stage, Move to Post
 *            Tracker)
 *   danger   leaving the workflow (Not Interested, No post) — the same red the
 *            terminal columns and their cards already use
 *
 * The destination is spelled out in the label AND in the tooltip, so the button
 * is never understood by colour alone, and the tooltip is an enhancement rather
 * than the only explanation.
 */
export interface StageActionButtonProps {
  /** Where this button sends the record, e.g. "Contacted" or "No post". */
  destination: string
  /**
   * Full tooltip/accessible sentence, e.g. "Move influencer to Contacted".
   * Passed in rather than built here so each board names its own entity
   * (influencer vs post) and can describe a move the label abbreviates.
   */
  label: string
  tone: "forward" | "danger" | "warning"
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  /** Shown instead of `label` when the control is disabled — the reason why. */
  disabledReason?: string
  icon?: React.ReactNode
}

const TONE: Record<StageActionButtonProps["tone"], string> = {
  // Solid brand green, matching the primary buttons elsewhere on both boards.
  forward:
    "bg-[#1FAE5B] text-white border-[#1FAE5B] hover:bg-[#178a48] hover:border-[#178a48] " +
    "active:bg-[#0F6B3E] focus-visible:ring-[#1FAE5B]",
  // Solid red for the moves that take a record OUT of the active workflow.
  danger:
    "bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700 " +
    "active:bg-red-800 focus-visible:ring-red-500",
  // Solid purple for flagging a problem — the row is stalled, not finished, so
  // it must not read as the same act as a terminal exit.
  warning:
    "bg-purple-600 text-white border-purple-600 hover:bg-purple-700 hover:border-purple-700 " +
    "active:bg-purple-800 focus-visible:ring-purple-500",
}

/** Gap between the button edge and the bubble, in px. */
const TOOLTIP_OFFSET = 8
/** Assumed bubble height when deciding whether it fits above the button. */
const TOOLTIP_HEIGHT = 26
/** Keeps the bubble off the very edge of the viewport. */
const VIEWPORT_MARGIN = 8

interface TipPosition {
  top: number
  left: number
  /** Which side of the button the bubble ended up on. */
  side: "top" | "bottom"
}

export function StageActionButton({
  destination,
  label,
  tone,
  onClick,
  disabled = false,
  disabledReason,
  icon,
}: StageActionButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Null until the pointer or keyboard actually reaches the button, which is
  // also what makes the portal below safe without a "mounted" flag: it can only
  // ever be rendered from a browser event, never during SSR or hydration.
  const [tip, setTip] = useState<TipPosition | null>(null)

  const text = disabled ? disabledReason ?? label : label

  /**
   * Measure the button and place the bubble in VIEWPORT coordinates.
   *
   * Portalled to document.body and positioned `fixed`, not absolutely inside
   * the card. The card sets `content-visibility: auto` and its column is
   * `overflow-y-auto` (the board itself `overflow-x-auto`), so an absolutely
   * positioned bubble was clipped by those ancestors and could not sit outside
   * the card at all — which is what pushed it down over the sibling button.
   */
  const place = useCallback(() => {
    const el = buttonRef.current
    if (!el) return
    const r = el.getBoundingClientRect()

    // Above by default so the bubble never covers the button it describes, nor
    // the button beside it — the action row is the LAST thing on the card, so
    // there is nothing but the card's own body above it. Flipped below only
    // when there genuinely is not room above.
    const fitsAbove = r.top - TOOLTIP_HEIGHT - TOOLTIP_OFFSET >= VIEWPORT_MARGIN
    const side: "top" | "bottom" = fitsAbove ? "top" : "bottom"

    setTip({
      top: side === "top" ? r.top - TOOLTIP_OFFSET : r.bottom + TOOLTIP_OFFSET,
      left: r.left + r.width / 2,
      side,
    })
  }, [])

  const show = useCallback(() => place(), [place])
  const hide = useCallback(() => setTip(null), [])

  // While the bubble is open, any scroll or resize moves the button out from
  // under it. Recomputed on both (capture phase, so a scroll of the column or
  // the board is caught, not just the window).
  useEffect(() => {
    if (!tip) return
    const onScroll = () => place()
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [tip, place])

  const bubble = tip ? ReactDOM.createPortal(
    <div
      role="tooltip"
      style={{
        position: "fixed",
        top: tip.top,
        left: tip.left,
        // Horizontal centring is done with a transform rather than by
        // subtracting half the measured width, so the bubble does not need to
        // be rendered and measured first. `max-width` plus the clamp below
        // keeps a long disabled-reason inside the viewport.
        transform: `translate(-50%, ${tip.side === "top" ? "-100%" : "0"})`,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        zIndex: 10000,
      }}
      className="pointer-events-none rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium
        text-white shadow-lg whitespace-nowrap overflow-hidden text-ellipsis"
    >
      {text}
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        disabled={disabled}
        // An EMPTY title, deliberately — not a missing one.
        //
        // This button used to set `title={text}` alongside the bubble as a
        // "fallback", so the browser's own tooltip and this one both appeared
        // on hover, saying the same sentence twice and overlapping the card.
        //
        // Simply dropping the attribute is not enough: a native `title` applies
        // to every descendant of the element that sets it, and the DraggableCard
        // wrapping this card sets one whenever the user lacks permission ("Only
        // Owners and Managers can…") — the same sentence this button shows as
        // its disabled reason. An empty title on the descendant is what stops
        // that inherited tooltip, and an empty string renders no bubble of its
        // own, so exactly one tooltip is left in both the enabled and the
        // disabled case.
        //
        // `aria-label` (not `title`) is what carries the text to assistive tech,
        // so nothing is lost.
        title=""
        aria-label={text}
        onMouseEnter={show}
        onMouseLeave={hide}
        // Keyboard focus only. A plain `onFocus` also fires on click, which —
        // together with the onPointerDown below — made a click hide the bubble
        // and immediately reopen it: a visible flicker on every move, with the
        // bubble then left hanging over the board while the card animated to
        // its new column. `:focus-visible` is the browser's own "did this come
        // from the keyboard?" answer, so tab-navigation still gets the tooltip.
        onFocus={e => { if (e.target.matches(":focus-visible")) show() }}
        onBlur={hide}
        // A press should not leave the bubble hanging over the board while the
        // card moves to another column.
        onPointerDown={hide}
        // `flex-1 min-w-0` sits on the button itself now that it is a direct
        // child of the card's action row — it used to live on a wrapper span
        // that the portalled tooltip made unnecessary. Buttons split the row
        // evenly, and a long stage name truncates rather than widening the card.
        //
        // `basis-24` is what makes a wrapping row behave: with a 0 basis, three
        // buttons in a 240px column each shrink to an unreadable sliver rather
        // than wrapping. At ~6rem the third one drops to its own line instead.
        className={`flex-1 basis-24 min-w-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border
          transition-colors flex items-center gap-1 justify-center cursor-pointer
          shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
          disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
          ${TONE[tone]}`}
      >
        {icon}
        <span className="truncate">{destination}</span>
      </button>
      {bubble}
    </>
  )
}

export default StageActionButton

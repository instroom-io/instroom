"use client"

import React from "react"

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
 * The destination is spelled out in the label, so the button is never
 * understood by colour alone. There is no hover tooltip: the full sentence (or
 * the disabled reason) is carried by `aria-label` only.
 */
export interface StageActionButtonProps {
  /** Where this button sends the record, e.g. "Contacted" or "No post". */
  destination: string
  /**
   * Full accessible sentence, e.g. "Move influencer to Contacted".
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

export function StageActionButton({
  destination,
  label,
  tone,
  onClick,
  disabled = false,
  disabledReason,
  icon,
}: StageActionButtonProps) {
  // The disabled reason replaces the label for assistive tech.
  const text = disabled ? disabledReason ?? label : label

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // An EMPTY title, deliberately — not a missing one. A native `title`
      // applies to every descendant, and the DraggableCard wrapping this card
      // sets one when the user lacks permission; the empty title here stops
      // that inherited browser tooltip so buttons show no tooltip at all.
      // `aria-label` carries the text to assistive tech.
      title=""
      aria-label={text}
      // `flex-1 min-w-0` sits on the button itself now that it is a direct
      // child of the card's action row — it used to live on a wrapper span
      // that the portalled tooltip made unnecessary. Buttons split the row
      // evenly, and a long stage name truncates rather than widening the card.
      //
      // `basis-20` is what makes a wrapping row behave: with a 0 basis, three
      // buttons in a 200px column each shrink to an unreadable sliver rather
      // than wrapping. At 5rem two still share a line and a third drops below.
      className={`flex-1 basis-20 min-w-0 text-[11px] font-semibold px-2 py-1 rounded-lg border
        transition-colors flex items-center gap-1 justify-center cursor-pointer
        shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
        ${TONE[tone]}`}
    >
      {icon}
      <span className="truncate">{destination}</span>
    </button>
  )
}

export default StageActionButton

/**
 * The single source of truth for which Pipeline stage moves are allowed.
 *
 * The board used to answer this question in one place only — `getNextStages` in
 * the kanban board, which drives the quick-move buttons on each card. The
 * Influencer Details panel's stage dropdown listed all six stages
 * unconditionally and called straight through to the update, and the PATCH
 * route validated permissions but never the transition. So the dropdown could
 * do what the card refused: jump "For Outreach" straight to "For Order
 * Creation", skipping Contacted, In Conversation and the Deal Agreed
 * collaboration-type step that is supposed to cascade a row into Post Tracker.
 *
 * Imported by BOTH the client (to build the dropdown's options and to check
 * before firing) and the PATCH route (to reject a request that did not come
 * from either of those). No `server-only` marker here, deliberately — that is
 * the whole point: one module, one rule set, enforced on both sides.
 */

/** Every stage the board recognises, in funnel order. */
export const PIPELINE_STAGES = [
  "For Outreach",
  "Contacted",
  "In Conversation",
  "Deal Agreed",
  "For Order Creation",
  "Not Interested",
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/**
 * Stages a row cannot move OUT of through the board.
 *
 * "For Order Creation" has handed the row to Post Tracker, which owns it from
 * there; "Not Interested" is a terminal decline. Re-opening either is a
 * deliberate act done from the Influencer List's approval control, not a
 * casual stage change.
 */
export const TERMINAL_STAGES: readonly string[] = ["Not Interested", "For Order Creation"]

export const isTerminalStage = (stage: string): boolean => TERMINAL_STAGES.includes(stage)

/**
 * The forward path. Each stage advances to exactly one next stage.
 *
 * "Deal Agreed" is absent on purpose: confirming a collaboration type there
 * cascades the row straight to "For Order Creation" (see pipelineStatusToFields
 * in the PATCH route), so it has no plain next stage of its own.
 */
const NEXT_STAGE: Record<string, string> = {
  "For Outreach":    "Contacted",
  "Contacted":       "In Conversation",
  "In Conversation": "Deal Agreed",
}

/**
 * The stages a row at `currentStatus` may move to.
 *
 * This is what the card's quick-move buttons render, what the Details
 * dropdown offers, and what the server checks — so all three agree by
 * construction rather than by three lists being kept in step by hand.
 *
 * "Not Interested" is reachable from every non-terminal stage EXCEPT "For
 * Outreach": nobody has been contacted yet there, so there is nothing to
 * decline. (The card additionally hides that button at For Outreach; the rule
 * is the same, it is simply the rule rather than a separate UI decision.)
 */
export function allowedTransitions(currentStatus: string): string[] {
  if (isTerminalStage(currentStatus)) return []

  const next = NEXT_STAGE[currentStatus]
  if (!next) {
    // "Deal Agreed" and anything unrecognised: the only move left is declining.
    return ["Not Interested"]
  }
  if (currentStatus === "For Outreach") return [next]
  return [next, "Not Interested"]
}

/** Is moving from `from` to `to` permitted? */
export function isTransitionAllowed(from: string, to: string): boolean {
  // A no-op move is not an error — the UI treats "already there" as nothing to
  // do, and the server should not 400 a client that raced itself.
  if (from === to) return true
  return allowedTransitions(from).includes(to)
}

/**
 * Why a move was refused, phrased for the person who attempted it.
 *
 * One sentence, naming the stage they can actually move to, so the message is
 * actionable rather than just "invalid".
 */
export function transitionRefusalReason(from: string, to: string): string {
  if (isTerminalStage(from)) {
    return `${from} is a final stage — this influencer can no longer be moved from the Pipeline.`
  }
  const allowed = allowedTransitions(from)
  if (allowed.length === 0) return `Cannot move from ${from} to ${to}.`
  return `Cannot skip from ${from} to ${to}. Move to ${allowed.join(" or ")} first.`
}

/**
 * The stage a stored row is currently in.
 *
 * Lifted verbatim from the pipeline GET route (derivePipelineStatus), which is
 * what the board reads, so the server's idea of "where is this row now" when it
 * validates a transition is exactly the stage the user was looking at. Pure —
 * no DB access; the caller supplies the three persisted fields.
 */
export function derivePipelineStage(
  contactStatus: string | null,
  stage: number | null,
  approvalStatus: string | null
): string {
  // Hard exits — checked first, always win
  if (contactStatus === "not_interested" || approvalStatus === "Declined") {
    return "Not Interested"
  }
  if (contactStatus === "for_order_creation" || (stage !== null && stage >= 5)) {
    return "For Order Creation"
  }

  // Stage-based (preferred when stage is set)
  if (stage !== null) {
    if (stage >= 4) return "Deal Agreed"
    if (stage === 3) return "In Conversation"
    if (stage === 2) return "Contacted"
    if (stage === 1) return "For Outreach"
  }

  // contact_status fallback (legacy records where stage is NULL)
  switch (contactStatus) {
    case "agreed":           return "Deal Agreed"
    case "negotiating":
    case "paid_collab":      return "In Conversation"
    case "responded":
    case "replied":
    case "contacted":        return "Contacted"
    case "no_response":
    case "email_error":      return "Contacted"
    case "pending":
    default:                 return "For Outreach"
  }
}

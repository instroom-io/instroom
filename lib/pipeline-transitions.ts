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
 * Stages a row cannot move OUT of through the Pipeline board.
 *
 * None. "For Order Creation" used to be one-way, but a row handed over to Post
 * Tracker can now be moved from the board like any other stage.
 *
 * "Not Interested" is NOT terminal. A decline is a decision the brand can
 * revisit — the influencer replies later, the budget changes, the decline was
 * a mistake — so a declined row can be moved back to any active stage. It was
 * grouped with For Order Creation here, which made an ordinary correction
 * impossible from the board.
 */
// Moving an "In Post Tracker" row to an earlier stage takes it back out of Post Tracker.
export const TERMINAL_STAGES: readonly string[] = []

export const isTerminalStage = (stage: string): boolean => TERMINAL_STAGES.includes(stage)

/**
 * Stages a row can be moved to from anywhere it is allowed to move at all.
 *
 * Everything except "For Order Creation", which is not a destination a user
 * picks: it is reached by confirming a collaboration type on "Deal Agreed",
 * which cascades there and seeds Post Tracker (see pipelineStatusToFields).
 * Offering it as a plain move would land a row on Post Tracker with no
 * collaboration type set.
 */
const SELECTABLE_STAGES: readonly string[] = PIPELINE_STAGES.filter(
  (s) => s !== "For Order Creation"
)

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
 * The moves a card's quick-move BUTTONS suggest — the obvious next step.
 *
 * This is a UI affordance, NOT the rule. It answers "what would this user most
 * likely do next", which is why it is deliberately narrow: one forward step,
 * plus declining. It is what `getNextStages` renders on each card.
 *
 * Use `isTransitionAllowed` to decide whether a move is PERMITTED. The two were
 * previously the same function, which is what made every backward move and
 * every correction of a decline impossible: the buttons' narrow suggestion list
 * was being enforced as the system's rule, on the client and the server.
 *
 * "Not Interested" is suggested from every stage EXCEPT "For Outreach": nobody
 * has been contacted yet there, so there is nothing to decline. It remains
 * reachable there through the dropdown — not suggested is not the same as not
 * allowed.
 */
export function suggestedTransitions(currentStatus: string): string[] {
  if (isTerminalStage(currentStatus)) return []

  // A declined row's obvious next step is being put BACK into the funnel, not
  // declining again. Without this it fell through to the generic branch below
  // and suggested "Not Interested" from "Not Interested" — a button that did
  // nothing.
  if (currentStatus === "Not Interested") return ["For Outreach"]

  const next = NEXT_STAGE[currentStatus]
  if (!next) {
    // "Deal Agreed" and anything unrecognised: the only step left is declining.
    return ["Not Interested"]
  }
  if (currentStatus === "For Outreach") return [next]
  return [next, "Not Interested"]
}

/**
 * Every stage a row at `currentStatus` may move to.
 *
 * This is what the stage DROPDOWNS offer and what `isTransitionAllowed`
 * checks — forward, backward, and out of a decline. Movement between the
 * active stages is not a funnel that only runs one way: a conversation can
 * regress, a stage can be set by mistake, and a decline can be reconsidered.
 *
 * Rows in a TERMINAL_STAGES stage (currently none) cannot move at all.
 */
export function allowedTransitions(currentStatus: string): string[] {
  if (isTerminalStage(currentStatus)) return []
  return SELECTABLE_STAGES.filter((s) => s !== currentStatus)
}

/** Is moving from `from` to `to` permitted? */
export function isTransitionAllowed(from: string, to: string): boolean {
  // A no-op move is not an error — the UI treats "already there" as nothing to
  // do, and the server should not 409 a client that raced itself.
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
    // Names the SOURCE, which is the actual cause. The drag guard used to
    // report the destination ("Cannot move to Contacted"), which read as though
    // the stage the user picked were the problem.
    return `${from} has moved to Post Tracker — manage this influencer from there.`
  }
  if (to === "For Order Creation") {
    return `Confirm a collaboration type on Deal Agreed to move ${from} into Post Tracker.`
  }
  return `Cannot move from ${from} to ${to}.`
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

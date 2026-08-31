// lib/influencer-draft.ts
//
// The one place that knows how a draft influencer is stored.
//
// A draft is a blank row the user added in the Influencer List and has not
// filled in yet. It is persisted immediately so the row survives a refresh, and
// it is NOT an influencer: `is_draft` keeps it out of plan limits, analytics,
// Pipeline, approvals, admin metrics, exports and the existing-influencer
// picker.
//
// Why a generated handle rather than an empty one: `Influencer` has
// `@@unique([handle, platform])`, which real influencers dedupe on. Every empty
// draft would be the same ("" + ""), so the second one in the entire database
// would fail to insert. Giving each draft its own handle keeps that index
// intact and untouched, and the read paths blank it out again so nothing shows
// the placeholder to a user.

/**
 * Marks a stored handle as a draft placeholder.
 *
 * "@" cannot appear in a real handle — every write path strips a leading "@"
 * (cleanHandle) and no platform allows one inside a username — so a real handle
 * can never collide with this prefix.
 */
export const DRAFT_HANDLE_PREFIX = "@draft:"

/** A handle for a new draft row, unique per row. */
export function newDraftHandle(): string {
  return `${DRAFT_HANDLE_PREFIX}${crypto.randomUUID()}`
}

/** Is this stored handle a draft placeholder rather than a real one? */
export function isDraftHandle(handle: string | null | undefined): boolean {
  return typeof handle === "string" && handle.startsWith(DRAFT_HANDLE_PREFIX)
}

/**
 * What a client should see for a stored handle.
 *
 * A draft's placeholder is an implementation detail of the unique index, so it
 * is blanked on the way out — the row renders as the empty row the user added.
 */
export function publicHandle(handle: string | null | undefined): string {
  return isDraftHandle(handle) ? "" : handle ?? ""
}

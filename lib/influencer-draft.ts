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

/**
 * The same marker after `cleanHandle` has stripped the leading "@".
 *
 * Every read and render path in the sheet runs cleanHandle, so both forms are
 * in circulation and both have to read as a draft.
 */
const BARE_DRAFT_PREFIX = "draft:"

/**
 * The canonical (handle, platform) identity used for duplicate detection.
 *
 * An influencer IS its handle+platform pair — that is what `@@unique([handle,
 * platform])` enforces — so every path that looks one up or stores one has to
 * agree on the exact string. They did not:
 *
 *   /api/influencers/create        trim + toLowerCase, no "@" strip
 *   the draft promote PUT          trim + "@" strip, no toLowerCase
 *   /api/brand/.../influencers/find  neither
 *
 * So "@Nike", "Nike" and "nike" were three different influencers to the index:
 * a lookup could miss an existing record and a create could store a second copy
 * of the same person. One function, used by all of them, removes that class of
 * bug rather than patching each site.
 *
 * Deliberately NOT the same as `normalizeApiUsername`, which also strips every
 * character a provider URL cannot carry — lossy on purpose for calling an API,
 * and wrong for an identity key.
 */
export function normalizeInfluencerIdentity(
  handle: string | null | undefined,
  platform: string | null | undefined
): { handle: string; platform: string } {
  return {
    handle: (handle ?? "").trim().replace(/^@+/, "").toLowerCase(),
    platform: (platform ?? "").trim().toLowerCase(),
  }
}

/** A handle for a new draft row, unique per row. */
export function newDraftHandle(): string {
  return `${DRAFT_HANDLE_PREFIX}${crypto.randomUUID()}`
}

/** Is this stored handle a draft placeholder rather than a real one? */
export function isDraftHandle(handle: string | null | undefined): boolean {
  if (typeof handle !== "string") return false
  const value = handle.trim()
  // Matched with AND without the leading "@".
  //
  // `cleanHandle` strips a leading "@" from every handle it touches, and the
  // sheet runs it before rendering — so a stored "@draft:<uuid>" arrived as
  // "draft:<uuid>", which no longer matched this prefix. The row then rendered
  // the placeholder as if it were a real handle: visible in the Handle column
  // and, because cleanHandle's result is also the "does this row have a
  // handle?" test, treated as a real influencer — so the profile panel opened
  // instead of the editor and the row could not be filled in.
  return value.startsWith(DRAFT_HANDLE_PREFIX) || value.startsWith(BARE_DRAFT_PREFIX)
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

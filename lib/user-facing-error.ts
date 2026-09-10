// lib/user-facing-error.ts
//
// Turning a thrown error into something worth showing a user.
//
// The technical detail is NOT discarded here — every caller logs the original
// before calling this. This only decides what the UI says, so a pool timeout
// stops reaching people as "P2024" or "Failed to fetch".
//
// The companion to lib/db-capacity.ts, which classifies the same failures on
// the server. This is the client half: db-capacity decides the status code a
// read replies with, this decides the sentence rendered for it.

/** What every unrecognised failure reads as. Used for reads and mutations. */
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again."

/** What a transient/capacity failure reads as — says it is worth retrying. */
export const TRANSIENT_ERROR_MESSAGE =
  "Having trouble connecting. Retrying shortly…"

/**
 * Fragments that mean "this failed for an infrastructure reason, and may well
 * work on the next attempt" rather than "this request is wrong".
 *
 * Deliberately the same set lib/db-capacity.ts matches on the server, plus the
 * browser-side network failures that never reach the server at all:
 *
 *   P2024 / "Timed out fetching a new connection"
 *                        Prisma's own pool timeout (connection_limit).
 *   P2037 / "Too many database connections"
 *                        the server refusing a new connection outright.
 *   max_user_connections MySQL 1203 — the per-user ceiling. Arrives as a
 *                        PrismaClientInitializationError with no usable code,
 *                        so the text is the only signal (see db-capacity).
 *   "Failed to fetch" / "NetworkError" / "Load failed"
 *                        the browser's own wording when a request never
 *                        completed — offline, dropped connection, a dev server
 *                        restarting. "Load failed" is Safari's.
 *   503                  what databaseCapacityResponse() replies with.
 */
const TRANSIENT_PATTERNS = [
  "p2024",
  "p2037",
  "timed out fetching a new connection",
  "too many database connections",
  "max_user_connections",
  "too many clients",
  "failed to fetch",
  "networkerror",
  "load failed",
  "network request failed",
  "econnreset",
  "etimedout",
  "503",
  "temporarily out of connections",
]

/** Text of an error, whatever shape it arrived in. */
function messageOf(error: unknown): string {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  return (error as { message?: string })?.message ?? ""
}

/**
 * Is this failure transient — worth a retry — rather than a real fault?
 *
 * Used to decide whether the UI offers/performs a retry, and which of the two
 * messages above it shows. A false negative is safe (the user sees the generic
 * message and a manual Retry); a false positive is what we avoid by matching
 * only the shapes above rather than anything that merely "looks like" a network
 * problem.
 */
export function isTransientError(error: unknown): boolean {
  const text = messageOf(error).toLowerCase()
  if (!text) return false
  return TRANSIENT_PATTERNS.some((pattern) => text.includes(pattern))
}

/**
 * The sentence to render for a failure.
 *
 * Never returns the original text: Prisma codes, stack traces and raw API
 * bodies are exactly what this exists to keep out of the UI. Callers that want
 * the detail should log `error` itself, which they already do.
 *
 * `fallback` lets a caller keep a message it has deliberately written for a
 * known, non-transient case (a validation message from its own API, say).
 */
export function toUserFacingError(
  error: unknown,
  fallback: string = GENERIC_ERROR_MESSAGE
): string {
  return isTransientError(error) ? TRANSIENT_ERROR_MESSAGE : fallback
}

/**
 * The sentence to show when a MUTATION (save, move, upload, remove) failed.
 *
 * A failed write is always reported — this never turns a failure into a
 * success, and never stays silent. It only decides the wording:
 *
 *   4xx  the server is describing something the user can act on ("This
 *        influencer has already Posted", "Only Owners can…", a validation
 *        message). That prose is deliberate and is kept.
 *   5xx  the server broke. Its body can carry a Prisma code or a raw
 *        exception, so it is replaced — transient capacity failures get the
 *        retry wording, anything else the generic sentence.
 *
 * `res.ok` is false for every caller of this, so there is no success path here.
 */
export function mutationErrorMessage(
  res: { status: number },
  body: { error?: unknown },
  fallback: string = GENERIC_ERROR_MESSAGE
): string {
  const serverText = typeof body?.error === "string" ? body.error : ""

  // 5xx, or a body that reads like an internal error, never reaches the user.
  if (res.status >= 500 || isTransientError(serverText)) {
    return isTransientError(serverText) || res.status === 503
      ? "Couldn't reach the server. Please try again in a moment."
      : GENERIC_ERROR_MESSAGE
  }

  return serverText || fallback
}

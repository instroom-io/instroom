/**
 * The single source of truth for "Not Interested" / decline reasons.
 *
 * Declining an influencer is one decision with one vocabulary, but it can be
 * made from two places — the Pipeline board ("Mark as not interested") and the
 * Influencer List ("Decline"). Both render the SAME modal
 * (components/shared/decline-modal.tsx) over this list, so a decline recorded
 * from either page carries a reason Analytics can bucket.
 *
 * `bucket` is what Analytics groups by. It is derived from the reason string
 * rather than stored as its own column: `approval_notes` is the only column the
 * reason itself writes, and an unrecognised or legacy free-text note has to
 * land somewhere — declineBucket() answers "hard" for those, matching how
 * Analytics has always counted an unknown reason under Others.
 *
 * "Others" sits in its OWN bucket rather than under Hard pass. It says nothing
 * about whether the influencer can be approached again — that is the whole
 * point of the free-text note that accompanies it — so counting it as a hard
 * pass overstated the "do not contact" total by every miscellaneous decline.
 */
export type DeclineBucket = "hard" | "soft" | "other"

export interface DeclineReason {
  /** The reason text. This is what is written to `approval_notes`. */
  r: string
  bucket: DeclineBucket
  /** Dot colour, shared by the modal and the Analytics reason breakdown. */
  color: string
}

export const DECLINE_REASONS: DeclineReason[] = [
  { r: "Fee too low / unpaid",                   bucket: "hard", color: "#E24B4A" },
  { r: "Brief too scripted",                     bucket: "hard", color: "#E8724A" },
  { r: "Won't allow content reuse",              bucket: "hard", color: "#F4A240" },
  { r: "Working with a competitor",              bucket: "hard", color: "#C97B3A" },
  { r: "Product doesn't fit their brand",        bucket: "hard", color: "#888780" },
  { r: "Wrong audience fit",                     bucket: "hard", color: "#6B7F7A" },
  { r: "Seen bad reviews about us",              bucket: "hard", color: "#A32D2D" },
  { r: "Fully booked",                           bucket: "soft", color: "#2C8EC4" },
  { r: "Temporarily unavailable / can't shoot",  bucket: "soft", color: "#5BAFD4" },
  { r: "Can't ship to their location",           bucket: "soft", color: "#7DC4E4" },
  { r: "Ghosted / no longer active",             bucket: "soft", color: "#B4B2A9" },
  { r: "Rate / deadline too tight",              bucket: "soft", color: "#F4B740" },
  { r: "Others",                                 bucket: "other", color: "#D3D1C7" },
]

export const HARD_PASS_REASONS  = DECLINE_REASONS.filter((d) => d.bucket === "hard").map((d) => d.r)
export const SOFT_PASS_REASONS  = DECLINE_REASONS.filter((d) => d.bucket === "soft").map((d) => d.r)
export const OTHER_PASS_REASONS = DECLINE_REASONS.filter((d) => d.bucket === "other").map((d) => d.r)

/**
 * The reason that opens the free-text notes field.
 *
 * Named rather than spelled inline so the modal, the validation and anything
 * reading a stored decline all agree on which reason carries a note.
 */
export const OTHER_REASON = "Others"

/**
 * Which bucket a stored reason belongs to.
 *
 * Anything not in the list — a legacy free-text note typed into the old
 * Influencer List decline modal, or an empty note — counts as "other". It used
 * to count as "hard", which asserted "do not contact again" about a decline
 * nobody had classified; "other" is the honest answer for a reason we cannot
 * place.
 */
export function declineBucket(reason: string | null | undefined): DeclineBucket {
  const clean = (reason ?? "").trim()
  if (SOFT_PASS_REASONS.includes(clean)) return "soft"
  if (HARD_PASS_REASONS.includes(clean)) return "hard"
  return "other"
}

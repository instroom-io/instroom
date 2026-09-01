// table-sheet/utils.ts
// Pure utility functions — no React, no side effects

import { CustomColumn, InfluencerRow, SortOrder } from "./types"
import { PLATFORM_URL_MAP, CSV_EXPORT_FIELDS, IMPORT_FIELDS, platforms, DEFAULT_GENDERS, DEFAULT_CONTACT_STATUSES } from "./constants"
import { isDraftHandle } from "@/lib/influencer-draft"

// ── Handle helpers ────────────────────────────────────────────────────────────

export function cleanHandle(raw: string): string {
  const value = raw.trim()
  // A draft's generated placeholder is not a handle the user typed — it exists
  // only to keep the row unique on @@unique([handle, platform]). Blanked here,
  // the one function every read and render path in the sheet already runs, so
  // the placeholder cannot surface in the Handle column, be mistaken for a real
  // value, or be carried into a save. The row then renders as the empty,
  // editable row the user actually added.
  if (isDraftHandle(value)) return ""
  return value.replace(/^@/, "")
}

export function displayHandle(handle: string): string {
  return cleanHandle(handle)
}

// ── Influencer API helpers ────────────────────────────────────────────────────

/**
 * Normalise a typed handle into the username the influencer API accepts.
 *
 * The API takes the bare username as a path segment. Instagram and TikTok both
 * allow letters, digits, '.' and '_' and nothing else, so anything outside that
 * set is removed rather than percent-encoded: a pasted profile URL, a stray
 * space, or an invisible character would otherwise be sent as %2F / %20 and come
 * back as a spurious "not found".
 *
 * Strips any leading '@' (including a repeated one) and lowercases, since both
 * platforms treat usernames case-insensitively.
 *
 * Returns "" when nothing usable remains — the caller must not send a request.
 */
export function normalizeApiUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
}

/** Does this look like a username the API can be asked about at all? */
export function isValidApiUsername(username: string): boolean {
  return username.length >= 2 && /^[a-z0-9._]+$/.test(username)
}

/**
 * What went wrong with an influencer lookup, and what to tell the user.
 *
 * Split out of the component so each documented response class is one testable
 * branch. `notFound` is the ONLY outcome that may be reported as "this username
 * doesn't exist" — a rate limit, a provider fault or a connection failure says
 * nothing about whether the influencer exists, and reporting those as not-found
 * is what sent people looking for a typo in a valid username.
 */
export type LookupFailure = {
  /** True only for a genuine 404: the caller keeps its existing toast. */
  notFound: boolean
  /**
   * The technical cause, for the CONSOLE only.
   *
   * Carries HTTP codes and upstream detail because that is what makes a report
   * actionable for us. Never rendered: a private profile is not a system fault,
   * and telling the user "HTTP 403" or naming the API blames the wrong thing.
   */
  reason: string
  /** True when retrying could plausibly succeed. */
  retryable: boolean
  /**
   * What actually went wrong, kept internally so a genuine outage stays
   * distinguishable from an ordinary fetch limitation.
   *
   *   restricted  private / blocked / not readable — the profile may be real
   *   invalid     the platform rejected the username itself
   *   rate-limit  too many requests, ours or the platform's
   *   service     a confirmed API/service failure
   */
  cause: "restricted" | "invalid" | "rate-limit" | "service"
}

/**
 * The one user-facing line for a failed lookup.
 *
 * Neutral on purpose. The user cannot tell — and does not need to tell — a
 * private account from a restricted one from a momentary hiccup, and none of
 * those is an API outage. What they need is the two things they can do, which
 * the modal offers: retry, or carry on filling the row in by hand. Identical
 * across Instagram, TikTok, YouTube, X and anything added later, so the message
 * cannot drift per platform.
 */
export function lookupFailureMessage(handle: string): string {
  const clean = handle.trim().replace(/^@+/, "")
  return (
    `We couldn't fetch data for @${clean}. The profile may be private, ` +
    `unavailable, or temporarily unable to be accessed. You can retry or ` +
    `continue adding the influencer manually.`
  )
}

/**
 * The API wraps upstream (Instagram/TikTok) failures in a 502 and puts the real
 * cause in the body, so a 502 alone is ambiguous. Observed against the live API:
 *
 *   {"message":"Request failed with status code 404"}   username does not exist
 *   {"message":"Request failed with status code 403"}   profile exists but the
 *                                                      provider was denied
 *                                                      (private/restricted)
 *   {"message":"Failed to fetch data from TikTok API."} genuine provider failure
 *
 * Reading the upstream status out of the body is what lets those three be told
 * apart. Confirmed live: @dandanielle returns 403 on Instagram on every attempt
 * yet 200 on TikTok, while cristiano/nasa/sarwarsetfree all return 200 on
 * Instagram — so a blanket "the API is broken, retry" was wrong for all three.
 */
function upstreamStatusFrom(detail: string | undefined): number | null {
  if (!detail) return null
  const m = /status code (\d{3})/i.exec(detail)
  return m ? Number(m[1]) : null
}

/**
 * The TikTok path reports a nonexistent username WITHOUT a status code in the
 * body, so `upstreamStatusFrom` cannot see it:
 *
 *   502 {"message":"Failed to fetch data from TikTok API."}
 *
 * Verified against the live API: charlidamelio, khaby.lame and zippit_nl all
 * return 200, while two fabricated handles both return exactly this 502 body. So
 * the endpoint is healthy and this message is how it says "no such user" — but
 * because no status could be parsed out of it, every mistyped TikTok handle fell
 * through to the generic 502 branch and raised the "Influencer API unavailable"
 * modal instead of the ordinary not-found toast.
 *
 * The honest limitation: a REAL TikTok outage produces the same body, and one
 * response cannot distinguish "this user does not exist" from "the provider is
 * down". Not-found is the right default because it is overwhelmingly the common
 * case — a typo or the wrong platform picked — and the alternative blames the
 * API on every typo. The full body is still logged by the caller, so a genuine
 * outage remains visible in the console rather than being swallowed.
 */
function isProviderMissTold(detail: string | undefined): boolean {
  if (!detail) return false
  return /failed to fetch data from .+ api/i.test(detail)
}

export function describeLookupFailure(
  status: number,
  platform: string,
  /** Raw response body, used to recover the wrapped upstream status. */
  detail?: string
): LookupFailure {
  // 400 — the API rejected the username itself. Retrying sends the same value,
  // so the user has to correct it; not a provider fault.
  if (status === 400) {
    return {
      notFound: false,
      reason: `API rejected the username as invalid for ${platform} (HTTP 400).`,
      retryable: false,
      cause: "invalid",
    }
  }
  if (status === 404) {
    return { notFound: true, reason: "", retryable: false, cause: "invalid" }
  }
  // 429 — request or monthly plan limit. The username is fine.
  if (status === 429) {
    return {
      notFound: false,
      reason: "API rate or monthly request limit reached (HTTP 429).",
      retryable: true,
      cause: "rate-limit",
    }
  }
  if (status === 500 || status === 502) {
    const upstream = upstreamStatusFrom(detail)

    // Upstream 404 — the username genuinely does not exist on this platform.
    // Treated exactly like a direct 404 so the existing not-found toast is used
    // instead of an "API is broken" modal the user can do nothing about.
    if (upstream === 404) {
      return { notFound: true, reason: "", retryable: false, cause: "invalid" }
    }

    // Same conclusion, reached from a body with no status code in it at all —
    // how the TikTok path reports a nonexistent handle. See isProviderMissTold.
    if (upstream === null && isProviderMissTold(detail)) {
      return { notFound: true, reason: "", retryable: false, cause: "invalid" }
    }

    // Upstream 401/403 — the account exists but the provider could not read it:
    // private, restricted, or blocked for this profile. Retrying is futile, and
    // this is NOT "not found" — the influencer may well be real.
    if (upstream === 401 || upstream === 403) {
      // The account exists but could not be read: private, restricted or
      // blocked. An ordinary limitation, NOT a service failure.
      return {
        notFound: false,
        reason: `${platform} refused to serve this profile (upstream HTTP ${upstream}) — private or restricted.`,
        retryable: false,
        cause: "restricted",
      }
    }

    // Upstream rate limit surfaced through the wrapper.
    if (upstream === 429) {
      return {
        notFound: false,
        reason: `${platform} is rate limiting the API (upstream HTTP 429).`,
        retryable: true,
        cause: "rate-limit",
      }
    }

    // A confirmed service-side failure: the API answered, but could not reach
    // the platform. This is the ONLY branch that is genuinely an outage.
    return {
      notFound: false,
      reason:
        `API could not reach ${platform} (HTTP ${status}` +
        `${upstream ? `, upstream ${upstream}` : ""}).`,
      retryable: true,
      cause: "service",
    }
  }
  if (status === 401 || status === 403) {
    return {
      notFound: false,
      reason: `API rejected our request (HTTP ${status}) — key or configuration issue.`,
      retryable: false,
      cause: "service",
    }
  }
  return {
    notFound: false,
    reason: `API returned an unexpected HTTP ${status}.`,
    retryable: true,
    cause: "service",
  }
}

/**
 * The display name for a stored platform value.
 *
 * Platforms are PERSISTED lowercase (`instagram`, `tiktok`, `youtube`,
 * `twitter` — the create route lowercases them, and PLATFORM_URL_MAP is keyed
 * the same way), while the label people read is capitalised. That mapping was
 * being done inline in a few places and, on the Pipeline board, against a table
 * keyed by the CAPITALISED name — so a stored "tiktok" matched nothing.
 *
 * Unknown-but-present values are returned as they are rather than replaced, so
 * a platform this build does not know about still shows itself. An absent
 * platform returns "", and the caller decides what an empty cell looks like.
 */
export function getPlatformLabel(platform?: string | null): string {
  const value = platform?.trim()
  if (!value) return ""
  // Case-insensitive for the same reason as PlatformIcon: the Pipeline and Post
  // Tracker routes serve the value capitalised, so a strict match returned the
  // raw string and the boards read "Tiktok" instead of "TikTok".
  const key = value.toLowerCase()
  return platforms.find((p) => p.value === key)?.name ?? value
}

export function getProfileUrl(platform: string, handle: string): string {
  if (!handle || handle === "@" || handle === "") return ""
  const fn = PLATFORM_URL_MAP[platform]
  return fn ? fn(handle) : ""
}

// ── Avatar helpers ────────────────────────────────────────────────────────────

export function stringToColor(str: string): { bg: string; text: string } {
  const colors = [
    { bg: "#dbeafe", text: "#1e40af" },
    { bg: "#dcfce7", text: "#166534" },
    { bg: "#fce7f3", text: "#9d174d" },
    { bg: "#ede9fe", text: "#5b21b6" },
    { bg: "#ffedd5", text: "#9a3412" },
    { bg: "#cffafe", text: "#155e75" },
    { bg: "#fef9c3", text: "#854d0e" },
    { bg: "#f1f5f9", text: "#334155" },
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function getInitials(name?: string, handle?: string): string {
  const source = name?.trim() || handle?.trim().replace(/^@/, "") || ""
  if (!source) return "?"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

// ── Number formatting ─────────────────────────────────────────────────────────

export function formatFollowers(n: number): string {
  if (!n || isNaN(n)) return "0"
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")) + "M"
  }
  if (n >= 1_000) {
    const v = n / 1_000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")) + "K"
  }
  return String(n)
}

export function parseFormattedNumber(val: string | number | undefined): string {
  if (!val || val === "Not Available") return ""
  const s = String(val).toLowerCase().trim()
  if (s.includes("m")) return String(Math.round(parseFloat(s) * 1_000_000))
  if (s.includes("k")) return String(Math.round(parseFloat(s) * 1_000))
  const n = parseFloat(s)
  return isNaN(n) ? "" : String(Math.round(n))
}

// ── URL helpers ───────────────────────────────────────────────────────────────

// ── Email placeholders ────────────────────────────────────────────────────────
// The enrichment providers do not omit a missing address, they send a stand-in
// for it — "Email not available" is the common one. Stored as-is it looked like
// a real value everywhere it mattered: two influencers who both lacked an email
// were flagged as sharing one, a row carrying nothing but the stand-in counted
// as having contact details and was written to the database, and a later fetch
// overwrote a real address with it.
//
// So the stand-ins are named once, here, and every place that asks "is there an
// email?" asks through these.

const UNAVAILABLE_VALUES = new Set([
  "email not available",
  "not available",
  "unavailable",
  "no email",
  "none",
  "n/a",
  "na",
  "-",
  "—",
])

/** Is this one of the provider's "there is nothing here" stand-ins? */
export function isUnavailablePlaceholder(value?: string | null): boolean {
  const v = value?.trim().toLowerCase()
  return !!v && UNAVAILABLE_VALUES.has(v)
}

/**
 * Is this an address worth keeping?
 *
 * Requires an "@" as well as not being a stand-in — the same rule the influencer
 * PUT route applies before it stores an email, so the client and the database
 * agree on what counts rather than the field silently emptying on next reload.
 */
export function isUsableEmail(value?: string | null): boolean {
  const v = value?.trim()
  if (!v || isUnavailablePlaceholder(v)) return false
  return v.includes("@")
}

/** The address if it is usable, an empty string otherwise. */
export function normalizeEmail(value?: string | null): string {
  return isUsableEmail(value) ? value!.trim() : ""
}

/**
 * Is this contact detail one that IDENTIFIES a person?
 *
 * Duplicate detection only makes sense for a contact that is unique to someone.
 * Two of them exist in this column:
 *
 *   unique      an email address, a phone number — one inbox, one line, one
 *               person, so a second row carrying it is worth asking about;
 *   NOT unique  a DM / social handle. `contact_info` is fed by the importer's
 *               "email address/handlename" column, so a messaging handle lands
 *               here routinely — and a DM route is not an identity. A brand
 *               messages many creators from one inbox, a manager runs several
 *               accounts, and the same handle string can belong to different
 *               people on different platforms. Flagging those as duplicates
 *               interrupted the user for something that was never a conflict.
 *
 * Anything containing "@" in the middle is an address; a leading "@", or no "@"
 * at all with no digits, reads as a handle. A value that is mostly digits is
 * treated as a phone number and stays unique.
 */
export function isUniqueContact(value?: string | null): boolean {
  const v = normalizeContactInfo(value)
  if (!v) return false

  // A DM/social handle: "@name", or a bare social URL. Never unique.
  if (v.startsWith("@")) return false
  if (/^(https?:\/\/)?(www\.)?(instagram|tiktok|twitter|x|facebook|fb|youtube|threads|linkedin)\.com\//i.test(v)) return false
  if (/^ig\.me\/|^m\.me\//i.test(v)) return false

  // An email address — unique.
  if (isUsableEmail(v)) return true

  // A phone number: mostly digits, allowing the usual punctuation. Unique.
  const digits = v.replace(/[\s()+.-]/g, "")
  if (/^\d{6,}$/.test(digits)) return true

  // Anything else with no "@" is a bare handle or free text — not an identity.
  return false
}

/**
 * The value a unique contact should be COMPARED on.
 *
 * A phone number is one line whichever way it is punctuated, so
 * "+63 917 123 4567", "+639171234567" and "(0917) 123-4567" have to reduce to
 * the same key or the same number gets accepted twice. Comparing the display
 * string missed exactly that. Everything else — an email above all — keeps its
 * existing lowercase-string comparison untouched.
 *
 * Returns "" for anything that is not a unique contact, so a DM handle can
 * never match: callers already gate on `isUniqueContact`, and an empty key is
 * the same answer if one ever does not.
 */
export function contactMatchKey(value?: string | null): string {
  const v = normalizeContactInfo(value)
  if (!v || !isUniqueContact(v)) return ""
  // Emails and anything else compare as themselves.
  if (isUsableEmail(v)) return v.toLowerCase()
  // Phone-shaped: compare on digits alone, using the same rule that classified
  // it as a phone number in the first place so the two cannot drift apart.
  const digits = v.replace(/[\s()+.-]/g, "")
  if (/^\d{6,}$/.test(digits)) return digits
  return v.toLowerCase()
}

/**
 * `contact_info` is not strictly an address — the CSV importer maps an
 * "email address/handlename" column into it — so this only strips the
 * stand-ins and leaves anything else alone.
 */
export function normalizeContactInfo(value?: string | null): string {
  const v = value?.trim()
  return !v || isUnavailablePlaceholder(v) ? "" : v
}

export function isValidUrl(str: string): boolean {
  if (!str) return false
  try {
    const u = new URL(str.startsWith("http") ? str : `https://${str}`)
    return u.hostname.includes(".")
  } catch { return false }
}

export function normalizeUrl(str: string): string {
  if (!str) return ""
  return str.startsWith("http") ? str : `https://${str}`
}

// ── Approval state machine ────────────────────────────────────────────────────

export function handleApprovalChange(
  row: InfluencerRow,
  newStatus: string,
  declineReason?: string
): InfluencerRow {
  const r = { ...row }
  if (newStatus === "Approved" && row.approval_status !== "Approved") {
    const t = new Date()
    r.transferred_date = [
      t.getFullYear(),
      String(t.getMonth() + 1).padStart(2, "0"),
      String(t.getDate()).padStart(2, "0"),
    ].join("-")
  } else if (newStatus !== "Approved") {
    r.transferred_date = ""
  }
  if (newStatus === "Declined" && row.approval_status !== "Declined") {
    r.contact_status = "not_contacted"; r.stage = "1"; r.agreed_rate = ""; r.notes = ""
    if (declineReason) { r.approval_notes = declineReason; r.decline_reason = declineReason }
  }
  r.approval_status = newStatus as "Approved" | "Declined" | "Pending"
  return r
}

// ── Row factory ───────────────────────────────────────────────────────────────

/**
 * A blank row.
 *
 * `platform` is deliberately EMPTY rather than "instagram". A default platform
 * meant a handle typed into a fresh row was immediately a complete
 * handle+platform pair, so the lookup fired — and saved — against Instagram
 * whether or not that was the platform the user meant. Someone adding a TikTok
 * creator got an Instagram lookup on the first commit, and switching the
 * platform afterwards could not undo the row that had already been written.
 *
 * With no platform, every gate downstream holds on its own and no new gate was
 * needed:
 *
 *   scheduleAutoFetch   returns early unless platform is instagram or tiktok,
 *                       so no request is scheduled and no debounce armed
 *   rowHasHandle        (manage-influencers/page.tsx) requires a truthy
 *                       platform, so no create, update or fallback-save path
 *                       runs either
 *
 * So the row sits in the grid, fully editable, until the user picks a platform —
 * and the lookup then runs against the platform they actually chose.
 *
 * NOTE for CSV import: parseCSV builds its rows on top of this one and used to
 * inherit "instagram" as its fallback for a file with no platform column. That
 * fallback is now explicit there instead, so import behaviour is unchanged.
 */
export function newEmptyRow(customCols: CustomColumn[]): InfluencerRow {
  const custom: Record<string, string> = {}
  customCols.forEach((c) => { custom[c.field_key] = c.field_type === "boolean" ? "No" : "" })
  return {
    id: `temp-${crypto.randomUUID()}`, handle: "", platform: "", full_name: "", email: "",
    follower_count: "", engagement_rate: "", niche: "", contact_status: "not_contacted",
    stage: "1", agreed_rate: "", notes: "", custom, gender: "", location: "",
    social_link: "", first_name: "", contact_info: "", approval_status: "Pending",
    transferred_date: "", approval_notes: "", decline_reason: "", tier: "Bronze",
    community_status: "Pending", profile_image_url: "",
    created_at: new Date().toISOString(),
  }
}

// ── Sort helper ───────────────────────────────────────────────────────────────

export function sortRows(rows: InfluencerRow[], order: SortOrder): InfluencerRow[] {
  const hasTimestamps = rows.some(r => r.created_at)
  if (hasTimestamps) {
    return [...rows].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return order === "newest" ? tb - ta : ta - tb
    })
  }
  return order === "newest" ? [...rows].reverse() : [...rows]
}

// ── Column definitions ────────────────────────────────────────────────────────

export function getStaticCols(niches: string[], locations: string[]) {
  return [
    { key: "handle",          label: "Handle",           group: "Influencer Details" as const, minWidth: 110, type: "text" as const },
    { key: "platform",        label: "Platform",         group: "Influencer Details" as const, minWidth: 80,  type: "select" as const, options: ["instagram","tiktok","youtube","twitter","other"] },
    { key: "niche",           label: "Niche",            group: "Influencer Details" as const, minWidth: 80,  type: "select" as const, options: niches },
    { key: "gender",          label: "Gender",           group: "Influencer Details" as const, minWidth: 70,  type: "select" as const, options: ["Male","Female","Non-binary","Other"] },
    { key: "location",        label: "Location",         group: "Influencer Details" as const, minWidth: 85,  type: "select" as const, options: locations },
    { key: "follower_count",  label: "Followers",        group: "Influencer Details" as const, minWidth: 70,  type: "number" as const },
    { key: "engagement_rate", label: "Engagement Rate ",              group: "Influencer Details" as const, minWidth: 60,  type: "number" as const },
    { key: "first_name",      label: "First Name",       group: "Influencer Details" as const, minWidth: 75,  type: "text" as const },
    { key: "contact_info",    label: "Contact Info",     group: "Influencer Details" as const, minWidth: 120, type: "text" as const },
    { key: "approval_status", label: "Approve/Decline",  group: "Approval Details" as const,  minWidth: 95,  type: "select" as const, options: ["Approved","Declined","Pending"] },
    { key: "transferred_date",label: "Date Reviewed",      group: "Approval Details" as const,  minWidth: 95,  type: "date" as const },
    { key: "approval_notes",  label: "Notes",            group: "Approval Details" as const,  minWidth: 110, type: "text" as const },
  ]
}
// ── CSV import ────────────────────────────────────────────────────────────────

export function escapeCSV(val: string): string {
  if (!val) return ""
  if (val.includes(",") || val.includes('"') || val.includes("\n")) return `"${val.replace(/"/g, '""')}"`
  return val
}

export function exportToCSV(rows: InfluencerRow[], cc: CustomColumn[]): void {
  const af = [...CSV_EXPORT_FIELDS, ...cc.map(c => ({ key: `custom.${c.field_key}`, label: c.field_name }))]
  const h = af.map(f => escapeCSV(f.label)).join(",")
  const l = rows.map(r =>
    af.map(f => {
      let v = ""
      if (f.key.startsWith("custom.")) v = r.custom[f.key.slice(7)] ?? ""
      else v = String((r as Record<string, unknown>)[f.key] ?? "")
      return escapeCSV(v)
    }).join(",")
  )
  const csv = [h, ...l].join("\n")
  const b = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const u = URL.createObjectURL(b)
  const a = document.createElement("a")
  a.href = u; a.download = `influencers_export_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(u)
}

export function downloadTemplate(cc: CustomColumn[]): void {
  const af = [...IMPORT_FIELDS, ...cc.map(c => ({ key: `custom.${c.field_key}`, label: c.field_name }))]
  const h = af.map(f => escapeCSV(f.label)).join(",")
  const sample = [
    "aliyahbeauty","instagram","Aliyah","Beauty","Female","Philippines","45000","3.2",
    "https://instagram.com/aliyahbeauty","aliyah@email.com",
    ...cc.map(() => ""),
  ].map(escapeCSV).join(",")
  const csv = [h, sample].join("\n")
  const b = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const u = URL.createObjectURL(b)
  const a = document.createElement("a")
  a.href = u; a.download = "instroom_import_template.csv"; a.click()
  URL.revokeObjectURL(u)
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let cur: string[] = []; let cell = ""; let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') inQ = false
      else cell += ch
    } else {
      if (ch === '"') inQ = true
      else if (ch === ',') { cur.push(cell); cell = "" }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        cur.push(cell); cell = ""; rows.push(cur); cur = []
        if (ch === '\r') i++
      } else cell += ch
    }
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur) }
  return rows
}

export function importFromCSV(
  text: string,
  cc: CustomColumn[]
): { rows: InfluencerRow[]; niches: string[]; locations: string[] } {
  const p = parseCSV(text)
  if (p.length < 2) return { rows: [], niches: [], locations: [] }
  const hd = p[0].map(h => h.trim().toLowerCase())

  const fm: Record<string, string> = {}
  CSV_EXPORT_FIELDS.forEach(f => { fm[f.label.toLowerCase()] = f.key })
  IMPORT_FIELDS.forEach(f => { fm[f.label.toLowerCase()] = f.key })

  fm["platform"]                  = "platform"
  fm["platform link"]             = "social_link"
  fm["new: location"]             = "location"
  fm["new: niche"]                = "niche"
  fm["username"]                  = "handle"
  fm["email address/ handlename"] = "contact_info"
  fm["email address/handlename"]  = "contact_info"
  fm["dm ig username"]            = "_dm_handle"
  fm["first name"]                = "first_name"
  fm["followers count"]           = "follower_count"
  fm["big rate"]                  = "engagement_rate"
  fm["average views"]             = "avg_views"
  fm["pipeline status"]           = "contact_status"

  cc.forEach(c => { fm[c.field_name.toLowerCase()] = `custom.${c.field_key}` })

  const rows: InfluencerRow[] = []
  const discoveredNiches = new Set<string>()
  const discoveredLocations = new Set<string>()

  for (let i = 1; i < p.length; i++) {
    const vals = p[i]
    if (vals.every(v => !v.trim())) continue
    const row = newEmptyRow(cc)
    hd.forEach((h, ci) => {
      const key = fm[h]
      if (!key || ci >= vals.length) return
      const val = vals[ci].trim()
      if (!val) return
      if (key.startsWith("custom.")) row.custom[key.slice(7)] = val
      else (row as Record<string, unknown>)[key] = val
    })
    if (!["Approved", "Declined", "Pending"].includes(row.approval_status || "")) row.approval_status = "Pending"

    const dmHandle = (row as any)["_dm_handle"]
    if (!row.handle && dmHandle) row.handle = cleanHandle(dmHandle)
    else row.handle = cleanHandle(row.handle)

    // Import has no interactive "pick a platform" step — the file either states
    // one or it does not — so an absent platform still falls back to Instagram,
    // exactly as it did when newEmptyRow supplied that default. Without this the
    // change to newEmptyRow would leave every row of a platform-less CSV with an
    // empty platform, which rowHasHandle rejects, and the whole import would
    // silently never save.
    {
      const pl = (row.platform || "instagram").toLowerCase()
      const map: Record<string, string> = {
        instagram: "instagram", tiktok: "tiktok", youtube: "youtube",
        "x (twitter)": "twitter", twitter: "twitter", facebook: "other", other: "other",
      }
      row.platform = map[pl] || "instagram"
    }

    if (row.contact_status) {
      const ps = row.contact_status.toLowerCase().trim()
      const statusMap: Record<string, string> = {
        "contacted":           "contacted", "replied": "contacted",
        "in progress":         "interested", "not interested": "not_contacted",
        "for order creation":  "agreed", "in transit": "agreed",
        "delivered":           "agreed", "posted": "agreed", "agreed": "agreed",
        "interested":          "interested", "not_contacted": "not_contacted",
      }
      row.contact_status = statusMap[ps] ?? "not_contacted"
    }

    if (row.niche?.trim()) discoveredNiches.add(row.niche.trim())
    if (row.location?.trim()) discoveredLocations.add(row.location.trim())

    if (isUnavailablePlaceholder(row.email)) row.email = ""
    if (isUnavailablePlaceholder(row.contact_info)) row.contact_info = ""
    if (row.email && !row.contact_info) row.contact_info = row.email
    if (row.contact_info && !row.email && isUsableEmail(row.contact_info)) row.email = row.contact_info
    if (!row.first_name && row.full_name) row.first_name = row.full_name.split(" ")[0]
    if (!row.handle) continue
    rows.push(row)
  }

  const seenHandles = new Map<string, number>()
  const seenEmails = new Map<string, number>()
  const deduped: InfluencerRow[] = []
  rows.forEach((row, idx) => {
    const hk = `${row.handle.toLowerCase()}@${row.platform}`
    // Placeholders excluded: two imported rows that both lack an email do not
    // share one, and the second must not be dropped as a duplicate.
    const em = (normalizeEmail(row.email) || normalizeContactInfo(row.contact_info)).toLowerCase().trim()
    let isDupe = false
    if (seenHandles.has(hk)) isDupe = true
    else seenHandles.set(hk, idx)
    if (!isDupe && em && seenEmails.has(em)) isDupe = true
    else if (em) seenEmails.set(em, idx)
    if (!isDupe) deduped.push(row)
  })

  return { rows: deduped, niches: [...discoveredNiches], locations: [...discoveredLocations] }
}
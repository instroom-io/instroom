// table-sheet/utils.ts
// Pure utility functions — no React, no side effects

import { CustomColumn, InfluencerRow, SortOrder } from "./types"
import { PLATFORM_URL_MAP, CSV_EXPORT_FIELDS, IMPORT_FIELDS, platforms, DEFAULT_GENDERS, DEFAULT_CONTACT_STATUSES } from "./constants"

// ── Handle helpers ────────────────────────────────────────────────────────────

export function cleanHandle(raw: string): string {
  return raw.trim().replace(/^@/, "")
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
  /** Shown in the existing API error modal, which offers Retry + manual add. */
  reason: string
  /** True when retrying could plausibly succeed. */
  retryable: boolean
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
      reason: `The API rejected this username as invalid for ${platform}. Check the spelling and try again.`,
      retryable: false,
    }
  }
  if (status === 404) {
    return { notFound: true, reason: "", retryable: false }
  }
  // 429 — request or monthly plan limit. The username is fine.
  if (status === 429) {
    return {
      notFound: false,
      reason:
        "The influencer API has hit its rate or monthly request limit. " +
        "This username is fine — wait a moment and retry, or add the influencer manually.",
      retryable: true,
    }
  }
  if (status === 500 || status === 502) {
    const upstream = upstreamStatusFrom(detail)

    // Upstream 404 — the username genuinely does not exist on this platform.
    // Treated exactly like a direct 404 so the existing not-found toast is used
    // instead of an "API is broken" modal the user can do nothing about.
    if (upstream === 404) {
      return { notFound: true, reason: "", retryable: false }
    }

    // Same conclusion, reached from a body with no status code in it at all —
    // how the TikTok path reports a nonexistent handle. See isProviderMissTold.
    if (upstream === null && isProviderMissTold(detail)) {
      return { notFound: true, reason: "", retryable: false }
    }

    // Upstream 401/403 — the account exists but the provider could not read it:
    // private, restricted, or blocked for this profile. Retrying is futile, and
    // this is NOT "not found" — the influencer may well be real.
    if (upstream === 401 || upstream === 403) {
      return {
        notFound: false,
        reason:
          `${platform} did not allow this profile to be read (HTTP ${upstream}). ` +
          `That usually means the account is private or restricted. Check the platform is ` +
          `right for this handle, or add the influencer manually.`,
        retryable: false,
      }
    }

    // Upstream rate limit surfaced through the wrapper.
    if (upstream === 429) {
      return {
        notFound: false,
        reason:
          `${platform} is rate limiting the API. This username is fine — wait a moment and retry.`,
        retryable: true,
      }
    }

    return {
      notFound: false,
      reason:
        `The influencer API could not reach ${platform} (HTTP ${status}` +
        `${upstream ? `, upstream ${upstream}` : ""}). This is a problem with the API or the ` +
        `platform, not with this username — retrying often works.`,
      retryable: true,
    }
  }
  if (status === 401 || status === 403) {
    return {
      notFound: false,
      reason: `The influencer API rejected our request (HTTP ${status}). This needs an API key or configuration fix.`,
      retryable: false,
    }
  }
  return {
    notFound: false,
    reason: `The influencer API returned an unexpected HTTP ${status}.`,
    retryable: true,
  }
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

    if (row.email && !row.contact_info) row.contact_info = row.email
    if (row.contact_info && !row.email) row.email = row.contact_info
    if (!row.first_name && row.full_name) row.first_name = row.full_name.split(" ")[0]
    if (!row.handle) continue
    rows.push(row)
  }

  const seenHandles = new Map<string, number>()
  const seenEmails = new Map<string, number>()
  const deduped: InfluencerRow[] = []
  rows.forEach((row, idx) => {
    const hk = `${row.handle.toLowerCase()}@${row.platform}`
    const em = (row.contact_info || row.email || "").toLowerCase().trim()
    let isDupe = false
    if (seenHandles.has(hk)) isDupe = true
    else seenHandles.set(hk, idx)
    if (!isDupe && em && seenEmails.has(em)) isDupe = true
    else if (em) seenEmails.set(em, idx)
    if (!isDupe) deduped.push(row)
  })

  return { rows: deduped, niches: [...discoveredNiches], locations: [...discoveredLocations] }
}
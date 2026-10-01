// lib/research-sop/fields.ts
//
// The ONLY Influencer columns an SOP step may target. Shared by the client (the
// step editor's dropdown) and the server (every write is re-checked against
// it), so a column name never travels from the browser into a query.
//
// These are existing Influencer columns — the same ones the Influencer List
// edits through PUT /api/brand/[brandId]/influencers/[id]. No field is
// duplicated for research.

export const RESEARCH_FIELDS = [
  "location",
  "niche",
  "follower_count",
  "engagement_rate",
  "email",
  "bio",
] as const

export type ResearchField = (typeof RESEARCH_FIELDS)[number]

export const RESEARCH_FIELD_LABELS: Record<ResearchField, string> = {
  location:        "Location",
  niche:           "Niche",
  follower_count:  "Followers",
  engagement_rate: "Engagement rate",
  email:           "Email",
  bio:             "Bio",
}

export function isResearchField(value: unknown): value is ResearchField {
  return typeof value === "string" && (RESEARCH_FIELDS as readonly string[]).includes(value)
}

export const VALUE_TYPES = ["explicit", "extracted", "inferred", "uncertain"] as const
export type ValueType = (typeof VALUE_TYPES)[number]

export const SOP_STATUSES = ["draft", "active", "archived"] as const
export type SopStatus = (typeof SOP_STATUSES)[number]

export const RUN_TARGET_MODES = ["selected", "missing", "all"] as const
export type RunTargetMode = (typeof RUN_TARGET_MODES)[number]

/** Result statuses that still wait for a person's decision. */
export const REVIEWABLE_RESULT_STATUSES = ["proposed", "needs_review", "conflict"] as const

// Column limits from prisma/schema.prisma (Influencer).
const MAX_LOCATION = 255
const MAX_NICHE = 100
const MAX_EMAIL = 191
const MAX_BIO = 5000

const PLACEHOLDERS = new Set(["", "n/a", "na", "none", "null", "unknown", "not available", "-", "—"])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Validate and normalise one proposed value for a field.
 *
 * Returns the canonical string that would be stored, or null when the value is
 * empty, a placeholder or invalid — a missing value is never turned into a fake
 * one. `taxonomy` is the brand's own niche / location list: a case-insensitive
 * match is snapped to the stored spelling, so the same place is never saved two
 * ways.
 */
export function normalizeFieldValue(
  field: ResearchField,
  raw: unknown,
  taxonomy?: { niches?: string[]; locations?: string[] }
): string | null {
  if (raw === null || raw === undefined) return null

  switch (field) {
    case "follower_count": {
      const n = parseCount(raw)
      return n === null ? null : String(n)
    }
    case "engagement_rate": {
      const s = String(raw).trim().replace(/%$/, "")
      const n = Number(s)
      if (!s || !Number.isFinite(n) || n < 0 || n > 100) return null
      return String(Math.round(n * 100) / 100)
    }
    case "email": {
      const s = String(raw).trim().toLowerCase()
      if (!EMAIL_RE.test(s) || s.length > MAX_EMAIL) return null
      return s
    }
    case "location":
      return normalizeLabel(raw, MAX_LOCATION, taxonomy?.locations)
    case "niche":
      return normalizeLabel(raw, MAX_NICHE, taxonomy?.niches)
    case "bio": {
      const s = String(raw).trim()
      if (isPlaceholder(s)) return null
      return s.slice(0, MAX_BIO)
    }
  }
}

function isPlaceholder(s: string): boolean {
  return PLACEHOLDERS.has(s.trim().toLowerCase())
}

function normalizeLabel(raw: unknown, max: number, known?: string[]): string | null {
  const s = String(raw).replace(/\s+/g, " ").trim()
  if (isPlaceholder(s) || s.length > max) return null
  const match = known?.find((k) => k.trim().toLowerCase() === s.toLowerCase())
  return match ?? s
}

/**
 * Follower counts as the Influencer List stores them: a whole, non-negative
 * integer. Accepts "12,300", "12.3K" and "1.2M" the way parseFormattedNumber
 * does; anything else is rejected rather than guessed at.
 */
function parseCount(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 && raw <= 2_000_000_000 ? Math.round(raw) : null
  }
  const s = String(raw).trim().toLowerCase().replace(/,/g, "")
  const m = s.match(/^(\d+(?:\.\d+)?)([km])?$/)
  if (!m) return null
  const base = Number(m[1])
  const mult = m[2] === "m" ? 1_000_000 : m[2] === "k" ? 1_000 : 1
  const n = Math.round(base * mult)
  return Number.isFinite(n) && n <= 2_000_000_000 ? n : null
}

/** Is the stored value for this field empty (what "missing information" means)? */
export function isFieldEmpty(field: ResearchField, value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (field === "follower_count" || field === "engagement_rate") return Number(value) <= 0
  return isPlaceholder(String(value))
}

/** The stored Influencer value as a comparable string ("" when empty). */
export function currentValueString(field: ResearchField, value: unknown): string {
  if (isFieldEmpty(field, value)) return ""
  if (field === "engagement_rate") return String(Math.round(Number(value) * 100) / 100)
  if (field === "follower_count") return String(Math.round(Number(value)))
  if (field === "email") return String(value).trim().toLowerCase()
  return String(value).trim()
}

/** The Prisma data object for writing one field onto Influencer. */
export function toInfluencerData(field: ResearchField, value: string): Record<string, string | number> {
  if (field === "follower_count") return { follower_count: parseInt(value, 10) }
  if (field === "engagement_rate") return { engagement_rate: parseFloat(value) }
  return { [field]: value }
}

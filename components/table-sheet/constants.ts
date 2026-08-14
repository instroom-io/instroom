// table-sheet/constants.ts
// All static data: platform list, default options, style maps

import React from "react"

export const DEFAULT_PLATFORMS = ["Instagram", "YouTube", "TikTok", "X (Twitter)"]
export const DEFAULT_NICHES: string[] = []
export const DEFAULT_LOCATIONS: string[] = []
export const DEFAULT_GENDERS = ["Male", "Female", "Non-binary", "Other"]
export const DEFAULT_CONTACT_STATUSES = [
  { value: "not_contacted", label: "Not Contacted" },
  { value: "contacted",     label: "Contacted" },
  { value: "interested",    label: "Interested" },
  { value: "agreed",        label: "Agreed" },
]

export const OUTREACH_FIELDS = new Set(["contact_status", "stage", "agreed_rate", "notes"])

// ── Instroom influencer API ───────────────────────────────────────────────────
// Single definition of the API host. It was previously hardcoded separately in
// table-sheet.tsx and hooks.ts, which is how the two drifted, so both now import
// this and there is one place to change.
//
// This code runs in the browser, where Next strips out env vars that lack the
// NEXT_PUBLIC_ prefix. Both names are accepted so either convention works:
//   NEXT_PUBLIC_INSTROOM_API_BASE_URL  reaches the browser on its own
//   INSTROOM_API_BASE_URL              reaches it via the `env` block in
//                                      next.config.ts, which inlines it
// Whichever is set wins; NEXT_PUBLIC_ takes precedence when both are.
//
// There is deliberately no hardcoded fallback. The old default,
// "https://api.instroom", does not resolve, so every lookup fired a doomed
// request that the browser reported as a bare `TypeError: Failed to fetch`. An
// unset variable is treated as "not configured" and no request is attempted —
// see isInstroomApiConfigured() and its use in table-sheet.tsx.
//
// Trailing slashes are trimmed so a value like "https://host/" cannot produce a
// double slash in the path.
export const INSTROOM_API_BASE_URL = (
  process.env.NEXT_PUBLIC_INSTROOM_API_BASE_URL ||
  process.env.INSTROOM_API_BASE_URL ||
  ""
)
  .trim()
  .replace(/\/+$/, "")

/**
 * Is the influencer API pointed at anything? False when the environment variable
 * is unset or blank, in which case callers must not issue a request — a fetch
 * against a relative or empty base is exactly the "Failed to fetch" this avoids.
 */
export function isInstroomApiConfigured(): boolean {
  return /^https?:\/\/.+/i.test(INSTROOM_API_BASE_URL)
}

/**
 * Profile-lookup endpoints, per the API's documented paths. Note the asymmetry:
 * Instagram is under /v2, TikTok is not.
 *
 *   Instagram  GET {base}/v2/{username}/instagram
 *   TikTok     GET {base}/{username}/tiktok
 *
 * `/users/{query}` is deliberately NOT used here — that endpoint is discovery
 * search, not profile data.
 *
 * `username` must already be normalised (see normalizeApiUsername in utils.ts):
 * bare, lowercased, and restricted to the characters the API accepts.
 */
export const INSTROOM_PROFILE_ENDPOINTS: Record<string, (username: string) => string> = {
  instagram: (u) => `${INSTROOM_API_BASE_URL}/v2/${u}/instagram`,
  tiktok:    (u) => `${INSTROOM_API_BASE_URL}/${u}/tiktok`,
}

export const FIELD_TYPE_INFO: Record<string, { description: string; example: string }> = {
  text:          { description: "Free-form text input for any value",              example: 'e.g., "Prefers email contact"' },
  number:        { description: "Numeric values only — great for metrics",         example: "e.g., CPM rate, post count" },
  dropdown:      { description: "Pick one option from a predefined list",          example: "e.g., Priority: High, Medium, Low" },
  "multi-select":{ description: "Pick multiple options from a list",               example: "e.g., Content types: Reel, Story, Post" },
  date:          { description: "Calendar date picker",                            example: "e.g., Contract start date" },
  boolean:       { description: "Simple Yes / No toggle",                          example: "e.g., Contract signed?" },
  url:           { description: "Clickable link",                                  example: "e.g., Media kit link, portfolio URL" },
}

// Badge style maps
export const STATUS_STYLE: Record<string, string> = {
  not_contacted:      "bg-gray-100 text-gray-600",
  pending:            "bg-gray-100 text-gray-600",
  contacted:          "bg-blue-100 text-blue-700",
  interested:         "bg-yellow-100 text-yellow-700",
  negotiating:        "bg-indigo-100 text-indigo-700",
  agreed:             "bg-green-100 text-green-700",
  for_order_creation: "bg-emerald-100 text-emerald-700",
  not_interested:     "bg-red-100 text-red-600",
}
export const STATUS_LABEL: Record<string, string> = {
  not_contacted:      "Not Contacted",
  pending:            "For Outreach",
  contacted:          "Contacted",
  interested:         "Interested",
  negotiating:        "In Conversation",
  agreed:             "Agreed",
  for_order_creation: "For Order Creation",
  not_interested:     "Not Interested",
}
// Full funnel stage — the single source of truth for where an influencer
// actually is, shared across Manage Influencers, Pipeline, and Post Tracker.
// Pipeline board writes stages 0-5, Post Tracker writes stages 5-8.
export const STAGE_LABEL: Record<number, string> = {
  0: "Not Interested",
  1: "For Outreach",
  2: "Contacted",
  3: "In Conversation",
  4: "Deal Agreed",
  5: "For Order Creation",
  6: "In-Transit",
  7: "Delivered",
  8: "Posted",
}
export const STAGE_AREA: Record<number, string> = {
  0: "Closed",
  1: "Pipeline",
  2: "Pipeline",
  3: "Pipeline",
  4: "Pipeline",
  5: "Post Tracker",
  6: "Post Tracker",
  7: "Post Tracker",
  8: "Post Tracker",
}
export const STAGE_STYLE: Record<number, string> = {
  0: "bg-red-100 text-red-700",
  1: "bg-gray-100 text-gray-600",
  2: "bg-blue-100 text-blue-700",
  3: "bg-indigo-100 text-indigo-700",
  4: "bg-green-100 text-green-700",
  5: "bg-emerald-100 text-emerald-700",
  6: "bg-yellow-100 text-yellow-700",
  7: "bg-cyan-100 text-cyan-700",
  8: "bg-[#0F6B3E]/15 text-[#0F6B3E]",
}
// ─── Unified journey status ────────────────────────────────────────────────────
// The Influencer Profile is the single place that moves an influencer through
// its journey. This collapses approval_status + stage into the progression
// shown there, and is what keeps the Influencer List and Pipeline in sync —
// they read the exact same approval_status/contact_status/stage columns.
export const JOURNEY_STATUSES = [
  "Pending", "Approved", "Contacted", "In Conversation", "Deal Agreed", "Post Tracker",
] as const
export type JourneyStatus = typeof JOURNEY_STATUSES[number]

export function getJourneyStatus(
  approvalStatus: string | undefined,
  stage: string | number | undefined
): JourneyStatus | "Declined" {
  if (approvalStatus === "Declined") return "Declined"
  if (approvalStatus !== "Approved") return "Pending"
  const s = Number(stage) || 1
  if (s <= 1) return "Approved"
  if (s === 2) return "Contacted"
  if (s === 3) return "In Conversation"
  if (s === 4) return "Deal Agreed"
  return "Post Tracker"
}

export function journeyStatusToFields(status: JourneyStatus): {
  approval_status: "Approved" | "Declined" | "Pending"
  contact_status: string
  stage: string
} {
  switch (status) {
    case "Pending":         return { approval_status: "Pending",  contact_status: "not_contacted",      stage: "1" }
    case "Approved":        return { approval_status: "Approved", contact_status: "not_contacted",        stage: "1" }
    case "Contacted":       return { approval_status: "Approved", contact_status: "contacted",           stage: "2" }
    case "In Conversation": return { approval_status: "Approved", contact_status: "negotiating",         stage: "3" }
    case "Deal Agreed":     return { approval_status: "Approved", contact_status: "agreed",              stage: "4" }
    case "Post Tracker":    return { approval_status: "Approved", contact_status: "for_order_creation",  stage: "5" }
  }
}

export const APPROVAL_STYLE: Record<string, string> = {
  Approved: "bg-green-100 text-green-700",
  Declined: "bg-red-100 text-red-600",
  Pending:  "bg-yellow-100 text-yellow-700",
}
export const TIER_STYLE: Record<string, string> = {
  Gold:   "bg-yellow-100 text-yellow-800",
  Silver: "bg-gray-200 text-gray-700",
  Bronze: "bg-amber-100 text-amber-800",
}
export const COMMUNITY_STYLE: Record<string, string> = {
  Pending:        "bg-yellow-100 text-yellow-700",
  Invited:        "bg-blue-100 text-blue-700",
  Joined:         "bg-green-100 text-green-700",
  "Not Interested":"bg-red-100 text-red-600",
  Left:           "bg-gray-100 text-gray-600",
}

// Platform definitions (icons defined inline to keep this file import-free)
export const platforms = [
  {
    name: "Instagram", value: "instagram",
    icon: React.createElement("img", { src: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg", alt: "Instagram", className: "w-4 h-4" }),
  },
  {
    name: "TikTok", value: "tiktok",
    icon: React.createElement("svg", { className: "w-4 h-4", viewBox: "0 0 24 24", fill: "currentColor" },
      React.createElement("path", { d: "M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.89 2.89 2.896 2.896 0 0 1-2.889-2.89 2.896 2.896 0 0 1 2.89-2.889c.302 0 .595.05.872.137V9.257a6.339 6.339 0 0 0-5.053 2.212 6.339 6.339 0 0 0-1.33 5.52 6.34 6.34 0 0 0 5.766 4.731 6.34 6.34 0 0 0 6.34-6.34V8.898a7.756 7.756 0 0 0 4.422 1.393V6.825a4.8 4.8 0 0 1-2.443-.139z" })
    ),
  },
  {
    name: "YouTube", value: "youtube",
    icon: React.createElement("svg", { className: "w-4 h-4", viewBox: "0 0 24 24", fill: "currentColor" },
      React.createElement("path", { d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" })
    ),
  },
  {
    name: "X (Twitter)", value: "twitter",
    icon: React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-4 h-4" },
      React.createElement("path", { d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" })
    ),
  },
]

export const PLATFORM_URL_MAP: Record<string, (h: string) => string> = {
  instagram: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
  tiktok:    (h) => `https://tiktok.com/@${h.replace(/^@/, "")}`,
  youtube:   (h) => `https://youtube.com/@${h.replace(/^@/, "")}`,
  twitter:   (h) => `https://x.com/${h.replace(/^@/, "")}`,
  other:     ()  => "",
}

// Import/export field definitions
export const IMPORT_FIELDS = [
  { key: "handle",          label: "Handle" },
  { key: "platform",        label: "Platform" },
  { key: "first_name",      label: "First Name" },
  { key: "niche",           label: "Niche" },
  { key: "gender",          label: "Gender" },
  { key: "location",        label: "Location" },
  { key: "follower_count",  label: "Follower Count" },
  { key: "engagement_rate", label: "Engagement Rate" },  
  { key: "social_link",     label: "Social Link" },
  { key: "contact_info",    label: "Contact Info" },
]

export const CSV_EXPORT_FIELDS = [
  { key: "handle",           label: "Handle" },
  { key: "platform",         label: "Platform" },
  { key: "first_name",       label: "First Name" },
  { key: "email",            label: "Email" },
  { key: "niche",            label: "Niche" },
  { key: "gender",           label: "Gender" },
  { key: "location",         label: "Location" },
  { key: "follower_count",   label: "Follower Count" },
  { key: "engagement_rate",  label: "Engagement Rate" },  // UPDATED from "Engagement"
  { key: "social_link",      label: "Social Link" },
  { key: "contact_info",     label: "Contact Email" },
  { key: "approval_status",  label: "Approval Status" },
  { key: "transferred_date", label: "Date Reviewed" },     // UPDATED from "Transferred"
  { key: "approval_notes",   label: "Approval Notes" },
  { key: "contact_status",   label: "Contact Status" },
  { key: "agreed_rate",      label: "Agreed Rate ($)" },
  { key: "notes",            label: "Notes" },
]
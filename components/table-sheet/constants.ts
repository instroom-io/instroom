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
  not_contacted: "bg-gray-100 text-gray-600",
  contacted:     "bg-blue-100 text-blue-700",
  interested:    "bg-yellow-100 text-yellow-700",
  agreed:        "bg-green-100 text-green-700",
}
export const STATUS_LABEL: Record<string, string> = {
  not_contacted: "Not Contacted",
  contacted:     "Contacted",
  interested:    "Interested",
  agreed:        "Agreed",
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
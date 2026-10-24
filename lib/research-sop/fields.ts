// lib/research-sop/fields.ts
//
// Shared vocabulary for Research SOPs.
//
// An SOP is a research playbook — the steps a researcher reads and follows —
// not an automation, so nothing here maps a step onto data. RESEARCH_FIELDS is
// kept only to validate the optional, legacy `target_field` column on a step
// (lib/research-sop/sops.ts); the editor no longer sets it.

export const RESEARCH_FIELDS = [
  "location",
  "niche",
  "follower_count",
  "engagement_rate",
  "email",
  "bio",
] as const

export type ResearchField = (typeof RESEARCH_FIELDS)[number]

export const SOP_STATUSES = ["draft", "active", "archived"] as const
export type SopStatus = (typeof SOP_STATUSES)[number]

// Campaign deliverables — the ONE source of truth shared by the Pipeline
// hand-over, the Influencer Profile and the Post Tracker.
//
// Stored where the Paid Collaboration editor already keeps them:
// BrandInfluencer.product_details (JSON) → paidCollab.deliverables[]. Gifting
// and Paid use the same array; each entry is one expected post, and its
// `postUrl` is the link that fulfils it. No new column or table — the shape is
// the existing CollabDeliverable plus the optional postUrl/postDate the
// Paid Collaboration editor (components/table-sheet/profile-sidebar.tsx)
// already models.

export interface CampaignDeliverable {
  id: number
  name: string
  scriptStatus: string
  scriptLink: string
  scriptRevs: { num: number; date: string; notes: string }[]
  contentStatus: string
  contentLink: string
  contentRevs: { num: number; date: string; notes: string }[]
  postUrl?: string
  postDate?: string
}

/** Same upper bound as the Paid Collaboration editor's "How many?" select. */
export const MAX_DELIVERABLES = 10
const MAX_NAME_LENGTH = 200

/** Collaboration types whose deliverables are defined on the hand-over. */
export const DELIVERABLE_COLLAB_TYPES = new Set([
  "gifting", "paid", "paid-affiliate", "ugc-paid", "tiktok-shop-paid",
])

/** Same blank shape the closed PATCH route's placeholder deliverable uses. */
export function blankDeliverable(id: number, name = ""): CampaignDeliverable {
  return {
    id, name,
    scriptStatus: "pending", scriptLink: "", scriptRevs: [],
    contentStatus: "pending", contentLink: "", contentRevs: [],
    postUrl: "", postDate: "",
  }
}

/** Reads the deliverables array out of a paidCollab object, tolerating any shape. */
export function getDeliverables(paidCollab: unknown): CampaignDeliverable[] {
  const list = (paidCollab as { deliverables?: unknown } | null | undefined)?.deliverables
  return Array.isArray(list) ? (list as CampaignDeliverable[]) : []
}

/**
 * Validates deliverable names sent by a client: an array of 1..MAX strings.
 * Returns the trimmed names, or null when the input is not acceptable.
 */
export function parseDeliverableNames(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_DELIVERABLES) return null
  if (!raw.every((n) => typeof n === "string")) return null
  return (raw as string[]).map((n) => n.trim().slice(0, MAX_NAME_LENGTH))
}

/**
 * Resizes/renames an existing deliverables array to match `names`. Existing
 * entries keep their data (links, review statuses) by position, so a row that
 * already has deliverables never loses them to a re-selection.
 */
export function applyDeliverableNames(existing: unknown, names: string[]): CampaignDeliverable[] {
  const current = getDeliverables({ deliverables: existing })
  const maxId = current.reduce((m, d) => Math.max(m, Number(d.id) || 0), 0)
  return names.map((name, i) =>
    current[i]
      ? { ...current[i], name: name || current[i].name }
      : blankDeliverable(maxId + i + 1, name)
  )
}

/**
 * The link fulfilling a deliverable. The row-level post_url predates
 * deliverables, so it stands in for the FIRST deliverable when that one has no
 * link of its own — existing Posted rows keep counting their post.
 */
export function deliverablePostUrl(d: CampaignDeliverable, index: number, legacyPostUrl?: string | null): string {
  const own = (d.postUrl ?? "").trim()
  if (own) return own
  return index === 0 ? (legacyPostUrl ?? "").trim() : ""
}

export function getDeliverableProgress(paidCollab: unknown, legacyPostUrl?: string | null) {
  const list = getDeliverables(paidCollab)
  const posted = list.filter((d, i) => Boolean(deliverablePostUrl(d, i, legacyPostUrl))).length
  return { total: list.length, posted, complete: list.length > 0 && posted === list.length }
}

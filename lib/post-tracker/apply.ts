import "server-only"

// ─── Carry a detected post onto the influencer's Post Tracker card ───────────
// Shared by every detection route (Instagram tagged posts in tagged.ts, TikTok
// keyword in tiktok.ts, caption matching in monitor.ts), so an automatic
// detection writes exactly what a person would have written on the Post tab.
//
//   • Delivered card  → the post becomes its Post URL (and first deliverable),
//                       and the card moves to Posted.
//   • Posted card     → the post fills the next deliverable with no link yet
//                       ("x/N deliverables"); when every slot is taken, a new
//                       deliverable is added for it (up to MAX_DELIVERABLES).
//                       Marking Completed stays a human step.
//   • Anything else   → untouched (Completed, Issues, No post, earlier stages).
//
// The column is moved through product_details.closedStatus as well as the
// stage fields. closedStatus is what the board reads first (deriveClosedStatus
// in app/api/brand/[brandId]/closed/route.ts); writing only `stage` — as the
// previous version did — left a detected card sitting in Delivered.
//
// A link a person entered is never overwritten, and the same post is never
// recorded twice. The write is conditional on updated_at, so a manual save that
// lands between the read and the write wins instead of being clobbered.

import { prisma, withUtf8mb4 } from "@/lib/prisma"
import { parsePostUrl, type EnsemblePost } from "@/lib/ensembledata"
import { isClosedColumn, mapClosedToPipelineFields, type ClosedColumn } from "@/lib/post-tracker-status"
import { getDeliverables, deliverablePostUrl, blankDeliverable, sumDeliverableMetric, MAX_DELIVERABLES } from "@/lib/deliverables"

const LOG = "[post-detection]"

export type RecordOutcome = "moved-to-posted" | "deliverable-filled" | "deliverable-updated" | "already-recorded" | "no-open-slot" | "not-tracked" | "changed-concurrently"

/** Comparable identity of a post link — the shortcode for Instagram. */
function postKey(url: string | null | undefined): string {
  const trimmed = (url ?? "").trim()
  if (!trimmed) return ""
  const parsed = parsePostUrl(trimmed)
  if (parsed?.platform === "instagram") return `ig:${parsed.code}`
  return trimmed.toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "")
}

/** The column a card is in, as the board computes it. */
export function postTrackerColumn(stage: number, details: Record<string, unknown>): ClosedColumn | null {
  if (isClosedColumn(details.closedStatus)) return details.closedStatus
  if (stage === 7) return "Delivered"
  if (stage === 8) return "Posted"
  return null
}

/** Is this card one that detection should look for posts for? */
export function isTrackedForDetection(stage: number, details: Record<string, unknown>): boolean {
  const column = postTrackerColumn(stage, details)
  if (column === "Delivered") return true
  return column === "Posted" && details.completed !== true
}

export function parseDetails(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** YYYY-MM-DD — what the deliverable date input stores. */
function ymd(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : ""
}

export async function recordPostOnInfluencer(
  brandInfluencerId: string,
  brandId: string,
  post: EnsemblePost
): Promise<RecordOutcome> {
  const current = await prisma.brandInfluencer.findFirst({
    where: { id: brandInfluencerId, brand_id: brandId },
    select: {
      stage: true,
      post_url: true,
      shipped_at: true,
      delivered_at: true,
      posted_at: true,
      product_details: true,
      updated_at: true,
    },
  })
  if (!current) return "not-tracked"

  const details = parseDetails(current.product_details)
  if (!details) {
    // Never rewrite a blob we can't read — that would erase whatever is in it.
    console.warn(`${LOG} ${brandInfluencerId} has unreadable product_details — detection not applied`)
    return "not-tracked"
  }

  const column = postTrackerColumn(current.stage, details)
  if (!isTrackedForDetection(current.stage, details)) return "not-tracked"

  const key = postKey(post.postUrl)
  const deliverables = getDeliverables(details.paidCollab)
  /** What a deliverable holds about its own post. */
  const postFields = {
    postUrl: post.postUrl,
    postDate: ymd(post.publishedAt),
    likes: post.likeCount ?? null,
    comments: post.commentCount ?? null,
    views: post.viewCount ?? null,
  }

  const data: Record<string, unknown> = {}
  let filled = false

  // ── Already on the card ─────────────────────────────────────────────────
  // Fill in only what that deliverable is missing (date, likes, comments,
  // views) — backfills deliverables recorded before per-deliverable details
  // existed, and never overwrites a value someone typed.
  const existingIndex = deliverables.findIndex((d, i) => postKey(deliverablePostUrl(d, i, current.post_url)) === key)
  if (existingIndex >= 0) {
    const d = deliverables[existingIndex]
    const patch: Partial<typeof postFields> = {}
    if (!(d.postUrl ?? "").trim()) patch.postUrl = postFields.postUrl
    if (!d.postDate && postFields.postDate) patch.postDate = postFields.postDate
    for (const k of ["likes", "comments", "views"] as const) {
      if (d[k] == null && postFields[k] != null) patch[k] = postFields[k]
    }
    if (Object.keys(patch).length === 0) return "already-recorded"
    const next = deliverables.map((x) => ({ ...x }))
    next[existingIndex] = { ...next[existingIndex], ...patch }
    details.paidCollab = { ...(details.paidCollab as Record<string, unknown>), deliverables: next }
    Object.assign(data, deliverableTotals(next))
    data.product_details = JSON.stringify(details)
    return (await writeCard(brandInfluencerId, brandId, current.updated_at, data, post)) ? "deliverable-updated" : "changed-concurrently"
  }
  if (postKey(current.post_url) === key) return "already-recorded"

  // Next deliverable with no link. The row-level post_url stands in for the
  // first deliverable (deliverablePostUrl), exactly as the board counts it.
  const openIndex = deliverables.findIndex((d, i) => !deliverablePostUrl(d, i, current.post_url))
  if (openIndex >= 0) {
    const next = deliverables.map((d) => ({ ...d }))
    next[openIndex] = { ...next[openIndex], ...postFields }
    details.paidCollab = { ...(details.paidCollab as Record<string, unknown>), deliverables: next }
    filled = true
  } else {
    // Every slot already has a post (or there are no slots but a Post URL is
    // set) and the influencer posted again: add a deliverable for this post
    // rather than dropping it — the n8n sheet's "Post Link2…5" columns. Capped
    // at MAX_DELIVERABLES, the same limit as the Paid Collaboration editor.
    const legacyUrl = (current.post_url ?? "").trim()
    const next = deliverables.map((d) => ({ ...d }))
    // A row with no deliverables but a Post URL: that URL becomes deliverable 1
    // first, so it isn't lost when the list stops being empty.
    if (next.length === 0 && legacyUrl) {
      next.push({ ...blankDeliverable(1), postUrl: legacyUrl, postDate: ymd(current.posted_at) })
    }
    if (next.length > 0 && next.length < MAX_DELIVERABLES) {
      const maxId = next.reduce((m, d) => Math.max(m, Number(d.id) || 0), 0)
      next.push({ ...blankDeliverable(maxId + 1), ...postFields })
      details.paidCollab = { ...(details.paidCollab as Record<string, unknown>), deliverables: next }
      filled = true
    }
  }

  // No Post URL yet — this post is it. Only what the provider actually
  // returned is written; a missing metric keeps the stored value.
  if (!(current.post_url ?? "").trim()) {
    data.post_url = post.postUrl
    if (post.likeCount != null) data.likes_count = post.likeCount
    if (post.commentCount != null) data.comments_count = post.commentCount
    if (post.viewCount != null) data.views_count = post.viewCount
    // Interactions, not views — and only when both halves are known.
    if (post.likeCount != null && post.commentCount != null) {
      data.engagement_count = post.likeCount + post.commentCount
    }
    filled = true
  }

  // With deliverables, the row-level metrics are the TOTAL across them — the
  // same rule /api/post-tracker/metrics applies — so card stats and Analytics
  // count every post, not just the first.
  const finalDeliverables = getDeliverables(details.paidCollab)
  if (finalDeliverables.length > 0) Object.assign(data, deliverableTotals(finalDeliverables))

  if (!filled) {
    console.log(`${LOG} ${brandInfluencerId}: ${MAX_DELIVERABLES} deliverables already have posts — ${post.postUrl} kept as detected only`)
    return "no-open-slot"
  }

  if (column === "Delivered") {
    Object.assign(
      data,
      mapClosedToPipelineFields("Posted", {
        shipped_at: current.shipped_at,
        delivered_at: current.delivered_at,
        // The post's own timestamp, so the timeline shows when it was published.
        posted_at: post.publishedAt ?? current.posted_at,
      })
    )
    details.closedStatus = "Posted"
    details.completed = false
  }
  data.product_details = JSON.stringify(details)

  if (!(await writeCard(brandInfluencerId, brandId, current.updated_at, data, post))) return "changed-concurrently"

  const outcome: RecordOutcome = column === "Delivered" ? "moved-to-posted" : "deliverable-filled"
  console.log(`${LOG} ${brandInfluencerId}: ${outcome} from ${post.postUrl}`)
  return outcome
}

/** Row-level likes/comments/views/engagement as totals across deliverables. */
function deliverableTotals(list: ReturnType<typeof getDeliverables>): Record<string, number> {
  const out: Record<string, number> = {}
  const likes = sumDeliverableMetric(list, "likes")
  const comments = sumDeliverableMetric(list, "comments")
  const views = sumDeliverableMetric(list, "views")
  if (likes != null) out.likes_count = likes
  if (comments != null) out.comments_count = comments
  if (views != null) out.views_count = views
  // Interactions, not views — and only when both halves are known.
  if (likes != null && comments != null) out.engagement_count = likes + comments
  return out
}

/**
 * Conditional write: only if the card hasn't changed since it was read, so a
 * manual save landing in between wins instead of being clobbered.
 */
async function writeCard(
  brandInfluencerId: string,
  brandId: string,
  readAt: Date,
  data: Record<string, unknown>,
  post: EnsemblePost
): Promise<boolean> {
  const result = await withUtf8mb4((tx) =>
    tx.brandInfluencer.updateMany({
      where: { id: brandInfluencerId, brand_id: brandId, updated_at: readAt },
      data,
    })
  )
  if (result.count === 0) {
    console.log(`${LOG} ${brandInfluencerId} was edited mid-detection — ${post.postUrl} not applied this pass`)
    return false
  }
  return true
}

/**
 * Put every detected post that isn't on the card yet onto it, oldest first.
 *
 * Each detection pass imports a post and records it straight away, but a post
 * detected while the card had no free slot (before deliverables were appended
 * automatically) stayed only in DetectedPost — and later passes skip it as
 * already imported. Running this at the end of a pass for every tracked
 * influencer backfills those, and keeps slot order = publish order.
 *
 * Only posts published since `since` (detectionWindowStart) are considered,
 * the same window detection used to import them. Cheap: DB reads/writes only.
 */
export async function syncDetectedPostsToCard(
  brandInfluencerId: string,
  brandId: string,
  since: Date
): Promise<number> {
  const rows = await prisma.detectedPost.findMany({
    where: { brand_influencer_id: brandInfluencerId, brand_id: brandId, published_at: { gte: since } },
    orderBy: { published_at: "asc" },
  })

  let added = 0
  for (const row of rows) {
    const outcome = await recordPostOnInfluencer(brandInfluencerId, brandId, {
      externalId: row.external_id,
      platform: row.platform === "tiktok" ? "tiktok" : "instagram",
      postUrl: row.post_url,
      author: row.author,
      caption: row.caption,
      publishedAt: row.published_at,
      hashtags: row.hashtags ? row.hashtags.split(",") : [],
      mentions: row.mentions ? row.mentions.split(",") : [],
      likeCount: row.like_count,
      commentCount: row.comment_count,
      viewCount: row.view_count,
      shareCount: row.share_count,
    })
    if (outcome === "moved-to-posted" || outcome === "deliverable-filled" || outcome === "deliverable-updated") added++
    if (outcome === "not-tracked") break // card left Delivered/Posted (e.g. Completed)
  }
  if (added) console.log(`${LOG} ${brandInfluencerId}: backfilled ${added} detected post(s) onto the card`)
  return added
}

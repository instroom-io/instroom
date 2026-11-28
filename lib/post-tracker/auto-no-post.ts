import "server-only"

// Delivered 10+ days with no post → No post, as a follow-up: only the column
// changes (stage 7 and dates kept), so detection still moves it to Posted.

import { prisma, withUtf8mb4 } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { getDeliverables, isUgcOnly } from "@/lib/deliverables"
import { parseDetails, postTrackerColumn } from "./apply"

export const AUTO_NO_POST_DAYS = 10
const DAY_MS = 24 * 60 * 60 * 1000
const LOG = "[auto-no-post]"

export const AUTO_NO_POST_ACTION = "posttracker.auto_no_post"

/** Later of delivered_at and the last manual move into Delivered. */
export function deliveredClockStart(deliveredAt: Date | null, details: Record<string, unknown>): Date | null {
  const since = typeof details.deliveredSince === "string" ? new Date(details.deliveredSince) : null
  const candidates = [deliveredAt, since && !Number.isNaN(since.getTime()) ? since : null].filter(
    (d): d is Date => d instanceof Date
  )
  if (candidates.length === 0) return null
  return new Date(Math.max(...candidates.map((d) => d.getTime())))
}

function hasPostOnCard(postUrl: string | null, details: Record<string, unknown>): boolean {
  if ((postUrl ?? "").trim()) return true
  const ugcOnly = isUgcOnly(details.campaignType as string | null | undefined)
  if (ugcOnly && String(details.driveLink ?? "").trim()) return true
  return getDeliverables(details.paidCollab).some(
    (d) => Boolean((d.postUrl ?? "").trim()) || (ugcOnly && Boolean((d.driveLink ?? "").trim()))
  )
}

export type AutoNoPostSummary = { checked: number; moved: number; skippedWithPost: number; changedConcurrently: number }

export async function runAutoNoPost(now: Date = new Date()): Promise<AutoNoPostSummary> {
  const cutoff = new Date(now.getTime() - AUTO_NO_POST_DAYS * DAY_MS)
  const summary: AutoNoPostSummary = { checked: 0, moved: 0, skippedWithPost: 0, changedConcurrently: 0 }

  const rows = await prisma.brandInfluencer.findMany({
    where: { stage: 7 },
    select: {
      id: true,
      brand_id: true,
      stage: true,
      shipped_at: true,
      delivered_at: true,
      post_url: true,
      product_details: true,
      updated_at: true,
      brand: { select: { owner_id: true } },
    },
  })

  const due = rows.flatMap((row) => {
    const details = parseDetails(row.product_details)
    if (!details) return []
    if (postTrackerColumn(row.stage, details) !== "Delivered") return []
    const start = deliveredClockStart(row.delivered_at, details)
    if (!start || start > cutoff) return []
    return [{ row, details, start }]
  })
  summary.checked = due.length
  if (due.length === 0) return summary

  // Detected posts since the ship date count as a post.
  const detected = await prisma.detectedPost.findMany({
    where: { brand_influencer_id: { in: due.map((d) => d.row.id) } },
    select: { brand_influencer_id: true, brand_id: true, published_at: true },
  })

  for (const { row, details, start } of due) {
    const hasDetected = detected.some(
      (p) =>
        p.brand_influencer_id === row.id &&
        p.brand_id === row.brand_id &&
        (!row.shipped_at || (p.published_at != null && p.published_at >= row.shipped_at))
    )
    if (hasDetected || hasPostOnCard(row.post_url, details)) {
      summary.skippedWithPost++
      continue
    }

    const at = now.toISOString()
    const next = { ...details, closedStatus: "No post", completed: false, autoNoPost: { at, deliveredSince: start.toISOString() } }
    delete (next as Record<string, unknown>).deliveredSince

    // A manual save since the read wins.
    const result = await withUtf8mb4((tx) =>
      tx.brandInfluencer.updateMany({
        where: { id: row.id, brand_id: row.brand_id, updated_at: row.updated_at },
        data: { product_details: JSON.stringify(next) },
      })
    )
    if (result.count === 0) {
      summary.changedConcurrently++
      continue
    }
    summary.moved++

    if (row.brand?.owner_id) {
      await logActivity({
        brandId: row.brand_id,
        userId: row.brand.owner_id,
        action: AUTO_NO_POST_ACTION,
        entityType: "brand_influencer",
        entityId: row.id,
        details: { from: "Delivered", to: "No post", automatic: true, days: AUTO_NO_POST_DAYS },
      })
    }
  }

  console.log(`${LOG} checked ${summary.checked}, moved ${summary.moved}, had a post ${summary.skippedWithPost}, changed mid-run ${summary.changedConcurrently}`)
  return summary
}

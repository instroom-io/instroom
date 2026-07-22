// app/api/analytics/route.ts
// Aggregates pipeline + closed data for the analytics dashboard.
// Reads directly from brandInfluencer records — no separate postMetric table assumed.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const brandId   = searchParams.get("brandId")
  const platform  = searchParams.get("platform")  || "all"
  const niche     = searchParams.get("niche")      || "all"
  const location  = searchParams.get("location")   || "all"
  const dateRange = searchParams.get("dateRange")  || "all"

  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 })
  }

  try {
    const dateFilter = buildDateFilter(dateRange)

    // Push the platform/niche/location filters into the query itself — instead
    // of pulling every row for the brand and filtering in JS afterward — so
    // the DB does less work and less data crosses the wire.
    const influencerFilter = {
      ...(platform !== "all" ? { platform } : {}),
      ...(niche    !== "all" ? { niche }    : {}),
      ...(location !== "all" ? { location } : {}),
    }
    const whereClause = {
      brand_id: brandId,
      ...(dateFilter ? { created_at: dateFilter } : {}),
      ...(Object.keys(influencerFilter).length ? { influencer: { is: influencerFilter } } : {}),
    }

    // These two queries are independent of each other — run them concurrently
    // instead of one after the other.
    const [pipelineRecords, closedRecords] = await Promise.all([
      prisma.brandInfluencer.findMany({
        where: whereClause,
        include: {
          influencer: {
            select: { platform: true, niche: true, location: true, handle: true },
          },
        },
      }),
      // Graceful fallback if the closedInfluencer model doesn't exist yet.
      (async () => {
        try {
          return await (prisma as any).closedInfluencer.findMany({
            where: whereClause,
            include: {
              influencer: {
                select: { platform: true, niche: true, location: true, handle: true },
              },
            },
          })
        } catch {
          return []
        }
      })(),
    ])

    const filtered = [...pipelineRecords, ...closedRecords]

    // ── Shape rows ────────────────────────────────────────────────────────────
    const rows = filtered.map((bi) => {
      const b   = bi as any
      const inf = b.influencer ?? {}

      return {
        id:               b.id,
        platform:         inf.platform     ?? b.platform   ?? "Instagram",
        instagramHandle:  inf.handle       ?? b.handle     ?? null,
        niche:            inf.niche        ?? b.niche      ?? "General",
        location:         inf.location     ?? b.location   ?? "PH",
        createdAt:        b.created_at?.toISOString() ?? new Date().toISOString(),

        pipelineStatus:   resolveStatus(b),
        rejectionReason:  b.approval_notes ?? b.ni_reason  ?? null,
        rejectionBucket:  resolveRejectionBucket(b.approval_notes ?? b.ni_reason),

        // Post metrics — try both snake_case and camelCase field names
        views:        Number(b.views         ?? b.view_count      ?? 0),
        likes:        Number(b.likes         ?? b.likes_count     ?? 0),
        comments:     Number(b.comments      ?? b.comments_count  ?? 0),
        clicks:       Number(b.clicks        ?? b.web_clicks      ?? 0),
        salesQty:     Number(b.sales_qty     ?? b.salesQty        ?? b.sales_quantity ?? 0),
        salesAmt:     Number(b.sales_amt     ?? b.salesAmt        ?? b.sales_amount   ?? 0),
        prodCost:     Number(b.prod_cost     ?? b.prodCost        ?? b.product_cost   ?? 0),

        usageRights:  Boolean(b.usage_rights  ?? b.usageRights  ?? false),
        contentSaved: Boolean(b.content_saved ?? b.contentSaved ?? false),
        adCode:       Boolean(b.ad_code       ?? b.adCode       ?? false),

        deliveredDaysAgo: resolveDeliveredDaysAgo(b),
      }
    })

    return NextResponse.json({ data: rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[analytics] GET error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDateFilter(dateRange: string): Record<string, Date> | null {
  const now = new Date()
  switch (dateRange) {
    case "7":  { const d = new Date(now); d.setDate(now.getDate() - 7);  return { gte: d } }
    case "30": { const d = new Date(now); d.setDate(now.getDate() - 30); return { gte: d } }
    case "90": { const d = new Date(now); d.setDate(now.getDate() - 90); return { gte: d } }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      return { gte: start, lte: end }
    }
    default: return null
  }
}

function resolveStatus(bi: Record<string, unknown>): string {
  const closed = (bi.closed_status ?? bi.closedStatus) as string | undefined
  if (closed) {
    switch (closed) {
      case "For Order Creation": return "Onboarded"
      case "In-Transit":         return "In Transit"
      case "Delivered":          return "Content Pending"
      case "Posted":             return "Posted"
      case "No post":            return "Content Pending"
    }
  }
  const pipeline = (bi.pipeline_status ?? bi.pipelineStatus) as string | undefined
  switch (pipeline) {
    case "For Outreach":       return "Prospect"
    case "Contacted":          return "Reached Out"
    case "In Conversation":    return "In Conversation"
    case "Deal Agreed":        return "Onboarded"
    case "For Order Creation": return "Onboarded"
    case "Not Interested":     return "Rejected"
    default:                   return pipeline ?? "Prospect"
  }
}

const SOFT_PASS_REASONS = new Set([
  "Fully booked",
  "Temporarily unavailable / can't shoot",
  "Can't ship to their location",
  "Ghosted / no longer active",
  "Rate / deadline too tight",
])

function resolveRejectionBucket(notes: unknown): "hard" | "soft" | null {
  if (typeof notes !== "string" || !notes) return null
  return SOFT_PASS_REASONS.has(notes) ? "soft" : "hard"
}

function resolveDeliveredDaysAgo(bi: Record<string, unknown>): number | null {
  const raw = bi.delivered_at ?? bi.deliveredAt
  if (!raw) return null
  const diffMs = Date.now() - new Date(raw as string).getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}
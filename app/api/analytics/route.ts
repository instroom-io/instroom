// app/api/analytics/route.ts
// Aggregates real pipeline, post, attribution and spend data for the analytics
// dashboard, scoped to a single brand.
//
// ── Why this route was rewritten ─────────────────────────────────────────────
// The previous version read fields that DO NOT EXIST on BrandInfluencer:
// `pipeline_status`, `closed_status`, `views`, `clicks`, `sales_qty`,
// `sales_amt`, `prod_cost`, `usage_rights`, `content_saved`, `ad_code`,
// `ni_reason`. Each was guarded by `?? 0` / `?? false` / `?? "Prospect"`, so
// every one silently produced a zero instead of an error — which is why the
// dashboard rendered 0 / 0% / $0 across whole tabs while looking healthy.
//
// Each metric now comes from the model that actually stores it:
//
//   pipeline stage    BrandInfluencer.contact_status + stage + approval_status
//                     via the same derivation the Pipeline board uses
//                     (app/api/brand/[brandId]/pipeline/route.ts)
//   closed stage      product_details.closedStatus + order_status +
//                     content_posted, as in the Post Tracker route
//                     (app/api/brand/[brandId]/closed/route.ts)
//   rejection reason  BrandInfluencer.approval_notes
//   views/likes/…     DetectedPost (per-post metrics, brand-scoped), falling
//                     back to BrandInfluencer.likes_count/comments_count which
//                     is where the Post Tracker writes manual entries
//   clicks / sales    Attribution.clicks / sales_count / gmv
//   spend             product cost, fees (paid, else agreed rate), commission_paid
//   usage rights / content saved   lib/deliverables ugcStatus

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBrandAccess } from "@/lib/brand-access"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"
import { declineBucket, type DeclineBucket } from "@/lib/decline-reasons"
import { isListDeclined, productCostFromDetails, resolveFees, resolveCommission, resolveCommissionRate } from "@/lib/pipeline-transitions"
import { goaffproCommissionByInfluencer } from "@/lib/goaffpro-commission"
import { ugcStatus } from "@/lib/deliverables"

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
  // Only read for dateRange=custom; YYYY-MM-DD, either end may be blank.
  const dateFrom  = searchParams.get("dateFrom")   || ""
  const dateTo    = searchParams.get("dateTo")     || ""

  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 })
  }

  try {
    // Brand ownership gate: every row below is additionally constrained by
    // brand_id, so no other brand's, account's or user's data can be reached
    // even if this check were bypassed.
    if (!(await checkBrandAccess(brandId, session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const dateFilter = buildDateFilter(dateRange, dateFrom, dateTo)

    // Filters are pushed into the query, so changing one re-queries the
    // database rather than re-slicing an array in the browser.
    const influencerFilter = {
      // The platform filter arrives as the UI label ("TikTok"), while
      // Influencer.platform stores the lower-case key the influencers list
      // writes ("tiktok"), so match on that key.
      ...(platform !== "all" ? { platform: platform.trim().toLowerCase() } : {}),
      ...(niche    !== "all" ? { niche }    : {}),
      ...(location !== "all" ? { location } : {}),
    }
    const whereClause = {
      brand_id: brandId,
      ...(dateFilter ? { created_at: dateFilter } : {}),
      // Drafts are blank rows the user has not filled in. They are not
      // influencers, so they must not enter any funnel count, chart or export.
      // Merged into the influencer filter rather than added beside it, because
      // a second `influencer` key would overwrite the first.
      influencer: { is: { ...influencerFilter, is_draft: false } },
    }

    const fetchedRecords = await prisma.brandInfluencer.findMany({
      where: whereClause,
      select: {
        id: true,
        created_at: true,
        // Stage inputs — the same columns the pipeline and post-tracker
        // routes derive their board columns from.
        contact_status: true,
        stage: true,
        order_status: true,
        content_posted: true,
        approval_status: true,
        approval_notes: true,
        product_details: true,
        agreed_rate: true,
        delivered_at: true,
        posted_at: true,
        // Manual post metrics captured in the Post Tracker.
        likes_count: true,
        comments_count: true,
        views_count: true,
        influencer: {
          // full_name backs name search in the toolbar; handle backs @handle
          // search. Same two fields the Post Tracker search matches on.
          select: { platform: true, niche: true, location: true, handle: true, full_name: true },
        },
        // Affiliate performance — the only source of clicks and sales.
        attribution: {
          select: { clicks: true, sales_count: true, gmv: true, spark_ads: true },
        },
        // Campaign spend, entered per partner.
        partner: {
          select: { product_cost: true, fees_paid: true, commission_paid: true, default_commission: true },
        },
      },
    })

    const records = fetchedRecords.filter(r => !isListDeclined(r.approval_status, r.contact_status))

    // Per-post metrics live in DetectedPost, one row per detected post. Summing
    // them per influencer in a single grouped query keeps this O(1) queries
    // rather than one lookup per influencer (the N+1 the previous shape invited).
    const brandInfluencerIds = records.map(r => r.id)
    const goaffproCommission = await goaffproCommissionByInfluencer(brandId, brandInfluencerIds)
    const postMetrics = brandInfluencerIds.length
      ? await prisma.detectedPost.groupBy({
          by: ["brand_influencer_id"],
          where: { brand_id: brandId, brand_influencer_id: { in: brandInfluencerIds } },
          _sum: { view_count: true, like_count: true, comment_count: true },
          _count: { _all: true },
        })
      : []

    const metricsByInfluencer = new Map(
      postMetrics.map(m => [m.brand_influencer_id, m])
    )

    // Actual outreach activity. A row only counts as outreach when a real
    // contact action exists — an OutreachLog entry, or a contact_status/stage
    // the app only writes once the influencer has been contacted. Merely
    // imported / approved / listed influencers (not_contacted + stage 1) are
    // NOT outreach, which is why totals used to match the whole influencer list.
    const outreachLogs = brandInfluencerIds.length
      ? await prisma.outreachLog.groupBy({
          by: ["brand_influencer_id"],
          where: { brand_influencer_id: { in: brandInfluencerIds } },
          _count: { _all: true },
        })
      : []
    const respondedLogs = brandInfluencerIds.length
      ? await prisma.outreachLog.groupBy({
          by: ["brand_influencer_id"],
          where: { brand_influencer_id: { in: brandInfluencerIds }, response_received: true },
          _count: { _all: true },
        })
      : []

    const outreachCountById = new Map(outreachLogs.map(l => [l.brand_influencer_id, l._count._all]))
    const responseCountById = new Map(respondedLogs.map(l => [l.brand_influencer_id, l._count._all]))

    const rows = records.map((r) => {
      const productDetails = safeJSONParse(r.product_details)
      const posts = metricsByInfluencer.get(r.id)

      // Detected posts are the truth when they exist; the Post Tracker's manual
      // likes_count/comments_count covers rows that were never auto-detected.
      const detectedLikes    = posts?._sum.like_count    ?? null
      const detectedComments = posts?._sum.comment_count ?? null

      return {
        id:               r.id,
        platform:         normalizePlatform(r.influencer?.platform),
        name:             r.influencer?.full_name ?? null,
        instagramHandle:  r.influencer?.handle ?? null,
        niche:            r.influencer?.niche    ?? "General",
        location:         r.influencer?.location ?? "PH",
        createdAt:        r.created_at.toISOString(),

        pipelineStatus:   resolveAnalyticsStatus(r, productDetails),
        // Marked completed in Post Tracker (all deliverables posted) — the same
        // product_details flag the Completed column reads.
        completed:        productDetails.closedStatus === "Posted" && productDetails.completed === true,

        // Outreach activity — the source of truth for Total Outreach.
        outreachCount:    outreachCountById.get(r.id) ?? 0,
        // Stage-derived, and deliberately NOT OR-ed with `outreachCount > 0` any
        // more. An OutreachLog row for an influencer the Pipeline still shows
        // under "For Outreach" would put that influencer back into the outreach
        // population, which is the very contradiction this metric had: the board
        // says "not yet contacted", the funnel counted them as reached. The
        // stage is what the brand manages and sees, so the stage decides.
        // `outreachCount` is still reported above, unchanged.
        hasOutreach:      wasContacted(r),
        // A response is only ever a RECORDED one: an OutreachLog entry flagged
        // response_received, or a contact_status the app writes when a reply
        // actually lands (the inbox sets "responded"/"replied" off a real
        // thread). Never inferred from a manual decline.
        hasResponse:      (responseCountById.get(r.id) ?? 0) > 0 ||
                          RESPONDED_CONTACT_STATUSES.has(r.contact_status ?? ""),
        // Declined / Not Interested, straight off the persisted row — used to
        // keep a decline out of the response count regardless of which stage the
        // row is currently rendered in.
        isDeclined:       r.approval_status === "Declined" || r.contact_status === "not_interested",
        // Did this decline happen AFTER the influencer had already engaged
        // (In Conversation or later), rather than while merely Contacted?
        // resolveAnalyticsStatus maps every decline to the same "Rejected"
        // string regardless of which stage it happened at, so that string
        // alone cannot tell the two apart.
        //
        // Answered by asking derivePipelineStatus itself what this row's
        // stage would resolve to with the decline fields temporarily unset —
        // the WHAT-IT-WAS-BEFORE-THE-DECLINE read, using the exact same
        // stage/contact_status precedence the pipeline already applies
        // everywhere else, rather than reimplementing a piece of it (which
        // previously missed the legacy contact_status-only path, e.g.
        // "negotiating" with stage left null).
        declinedAfterResponse:
          (r.approval_status === "Declined" || r.contact_status === "not_interested") &&
          ["In Conversation", "Deal Agreed", "For Order Creation"].includes(
            derivePipelineStatus(
              r.contact_status === "not_interested" ? "" : r.contact_status,
              r.stage,
              null
            )
          ),

        rejectionReason:  r.approval_notes ?? null,
        rejectionBucket:  resolveRejectionBucket(r.approval_notes),

        // Detected posts first, same as likes/comments; otherwise the views
        // fetched from (or typed against) the Post Tracker's post link.
        views:    Number(posts?._sum.view_count ?? r.views_count ?? 0),
        likes:    Number(detectedLikes    ?? r.likes_count    ?? 0),
        comments: Number(detectedComments ?? r.comments_count ?? 0),

        clicks:   Number(r.attribution?.clicks      ?? 0),
        salesQty: Number(r.attribution?.sales_count ?? 0),
        salesAmt: r.attribution?.gmv ? Number(r.attribution.gmv) : 0,

        prodCost:      r.partner
          ? Number(r.partner.product_cost ?? 0)
          : productCostFromDetails(r.product_details),
        feesPaid:      resolveFees({ partnerFeesPaid: r.partner?.fees_paid, productDetails: r.product_details, agreedRate: r.agreed_rate }).amount,
        commissionPaid: resolveCommission({
          partnerCommissionPaid: r.partner?.commission_paid,
          productDetails: r.product_details,
          goaffproCommission: goaffproCommission.get(r.id) ?? null,
          revenue: r.attribution?.gmv ? Number(r.attribution.gmv) : 0,
          commissionRate: resolveCommissionRate({ partnerDefault: r.partner?.default_commission, productDetails: r.product_details }),
        }).amount,

        usageRights:  ugcStatus(productDetails).granted,
        contentSaved: ugcStatus(productDetails).saved,
        adCode:       Boolean(r.attribution?.spark_ads?.trim()),

        deliveredDaysAgo: resolveDeliveredDaysAgo(r.delivered_at),
      }
    })

    return NextResponse.json({
      data: rows,
      // Declared so the client never has to guess whether a zero is real.
      meta: {
        brandId,
        filters: { platform, niche, location, dateRange, dateFrom, dateTo },
        /** The column `dateRange` filters on. */
        dateField: "created_at",
        recordCount: rows.length,
        /** Metrics with no backing column in the schema. */
        untracked: ["usageRights", "contentSaved"],
      },
    })
  } catch (err: unknown) {
    if (isDatabaseCapacityError(err)) return databaseCapacityResponse()
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[analytics] GET error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeJSONParse(value: string | null): Record<string, any> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Canonical platform casing.
 *
 * Influencer.platform is stored lower-case ("tiktok"), while the analytics UI
 * buckets on "TikTok" / "YouTube" / "Instagram". Capitalising the first letter
 * — as the post-tracker route does — yields "Tiktok" and "Youtube", which match
 * NO bucket, so those platforms' posts, views and EMV were being dropped
 * entirely. This maps to the exact keys the dashboard aggregates on.
 */
function normalizePlatform(raw: string | null | undefined): string {
  const key = raw?.trim().toLowerCase()
  switch (key) {
    case "instagram": return "Instagram"
    case "tiktok":    return "TikTok"
    case "youtube":   return "YouTube"
    // Anything else is passed through rather than defaulted to Instagram:
    // inventing a platform would manufacture activity that never happened.
    default:          return raw?.trim() || "Unknown"
  }
}

function buildDateFilter(dateRange: string, dateFrom = "", dateTo = ""): Record<string, Date> | null {
  const now = new Date()
  switch (dateRange) {
    case "custom": {
      // Inclusive whole days; an invalid or blank end simply leaves that side open.
      const from = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? new Date(`${dateFrom}T00:00:00`) : null
      const to   = /^\d{4}-\d{2}-\d{2}$/.test(dateTo)   ? new Date(`${dateTo}T23:59:59.999`) : null
      const range: Record<string, Date> = {}
      if (from && !isNaN(from.getTime())) range.gte = from
      if (to && !isNaN(to.getTime()))     range.lte = to
      return Object.keys(range).length ? range : null
    }
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

/* ── Stage derivation ──────────────────────────────────────────────────────
   Ported from the two routes that own these rules, so Analytics, the Pipeline
   board and the Post Tracker can never disagree about what stage a row is in:
     derivePipelineStatus  app/api/brand/[brandId]/pipeline/route.ts
     deriveClosedStatus    app/api/brand/[brandId]/closed/route.ts
   ------------------------------------------------------------------------ */

const CLOSED_COLUMNS = ["For Order Creation", "In-Transit", "Delivered", "Posted", "No post", "Issues"]

/**
 * Statuses the app only ever writes AFTER a real contact action.
 *
 * Kept for reference; no longer used to decide `hasOutreach` — see wasContacted.
 */
const NOT_CONTACTED_STATUSES = new Set(["not_contacted", "pending", ""])

/**
 * Contact statuses the app only writes once the influencer has actually replied.
 * "not_interested" is deliberately absent: marking someone Not Interested is a
 * decision the brand records, not evidence that the influencer answered.
 */
const RESPONDED_CONTACT_STATUSES = new Set(["responded", "replied"])

/**
 * Has this influencer actually been reached out to?
 *
 * Derived from the SAME stage resolution the Pipeline board renders from, rather
 * than from a second, parallel reading of the raw columns.
 *
 * ── Why this changed ────────────────────────────────────────────────────────
 * The previous version inspected `contact_status` directly: anything outside
 * NOT_CONTACTED_STATUSES counted as contacted. But `derivePipelineStatus` gives
 * `stage` PRECEDENCE over `contact_status` — stage 1 is "For Outreach" whatever
 * the status column says. The two therefore disagreed, and this deployment's own
 * data is full of the disagreement: 87 rows carry
 *
 *     contact_status = "contacted", stage = 1
 *
 * which the Pipeline renders under "For Outreach" (correctly — nobody has been
 * contacted yet; the status column is stale) while Total Outreach counted every
 * one of them. That is the reported symptom: influencers sitting in For Outreach
 * inflating the outreach total.
 *
 * "For Outreach" is the only pre-contact stage, so the rule is simply: any other
 * resolved stage means an outreach action is on the record. Because the funnel's
 * population and the board's columns now come from one function, they cannot
 * drift apart again, and
 *
 *     Total Outreach === (all influencers) − (those in For Outreach)
 *
 * holds by construction rather than by coincidence.
 *
 * Note "Not Interested" still counts as outreach: it is a verdict the brand
 * records about someone it engaged, and the funnel already reports it as a
 * terminal step out of the outreach population.
 */
function wasContacted(r: {
  contact_status: string
  stage: number | null
  order_status: string | null
  content_posted: boolean
  approval_status: string | null
}): boolean {
  return derivePipelineStatus(r.contact_status, r.stage, r.approval_status) !== "For Outreach"
}

function derivePipelineStatus(
  contactStatus: string,
  stage: number | null,
  approvalStatus: string | null
): string {
  if (contactStatus === "not_interested" || approvalStatus === "Declined") return "Not Interested"
  if (contactStatus === "for_order_creation" || (stage !== null && stage >= 5)) return "For Order Creation"

  if (stage !== null) {
    if (stage >= 4) return "Deal Agreed"
    if (stage === 3) return "In Conversation"
    if (stage === 2) return "Contacted"
    if (stage === 1) return "For Outreach"
  }

  switch (contactStatus) {
    case "agreed":           return "Deal Agreed"
    case "negotiating":
    case "paid_collab":      return "In Conversation"
    case "responded":
    case "replied":
    case "contacted":
    case "no_response":
    case "email_error":      return "Contacted"
    case "pending":
    default:                 return "For Outreach"
  }
}

function deriveClosedStatus(
  contactStatus: string,
  orderStatus: string | null,
  contentPosted: boolean,
  approvalStatus: string | null,
  storedClosedStatus: string | null
): string | null {
  // The saved stage always wins, exactly as in the Post Tracker route.
  if (storedClosedStatus && CLOSED_COLUMNS.includes(storedClosedStatus)) return storedClosedStatus
  if (approvalStatus === "Declined" || contactStatus === "not_interested") return "No post"
  if (contentPosted) return "Posted"
  if (orderStatus === "delivered") return "Delivered"
  if (orderStatus === "shipped")   return "In-Transit"
  return null
}

/**
 * Map the app's stage vocabulary onto the labels the analytics dashboard
 * aggregates on. The mapping itself is unchanged from the previous version of
 * this route — only its INPUTS are fixed (real columns instead of missing ones).
 */
function resolveAnalyticsStatus(
  r: {
    contact_status: string
    stage: number | null
    order_status: string | null
    content_posted: boolean
    approval_status: string | null
  },
  productDetails: Record<string, any>
): string {
  const closed = deriveClosedStatus(
    r.contact_status,
    r.order_status,
    r.content_posted,
    r.approval_status,
    (productDetails.closedStatus as string) ?? null
  )

  // Plain UGC needs no post: keep out of post rate.
  if ((closed === "Delivered" || closed === "Posted") && productDetails.campaignType === "ugc") return "UGC"

  if (closed) {
    switch (closed) {
      case "For Order Creation": return "Onboarded"
      case "In-Transit":         return "In Transit"
      case "Delivered":          return "Content Pending"
      case "Posted":             return "Posted"
      // deriveClosedStatus also returns "No post" for a decline / Not
      // Interested — those stay "Rejected". Only a card the Post Tracker
      // itself holds in No post is a closed deal that did not publish.
      case "No post":
        return r.approval_status === "Declined" || r.contact_status === "not_interested"
          ? "Rejected"
          : "No Content"
      // Post Tracker's Issues column — a stalled delivery, a returned package,
      // a wrong address. Analytics already had a "Delivery Problem" bucket
      // that nothing ever wrote to; this is what it was for.
      case "Issues":             return "Delivery Problem"
    }
  }

  switch (derivePipelineStatus(r.contact_status, r.stage, r.approval_status)) {
    case "For Outreach":       return "Prospect"
    case "Contacted":          return "Reached Out"
    case "In Conversation":    return "In Conversation"
    case "Deal Agreed":        return "Onboarded"
    case "For Order Creation": return "Onboarded"
    case "Not Interested":     return "Rejected"
    default:                   return "Prospect"
  }
}

/**
 * Which pass bucket a stored decline note belongs to.
 *
 * Delegates to the shared decline vocabulary (lib/decline-reasons.ts) that the
 * Pipeline board and the Influencer List both write, rather than keeping its
 * own copy of the soft-pass list — the copy here and the one in the Analytics
 * page had to be edited in lockstep with the modal's, and a reason added to one
 * silently fell into "hard" everywhere else.
 */
function resolveRejectionBucket(notes: unknown): DeclineBucket | null {
  if (typeof notes !== "string" || !notes) return null
  return declineBucket(notes)
}

function resolveDeliveredDaysAgo(raw: Date | null): number | null {
  if (!raw) return null
  const diffMs = Date.now() - new Date(raw).getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

// app/api/brand/[brandId]/closed/route.ts
// FIXED: removed NOT clause that conflicted with OR and blocked for_order_creation records

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type ClosedColumn =
  | "For Order Creation"
  | "In-Transit"
  | "Delivered"
  | "Posted"
  | "No post"

function deriveClosedStatus(
  contactStatus: string,
  orderStatus: string | null,
  contentPosted: boolean,
  approvalStatus: string | null,
  storedClosedStatus: string | null
): ClosedColumn {
  const valid: ClosedColumn[] = [
    "For Order Creation",
    "In-Transit",
    "Delivered",
    "Posted",
    "No post",
  ]

  // 1. Stored override from product_details.closedStatus (set by PATCH)
  if (storedClosedStatus && valid.includes(storedClosedStatus as ClosedColumn)) {
    return storedClosedStatus as ClosedColumn
  }

  // 2. Hard exits
  if (approvalStatus === "Declined" || contactStatus === "not_interested") {
    return "No post"
  }

  // 3. Content posted
  if (contentPosted) return "Posted"

  // 4. Order flow
  if (orderStatus === "shipped")    return "In-Transit"
  if (orderStatus === "delivered")  return "Delivered"

  // 5. Default entry point for for_order_creation
  return "For Order Creation"
}

function safeJSONParse(value: string | null): Record<string, any> {
  if (!value) return {}
  try { return JSON.parse(value) }
  catch { return {} }
}

function formatFollowers(n: number): string {
  if (!n) return "0"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return String(n)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params

    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        OR: [
          { owner_id: session.user.id },
          { members: { some: { user_id: session.user.id } } },
        ],
      },
      select: { id: true },
    })

    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // ── FIXED QUERY ─────────────────────────────────────────────────────────
    // OLD (broken): used OR + NOT which Prisma/MySQL resolves in a way that
    // excludes for_order_creation records even though they match the OR.
    //
    // NEW: single OR that covers every case we want to show in Post Tracker.
    // No NOT clause — exclusions are handled by deriveClosedStatus() instead.
    //
    // Cases included:
    //   A) contact_status = 'for_order_creation'  → For Order Creation column
    //   B) stage >= 6                              → In-Transit / Delivered / Posted
    //      (stage 5 = For Order Creation, set by pipeline PATCH)
    //      (stage 6 = In-Transit, 7 = Delivered, 8 = Posted)
    //   C) content_posted = true                  → Posted column
    //   D) order_status IN shipped/delivered       → In-Transit or Delivered
    //
    // NOT included (naturally excluded because none of A-D match):
    //   - contacted, negotiating, agreed, etc. → stage 1-4, no for_order_creation
    //   - not_interested → deriveClosedStatus returns "No post" for these
    const rows = await prisma.brandInfluencer.findMany({
      where: {
        brand_id: brandId,
        OR: [
          { contact_status: "for_order_creation" },
          { stage: { gte: 5 } },
          { content_posted: true },
          { order_status: { in: ["shipped", "delivered"] } },
        ],
      },
      include: {
        influencer: true,
        campaign: true,
      },
      orderBy: { updated_at: "desc" },
    })

    const data = rows.map((row) => {
      const productDetails = safeJSONParse(row.product_details)
      const inf = row.influencer

      const closedStatus = deriveClosedStatus(
        row.contact_status,
        row.order_status,
        row.content_posted,
        row.approval_status,
        productDetails.closedStatus || null
      )

      return {
        id:            row.id,
        influencerId:  row.influencer_id,
        campaignId:    row.campaign_id,
        campaignName:  row.campaign?.name || null,

        influencer:      inf?.full_name || inf?.handle || "Unknown",
        handle:          inf?.handle || "",
        platform:        inf?.platform
          ? inf.platform.charAt(0).toUpperCase() + inf.platform.slice(1)
          : "Instagram",

        followers:       formatFollowers(inf?.follower_count || 0),
        followerCount:   inf?.follower_count || 0,
        engagementRate:  inf?.engagement_rate
          ? `${Number(inf.engagement_rate).toFixed(1)}%`
          : "0%",

        niche:           inf?.niche            || "",
        location:        inf?.location         || "",
        email:           inf?.email            || "",
        profileImageUrl: inf?.profile_image_url || null,
        bio:             inf?.bio              || "",

        closedStatus,

        contactStatus:   row.contact_status,
        stage:           row.stage,
        orderStatus:     row.order_status,
        contentPosted:   row.content_posted,
        approvalStatus:  row.approval_status,
        approvalNotes:   row.approval_notes   || "",

        agreedRate:      row.agreed_rate ? Number(row.agreed_rate) : null,
        currency:        row.currency,
        deliverables:    row.deliverables,
        deadline:        row.deadline?.toISOString()     || null,
        notes:           row.notes                       || "",

        campaignType:    productDetails.campaignType     || null,
        productDetails:  row.product_details,

        shippedAt:       row.shipped_at?.toISOString()   || null,
        deliveredAt:     row.delivered_at?.toISOString() || null,
        trackingNumber:  productDetails.trackingNumber   || null,

        postUrl:         row.post_url,
        postedAt:        row.posted_at?.toISOString()    || null,

        likesCount:      row.likes_count      || 0,
        commentsCount:   row.comments_count   || 0,
        engagementCount: row.engagement_count || 0,

        paidCollabData:  productDetails.paidCollab || null,

        internalRating:  row.internal_rating ? Number(row.internal_rating) : null,
        lastContact:     row.updated_at.toISOString(),
        createdAt:       row.created_at.toISOString(),
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("GET closed error:", error)
    return NextResponse.json(
      { error: "Failed to fetch data", detail: error?.message },
      { status: 500 }
    )
  }
}
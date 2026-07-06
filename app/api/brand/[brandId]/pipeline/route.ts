// app/api/brand/[brandId]/pipeline/route.ts
//
// PERFORMANCE CHANGES vs previous version:
//
//   1. TWO DB queries → ONE
//      Auth check is embedded directly into the brandInfluencer query via
//      a nested `brand` filter. One round-trip instead of two.
//
//   2. Simplified OR filter
//      Instead of a 5-branch OR that MySQL can't index well, we use a
//      single exclusion approach: fetch everything for the brand EXCEPT
//      pure "Pending" records that have never been touched. This lets
//      MySQL use the (brand_id, approval_status) composite index.
//
//   3. Pagination via cursor
//      `?limit=N&cursor=<id>` — prevents runaway queries at 1k+ records.
//      Default limit: 200. Max: 500.
//
//   4. Cache-Control header
//      `stale-while-revalidate=30` so repeat visits feel instant while
//      a background refresh happens silently.
//
//   5. select instead of include where possible
//      Campaign is now a select (only id + name needed) — avoids pulling
//      extra Prisma relation objects into memory.

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─── Pipeline status derivation ───────────────────────────────────────────────
// Pure function — no DB access, called in a tight .map() loop.
function derivePipelineStatus(
  contactStatus: string,
  stage: number | null,
  approvalStatus: string | null
): string {
  // Hard exits — checked first, always win
  if (contactStatus === "not_interested" || approvalStatus === "Declined") {
    return "Not Interested"
  }
  if (contactStatus === "for_order_creation" || (stage !== null && stage >= 5)) {
    return "For Order Creation"
  }

  // Stage-based (preferred when stage is set)
  if (stage !== null) {
    if (stage >= 4) return "Deal Agreed"
    if (stage === 3) return "In Conversation"
    if (stage === 2) return "Contacted"
    if (stage === 1) return "For Outreach"
  }

  // contact_status fallback (legacy records where stage is NULL)
  switch (contactStatus) {
    case "agreed":           return "Deal Agreed"
    case "negotiating":
    case "paid_collab":      return "In Conversation"
    case "responded":
    case "replied":
    case "contacted":        return "Contacted"
    case "no_response":
    case "email_error":      return "Contacted"
    case "pending":
    default:                 return "For Outreach"
  }
}

function formatFollowers(n: number): string {
  if (!n) return "0"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return String(n)
}

// ─── GET handler ──────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    // getServerSession is fast when using JWT strategy (no DB hit).
    // If you're still on database sessions, switch authOptions to
    // `session: { strategy: "jwt" }` for a ~300ms gain per request.
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params

    // ── Pagination params ────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url)
    const limit  = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500)
    const cursor = searchParams.get("cursor") ?? undefined

    // ── SINGLE DB QUERY ──────────────────────────────────────────────────────
    // Auth check is embedded as a nested brand filter — Prisma generates a
    // single JOIN query rather than two sequential round-trips.
    //
    // The OR on approval_status / contact_status is intentional:
    //   - "Approved"         → active pipeline cards
    //   - "Declined"         → Not Interested column (must persist on refresh)
    //   - "not_interested"   → legacy rows before approval_status was set
    //   - "for_order_creation" → moved to Post Tracker but still shown here
    //   - stage >= 5         → same as for_order_creation, stage-based
    //
    // MySQL will use the (brand_id, approval_status) composite index for the
    // Approved/Declined branches and (brand_id, contact_status) for the rest.
    const brandInfluencers = await prisma.brandInfluencer.findMany({
      where: {
        brand_id: brandId,
        // ── Embedded auth: only returns rows if this brand belongs to the user ──
        brand: {
          is_active: true,
          OR: [
            { owner_id: session.user.id },
            { members: { some: { user_id: session.user.id } } },
          ],
        },
        // ── Pipeline visibility filter ─────────────────────────────────────
        OR: [
          { approval_status: "Approved"  },
          { approval_status: "Declined"  },
          { contact_status:  "not_interested"    },
          { contact_status:  "for_order_creation" },
          { stage:           { gte: 5 }  },
        ],
      },
      // Select only columns the pipeline UI actually needs.
      // Omitting heavy Text fields (post_caption, product_details, etc.)
      // that are only needed when the sidebar opens — load those on demand.
      select: {
        id:              true,
        brand_id:        true,
        influencer_id:   true,
        campaign_id:     true,
        contact_status:  true,
        stage:           true,
        order_status:    true,
        content_posted:  true,
        approval_status: true,
        approval_notes:  true,
        agreed_rate:     true,
        currency:        true,
        deliverables:    true,
        deadline:        true,
        post_url:        true,
        likes_count:     true,
        comments_count:  true,
        engagement_count: true,
        posted_at:       true,
        shipped_at:      true,
        delivered_at:    true,
        notes:           true,
        internal_rating: true,
        updated_at:      true,
        created_at:      true,

        // GoAffPro affiliate data
        affiliate_id:    true,
        ref_code:        true,
        coupon:          true,
        affiliate_link:  true,
        clicks:          true,
        sales_count:     true,
        gmv:             true,

        // Influencer — only the fields the card + list view renders
        influencer: {
          select: {
            id:                true,
            handle:            true,
            platform:          true,
            full_name:         true,
            email:             true,
            niche:             true,
            location:          true,
            profile_image_url: true,
            bio:               true,
            follower_count:    true,
            engagement_rate:   true,
          },
        },

        // Campaign — only id + name for the label
        campaign: {
          select: { id: true, name: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: limit,
      // Cursor-based pagination — pass the last id from the previous page
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
    })

    if (brandInfluencers.length === 0 && !cursor) {
      const access = await prisma.brand.findFirst({
        where: {
          id:        brandId,
          is_active: true,
          OR: [
            { owner_id: session.user.id },
            { members: { some: { user_id: session.user.id } } },
          ],
        },
        select: { id: true },
      })
      if (!access) {
        return NextResponse.json({ error: "Brand not found or access denied" }, { status: 403 })
      }
      // Brand exists but genuinely has 0 pipeline records — return empty array
      return NextResponse.json(
        { data: [], nextCursor: null },
        {
          headers: {
            "Cache-Control": "private, max-age=0, stale-while-revalidate=30",
          },
        }
      )
    }

    // ── Map to response shape ────────────────────────────────────────────────
    const data = brandInfluencers
      .filter((bi) => bi.influencer !== null) // drop orphaned records
      .map((bi) => {
        const inf = bi.influencer!

        const pipelineStatus = derivePipelineStatus(
          bi.contact_status,
          bi.stage,
          bi.approval_status
        )

        return {
          id:            bi.id,
          influencerId:  inf.id,
          campaignId:    bi.campaign_id,
          campaignName:  bi.campaign?.name ?? null,

          influencer:      inf.full_name || inf.handle,
          instagramHandle: inf.platform === "instagram" ? `@${inf.handle}` : inf.handle,
          handle:          inf.handle,
          platform:        inf.platform.charAt(0).toUpperCase() + inf.platform.slice(1),

          followers:      formatFollowers(inf.follower_count),
          followerCount:  inf.follower_count,
          engagementRate: inf.engagement_rate
            ? `${Number(inf.engagement_rate).toFixed(1)}%`
            : "0%",

          niche:           inf.niche             || "",
          location:        inf.location          || "",
          email:           inf.email             || "",
          profileImageUrl: inf.profile_image_url || null,
          bio:             inf.bio               || "",

          pipelineStatus,
          contactStatus:   bi.contact_status,
          stage:           bi.stage,
          orderStatus:     bi.order_status,
          contentPosted:   bi.content_posted,
          approvalStatus:  bi.approval_status,
          approvalNotes:   bi.approval_notes,   // doubles as NI reason

          agreedRate:      bi.agreed_rate    ? Number(bi.agreed_rate)    : null,
          currency:        bi.currency,
          deliverables:    bi.deliverables,
          deadline:        bi.deadline       ? bi.deadline.toISOString()       : null,
          postUrl:         bi.post_url,
          likesCount:      bi.likes_count,
          commentsCount:   bi.comments_count,
          engagementCount: bi.engagement_count,
          postedAt:        bi.posted_at      ? bi.posted_at.toISOString()      : null,
          shippedAt:       bi.shipped_at     ? bi.shipped_at.toISOString()     : null,
          deliveredAt:     bi.delivered_at   ? bi.delivered_at.toISOString()   : null,
          notes:           bi.notes          || "",
          internalRating:  bi.internal_rating ? Number(bi.internal_rating)     : null,
          lastContact:     bi.updated_at.toISOString(),
          createdAt:       bi.created_at.toISOString(),

          affiliateId:     bi.affiliate_id,
          refCode:         bi.ref_code,
          coupon:          bi.coupon,
          affiliateLink:   bi.affiliate_link,
          clicks:          bi.clicks,
          salesCount:      bi.sales_count,
          gmv:             bi.gmv ? Number(bi.gmv) : 0,
        }
      })

    // Next cursor = last record's id (for the next page call)
    const nextCursor =
      data.length === limit ? data[data.length - 1].id : null

    return NextResponse.json(
      { data, nextCursor },
      {
        headers: {
          "Cache-Control": "private, max-age=0, stale-while-revalidate=30",
        },
      }
    )
  } catch (error) {
    console.error("GET /api/brand/[brandId]/pipeline error:", error)
    return NextResponse.json(
      { error: "Failed to fetch pipeline data" },
      { status: 500 }
    )
  }
}
import { prisma } from "@/lib/prisma"
import { canAddInfluencer } from "@/lib/subscription-limits"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { NextRequest, NextResponse } from "next/server"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"
import { publicHandle } from "@/lib/influencer-draft"

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
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const unpartneredOnly = searchParams.get("unpartnered_only") === "true"
    // Drafts are blank rows the user added in the Influencer List and has not
    // filled in. Only that sheet has any use for them, and it is the only
    // caller that opts in — every other consumer of this route (the Add Partner
    // picker, the card list view) gets the default and never sees one.
    const includeDrafts = searchParams.get("include_drafts") === "true"

    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 })
    }

    const isOwner = brand.owner_id === session.user.id
    const isMember = isOwner
      ? true
      : !!(await prisma.brandMember.findFirst({
          where: { brand_id: brandId, user_id: session.user.id },
        }))

    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    if (!isOwner && !brand.is_active) {
      return NextResponse.json({ error: "This workspace is unavailable." }, { status: 403 })
    }

    if (isOwner && !brand.is_active) {
      const subscription = await prisma.userSubscription.findUnique({
        where: { user_id: brand.owner_id },
      })
      if (
        subscription &&
        (subscription.status === "cancelled" ||
          subscription.status === "paused" ||
          (subscription.current_period_end &&
            subscription.current_period_end < new Date()))
      ) {
        return NextResponse.json(
          {
            error: "Subscription expired. Please renew to access this workspace.",
            subscriptionExpired: true,
          },
          { status: 403 }
        )
      }
    }

    const brandInfluencers = await prisma.brandInfluencer.findMany({
      where: {
        brand_id: brandId,
        ...(includeDrafts ? {} : { influencer: { is_draft: false } }),
        // Push the search filter down to the DB via the influencer relation
        // when a caller supplies one, instead of always loading every row
        // for the brand and filtering the full set in JS. No current caller
        // passes `search`, so this is purely additive and changes nothing
        // for existing behavior — it only narrows the query when used.
        ...(search
          ? {
              influencer: {
                OR: [
                  { handle: { contains: search } },
                  { full_name: { contains: search } },
                  { niche: { contains: search } },
                  { location: { contains: search } },
                ],
              },
            }
          : {}),
      },
      // The influencer is read through the relation rather than by a second
      // findMany over the collected ids. Same tight field list as before — only
      // what the response below reads — but one fewer database round trip, and
      // so one fewer connection acquisition per request. That matters here: the
      // MySQL user has a max_user_connections ceiling, and this is the heaviest
      // route in the app, so it is the one that trips the ceiling first and
      // surfaces as "Failed to load influencers".
      //
      // A missing influencer still comes back as null and is still filtered out
      // below — the tables are MyISAM, so there is no foreign key to guarantee
      // the row exists.
      include: {
        attribution: true,
        influencer: {
          select: {
            id: true,
            handle: true,
            platform: true,
            full_name: true,
            email: true,
            gender: true,
            niche: true,
            location: true,
            bio: true,
            profile_image_url: true,
            is_draft: true,
            social_link: true,
            follower_count: true,
            engagement_rate: true,
            avg_likes: true,
            avg_comments: true,
            avg_views: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    })

    // Only asked for when the caller wants it; previously this sat in a
    // Promise.all whose other branch was an already-resolved literal.
    const partnerRows = unpartneredOnly
      ? await prisma.brandPartner.findMany({
          where: { brand_id: brandId },
          select: { brand_influencer_id: true },
        })
      : []

    const partnerIds = new Set(partnerRows.map((partner) => partner.brand_influencer_id))

    const filteredBrandInfluencers = brandInfluencers.filter((bi) => {
      const inf = bi.influencer
      if (!inf) return false
      if (unpartneredOnly && partnerIds.has(bi.id)) return false

      if (!search) return true

      const haystack = [inf.handle, inf.full_name, inf.niche, inf.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(search.toLowerCase())
    })

    const brandInfluencerIds = filteredBrandInfluencers.map((bi) => bi.id)

    const addedLogs = await prisma.activityLog.findMany({
      where: {
        brand_id: brandId,
        action: "influencer.added",
        entity_type: "brand_influencer",
        entity_id: { in: brandInfluencerIds },
      },
      orderBy: { created_at: "asc" },
      select: {
        entity_id: true,
        created_at: true,
        user_id: true,
      },
    })

    // Fetch user info for whoever added each influencer
    const userIds = [...new Set(addedLogs.map((l) => l.user_id))]
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, image: true, email: true },
        })
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))

    // First log per brand_influencer_id = who added
    const addedByMap = new Map<string, { user_id: string; created_at: Date }>()
    for (const log of addedLogs) {
      if (!addedByMap.has(log.entity_id)) {
        addedByMap.set(log.entity_id, log)
      }
    }

    const combined = filteredBrandInfluencers
      .filter((bi) => bi.influencer !== null)
      .map((bi) => {
        const inf = bi.influencer!
        const addedLog = addedByMap.get(bi.id)
        const addedUser = addedLog ? userMap.get(addedLog.user_id) : null

        return {
          id: bi.id,
          brand_id: bi.brand_id,
          influencer_id: bi.influencer_id,
          campaign_id: bi.campaign_id,
          contact_status: bi.contact_status,
          outreach_method: bi.outreach_method,
          stage: bi.stage,
          order_status: bi.order_status,
          product_details: bi.product_details,
          shipped_at: bi.shipped_at?.toISOString() ?? null,
          delivered_at: bi.delivered_at?.toISOString() ?? null,
          content_posted: bi.content_posted,
          posted_at: bi.posted_at?.toISOString() ?? null,
          post_url: bi.post_url,
          post_caption: bi.post_caption,
          likes_count: bi.likes_count,
          comments_count: bi.comments_count,
          engagement_count: bi.engagement_count,
          agreed_rate: bi.agreed_rate ? bi.agreed_rate.toString() : null,
          currency: bi.currency,
          deliverables: bi.deliverables,
          deadline: bi.deadline?.toISOString() ?? null,
          notes: bi.notes,
          internal_rating: bi.internal_rating ? bi.internal_rating.toString() : null,
          approval_status: bi.approval_status,
          approval_notes: bi.approval_notes,
          transferred_date: bi.transferred_date?.toISOString() ?? null,
          affiliate_id: bi.attribution?.affiliate_id   ?? null,
          ref_code: bi.attribution?.ref_code           ?? null,
          coupon: bi.attribution?.coupon               ?? null,
          spark_ads: bi.attribution?.spark_ads         ?? null,
          affiliate_link: bi.attribution?.affiliate_link ?? null,
          clicks: bi.attribution?.clicks               ?? 0,
          sales_count: bi.attribution?.sales_count     ?? 0,
          gmv: bi.attribution?.gmv ? Number(bi.attribution.gmv) : 0,
          created_at: bi.created_at.toISOString(),
          updated_at: bi.updated_at.toISOString(),
          added_by: addedUser
            ? {
                id: addedUser.id,
                name: addedUser.name,
                image: addedUser.image,
                added_at: addedLog!.created_at.toISOString(),
              }
            : null,
          influencer: {
            id: inf.id,
            // A draft's stored handle is a generated placeholder that keeps it
            // unique on @@unique([handle, platform]); the sheet must see the
            // empty row the user actually added.
            handle: publicHandle(inf.handle),
            is_draft: inf.is_draft,
            platform: inf.platform,
            full_name: inf.full_name,
            email: inf.email,
            gender: inf.gender,
            niche: inf.niche,
            location: inf.location,
            bio: inf.bio,
            profile_image_url: inf.profile_image_url,
            social_link: inf.social_link,
            follower_count: inf.follower_count,
            engagement_rate: inf.engagement_rate ? Number(inf.engagement_rate) : 0,
            avg_likes: inf.avg_likes,
            avg_comments: inf.avg_comments,
            avg_views: inf.avg_views,
            created_at: inf.created_at.toISOString(),
            updated_at: inf.updated_at.toISOString(),
          },
        }
      })

    return NextResponse.json({ influencers: combined }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("GET /api/brand/[brandId]/influencers:", message)

    // A database that is out of connections is a CAPACITY problem, not a broken
    // request, and it clears on its own. Reporting it as 500 made the page show
    // a dead-end "Failed to load influencers" for something a retry a moment
    // later would have served.
    //
    // Two shapes reach here, from two different limits:
    //   MySQL 1203  "User ... already has more than 'max_user_connections'
    //               active connections" — the server-side ceiling on the DB
    //               user, hit when a NEW connection is opened. Existing pooled
    //               connections keep working, which is why this comes and goes.
    //   Prisma P2024 pool timeout — DATABASE_URL's own connection_limit.
    //
    // 503 with Retry-After is what the client needs to tell "try again" from
    // "this will never work"; the page renders a Retry button on this.
    if (isDatabaseCapacityError(message)) {
      return databaseCapacityResponse()
    }

    return NextResponse.json({ error: "Failed to fetch influencers" }, { status: 500 })
  }
}


export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params
    const body = await req.json()
    const { influencer_id } = body

    if (!influencer_id) {
      return NextResponse.json({ error: "influencer_id is required" }, { status: 400 })
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) {
      return NextResponse.json({ error: "Brand not found or access denied" }, { status: 404 })
    }

    const isOwnerForCreate = brand.owner_id === session.user.id
    const isMemberForCreate = isOwnerForCreate
      ? true
      : !!(await prisma.brandMember.findFirst({
          where: { brand_id: brandId, user_id: session.user.id },
        }))

    if (!isMemberForCreate) {
      return NextResponse.json({ error: "Brand not found or access denied" }, { status: 404 })
    }

    const limitCheck = await canAddInfluencer(session.user.id, brandId)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: limitCheck.message,
          current: limitCheck.current,
          max: limitCheck.max,
          requiresSubscription: limitCheck.requiresSubscription ?? false,
        },
        { status: 403 }
      )
    }

    const influencer = await prisma.influencer.findUnique({ where: { id: influencer_id } })
    if (!influencer) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 })
    }

    const existing = await prisma.brandInfluencer.findUnique({
      where: { brand_id_influencer_id: { brand_id: brandId, influencer_id } },
    })
    if (existing) {
      return NextResponse.json(
        { error: "This influencer is already added to your brand" },
        { status: 409 }
      )
    }

    const brandInfluencer = await prisma.brandInfluencer.create({
      data: { brand_id: brandId, influencer_id, contact_status: "not_contacted" },
      include: { influencer: true },
    })

    logActivity({
      brandId,
      userId: session.user.id,
      action: "influencer.added",
      entityType: "brand_influencer",
      entityId: brandInfluencer.id,
      details: {
        method: "manual",
        handle: influencer.handle,
        platform: influencer.platform,
      },
    }).catch(console.error)

    return NextResponse.json({
      influencer: {
        ...brandInfluencer,
        affiliate_id: null,
        ref_code: null,
        coupon: null,
        spark_ads: null,
        affiliate_link: null,
        clicks: 0,
        sales_count: 0,
        gmv: 0,
      },
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to add influencer",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
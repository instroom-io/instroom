import { prisma } from "@/lib/prisma"
import { canAddInfluencer } from "@/lib/subscription-limits"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { provisionGoAffProAffiliate } from "@/lib/goaffpro-provision"
import { NextRequest, NextResponse } from "next/server"

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
      },
      orderBy: { created_at: "desc" },
    })

    const influencerIds = [...new Set(brandInfluencers.map((bi) => bi.influencer_id))]

    const partnerIds = unpartneredOnly
      ? new Set(
          (
            await prisma.brandPartner.findMany({
              where: { brand_id: brandId },
              select: { brand_influencer_id: true },
            })
          ).map((partner) => partner.brand_influencer_id)
        )
      : new Set<string>()

    // Fetch influencers first so orphaned brand_influencer rows can be skipped safely.
    const influencers = await prisma.influencer.findMany({ where: { id: { in: influencerIds } } })
    const influencerMap = new Map(influencers.map((i) => [i.id, i]))

    const filteredBrandInfluencers = brandInfluencers.filter((bi) => {
      const inf = influencerMap.get(bi.influencer_id)
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
      .filter((bi) => influencerMap.has(bi.influencer_id))
      .map((bi) => {
        const affiliateBi = bi as typeof bi & {
          affiliate_id?: string | null
          ref_code?: string | null
          coupon?: string | null
          affiliate_link?: string | null
          clicks?: number
          sales_count?: number
          gmv?: unknown
        }
        const inf = influencerMap.get(bi.influencer_id)!
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
          affiliate_id: affiliateBi.affiliate_id,
          ref_code: affiliateBi.ref_code,
          coupon: affiliateBi.coupon,
          affiliate_link: affiliateBi.affiliate_link,
          clicks: affiliateBi.clicks,
          sales_count: affiliateBi.sales_count,
          gmv: affiliateBi.gmv ? Number(affiliateBi.gmv) : 0,
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
            handle: inf.handle,
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
    console.error(
      "GET /api/brand/[brandId]/influencers:",
      error instanceof Error ? error.message : String(error)
    )
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
    if (!brand || brand.owner_id !== session.user.id) {
      return NextResponse.json({ error: "Brand not found or access denied" }, { status: 404 })
    }

    const limitCheck = await canAddInfluencer(session.user.id, brandId)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.message, current: limitCheck.current, max: limitCheck.max },
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

    const affiliateBrandInfluencer = brandInfluencer as typeof brandInfluencer & {
      affiliate_id?: string | null
      ref_code?: string | null
      coupon?: string | null
      affiliate_link?: string | null
      clicks?: number
      sales_count?: number
      gmv?: unknown
    }

    const goAffProProvision = await provisionGoAffProAffiliate({
      brandId,
      brandInfluencerId: brandInfluencer.id,
    })

    if (!goAffProProvision.success && !goAffProProvision.skipped) {
      console.error("GoAffPro provisioning failed:", goAffProProvision.reason)
    }

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
        ...affiliateBrandInfluencer,
        gmv: affiliateBrandInfluencer.gmv ? Number(affiliateBrandInfluencer.gmv) : 0,
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
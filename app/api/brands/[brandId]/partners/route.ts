// app/api/brands/[brandId]/partners/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkBrandAccess } from "@/lib/brand-access"

// Re-flattens the Attribution relation back onto the response object so
// consumers (BrandPartnersPage.tsx etc.) keep reading these as top-level
// fields, exactly as when they lived directly on BrandInfluencer.
// Tight select shared by GET and POST: pulls only the columns that
// dbToPartner() in BrandPartnersPage.tsx (and its child components) actually
// consume, instead of `include: true`-ing entire influencer/partner/
// attribution rows (which also drags along unused @db.Text columns like
// product_details, post_caption, and approval_notes on every row).
const PARTNER_SELECT = {
  id: true,
  brand_id: true,
  influencer_id: true,
  campaign_id: true,
  contact_status: true,
  stage: true,
  content_posted: true,
  post_url: true,
  notes: true,
  agreed_rate: true,
  internal_rating: true,
  likes_count: true,
  comments_count: true,
  engagement_count: true,
  deliverables: true,
  created_at: true,
  updated_at: true,
  influencer: {
    select: {
      handle: true,
      platform: true,
      full_name: true,
      email: true,
      gender: true,
      niche: true,
      location: true,
      bio: true,
      profile_image_url: true,
      social_link: true,
      follower_count: true,
      engagement_rate: true,
      avg_likes: true,
      avg_comments: true,
      avg_views: true,
    },
  },
  campaign: {
    select: { id: true, name: true, status: true },
  },
  partner: {
    select: {
      id: true,
      brand_id: true,
      influencer_id: true,
      brand_influencer_id: true,
      on_retainer: true,
      retainer_fee: true,
      default_commission: true,
      tier_override: true,
      product_cost: true,
      fees_paid: true,
      commission_paid: true,
      created_at: true,
      updated_at: true,
    },
  },
  attribution: {
    select: {
      affiliate_id: true,
      ref_code: true,
      coupon: true,
      spark_ads: true,
      affiliate_link: true,
      clicks: true,
      sales_count: true,
      gmv: true,
    },
  },
} as const

function flattenAttribution<T extends { attribution?: { affiliate_id: string | null; ref_code: string | null; coupon: string | null; spark_ads: string | null; affiliate_link: string | null; clicks: number; sales_count: number; gmv: unknown } | null }>(
  bi: T
) {
  const { attribution, ...rest } = bi
  return {
    ...rest,
    affiliate_id:   attribution?.affiliate_id   ?? null,
    ref_code:       attribution?.ref_code       ?? null,
    coupon:         attribution?.coupon         ?? null,
    spark_ads:      attribution?.spark_ads      ?? null,
    affiliate_link: attribution?.affiliate_link ?? null,
    clicks:         attribution?.clicks         ?? 0,
    sales_count:    attribution?.sales_count    ?? 0,
    gmv:            attribution?.gmv ? Number(attribution.gmv as any) : 0,
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Next.js 15+: params is a Promise — must be awaited
    const { brandId } = await context.params
    if (!(await checkBrandAccess(brandId, session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search        = searchParams.get("search") || ""
    const stage         = searchParams.get("stage")
    const contactStatus = searchParams.get("contact_status")
    const campaignId    = searchParams.get("campaign_id")
    const platform      = searchParams.get("platform")
    const niche         = searchParams.get("niche")

    const brandInfluencers = await prisma.brandInfluencer.findMany({
      where: {
        brand_id: brandId,
        partner: { isNot: null }, // only rows promoted to an actual BrandPartner
        ...(stage         ? { stage: parseInt(stage) } : {}),
        ...(contactStatus ? { contact_status: contactStatus } : {}),
        ...(campaignId    ? { campaign_id: campaignId } : {}),
        influencer: {
          ...(platform ? { platform } : {}),
          ...(niche    ? { niche }    : {}),
          // Fix 1: removed mode: "insensitive" — SQLite doesn't support it
          ...(search   ? {
              OR: [
                { handle:    { contains: search } },
                { full_name: { contains: search } },
                { email:     { contains: search } },
                { niche:     { contains: search } },
                { location:  { contains: search } },
              ],
            } : {}),
        },
      },
      select: PARTNER_SELECT,
      orderBy: { created_at: "desc" },
    })

    return NextResponse.json({ data: brandInfluencers.map(flattenAttribution) })
  } catch (error) {
    console.error("[GET /partners]", error)
    return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await context.params
    if (!(await checkBrandAccess(brandId, session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const body = await req.json()

    if (!body.influencer_id) {
      return NextResponse.json(
        { error: "influencer_id is required" },
        { status: 400 }
      )
    }

    const influencerId = body.influencer_id

    const influencer = await prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true },
    })

    if (!influencer) {
      return NextResponse.json(
        { error: "Influencer not found" },
        { status: 404 }
      )
    }

    // ── Check for duplicate brand-influencer link ────────────────────────
    const duplicate = await prisma.brandInfluencer.findUnique({
      where: { brand_id_influencer_id: { brand_id: brandId, influencer_id: influencerId } },
    })

    if (duplicate) {
      return NextResponse.json(
        { error: "This influencer is already added to this brand", existing: duplicate },
        { status: 409 }
      )
    }

    // ── Create the BrandInfluencer link + matching BrandPartner row ──────
    // Fix 2: removed $transaction wrapper — the findUniqueOrThrow with nested
    // includes was too slow and hitting SQLite's 5s transaction timeout.
    // Sequential awaits are safe here since the duplicate check above guards
    // against concurrent double-inserts in the vast majority of cases.
    const bi = await prisma.brandInfluencer.create({
      data: {
        brand_id:        brandId,
        influencer_id:   influencerId,
        campaign_id:     body.campaign_id     ?? null,
        stage:           body.stage           ?? 1,
        contact_status:  body.contact_status  ?? "not_contacted",
        notes:           body.notes           ?? null,
        agreed_rate:     body.agreed_rate     ?? null,
        currency:        body.currency        ?? null,
        internal_rating: body.internal_rating ?? null,
        outreach_method: body.outreach_method ?? null,
        deliverables:    body.deliverables    ?? null,
        deadline:        body.deadline ? new Date(body.deadline) : null,
      },
    })

    await prisma.brandPartner.create({
      data: {
        brand_id:            brandId,
        influencer_id:       influencerId,
        brand_influencer_id: bi.id,
      },
    })

    const brandInfluencer = await prisma.brandInfluencer.findUniqueOrThrow({
      where: { id: bi.id },
      select: PARTNER_SELECT,
    })

    return NextResponse.json({ data: flattenAttribution(brandInfluencer) }, { status: 201 })
  } catch (error) {
    console.error("[POST /partners]", error)
    return NextResponse.json({ error: "Failed to add partner" }, { status: 500 })
  }
}
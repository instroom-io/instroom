// app/api/brands/[brandId]/partners/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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
        ...(stage         ? { stage: parseInt(stage) } : {}),
        ...(contactStatus ? { contact_status: contactStatus } : {}),
        ...(campaignId    ? { campaign_id: campaignId } : {}),
        influencer: {
          ...(platform ? { platform } : {}),
          ...(niche    ? { niche }    : {}),
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
      include: {
        influencer: true,
        campaign: {
          select: { id: true, name: true, status: true },
        },
        partner: true, // ← fixes missing financials (product_cost, fees_paid, clicks, tier_override, etc.)
      },
      orderBy: { created_at: "desc" },
    })

    return NextResponse.json({ data: brandInfluencers })
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
    const body = await req.json()

    // ── Resolve or create the global Influencer record ──────────────────
    let influencerId: string

    if (body.influencer_id) {
      influencerId = body.influencer_id
    } else {
      if (!body.handle || !body.platform) {
        return NextResponse.json(
          { error: "handle and platform are required when influencer_id is not provided" },
          { status: 400 }
        )
      }

      const handle   = body.handle.trim().replace(/^@/, "").toLowerCase()
      const platform = body.platform.toLowerCase()

      const existing = await prisma.influencer.findUnique({
        where: { handle_platform: { handle, platform } },
      })

      if (existing) {
        influencerId = existing.id
      } else {
        const created = await prisma.influencer.create({
          data: {
            handle,
            platform,
            full_name:         body.full_name         ?? null,
            email:             body.email             ?? null,
            gender:            body.gender            ?? null,
            niche:             body.niche             ?? null,
            location:          body.location          ?? null,
            bio:               body.bio               ?? null,
            profile_image_url: body.profile_image_url ?? null,
            social_link:       body.social_link       ?? null,
            follower_count:    body.follower_count     ?? 0,
            engagement_rate:   body.engagement_rate    ?? 0,
            avg_likes:         body.avg_likes          ?? 0,
            avg_comments:      body.avg_comments       ?? 0,
            avg_views:         body.avg_views          ?? 0,
          },
        })
        influencerId = created.id
      }
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

    // ── Create the BrandInfluencer link ──────────────────────────────────
    const brandInfluencer = await prisma.brandInfluencer.create({
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
      include: {
        influencer: true,
        campaign: { select: { id: true, name: true, status: true } },
        partner: true, // ← ensures POST response also includes financials (null on first create, that's fine)
      },
    })

    return NextResponse.json({ data: brandInfluencer }, { status: 201 })
  } catch (error) {
    console.error("[POST /partners]", error)
    return NextResponse.json({ error: "Failed to add partner" }, { status: 500 })
  }
}
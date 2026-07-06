// app/api/brands/[brandId]/partners/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { provisionGoAffProAffiliate } from "@/lib/goaffpro-provision"

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
      include: {
        influencer: true,
        campaign: {
          select: { id: true, name: true, status: true },
        },
        partner: true,
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

    const goAffProProvision = await provisionGoAffProAffiliate({
      brandId,
      brandInfluencerId: bi.id,
    })

    if (!goAffProProvision.success && !goAffProProvision.skipped) {
      console.error("GoAffPro provisioning failed:", goAffProProvision.reason)
    }

    const brandInfluencer = await prisma.brandInfluencer.findUniqueOrThrow({
      where: { id: bi.id },
      include: {
        influencer: true,
        campaign: { select: { id: true, name: true, status: true } },
        partner: true,
      },
    })

    return NextResponse.json({ data: brandInfluencer }, { status: 201 })
  } catch (error) {
    console.error("[POST /partners]", error)
    return NextResponse.json({ error: "Failed to add partner" }, { status: 500 })
  }
}
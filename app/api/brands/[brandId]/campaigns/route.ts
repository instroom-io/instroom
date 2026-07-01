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

    const { brandId } = await context.params

    const campaigns = await prisma.campaign.findMany({
      where: { brand_id: brandId },
      orderBy: { created_at: "desc" },
    })

    if (campaigns.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const campaignIds = campaigns.map((c) => c.id)

    const brandInfluencers = await prisma.brandInfluencer.findMany({
      where: {
        brand_id: brandId,
        campaign_id: { in: campaignIds },
      },
      select: {
        id: true,
        campaign_id: true,
        content_posted: true,
        likes_count: true,
        comments_count: true,
      },
    })

    const bisByCampaign = new Map<string, typeof brandInfluencers>()
    for (const bi of brandInfluencers) {
      if (!bi.campaign_id) continue
      const arr = bisByCampaign.get(bi.campaign_id) ?? []
      arr.push(bi)
      bisByCampaign.set(bi.campaign_id, arr)
    }

    const enriched = campaigns.map((c) => {
      const bis = bisByCampaign.get(c.id) ?? []
      const postedCount = bis.filter((bi) => bi.content_posted).length

      return {
        ...c,
        _stats: {
          partner_count: bis.length,
          posts_done:    postedCount,
          posts_total:   bis.length,
          total_rev:     0,
        },
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error("[GET /campaigns]", error)
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
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

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        brand_id:    brandId,
        name:        body.name                                        as string,
        description: (body.description as string | null | undefined) ?? null,
        status:      (body.status      as string | undefined)        ?? "draft",
        type:        (body.type        as string | null | undefined) ?? null,
        budget:      body.budget    != null ? Number(body.budget)    : null,
        start_date:  body.start_date   ? new Date(body.start_date)  : null,
        end_date:    body.end_date     ? new Date(body.end_date)     : null,
      },
    })

    if (Array.isArray(body.influencer_ids) && body.influencer_ids.length > 0) {
      await prisma.brandInfluencer.updateMany({
        where: {
          id:       { in: body.influencer_ids as string[] },
          brand_id: brandId,
        },
        data: { campaign_id: campaign.id },
      })
    }

    return NextResponse.json({ data: campaign }, { status: 201 })
  } catch (error) {
    console.error("[POST /campaigns]", error)
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}
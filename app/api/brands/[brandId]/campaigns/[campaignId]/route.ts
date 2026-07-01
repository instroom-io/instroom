// app/api/brands/[brandId]/campaigns/[campaignId]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ brandId: string; campaignId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, campaignId } = await context.params

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brand_id: brandId },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Fetch linked partners separately to avoid stale Prisma client issues
    const brandInfluencers = await prisma.brandInfluencer.findMany({
      where: { brand_id: brandId, campaign_id: campaignId },
      include: {
        influencer: true,
      },
    })

    return NextResponse.json({
      data: { ...campaign, influencers: brandInfluencers },
    })
  } catch (error) {
    console.error("[GET /campaigns/:id]", error)
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ brandId: string; campaignId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, campaignId } = await context.params
    const body = await req.json()

    if (body.name !== undefined || body.description !== undefined || body.status !== undefined) {
      const campaignData: { name?: string; description?: string | null; status?: string } = {}
      if (body.name        !== undefined) campaignData.name        = body.name        as string
      if (body.description !== undefined) campaignData.description = body.description as string | null
      if (body.status      !== undefined) campaignData.status      = body.status      as string

      await prisma.campaign.update({
        where: { id: campaignId },
        data: campaignData,
      })
    }

    if (Array.isArray(body.add_influencer_ids) && body.add_influencer_ids.length > 0) {
      await prisma.brandInfluencer.updateMany({
        where: { id: { in: body.add_influencer_ids as string[] }, brand_id: brandId },
        data: { campaign_id: campaignId },
      })
    }

    if (Array.isArray(body.remove_influencer_ids) && body.remove_influencer_ids.length > 0) {
      await prisma.brandInfluencer.updateMany({
        where: { id: { in: body.remove_influencer_ids as string[] }, brand_id: brandId },
        data: { campaign_id: null },
      })
    }

    const updated = await prisma.campaign.findUnique({ where: { id: campaignId } })
    const updatedBIs = await prisma.brandInfluencer.findMany({
      where: { campaign_id: campaignId, brand_id: brandId },
      include: { influencer: true },
    })

    return NextResponse.json({ data: { ...updated, influencers: updatedBIs } })
  } catch (error) {
    console.error("[PATCH /campaigns/:id]", error)
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ brandId: string; campaignId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, campaignId } = await context.params

    await prisma.brandInfluencer.updateMany({
      where: { campaign_id: campaignId, brand_id: brandId },
      data: { campaign_id: null },
    })

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "archived" },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[DELETE /campaigns/:id]", error)
    return NextResponse.json({ error: "Failed to archive campaign" }, { status: 500 })
  }
}
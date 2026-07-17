import { prisma } from "@/lib/prisma"
import { canCreateCampaign } from "@/lib/subscription-limits"
import { hasBrandCapability } from "@/lib/permissions"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
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

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand) {
      return NextResponse.json({ error: "Brand not found or access denied" }, { status: 404 })
    }

    const isOwner = brand.owner_id === session.user.id
    const isMember = isOwner
      ? true
      : !!(await prisma.brandMember.findFirst({
          where: { brand_id: brandId, user_id: session.user.id },
        }))

    if (!isMember) {
      return NextResponse.json({ error: "Brand not found or access denied" }, { status: 404 })
    }

    // Fetch all campaigns for this brand
    const campaigns = await prisma.campaign.findMany({
      where: { brand_id: brandId },
      orderBy: { created_at: "desc" },
    })

    return NextResponse.json({ campaigns }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch campaigns", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/brand/[brandId]/campaigns
 * Create a new campaign (with limit enforcement for active campaigns)
 */
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
    const { name, description, status = "draft" } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand) {
      return NextResponse.json({ error: "Brand not found or access denied" }, { status: 404 })
    }

    const isOwner = brand.owner_id === session.user.id
    const isMember = isOwner
      ? true
      : !!(await prisma.brandMember.findFirst({
          where: { brand_id: brandId, user_id: session.user.id },
        }))

    if (!isMember) {
      return NextResponse.json({ error: "Brand not found or access denied" }, { status: 404 })
    }

    if (!(await hasBrandCapability(brandId, session.user.id, "manageCampaigns"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // If setting to active, check campaign limit
    if (status === "active") {
      const limitCheck = await canCreateCampaign(session.user.id, brandId)

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
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        brand_id: brandId,
        name: name.trim(),
        description: description || undefined,
        status,
      },
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create campaign", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

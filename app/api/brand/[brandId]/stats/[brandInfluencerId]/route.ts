import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { productCostFromDetails } from "@/lib/pipeline-transitions"

// GET — one influencer's numbers for the shared Stats tab (Pipeline and Post Tracker drawers).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string; brandInfluencerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, brandInfluencerId } = await params
    const accessCount = await prisma.brand.count({
      where: {
        id: brandId,
        is_active: true,
        OR: [
          { owner_id: session.user.id },
          { members: { some: { user_id: session.user.id } } },
        ],
      },
    })
    if (accessCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 403 })
    }

    const bi = await prisma.brandInfluencer.findFirst({
      where: { id: brandInfluencerId, brand_id: brandId },
      select: {
        agreed_rate: true,
        likes_count: true,
        comments_count: true,
        views_count: true,
        shipped_at: true,
        delivered_at: true,
        posted_at: true,
        product_details: true,
        influencer: {
          select: { follower_count: true, engagement_rate: true, avg_likes: true, avg_comments: true, avg_views: true },
        },
        attribution: { select: { clicks: true, sales_count: true, gmv: true } },
        partner: { select: { product_cost: true, commission_paid: true } },
      },
    })
    if (!bi) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const agreedRate = bi.agreed_rate ? Number(bi.agreed_rate) : null
    // Same product cost and commission as Analytics; fees = the agreed rate, as the Pipeline showed.
    const productCost = bi.partner ? Number(bi.partner.product_cost) : productCostFromDetails(bi.product_details)
    const commissionPaid = bi.partner ? Number(bi.partner.commission_paid) : 0
    const feesPaid = agreedRate ?? 0

    return NextResponse.json({
      data: {
        clicks: bi.attribution?.clicks ?? 0,
        sales: bi.attribution?.sales_count ?? 0,
        revenue: bi.attribution?.gmv ? Number(bi.attribution.gmv) : 0,
        productCost,
        feesPaid,
        commissionPaid,
        totalSpend: productCost + feesPaid + commissionPaid,
        followers: bi.influencer.follower_count ?? null,
        engagementRate: bi.influencer.engagement_rate != null ? Number(bi.influencer.engagement_rate) : null,
        likes: bi.likes_count ?? 0,
        comments: bi.comments_count ?? 0,
        views: bi.views_count ?? 0,
        agreedRate,
        avgLikes: bi.influencer.avg_likes ?? null,
        avgComments: bi.influencer.avg_comments ?? null,
        avgViews: bi.influencer.avg_views ?? null,
        shippedAt: bi.shipped_at?.toISOString() ?? null,
        deliveredAt: bi.delivered_at?.toISOString() ?? null,
        postedAt: bi.posted_at?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error("GET /api/brand/[brandId]/stats/[brandInfluencerId]:", error)
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 })
  }
}

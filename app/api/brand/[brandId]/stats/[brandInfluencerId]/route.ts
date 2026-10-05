import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { productCostFromDetails, resolveFees, resolveCommission, resolveCommissionRate } from "@/lib/pipeline-transitions"
import { goaffproCommissionByInfluencer } from "@/lib/goaffpro-commission"
import { getDeliverableProgress } from "@/lib/deliverables"

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
        post_url: true,
        product_details: true,
        influencer: {
          select: { follower_count: true, engagement_rate: true, avg_likes: true, avg_comments: true, avg_views: true },
        },
        attribution: { select: { clicks: true, sales_count: true, gmv: true } },
        partner: { select: { product_cost: true, fees_paid: true, commission_paid: true, default_commission: true } },
      },
    })
    if (!bi) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const agreedRate = bi.agreed_rate ? Number(bi.agreed_rate) : null
    // Same product cost, fees and commission rules as Analytics.
    const productCost = bi.partner ? Number(bi.partner.product_cost) : productCostFromDetails(bi.product_details)
    const fees = resolveFees({ partnerFeesPaid: bi.partner?.fees_paid, productDetails: bi.product_details, agreedRate })
    const feesPaid = fees.amount
    const revenue = bi.attribution?.gmv ? Number(bi.attribution.gmv) : 0
    const commissionRate = resolveCommissionRate({ partnerDefault: bi.partner?.default_commission, productDetails: bi.product_details })
    const goaffpro = (await goaffproCommissionByInfluencer(brandId, [brandInfluencerId])).get(brandInfluencerId) ?? null
    const commission = resolveCommission({
      partnerCommissionPaid: bi.partner?.commission_paid,
      productDetails: bi.product_details,
      goaffproCommission: goaffpro,
      revenue,
      commissionRate,
    })
    const commissionPaid = commission.amount

    // Posted deliverables, or 1 for a single post URL.
    let paidCollab: unknown = null
    try { paidCollab = JSON.parse(bi.product_details || "{}")?.paidCollab ?? null } catch { /* unreadable details */ }
    const progress = getDeliverableProgress(paidCollab, bi.post_url)
    const postedPosts = progress.total > 0 ? progress.posted : bi.post_url?.trim() ? 1 : 0

    return NextResponse.json({
      data: {
        clicks: bi.attribution?.clicks ?? 0,
        sales: bi.attribution?.sales_count ?? 0,
        revenue,
        productCost,
        feesPaid,
        feesSource: fees.source,
        commissionPaid,
        commissionSource: commission.source,
        commissionRate,
        totalSpend: productCost + feesPaid + commissionPaid,
        followers: bi.influencer.follower_count ?? null,
        engagementRate: bi.influencer.engagement_rate != null ? Number(bi.influencer.engagement_rate) : null,
        likes: bi.likes_count ?? 0,
        comments: bi.comments_count ?? 0,
        views: bi.views_count ?? 0,
        postedPosts,
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

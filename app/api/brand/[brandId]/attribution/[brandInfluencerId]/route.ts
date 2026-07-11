import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assignGoAffProCoupon } from "@/lib/goaffpro-provision"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; brandInfluencerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, brandInfluencerId } = await params
    const body = await req.json()
    const { coupon, affiliateLink, sparkAds } = body as {
      coupon?: string | null
      affiliateLink?: string | null
      sparkAds?: string | null
    }

    // ── Access check — only brand owner/members can edit attribution data ────
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

    const brandInfluencer = await prisma.brandInfluencer.findFirst({
      where: { id: brandInfluencerId, brand_id: brandId },
      select: {
        id: true,
        attribution: { select: { coupon: true, affiliate_id: true } },
      },
    })

    if (!brandInfluencer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // ── DB write happens first — local save always succeeds even if the ─────
    // GoAffPro push below fails.
    const fields: Record<string, unknown> = {}
    if (coupon !== undefined) fields.coupon = coupon || null
    if (affiliateLink !== undefined) fields.affiliate_link = affiliateLink || null
    if (sparkAds !== undefined) fields.spark_ads = sparkAds || null

    const updated = await prisma.attribution.upsert({
      where: { brand_influencer_id: brandInfluencerId },
      update: fields,
      create: {
        brand_id: brandId,
        brand_influencer_id: brandInfluencerId,
        ...fields,
      },
    })

    // ── Conditional GoAffPro coupon sync ──────────────────────────────────────
    let goAffPro: { synced: boolean; reason?: string } = { synced: false }

    const previousCoupon = brandInfluencer.attribution?.coupon ?? null
    const couponChanged = coupon !== undefined && (coupon || null) !== previousCoupon
    const affiliateId = brandInfluencer.attribution?.affiliate_id

    if (couponChanged) {
      if (!affiliateId) {
        goAffPro = { synced: false, reason: "Not yet provisioned with GoAffPro" }
      } else if (!coupon) {
        goAffPro = { synced: false, reason: "Discount code cleared — not pushed to GoAffPro" }
      } else {
        const result = await assignGoAffProCoupon({ brandId, affiliateId, coupon })
        goAffPro = result.success ? { synced: true } : { synced: false, reason: result.reason }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        coupon: updated.coupon,
        affiliateLink: updated.affiliate_link,
        sparkAds: updated.spark_ads,
      },
      goAffPro,
    })
  } catch (error: any) {
    console.error("PATCH /api/brand/[brandId]/attribution/[brandInfluencerId]:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to save attribution data" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assignGoAffProCoupon } from "@/lib/goaffpro-provision"

// Read for drawers whose own data doesn't carry attribution (e.g. Post Tracker's).
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
        attribution: { select: { coupon: true, ref_code: true, affiliate_link: true, spark_ads: true } },
      },
    })
    if (!bi) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        coupon: bi.attribution?.coupon ?? null,
        refCode: bi.attribution?.ref_code ?? null,
        affiliateLink: bi.attribution?.affiliate_link ?? null,
        sparkAds: bi.attribution?.spark_ads ?? null,
      },
    })
  } catch (error) {
    console.error("GET /api/brand/[brandId]/attribution/[brandInfluencerId]:", error)
    return NextResponse.json({ error: "Failed to load attribution data" }, { status: 500 })
  }
}

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
    const { coupon, affiliateLink, sparkAds, productCost } = body as {
      coupon?: string | null
      affiliateLink?: string | null
      sparkAds?: string | null
      productCost?: string | number | null
    }

    // "$1,250.50" → 1250.5; blank clears it; non-numbers are rejected.
    let parsedProductCost: number | null | undefined
    if (productCost !== undefined) {
      const raw = String(productCost ?? "").replace(/[$,\s]/g, "")
      parsedProductCost = raw === "" ? null : Number(raw)
      if (parsedProductCost !== null && (!Number.isFinite(parsedProductCost) || parsedProductCost < 0)) {
        return NextResponse.json({ error: "Product cost must be a positive number" }, { status: 400 })
      }
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
        product_details: true,
        partner: { select: { id: true } },
        attribution: { select: { coupon: true, affiliate_id: true } },
      },
    })

    if (!brandInfluencer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // ── DB write happens first — local save always succeeds even if the ─────
    // GoAffPro push below fails.
    // Normalized so Shopify's discount-code fallback matching (which also
    // normalizes with .trim().toUpperCase()) compares like-for-like.
    const normalizedCoupon = coupon ? coupon.trim().toUpperCase() : coupon

    const fields: Record<string, unknown> = {}
    if (coupon !== undefined) fields.coupon = normalizedCoupon || null
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

    if (parsedProductCost !== undefined) {
      if (brandInfluencer.partner) {
        await prisma.brandPartner.update({
          where: { id: brandInfluencer.partner.id },
          data: { product_cost: parsedProductCost ?? 0 },
        })
      } else {
        let details: Record<string, unknown> | null = null
        try { details = brandInfluencer.product_details ? JSON.parse(brandInfluencer.product_details) : {} } catch { details = null }
        if (details && typeof details === "object") {
          if (parsedProductCost === null) delete details.productCost
          else details.productCost = parsedProductCost
          await prisma.brandInfluencer.update({
            where: { id: brandInfluencerId },
            data: { product_details: JSON.stringify(details) },
          })
        }
      }
    }

    // ── Conditional GoAffPro coupon sync ──────────────────────────────────────
    let goAffPro: { synced: boolean; reason?: string } = { synced: false }

    const previousCoupon = brandInfluencer.attribution?.coupon ?? null
    const couponChanged = coupon !== undefined && (normalizedCoupon || null) !== previousCoupon
    const affiliateId = brandInfluencer.attribution?.affiliate_id

    if (couponChanged) {
      if (!affiliateId) {
        goAffPro = { synced: false, reason: "Not yet provisioned with GoAffPro" }
      } else if (!normalizedCoupon) {
        goAffPro = { synced: false, reason: "Discount code cleared — not pushed to GoAffPro" }
      } else {
        const result = await assignGoAffProCoupon({ brandId, affiliateId, coupon: normalizedCoupon })
        goAffPro = result.success ? { synced: true } : { synced: false, reason: result.reason }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        coupon: updated.coupon,
        affiliateLink: updated.affiliate_link,
        sparkAds: updated.spark_ads,
        ...(parsedProductCost !== undefined ? { productCost: parsedProductCost } : {}),
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

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assignGoAffProCoupon } from "@/lib/goaffpro-provision"
import { resolveCommission, resolveCommissionRate } from "@/lib/pipeline-transitions"
import { goaffproCommissionByInfluencer } from "@/lib/goaffpro-commission"

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
        product_details: true,
        attribution: { select: { coupon: true, ref_code: true, affiliate_link: true, spark_ads: true, gmv: true } },
        partner: { select: { default_commission: true, commission_paid: true } },
      },
    })
    if (!bi) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // A partner's 0 means not entered.
    let commissionPaid: number | null = null
    const partnerPaid = Number(bi.partner?.commission_paid ?? 0)
    if (partnerPaid > 0) commissionPaid = partnerPaid
    else {
      try {
        const raw = JSON.parse(bi.product_details || "{}")?.commissionPaid
        if (raw != null && raw !== "" && Number.isFinite(Number(raw))) commissionPaid = Number(raw)
      } catch { /* unreadable details */ }
    }

    // What a blank Commission paid works out to, as in Stats.
    const commissionRate = resolveCommissionRate({ partnerDefault: bi.partner?.default_commission, productDetails: bi.product_details })
    const calculated = resolveCommission({
      goaffproCommission: (await goaffproCommissionByInfluencer(brandId, [brandInfluencerId])).get(brandInfluencerId) ?? null,
      revenue: bi.attribution?.gmv ? Number(bi.attribution.gmv) : 0,
      commissionRate,
    })

    return NextResponse.json({
      data: {
        coupon: bi.attribution?.coupon ?? null,
        refCode: bi.attribution?.ref_code ?? null,
        affiliateLink: bi.attribution?.affiliate_link ?? null,
        sparkAds: bi.attribution?.spark_ads ?? null,
        commissionRate,
        commissionPaid,
        commissionCalculated: { amount: calculated.amount, source: calculated.source },
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
    // Fees and product cost are set in their own tabs.
    const { coupon, affiliateLink, sparkAds, commissionRate, commissionPaid, clicks, sales, revenue } = body as {
      coupon?: string | null
      affiliateLink?: string | null
      sparkAds?: string | null
      commissionRate?: string | number | null
      commissionPaid?: string | number | null
      clicks?: string | number | null
      sales?: string | number | null
      revenue?: string | number | null
    }

    // Manual performance numbers, for brands not using an affiliate tool.
    // Blank reads as 0; negatives and non-numbers are rejected.
    const parseStat = (value: string | number | null | undefined, integer: boolean) => {
      if (value === undefined) return undefined
      const raw = String(value ?? "").replace(/[$,\s]/g, "")
      const n = raw === "" ? 0 : Number(raw)
      if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) return null
      return n
    }
    const parsedClicks = parseStat(clicks, true)
    const parsedSales = parseStat(sales, true)
    const parsedRevenue = parseStat(revenue, false)
    if (parsedClicks === null || parsedSales === null) {
      return NextResponse.json({ error: "Clicks and sales must be whole positive numbers" }, { status: 400 })
    }
    if (parsedRevenue === null) {
      return NextResponse.json({ error: "Revenue must be a positive number" }, { status: 400 })
    }

    // "$1,250.50" → 1250.5; blank clears it.
    const parseMoney = (value: string | number | null | undefined): number | null | undefined | "invalid" => {
      if (value === undefined) return undefined
      const raw = String(value ?? "").replace(/[$,\s]/g, "")
      if (raw === "") return null
      const n = Number(raw)
      return Number.isFinite(n) && n >= 0 ? n : "invalid"
    }
    const parsedCommissionPaid = parseMoney(commissionPaid)
    const rateMoney = parseMoney(typeof commissionRate === "string" ? commissionRate.replace(/%/g, "") : commissionRate)
    const parsedCommissionRate = typeof rateMoney === "number" && rateMoney > 100 ? "invalid" : rateMoney
    if (parsedCommissionPaid === "invalid") {
      return NextResponse.json({ error: "Commission paid must be a positive number" }, { status: 400 })
    }
    if (parsedCommissionRate === "invalid") {
      return NextResponse.json({ error: "Commission rate must be between 0 and 100" }, { status: 400 })
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
    if (parsedClicks !== undefined) fields.clicks = parsedClicks
    if (parsedSales !== undefined) fields.sales_count = parsedSales
    if (parsedRevenue !== undefined) fields.gmv = parsedRevenue

    const updated = await prisma.attribution.upsert({
      where: { brand_influencer_id: brandInfluencerId },
      update: fields,
      create: {
        brand_id: brandId,
        brand_influencer_id: brandInfluencerId,
        ...fields,
      },
    })

    // Brand Partners keep these on the partner record; others in product_details.
    if (parsedCommissionPaid !== undefined || parsedCommissionRate !== undefined) {
      if (brandInfluencer.partner) {
        await prisma.brandPartner.update({
          where: { id: brandInfluencer.partner.id },
          data: {
            ...(parsedCommissionPaid !== undefined ? { commission_paid: parsedCommissionPaid ?? 0 } : {}),
            ...(parsedCommissionRate !== undefined ? { default_commission: parsedCommissionRate ?? 0 } : {}),
          },
        })
      } else {
        let details: Record<string, unknown> | null = null
        try { details = brandInfluencer.product_details ? JSON.parse(brandInfluencer.product_details) : {} } catch { details = null }
        if (details && typeof details === "object") {
          const d = details
          const setOrClear = (key: string, v: number | null | undefined) => {
            if (v === undefined) return
            if (v === null) delete d[key]
            else d[key] = v
          }
          setOrClear("commissionPaid", parsedCommissionPaid)
          setOrClear("commissionRate", parsedCommissionRate)
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

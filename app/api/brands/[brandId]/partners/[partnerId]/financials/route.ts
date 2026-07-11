import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Re-flattens the Attribution relation back onto the response object so
// consumers keep reading these as top-level fields, exactly as when they
// lived directly on BrandInfluencer.
function flattenAttribution<T extends { attribution?: { affiliate_id: string | null; ref_code: string | null; coupon: string | null; spark_ads: string | null; affiliate_link: string | null; clicks: number; sales_count: number; gmv: unknown } | null }>(
  bi: T
) {
  const { attribution, ...rest } = bi
  return {
    ...rest,
    affiliate_id:   attribution?.affiliate_id   ?? null,
    ref_code:       attribution?.ref_code       ?? null,
    coupon:         attribution?.coupon         ?? null,
    spark_ads:      attribution?.spark_ads      ?? null,
    affiliate_link: attribution?.affiliate_link ?? null,
    clicks:         attribution?.clicks         ?? 0,
    sales_count:    attribution?.sales_count    ?? 0,
    gmv:            attribution?.gmv ? Number(attribution.gmv as any) : 0,
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ brandId: string; partnerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, partnerId } = await context.params
    const body = await req.json()

    const bi = await prisma.brandInfluencer.findFirst({
      where: { id: partnerId, brand_id: brandId },
      select: { id: true, brand_id: true, influencer_id: true },
    })

    if (!bi) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 })
    }

    const {
      on_retainer, retainer_fee, default_commission, tier_override,
      product_cost, fees_paid, commission_paid,
      clicks, sales_count, gmv,
    } = body

    const financialFields = {
      ...(on_retainer         !== undefined ? { on_retainer }         : {}),
      ...(retainer_fee        !== undefined ? { retainer_fee }        : {}),
      ...(default_commission  !== undefined ? { default_commission }  : {}),
      ...(tier_override       !== undefined ? { tier_override }       : {}),
      ...(product_cost        !== undefined ? { product_cost }        : {}),
      ...(fees_paid           !== undefined ? { fees_paid }            : {}),
      ...(commission_paid     !== undefined ? { commission_paid }      : {}),
    }

    const attributionFields = {
      ...(clicks      !== undefined ? { clicks }      : {}),
      ...(sales_count !== undefined ? { sales_count } : {}),
      ...(gmv          !== undefined ? { gmv }          : {}),
    }

    await prisma.brandPartner.upsert({
      where: { brand_influencer_id: bi.id },
      update: financialFields,
      create: {
        brand_id: bi.brand_id,
        influencer_id: bi.influencer_id,
        brand_influencer_id: bi.id,
        ...financialFields,
      },
    })

    if (Object.keys(attributionFields).length > 0) {
      await prisma.attribution.upsert({
        where: { brand_influencer_id: bi.id },
        update: attributionFields,
        create: {
          brand_id: bi.brand_id,
          brand_influencer_id: bi.id,
          ...attributionFields,
        },
      })
    }

    const updated = await prisma.brandInfluencer.findUnique({
      where: { id: partnerId },
      include: {
        influencer: true,
        campaign: { select: { id: true, name: true, status: true } },
        partner: true,
        attribution: true,
      },
    })

    return NextResponse.json({ data: updated ? flattenAttribution(updated) : updated })
  } catch (error) {
    console.error("[PATCH /partners/:id/financials]", error)
    return NextResponse.json({ error: "Failed to update partner financials" }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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

    const fields = {
      ...(on_retainer         !== undefined ? { on_retainer }         : {}),
      ...(retainer_fee        !== undefined ? { retainer_fee }        : {}),
      ...(default_commission  !== undefined ? { default_commission }  : {}),
      ...(tier_override       !== undefined ? { tier_override }       : {}),
      ...(product_cost        !== undefined ? { product_cost }        : {}),
      ...(fees_paid           !== undefined ? { fees_paid }            : {}),
      ...(commission_paid     !== undefined ? { commission_paid }      : {}),
      ...(clicks               !== undefined ? { clicks }               : {}),
      ...(sales_count          !== undefined ? { sales_count }          : {}),
      ...(gmv                  !== undefined ? { gmv }                  : {}),
    }

    await prisma.brandPartner.upsert({
      where: { brand_influencer_id: bi.id },
      update: fields,
      create: {
        brand_id: bi.brand_id,
        influencer_id: bi.influencer_id,
        brand_influencer_id: bi.id,
        ...fields,
      },
    })

    const updated = await prisma.brandInfluencer.findUnique({
      where: { id: partnerId },
      include: {
        influencer: true,
        campaign: { select: { id: true, name: true, status: true } },
        partner: true,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[PATCH /partners/:id/financials]", error)
    return NextResponse.json({ error: "Failed to update partner financials" }, { status: 500 })
  }
}
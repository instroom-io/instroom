// app/api/brands/[brandId]/partners/[partnerId]/route.ts
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ brandId: string; partnerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, partnerId } = await context.params

    const bi = await prisma.brandInfluencer.findFirst({
      where: { id: partnerId, brand_id: brandId },
      include: {
        influencer: true,
        campaign: true,
        partner: true, // ← added: financial/commercial layer (BrandPartner)
        attribution: true,
      },
    })

    if (!bi) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 })
    }

    return NextResponse.json({ data: flattenAttribution(bi) })
  } catch (error) {
    console.error("[GET /partners/:id]", error)
    return NextResponse.json({ error: "Failed to fetch partner" }, { status: 500 })
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

    const { partnerId } = await context.params
    const body = await req.json()

    const {
      campaign_id, contact_status, outreach_method, stage,
      order_status, product_details, shipped_at, delivered_at,
      content_posted, posted_at, post_url, post_caption,
      likes_count, comments_count, engagement_count,
      agreed_rate, currency, deliverables, deadline,
      notes, internal_rating, approval_status, approval_notes,
    } = body

    const updated = await prisma.brandInfluencer.update({
      where: { id: partnerId },
      data: {
        ...(campaign_id      !== undefined ? { campaign_id }      : {}),
        ...(contact_status   !== undefined ? { contact_status }   : {}),
        ...(outreach_method  !== undefined ? { outreach_method }  : {}),
        ...(stage            !== undefined ? { stage }            : {}),
        ...(order_status     !== undefined ? { order_status }     : {}),
        ...(product_details  !== undefined ? { product_details }  : {}),
        ...(shipped_at       !== undefined ? { shipped_at:   new Date(shipped_at) }   : {}),
        ...(delivered_at     !== undefined ? { delivered_at: new Date(delivered_at) } : {}),
        ...(content_posted   !== undefined ? { content_posted }   : {}),
        ...(posted_at        !== undefined ? { posted_at:    new Date(posted_at) }    : {}),
        ...(post_url         !== undefined ? { post_url }         : {}),
        ...(post_caption     !== undefined ? { post_caption }     : {}),
        ...(likes_count      !== undefined ? { likes_count }      : {}),
        ...(comments_count   !== undefined ? { comments_count }   : {}),
        ...(engagement_count !== undefined ? { engagement_count } : {}),
        ...(agreed_rate      !== undefined ? { agreed_rate }      : {}),
        ...(currency         !== undefined ? { currency }         : {}),
        ...(deliverables     !== undefined ? { deliverables }     : {}),
        ...(deadline         !== undefined ? { deadline: new Date(deadline) } : {}),
        ...(notes            !== undefined ? { notes }            : {}),
        ...(internal_rating  !== undefined ? { internal_rating }  : {}),
        ...(approval_status  !== undefined ? { approval_status }  : {}),
        ...(approval_notes   !== undefined ? { approval_notes }   : {}),
      },
      include: {
        influencer: true,
        campaign: { select: { id: true, name: true } },
        partner: true, // ← added: keep financials in the response shape consistent with GET
        attribution: true,
      },
    })

    return NextResponse.json({ data: flattenAttribution(updated) })
  } catch (error) {
    console.error("[PATCH /partners/:id]", error)
    return NextResponse.json({ error: "Failed to update partner" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ brandId: string; partnerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { partnerId } = await context.params

    // BrandPartner row (if any) is cascade-deleted automatically via the
    // brand_influencer_id FK (onDelete: Cascade) — no manual cleanup needed.
    await prisma.brandInfluencer.delete({ where: { id: partnerId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[DELETE /partners/:id]", error)
    return NextResponse.json({ error: "Failed to remove partner" }, { status: 500 })
  }
}
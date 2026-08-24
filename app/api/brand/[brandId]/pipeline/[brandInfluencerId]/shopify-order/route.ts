import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasBrandCapability } from "@/lib/permissions"
import { createShopifyOrderForInfluencer } from "@/lib/shopify-create-order"
import { getShopifyConnection } from "@/lib/shopify-connection"
import type { ShopifyShippingAddress } from "@/lib/shopify"

// Read-only — whether an order already exists for this influencer, and its
// summary. Lets the Post Tracker panel show "already created" instead of a
// blank create form when reopened after the order was placed in an earlier
// session (e.g. once the influencer has progressed to Delivered).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; brandInfluencerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, brandInfluencerId } = await params

    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        OR: [
          { owner_id: session.user.id },
          { members: { some: { user_id: session.user.id } } },
        ],
      },
      select: { id: true },
    })
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const order = await prisma.shopifyOrder.findFirst({
      where: { brand_id: brandId, brand_influencer_id: brandInfluencerId },
      orderBy: { created_at: "desc" },
    })

    if (!order) {
      return NextResponse.json({ order: null })
    }

    const connection = await getShopifyConnection(brandId)
    const raw = order.raw as any
    const lineItem = raw?.line_items?.[0]
    const productPrice = lineItem ? (parseFloat(lineItem.price) * lineItem.quantity).toFixed(2) : null
    // "Product X - Variant Y", for pre-filling the Order tab's Product Details
    // note when it's still empty — never used to overwrite a note someone
    // already wrote.
    const productSummary = lineItem
      ? (lineItem.name as string | undefined) ||
        [lineItem.title, lineItem.variant_title].filter(Boolean).join(" - ") ||
        null
      : null

    return NextResponse.json({
      order: {
        shopifyOrderId: order.shopify_order_id,
        orderNumber: raw?.name ?? (raw?.order_number ? `#${raw.order_number}` : order.shopify_order_id),
        adminUrl: connection ? `https://${connection.shopDomain}/admin/orders/${order.shopify_order_id}` : null,
        productSummary,
        priceBreakdown: {
          productPrice,
          discountCode: order.discount_code,
          discountAmount: null,
          total: raw?.total_price ?? null,
        },
      },
    })
  } catch (error: any) {
    console.error("GET shopify-order error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to load Shopify order" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; brandInfluencerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, brandInfluencerId } = await params

    // Same auth requirement as the manual closed/[id] status PATCH — order
    // creation moves real money/inventory, so it needs the same capability.
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        OR: [
          { owner_id: session.user.id },
          { members: { some: { user_id: session.user.id } } },
        ],
      },
      select: { id: true },
    })
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!(await hasBrandCapability(brandId, session.user.id, "approveInfluencers"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { variantId, quantity, shippingAddress } = body as {
      variantId?: string | number
      quantity?: number
      shippingAddress?: ShopifyShippingAddress
    }

    if (!variantId) {
      return NextResponse.json({ error: "variantId is required" }, { status: 400 })
    }
    if (!shippingAddress?.address1 || !shippingAddress?.city || !shippingAddress?.zip || !shippingAddress?.country) {
      return NextResponse.json({ error: "A complete shipping address is required" }, { status: 400 })
    }

    const result = await createShopifyOrderForInfluencer({
      brandId,
      brandInfluencerId,
      variantId,
      quantity: quantity && quantity > 0 ? quantity : 1,
      shippingAddress,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("POST shopify-order error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to create Shopify order" },
      { status: 500 }
    )
  }
}

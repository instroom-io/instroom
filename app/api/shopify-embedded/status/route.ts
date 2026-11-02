import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyShopifySessionToken } from "@/lib/shopify-session-token"
import { getBrandIdByShopDomain, getShopifyConnection } from "@/lib/shopify-connection"
import { ensureShopifyInstallation, idTokenFrom, retryWithFreshIdToken } from "@/lib/shopify-embedded"
import { openOrder } from "@/lib/shopify-orders"

type OrderState = "awaiting" | "in_transit" | "delivered" | "cancelled"

function orderState(order: { fulfillment_status: string | null; shipment_status: string | null; raw: unknown }): OrderState {
  if (openOrder(order.raw)?.cancelled_at) return "cancelled"
  if (order.shipment_status === "delivered") return "delivered"
  if (["fulfilled", "partially_fulfilled", "partial"].includes(order.fulfillment_status ?? "")) return "in_transit"
  return "awaiting"
}

async function orderOverview(brandId: string) {
  const [orders, codeOrders] = await Promise.all([
    prisma.shopifyOrder.findMany({
      where: { brand_id: brandId, source: "instroom" },
      orderBy: { created_at: "desc" },
      take: 500,
      select: {
        shopify_order_id: true,
        fulfillment_status: true,
        shipment_status: true,
        raw: true,
        created_at: true,
        brandInfluencer: { select: { influencer: { select: { handle: true } } } },
      },
    }),
    prisma.shopifyOrder.count({ where: { brand_id: brandId, source: "synced", brand_influencer_id: { not: null } } }),
  ])

  const states = orders.map(orderState)
  const count = (state: OrderState) => states.filter((s) => s === state).length
  return {
    summary: { total: orders.length, awaiting: count("awaiting"), inTransit: count("in_transit"), delivered: count("delivered"), codeOrders },
    recent: orders.slice(0, 5).map((o, i) => ({
      id: o.shopify_order_id,
      name: openOrder(o.raw)?.name ?? `#${o.shopify_order_id}`,
      influencer: o.brandInfluencer?.influencer.handle ?? null,
      state: states[i],
      createdAt: o.created_at.toISOString(),
    })),
  }
}

// Auth: App Bridge ID token (no login cookie inside Shopify's iframe).
export async function GET(req: NextRequest) {
  const idToken = idTokenFrom(req)
  const verified = idToken ? verifyShopifySessionToken(idToken) : null
  if (!idToken || !verified) return retryWithFreshIdToken()

  const brandId = await getBrandIdByShopDomain(verified.shop)
  const connection = brandId ? await getShopifyConnection(brandId) : null
  if (brandId && connection && connection.shopDomain === verified.shop) {
    const [brand, overview] = await Promise.all([
      prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } }),
      orderOverview(brandId),
    ])
    return NextResponse.json({
      connected: true,
      brandId,
      brandName: brand?.name ?? null,
      storeName: connection.storeName,
      lastOrderSyncAt: connection.lastOrderSyncAt?.toISOString() ?? null,
      ...overview,
    })
  }

  // Not linked yet: get access now, before any UI.
  const installed = await ensureShopifyInstallation(verified.shop, idToken)
  if (installed !== "ok") return installed

  return NextResponse.json({ connected: false })
}

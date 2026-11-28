import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyShopifySessionToken } from "@/lib/shopify-session-token"
import { getBrandIdByShopDomain, getShopifyConnection } from "@/lib/shopify-connection"
import { ensureShopifyInstallation, idTokenFrom, retryWithFreshIdToken } from "@/lib/shopify-embedded"
import { openOrder } from "@/lib/shopify-orders"
import { markShopifyBilled, shopifyPlanSelectionUrl, syncShopifyBillingForShop } from "@/lib/shopify-billing"

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

/** The store's plan, synced from Shopify; falls back to the stored plan on API failure. */
async function storePlan(shop: string, ownerId: string | null, planHandle: string | null) {
  try {
    const synced = await syncShopifyBillingForShop(shop, planHandle)
    if (!synced && ownerId) await markShopifyBilled(ownerId, shop)
  } catch (error) {
    console.error("[shopify-embedded] plan sync failed", error)
  }

  const select = {
    billing_cycle: true,
    current_period_end: true,
    plan: { select: { name: true, display_name: true } },
  } as const
  const sub = await prisma.userSubscription.findFirst({
    where: { shopify_shop_domain: shop, billing_provider: "shopify" },
    select,
  })
  if (sub) {
    return {
      plan: { name: sub.plan.name, displayName: sub.plan.display_name, cycle: sub.billing_cycle },
      manageUrl: shopifyPlanSelectionUrl(shop),
    }
  }

  // Owner still on an Instroom-paid plan: no Shopify upgrade, to avoid double billing.
  const ownerSub = ownerId ? await prisma.userSubscription.findUnique({ where: { user_id: ownerId }, select }) : null
  if (ownerSub && ownerSub.plan.name !== "basic") {
    return {
      plan: { name: ownerSub.plan.name, displayName: ownerSub.plan.display_name, cycle: ownerSub.billing_cycle },
      manageUrl: null,
      billedByInstroomUntil: ownerSub.current_period_end?.toISOString() ?? null,
    }
  }
  return { plan: null, manageUrl: shopifyPlanSelectionUrl(shop) }
}

// Auth: App Bridge ID token (no login cookie inside Shopify's iframe).
export async function GET(req: NextRequest) {
  const idToken = idTokenFrom(req)
  const verified = idToken ? verifyShopifySessionToken(idToken) : null
  if (!idToken || !verified) return retryWithFreshIdToken()

  const planHandle = req.nextUrl.searchParams.get("plan_handle")

  const brandId = await getBrandIdByShopDomain(verified.shop)
  const connection = brandId ? await getShopifyConnection(brandId) : null
  if (brandId && connection && connection.shopDomain === verified.shop) {
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true, owner_id: true } })
    const [overview, billing] = await Promise.all([
      orderOverview(brandId),
      storePlan(verified.shop, brand?.owner_id ?? null, planHandle),
    ])
    return NextResponse.json({
      connected: true,
      brandId,
      brandName: brand?.name ?? null,
      storeName: connection.storeName,
      lastOrderSyncAt: connection.lastOrderSyncAt?.toISOString() ?? null,
      ...overview,
      ...billing,
    })
  }

  // Not linked yet: get access now, before any UI.
  const installed = await ensureShopifyInstallation(verified.shop, idToken)
  if (installed !== "ok") return installed

  return NextResponse.json({ connected: false, ...(await storePlan(verified.shop, null, planHandle)) })
}

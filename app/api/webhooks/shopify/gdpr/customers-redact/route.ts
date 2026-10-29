import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyShopifyWebhook } from "@/lib/shopify-oauth"
import { getBrandIdByShopDomain } from "@/lib/shopify-connection"
import { openOrder, sealOrder } from "@/lib/shopify-orders"

// GDPR customers/redact: re-saves older full copies in minimal form.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifyShopifyWebhook(rawBody, req.headers.get("x-shopify-hmac-sha256"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error("[Shopify GDPR webhook] malformed JSON body", { bytes: rawBody.length })
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const shopDomain = payload?.shop_domain as string | undefined
  if (!shopDomain) {
    console.error("[Shopify GDPR webhook] customers/redact missing shop_domain")
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const brandId = await getBrandIdByShopDomain(shopDomain)
  const ordersToRedact: number[] = Array.isArray(payload?.orders_to_redact) ? payload.orders_to_redact : []

  if (brandId && ordersToRedact.length > 0) {
    const orders = await prisma.shopifyOrder.findMany({
      where: { brand_id: brandId, shopify_order_id: { in: ordersToRedact.map(String) } },
    })

    for (const order of orders) {
      await prisma.shopifyOrder.update({
        where: { id: order.id },
        data: { raw: sealOrder(openOrder(order.raw) ?? {}) },
      })
    }
  }

  await prisma.shopifyComplianceRequest.create({
    data: {
      brand_id: brandId,
      shop_domain: shopDomain,
      request_type: "customers_redact",
      shopify_customer_id: payload?.customer?.id ? String(payload.customer.id) : null,
      order_ids: ordersToRedact.map(String),
      payload,
      resolved_at: new Date(),
    },
  })

  return NextResponse.json({ received: true }, { status: 200 })
}

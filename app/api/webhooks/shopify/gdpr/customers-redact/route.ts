import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getShopifyWebhookSecret } from "@/lib/shopify-oauth"
import { getBrandIdByShopDomain } from "@/lib/shopify-connection"
import { redactOrderPII } from "@/lib/shopify-orders"

const HEADER_NAME = "x-shopify-hmac-sha256"

function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64")
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// Shopify's mandatory GDPR compliance webhook: a customer's personal data
// must be deleted within 30 days. The ShopifyOrder rows themselves stay —
// order history and influencer-attribution linkage are the app's own data,
// not the customer's — only the PII inside each matching order's raw
// payload is scrubbed.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get(HEADER_NAME)

  if (!signature || !verifySignature(rawBody, signature, getShopifyWebhookSecret())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error("[Shopify GDPR webhook] malformed JSON body", rawBody.slice(0, 500))
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const shopDomain = payload?.shop_domain as string | undefined
  if (!shopDomain) {
    console.error("[Shopify GDPR webhook] customers/redact missing shop_domain", payload)
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
        data: { raw: redactOrderPII(order.raw) as any },
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

import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getShopifyWebhookSecret } from "@/lib/shopify-oauth"
import { getBrandIdByShopDomain } from "@/lib/shopify-connection"

const HEADER_NAME = "x-shopify-hmac-sha256"

function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64")
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// Shopify's mandatory GDPR compliance webhook: a customer (or the merchant on
// their behalf) has requested a copy of the data this app holds about them.
// This app doesn't send the data back automatically — the 30-day legal
// deadline for actually fulfilling the request is a merchant/business
// process, not something this endpoint can complete synchronously. Its job
// is only to record the request durably so it doesn't get missed, by
// resolving which orders (if any) this app has stored for the customer.
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
    console.error("[Shopify GDPR webhook] customers/data_request missing shop_domain", payload)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const brandId = await getBrandIdByShopDomain(shopDomain)
  const ordersRequested: number[] = Array.isArray(payload?.orders_requested) ? payload.orders_requested : []

  const matchedOrders = brandId
    ? await prisma.shopifyOrder.findMany({
        where: {
          brand_id: brandId,
          shopify_order_id: { in: ordersRequested.map(String) },
        },
        select: { shopify_order_id: true },
      })
    : []

  await prisma.shopifyComplianceRequest.create({
    data: {
      brand_id: brandId,
      shop_domain: shopDomain,
      request_type: "customers_data_request",
      shopify_customer_id: payload?.customer?.id ? String(payload.customer.id) : null,
      order_ids: matchedOrders.map((o) => o.shopify_order_id),
      payload,
    },
  })

  return NextResponse.json({ received: true }, { status: 200 })
}

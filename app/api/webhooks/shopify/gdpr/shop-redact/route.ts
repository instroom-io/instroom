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

function safeParse(value: string | null) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

// Shopify's mandatory GDPR compliance webhook: fires 48 hours after a
// merchant uninstalls, mandating a real purge — unlike the manual
// "Disconnect" flow (app/api/settings/integrations/disconnect/route.ts),
// which only flips connected:false and deliberately keeps order history for
// reconnection, this is a genuine hard delete since the merchant is gone
// for good.
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
    console.error("[Shopify GDPR webhook] shop/redact missing shop_domain", payload)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const brandId = await getBrandIdByShopDomain(shopDomain)

  if (brandId) {
    await prisma.shopifyOrder.deleteMany({ where: { brand_id: brandId } })

    // Shipping addresses (customer PII) get copied onto product_details when
    // an order is pushed from Post Tracker — that's this shop's customer
    // data too, living outside ShopifyOrder, so it needs the same purge.
    const brandInfluencers = await prisma.brandInfluencer.findMany({
      where: { brand_id: brandId, product_details: { not: null } },
      select: { id: true, product_details: true },
    })

    for (const bi of brandInfluencers) {
      const details = safeParse(bi.product_details)
      if (!("shippingAddress" in details) && !("variantId" in details)) continue
      delete details.shippingAddress
      delete details.variantId
      await prisma.brandInfluencer.update({
        where: { id: bi.id },
        data: { product_details: JSON.stringify(details) },
      })
    }

    await prisma.integrationConnection.deleteMany({
      where: { brand_id: brandId, integration_key: "shopify" },
    })
  }

  await prisma.shopifyComplianceRequest.create({
    data: {
      brand_id: brandId,
      shop_domain: shopDomain,
      request_type: "shop_redact",
      payload,
      resolved_at: new Date(),
    },
  })

  return NextResponse.json({ received: true }, { status: 200 })
}

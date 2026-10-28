import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyShopifyWebhook } from "@/lib/shopify-oauth"
import { getBrandIdByShopDomain } from "@/lib/shopify-connection"
import { deletePendingInstallation } from "@/lib/shopify-installation"

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
    console.error("[Shopify GDPR webhook] shop/redact missing shop_domain")
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const brandId = await getBrandIdByShopDomain(shopDomain)
  await deletePendingInstallation(shopDomain)

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

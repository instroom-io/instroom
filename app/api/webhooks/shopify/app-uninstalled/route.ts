import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyShopifyWebhook, isValidShopDomain } from "@/lib/shopify-oauth"

// Keeps shopDomain so the GDPR shop/redact 48 hours later still finds the brand.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifyShopifyWebhook(rawBody, req.headers.get("x-shopify-hmac-sha256"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const shop = req.headers.get("x-shopify-shop-domain")
  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const connections = await prisma.integrationConnection.findMany({
    where: { integration_key: "shopify", connected: true, config: { path: "$.shopDomain", equals: shop } },
    select: { id: true },
  })

  const now = new Date().toISOString()
  for (const c of connections) {
    await prisma.integrationConnection.update({
      where: { id: c.id },
      data: { connected: false, connected_as: null, config: { shopDomain: shop, disconnectedAt: now, uninstalledAt: now } },
    })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}

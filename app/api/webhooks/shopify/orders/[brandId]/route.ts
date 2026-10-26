import { NextRequest, NextResponse } from "next/server"
import { getShopifyConnection } from "@/lib/shopify-connection"
import { verifyShopifyWebhook } from "@/lib/shopify-oauth"
import { syncShopifyOrder } from "@/lib/shopify-orders"

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params

  const rawBody = await req.text()
  if (!verifyShopifyWebhook(rawBody, req.headers.get("x-shopify-hmac-sha256"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const connection = await getShopifyConnection(brandId)
  if (!connection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Ignore stores previously connected to this brand.
  const shop = req.headers.get("x-shopify-shop-domain")
  if (shop !== connection.shopDomain) {
    console.warn("[Shopify webhook] ignored order from a store not connected to this brand", { brandId, shop })
    return NextResponse.json({ received: true, ignored: true }, { status: 200 })
  }

  let order: any
  try {
    order = JSON.parse(rawBody)
  } catch {
    console.error("[Shopify webhook] malformed JSON body", { bytes: rawBody.length })
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (!order || order.id === undefined) {
    console.error("[Shopify webhook] payload missing id", { brandId })
    return NextResponse.json({ received: true }, { status: 200 })
  }

  try {
    const result = await syncShopifyOrder({ brandId, order })
    return NextResponse.json({ received: true, ...result }, { status: 200 })
  } catch (error) {
    console.error("[Shopify webhook] sync failed", error)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}

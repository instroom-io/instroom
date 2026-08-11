import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getShopifyConnection } from "@/lib/shopify-connection"
import { getShopifyWebhookSecret } from "@/lib/shopify-oauth"
import { syncShopifyOrder } from "@/lib/shopify-orders"

const HEADER_NAME = "x-shopify-hmac-sha256"

function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64")
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params

  const connection = await getShopifyConnection(brandId)
  if (!connection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get(HEADER_NAME)

  if (!signature || !verifySignature(rawBody, signature, getShopifyWebhookSecret())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let order: any
  try {
    order = JSON.parse(rawBody)
  } catch {
    console.error("[Shopify webhook] malformed JSON body", rawBody.slice(0, 500))
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (!order || order.id === undefined) {
    console.error("[Shopify webhook] payload missing id", order)
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

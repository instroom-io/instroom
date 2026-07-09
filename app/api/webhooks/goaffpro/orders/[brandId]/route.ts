import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getGoAffProConnection } from "@/lib/goaffpro-connection"
import { syncGoAffProOrder } from "@/lib/goaffpro-orders"

// GoAffPro's exact signature header/algorithm is unconfirmed (no brand has
// upgraded to a plan with webhooks yet) — defaulting to the common
// Shopify-style convention. Confirm against a real payload (GoAffPro's admin
// panel has a "View sample payloads" link) once a brand upgrades, and adjust
// HEADER_NAME/verifySignature below if it differs.
const HEADER_NAME = "x-goaffpro-hmac-sha256"

function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64")
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params

  const connection = await getGoAffProConnection(brandId)
  if (!connection?.webhookSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get(HEADER_NAME)

  if (!signature || !verifySignature(rawBody, signature, connection.webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error("[GoAffPro webhook] malformed JSON body", rawBody.slice(0, 500))
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const order = payload?.order ?? payload?.data ?? payload

  if (!order || order.id === undefined || order.affiliate_id === undefined) {
    console.error("[GoAffPro webhook] payload missing id/affiliate_id", payload)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  try {
    const result = await syncGoAffProOrder({ brandId, order })
    return NextResponse.json({ received: true, ...result }, { status: 200 })
  } catch (error) {
    console.error("[GoAffPro webhook] sync failed", error)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}

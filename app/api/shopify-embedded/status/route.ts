import { NextRequest, NextResponse } from "next/server"
import { verifyShopifySessionToken } from "@/lib/shopify-session-token"
import { getBrandIdByShopDomain, getShopifyConnection } from "@/lib/shopify-connection"

// Backs the embedded panel Shopify iframes into its own admin — authenticated
// via the session token App Bridge hands the page client-side (there's no
// NextAuth cookie in that context), not the usual getServerSession pattern
// every other route in this app uses.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null
  if (!token) {
    return NextResponse.json({ error: "Missing session token" }, { status: 401 })
  }

  const verified = verifyShopifySessionToken(token)
  if (!verified) {
    return NextResponse.json({ error: "Invalid session token" }, { status: 401 })
  }

  const brandId = await getBrandIdByShopDomain(verified.shop)
  if (!brandId) {
    return NextResponse.json({ connected: false })
  }

  const connection = await getShopifyConnection(brandId)
  if (!connection) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    brandId,
    storeName: connection.storeName,
    lastOrderSyncAt: connection.lastOrderSyncAt?.toISOString() ?? null,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { verifyShopifySessionToken } from "@/lib/shopify-session-token"
import { getBrandIdByShopDomain, getShopifyConnection } from "@/lib/shopify-connection"
import { ensureShopifyInstallation, idTokenFrom, retryWithFreshIdToken } from "@/lib/shopify-embedded"

// Auth: App Bridge ID token (no login cookie inside Shopify's iframe).
export async function GET(req: NextRequest) {
  const idToken = idTokenFrom(req)
  const verified = idToken ? verifyShopifySessionToken(idToken) : null
  if (!idToken || !verified) return retryWithFreshIdToken()

  const brandId = await getBrandIdByShopDomain(verified.shop)
  const connection = brandId ? await getShopifyConnection(brandId) : null
  if (connection && connection.shopDomain === verified.shop) {
    return NextResponse.json({
      connected: true,
      brandId,
      storeName: connection.storeName,
      lastOrderSyncAt: connection.lastOrderSyncAt?.toISOString() ?? null,
    })
  }

  // Not linked yet: get access now, before any UI.
  const installed = await ensureShopifyInstallation(verified.shop, idToken)
  if (installed !== "ok") return installed

  return NextResponse.json({ connected: false })
}

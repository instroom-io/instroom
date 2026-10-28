import { NextRequest, NextResponse } from "next/server"
import { exchangeShopifyIdToken, missingShopifyScopes } from "@/lib/shopify-oauth"
import { getPendingInstallationTokens, savePendingInstallation } from "@/lib/shopify-installation"

export function idTokenFrom(req: NextRequest) {
  const header = req.headers.get("authorization")
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null
}

/** Asks App Bridge to retry with a fresh ID token. */
export function retryWithFreshIdToken() {
  return NextResponse.json(
    { error: "Invalid session token" },
    { status: 401, headers: { "X-Shopify-Retry-Invalid-Session-Request": "1" } }
  )
}

/** Exchanges the ID token if this store has no usable tokens. */
export async function ensureShopifyInstallation(shop: string, idToken: string): Promise<"ok" | NextResponse> {
  if (await getPendingInstallationTokens(shop)) return "ok"

  const exchanged = await exchangeShopifyIdToken(shop, idToken)
  if (!exchanged.ok) {
    if (exchanged.reason === "invalid_id_token") return retryWithFreshIdToken()
    return NextResponse.json({ error: "Couldn't get access from Shopify. Please try again." }, { status: 502 })
  }
  const missing = missingShopifyScopes(exchanged.grantedScope)
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing Shopify permissions: ${missing.join(", ")}` }, { status: 403 })
  }
  await savePendingInstallation(shop, exchanged.tokens)
  return "ok"
}

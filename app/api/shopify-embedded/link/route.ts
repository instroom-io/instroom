import { NextRequest, NextResponse } from "next/server"
import { verifyShopifySessionToken } from "@/lib/shopify-session-token"
import { createShopifyLinkTicket } from "@/lib/shopify-oauth"
import { ensureShopifyInstallation, idTokenFrom, retryWithFreshIdToken } from "@/lib/shopify-embedded"

export async function POST(req: NextRequest) {
  const idToken = idTokenFrom(req)
  const verified = idToken ? verifyShopifySessionToken(idToken) : null
  if (!idToken || !verified) return retryWithFreshIdToken()

  const installed = await ensureShopifyInstallation(verified.shop, idToken)
  if (installed !== "ok") return installed

  const url = new URL("/dashboard/settings/integrations/shopify-link", new URL(req.url).origin)
  url.searchParams.set("ticket", createShopifyLinkTicket(verified.shop))
  return NextResponse.json({ url: url.toString() })
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  verifyShopifyOAuthCallback,
  decodeShopifyState,
  exchangeShopifyCodeForToken,
  missingShopifyScopes,
  isValidShopDomain,
  SHOPIFY_NONCE_COOKIE,
  type ShopifyTokens,
} from "@/lib/shopify-oauth"
import { connectShopToBrand, shopifyLinkProblem } from "@/lib/shopify-installation"

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)

  // Nonce cookie is single-use.
  function redirect(url: URL) {
    const res = NextResponse.redirect(url)
    res.cookies.set(SHOPIFY_NONCE_COOKIE, "", { path: "/api/settings/integrations/shopify", maxAge: 0 })
    return res
  }

  function fail(reason: string) {
    const url = new URL("/dashboard/settings/integrations", origin)
    url.searchParams.set("shopify_error", reason)
    return redirect(url)
  }

  const shop = searchParams.get("shop")
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  if (!shop || !code || !state || !isValidShopDomain(shop)) {
    return fail("Invalid callback request")
  }

  if (!verifyShopifyOAuthCallback(searchParams)) {
    console.error("[Shopify OAuth callback] HMAC verification failed", { shop })
    return fail("Invalid signature")
  }

  const decoded = decodeShopifyState(state, shop, req.cookies.get(SHOPIFY_NONCE_COOKIE)?.value)
  if (!decoded) {
    return fail("Invalid or expired state — please try connecting again")
  }
  const { brandId } = decoded

  const session = await getServerSession(authOptions)
  if (session?.user?.id !== decoded.userId) {
    return fail("Please sign in with the account that started the connection and try again")
  }
  const brand = await prisma.brand.findFirst({ where: { id: brandId, owner_id: decoded.userId }, select: { id: true } })
  if (!brand) {
    return fail("Brand not found")
  }

  const problem = await shopifyLinkProblem(shop, brandId)
  if (problem) {
    return fail(problem)
  }

  let tokens: ShopifyTokens
  let grantedScope: string
  try {
    ({ grantedScope, ...tokens } = await exchangeShopifyCodeForToken(shop, code))
  } catch (error) {
    console.error("[Shopify OAuth callback] token exchange failed", error)
    return fail("Failed to complete Shopify authorization")
  }

  const missing = missingShopifyScopes(grantedScope)
  if (missing.length > 0) {
    console.error("[Shopify OAuth callback] missing scopes", { shop, missing })
    return fail(`Shopify didn't grant all the permissions Instroom needs (${missing.join(", ")}). Please try connecting again and approve all permissions.`)
  }

  await connectShopToBrand({ brandId, shop, tokens, origin })

  const successUrl = new URL("/dashboard/settings/integrations", origin)
  successUrl.searchParams.set("brandId", brandId)
  successUrl.searchParams.set("shopify", "connected")
  return redirect(successUrl)
}

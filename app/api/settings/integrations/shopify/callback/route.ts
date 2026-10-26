import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/crypto"
import {
  verifyShopifyOAuthCallback,
  decodeShopifyState,
  exchangeShopifyCodeForToken,
  missingShopifyScopes,
  isValidShopDomain,
  SHOPIFY_NONCE_COOKIE,
} from "@/lib/shopify-oauth"
import { getShopifyShopInfo, createShopifyWebhook } from "@/lib/shopify"

const SHOPIFY_KEY = "shopify"

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

  // One store per brand: webhooks and GDPR requests identify stores by domain.
  const otherBrand = await prisma.integrationConnection.findFirst({
    where: {
      integration_key: SHOPIFY_KEY,
      connected: true,
      brand_id: { not: brandId },
      config: { path: "$.shopDomain", equals: shop },
    },
    select: { brand_id: true },
  })
  if (otherBrand) {
    return fail("This Shopify store is already connected to another brand")
  }

  let accessToken: string
  let grantedScope: string
  try {
    ({ accessToken, grantedScope } = await exchangeShopifyCodeForToken(shop, code))
  } catch (error) {
    console.error("[Shopify OAuth callback] token exchange failed", error)
    return fail("Failed to complete Shopify authorization")
  }

  const missing = missingShopifyScopes(grantedScope)
  if (missing.length > 0) {
    console.error("[Shopify OAuth callback] missing scopes", { shop, missing })
    return fail(`Shopify didn't grant all the permissions Instroom needs (${missing.join(", ")}). Please try connecting again and approve all permissions.`)
  }

  let storeName: string | null = null
  try {
    const info = await getShopifyShopInfo(shop, accessToken)
    storeName = info.storeName
  } catch (error) {
    console.error("[Shopify OAuth callback] failed to fetch shop info", error)
  }

  const config = {
    shopDomain: shop,
    accessTokenEncrypted: encrypt(accessToken),
    storeName,
    verifiedAt: new Date().toISOString(),
  }

  await prisma.integrationConnection.upsert({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: SHOPIFY_KEY } },
    create: { brand_id: brandId, integration_key: SHOPIFY_KEY, connected: true, connected_as: storeName ?? "Shopify", config },
    update: { connected: true, connected_as: storeName ?? "Shopify", config },
  })

  const webhookAddress = `${origin}/api/webhooks/shopify/orders/${brandId}`
  await Promise.all([
    createShopifyWebhook(shop, accessToken, "orders/create", webhookAddress),
    createShopifyWebhook(shop, accessToken, "orders/updated", webhookAddress),
    createShopifyWebhook(shop, accessToken, "app/uninstalled", `${origin}/api/webhooks/shopify/app-uninstalled`),
  ])

  const successUrl = new URL("/dashboard/settings/integrations", origin)
  successUrl.searchParams.set("brandId", brandId)
  successUrl.searchParams.set("shopify", "connected")
  return redirect(successUrl)
}

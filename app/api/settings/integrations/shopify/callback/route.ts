import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/crypto"
import {
  verifyShopifyOAuthCallback,
  decodeShopifyState,
  exchangeShopifyCodeForToken,
  isValidShopDomain,
} from "@/lib/shopify-oauth"
import { getShopifyShopInfo, createShopifyWebhook } from "@/lib/shopify"

const SHOPIFY_KEY = "shopify"

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)

  function fail(reason: string) {
    const url = new URL("/dashboard/settings/integrations", origin)
    url.searchParams.set("shopify_error", reason)
    return NextResponse.redirect(url)
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

  const decoded = decodeShopifyState(state)
  if (!decoded) {
    return fail("Invalid or expired state — please try connecting again")
  }
  const { brandId } = decoded

  let accessToken: string
  try {
    accessToken = await exchangeShopifyCodeForToken(shop, code)
  } catch (error) {
    console.error("[Shopify OAuth callback] token exchange failed", error)
    return fail("Failed to complete Shopify authorization")
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
  ])

  const successUrl = new URL("/dashboard/settings/integrations", origin)
  successUrl.searchParams.set("brandId", brandId)
  successUrl.searchParams.set("shopify", "connected")
  return NextResponse.redirect(successUrl)
}

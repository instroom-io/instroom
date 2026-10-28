import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"
import { refreshShopifyToken, type ShopifyTokens } from "@/lib/shopify-oauth"
import { shopifyTokenConfig } from "@/lib/shopify-connection"
import { getShopifyShopInfo, createShopifyWebhook } from "@/lib/shopify"

const SHOPIFY_KEY = "shopify"

export async function savePendingInstallation(shop: string, tokens: ShopifyTokens) {
  const config = shopifyTokenConfig(tokens)
  await prisma.shopifyInstallation.upsert({
    where: { shop_domain: shop },
    create: { shop_domain: shop, config },
    update: { config },
  })
}

export async function deletePendingInstallation(shop: string) {
  await prisma.shopifyInstallation.deleteMany({ where: { shop_domain: shop } })
}

/** Refreshed if expired; null if unusable. */
export async function getPendingInstallationTokens(shop: string): Promise<ShopifyTokens | null> {
  const row = await prisma.shopifyInstallation.findUnique({ where: { shop_domain: shop } })
  if (!row) return null
  const config = row.config as Record<string, string | null>
  if (!config.accessTokenEncrypted) return null

  const tokens: ShopifyTokens = {
    accessToken: decrypt(config.accessTokenEncrypted),
    refreshToken: config.refreshTokenEncrypted ? decrypt(config.refreshTokenEncrypted) : null,
    accessTokenExpiresAt: config.accessTokenExpiresAt ? new Date(config.accessTokenExpiresAt) : null,
    refreshTokenExpiresAt: config.refreshTokenExpiresAt ? new Date(config.refreshTokenExpiresAt) : null,
  }
  if (!tokens.accessTokenExpiresAt || tokens.accessTokenExpiresAt.getTime() - Date.now() > 5 * 60 * 1000) return tokens

  if (!tokens.refreshToken) return null
  const result = await refreshShopifyToken(shop, tokens.refreshToken)
  if (!result.ok) {
    if (result.reason === "reauthorize") await deletePendingInstallation(shop)
    return null
  }
  await savePendingInstallation(shop, result.tokens)
  return result.tokens
}

/** null if linkable. One store per brand. */
export async function shopifyLinkProblem(shop: string, brandId: string): Promise<string | null> {
  const [otherBrand, current] = await Promise.all([
    prisma.integrationConnection.findFirst({
      where: { integration_key: SHOPIFY_KEY, connected: true, brand_id: { not: brandId }, config: { path: "$.shopDomain", equals: shop } },
      select: { brand_id: true },
    }),
    prisma.integrationConnection.findUnique({
      where: { brand_id_integration_key: { brand_id: brandId, integration_key: SHOPIFY_KEY } },
      select: { connected: true, config: true },
    }),
  ])
  if (otherBrand) return "This Shopify store is already connected to another brand"
  const currentShop = (current?.config as Record<string, unknown> | null)?.shopDomain
  if (current?.connected && currentShop && currentShop !== shop) {
    return "This brand is already connected to a different Shopify store. Disconnect it first."
  }
  return null
}

export async function connectShopToBrand({ brandId, shop, tokens, origin }: {
  brandId: string
  shop: string
  tokens: ShopifyTokens
  origin: string
}) {
  let storeName: string | null = null
  try {
    storeName = (await getShopifyShopInfo(shop, tokens.accessToken)).storeName
  } catch (error) {
    console.error("[Shopify] failed to fetch shop info", error)
  }

  const config = {
    shopDomain: shop,
    ...shopifyTokenConfig(tokens),
    storeName,
    verifiedAt: new Date().toISOString(),
  }
  await prisma.integrationConnection.upsert({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: SHOPIFY_KEY } },
    create: { brand_id: brandId, integration_key: SHOPIFY_KEY, connected: true, connected_as: storeName ?? "Shopify", config },
    update: { connected: true, connected_as: storeName ?? "Shopify", config },
  })
  await deletePendingInstallation(shop)

  // Fails on localhost: Shopify only delivers to https.
  const ordersAddress = `${origin}/api/webhooks/shopify/orders/${brandId}`
  await Promise.all([
    createShopifyWebhook(shop, tokens.accessToken, "orders/create", ordersAddress),
    createShopifyWebhook(shop, tokens.accessToken, "orders/updated", ordersAddress),
    createShopifyWebhook(shop, tokens.accessToken, "app/uninstalled", `${origin}/api/webhooks/shopify/app-uninstalled`),
  ])

  return { storeName }
}

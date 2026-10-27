import { prisma } from "@/lib/prisma"
import { decrypt, encrypt } from "@/lib/crypto"
import { refreshShopifyToken, type ShopifyTokens } from "@/lib/shopify-oauth"

const SHOPIFY_KEY = "shopify"

export type ShopifyConnection = {
  brandId: string
  shopDomain: string
  accessToken: string
  storeName: string | null
  lastOrderSyncAt: Date | null
}

export function shopifyTokenConfig(tokens: ShopifyTokens) {
  return {
    accessTokenEncrypted: encrypt(tokens.accessToken),
    refreshTokenEncrypted: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt?.toISOString() ?? null,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt?.toISOString() ?? null,
  }
}

// Refresh early so a token never expires mid-request.
const REFRESH_MARGIN_MS = 5 * 60 * 1000

// One refresh per brand at a time.
const refreshing = new Map<string, Promise<string | null>>()

/** Keeps shopDomain for GDPR requests. */
async function markNeedsReconnect(brandId: string, shopDomain: string) {
  await prisma.integrationConnection.update({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: SHOPIFY_KEY } },
    data: {
      connected: false,
      connected_as: null,
      config: { shopDomain, disconnectedAt: new Date().toISOString(), reconnectRequired: true },
    },
  })
}

/** null: the brand must reconnect. */
async function refreshAccessToken(brandId: string, shopDomain: string, config: Record<string, unknown>): Promise<string | null> {
  const refreshTokenEncrypted = config.refreshTokenEncrypted as string | undefined
  if (!refreshTokenEncrypted) {
    await markNeedsReconnect(brandId, shopDomain)
    return null
  }

  const result = await refreshShopifyToken(shopDomain, decrypt(refreshTokenEncrypted))
  if (!result.ok) {
    if (result.reason === "reauthorize") {
      await markNeedsReconnect(brandId, shopDomain)
      return null
    }
    // Shopify busy: the current token works until it expires.
    const expiresAt = config.accessTokenExpiresAt ? new Date(config.accessTokenExpiresAt as string) : null
    if (expiresAt && expiresAt.getTime() > Date.now()) return decrypt(config.accessTokenEncrypted as string)
    throw new Error("Couldn't renew Shopify access. Please try again in a moment.")
  }

  // Both tokens rotate. Re-read config so a concurrent write isn't lost.
  const latest = await prisma.integrationConnection.findUnique({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: SHOPIFY_KEY } },
    select: { config: true },
  })
  const latestConfig = (latest?.config as Record<string, unknown> | null) ?? {}
  await prisma.integrationConnection.update({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: SHOPIFY_KEY } },
    data: { config: { ...latestConfig, ...shopifyTokenConfig(result.tokens) } },
  })
  return result.tokens.accessToken
}

export async function getShopifyConnection(brandId: string): Promise<ShopifyConnection | null> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: SHOPIFY_KEY } },
  })

  if (!connection?.connected) {
    return null
  }

  const config = (connection.config as Record<string, unknown> | null) ?? {}
  const shopDomain = config.shopDomain as string | undefined
  const accessTokenEncrypted = config.accessTokenEncrypted as string | undefined

  if (!shopDomain || !accessTokenEncrypted) {
    return null
  }

  let accessToken = decrypt(accessTokenEncrypted)
  const expiresAt = config.accessTokenExpiresAt ? new Date(config.accessTokenExpiresAt as string) : null
  if (expiresAt && expiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS) {
    let pending = refreshing.get(brandId)
    if (!pending) {
      pending = refreshAccessToken(brandId, shopDomain, config).finally(() => refreshing.delete(brandId))
      refreshing.set(brandId, pending)
    }
    const fresh = await pending
    if (!fresh) return null
    accessToken = fresh
  }

  const lastOrderSyncAt = config.lastOrderSyncAt as string | undefined

  return {
    brandId,
    shopDomain,
    accessToken,
    storeName: (config.storeName as string | undefined) ?? connection.connected_as ?? null,
    lastOrderSyncAt: lastOrderSyncAt ? new Date(lastOrderSyncAt) : null,
  }
}

// Resolves a brand from the shop domain Shopify's compliance webhooks and
// the embedded-app status route identify a shop by — those payloads carry
// no brandId, only the shop's own domain, since Shopify has no concept of
// Instroom's brand model. `config` is a Json column, so this is a JSON-path
// filter rather than a plain equality where clause. A connected brand wins.
export async function getBrandIdByShopDomain(shopDomain: string): Promise<string | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      integration_key: SHOPIFY_KEY,
      config: { path: "$.shopDomain", equals: shopDomain },
    },
    orderBy: [{ connected: "desc" }, { updated_at: "desc" }],
    select: { brand_id: true },
  })
  return connection?.brand_id ?? null
}

export async function listConnectedShopifyBrandIds(): Promise<string[]> {
  const connections = await prisma.integrationConnection.findMany({
    where: { integration_key: SHOPIFY_KEY, connected: true },
    select: { brand_id: true },
  })
  return connections.map((c) => c.brand_id)
}

export async function setShopifyOrderSyncCursor(brandId: string, syncedAt: Date) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: SHOPIFY_KEY } },
  })
  if (!connection) return

  const config = (connection.config as Record<string, unknown> | null) ?? {}
  await prisma.integrationConnection.update({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: SHOPIFY_KEY } },
    data: { config: { ...config, lastOrderSyncAt: syncedAt.toISOString() } },
  })
}

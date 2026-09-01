import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

const SHOPIFY_KEY = "shopify"

export type ShopifyConnection = {
  brandId: string
  shopDomain: string
  accessToken: string
  storeName: string | null
  lastOrderSyncAt: Date | null
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

  const lastOrderSyncAt = config.lastOrderSyncAt as string | undefined

  return {
    brandId,
    shopDomain,
    accessToken: decrypt(accessTokenEncrypted),
    storeName: (config.storeName as string | undefined) ?? connection.connected_as ?? null,
    lastOrderSyncAt: lastOrderSyncAt ? new Date(lastOrderSyncAt) : null,
  }
}

// Resolves a brand from the shop domain Shopify's compliance webhooks and
// the embedded-app status route identify a shop by — those payloads carry
// no brandId, only the shop's own domain, since Shopify has no concept of
// Instroom's brand model. `config` is a Json column, so this is a JSON-path
// filter rather than a plain equality where clause.
export async function getBrandIdByShopDomain(shopDomain: string): Promise<string | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      integration_key: SHOPIFY_KEY,
      config: { path: "$.shopDomain", equals: shopDomain },
    },
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

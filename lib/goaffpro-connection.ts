import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

const GOAFFPRO_KEY = "goaffpro"

export type GoAffProConnection = {
  brandId: string
  accessToken: string
  webhookSecret: string | null
  storeName: string | null
  lastOrderSyncAt: Date | null
}

export async function getGoAffProConnection(brandId: string): Promise<GoAffProConnection | null> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: GOAFFPRO_KEY } },
  })

  if (!connection?.connected) {
    return null
  }

  const config = (connection.config as Record<string, unknown> | null) ?? {}
  const accessTokenEncrypted = config.accessTokenEncrypted as string | undefined

  if (!accessTokenEncrypted) {
    return null
  }

  const webhookSecretEncrypted = config.webhookSecretEncrypted as string | undefined
  const lastOrderSyncAt = config.lastOrderSyncAt as string | undefined

  return {
    brandId,
    accessToken: decrypt(accessTokenEncrypted),
    webhookSecret: webhookSecretEncrypted ? decrypt(webhookSecretEncrypted) : null,
    storeName: (config.storeName as string | undefined) ?? connection.connected_as ?? null,
    lastOrderSyncAt: lastOrderSyncAt ? new Date(lastOrderSyncAt) : null,
  }
}

export async function listConnectedGoAffProBrandIds(): Promise<string[]> {
  const connections = await prisma.integrationConnection.findMany({
    where: { integration_key: GOAFFPRO_KEY, connected: true },
    select: { brand_id: true },
  })
  return connections.map((c) => c.brand_id)
}

export async function setGoAffProOrderSyncCursor(brandId: string, syncedAt: Date) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: GOAFFPRO_KEY } },
  })
  if (!connection) return

  const config = (connection.config as Record<string, unknown> | null) ?? {}
  await prisma.integrationConnection.update({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: GOAFFPRO_KEY } },
    data: { config: { ...config, lastOrderSyncAt: syncedAt.toISOString() } },
  })
}

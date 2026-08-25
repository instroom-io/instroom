import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const GOAFFPRO_KEY = "goaffpro"
const SHOPIFY_KEY = "shopify"

function defaultIntegrations() {
  return {
    goaffpro: { connected: false } as { connected: boolean; connectedAs?: string },
    uppromote: { connected: false },
    shopify: { connected: false } as { connected: boolean; connectedAs?: string },
    woocommerce: { connected: false },
    gdrive: { connected: false },
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get("brandId")

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 })
    }

    const brand = await prisma.brand.findFirst({
      where: { id: brandId, owner_id: session.user.id },
      select: { id: true },
    })

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 })
    }

    const [goaffproSetting, shopifySetting] = await Promise.all([
      prisma.integrationConnection.findUnique({
        where: { brand_id_integration_key: { brand_id: brandId, integration_key: GOAFFPRO_KEY } },
      }),
      prisma.integrationConnection.findUnique({
        where: { brand_id_integration_key: { brand_id: brandId, integration_key: SHOPIFY_KEY } },
      }),
    ])

    let goaffpro = defaultIntegrations().goaffpro
    if (goaffproSetting) {
      goaffpro = {
        connected: goaffproSetting.connected,
        connectedAs: goaffproSetting.connected_as ?? undefined,
      }
    }

    let shopify: {
      connected: boolean
      connectedAs?: string
      unmatchedOrders?: number
      /**
       * Connected AND actually usable.
       *
       * `connected` is the row's own boolean, which is what the Settings page
       * shows. It can be true while the stored config has no credentials — a
       * half-finished install leaves exactly that — and every Shopify request
       * then fails, because getShopifyConnection (lib/shopify-connection.ts)
       * requires shopDomain and accessTokenEncrypted before it returns anything.
       *
       * Callers that are about to CALL Shopify should gate on this instead, so
       * they skip the request rather than making one that cannot succeed. Only
       * the presence of the two fields is checked — nothing is decrypted and no
       * credential value is read here.
       */
      ready?: boolean
    } = defaultIntegrations().shopify
    if (shopifySetting) {
      const config = (shopifySetting.config as Record<string, unknown> | null) ?? {}
      shopify = {
        connected: shopifySetting.connected,
        connectedAs: shopifySetting.connected_as ?? undefined,
        ready:
          shopifySetting.connected &&
          typeof config.shopDomain === "string" &&
          Boolean(config.shopDomain) &&
          typeof config.accessTokenEncrypted === "string" &&
          Boolean(config.accessTokenEncrypted),
      }
      if (shopifySetting.connected) {
        shopify.unmatchedOrders = await prisma.shopifyOrder.count({
          where: { brand_id: brandId, source: "synced", brand_influencer_id: null },
        })
      }
    }

    return NextResponse.json({
      integrations: {
        ...defaultIntegrations(),
        goaffpro,
        shopify,
      },
    })
  } catch (error) {
    console.error("[GET /settings/integrations]", error)
    return NextResponse.json({ error: "Failed to load integrations" }, { status: 500 })
  }
}

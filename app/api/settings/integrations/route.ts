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

    let shopify: { connected: boolean; connectedAs?: string; unmatchedOrders?: number } =
      defaultIntegrations().shopify
    if (shopifySetting) {
      shopify = {
        connected: shopifySetting.connected,
        connectedAs: shopifySetting.connected_as ?? undefined,
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

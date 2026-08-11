import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const GOAFFPRO_KEY = "goaffpro"
const SHOPIFY_KEY = "shopify"
const SUPPORTED_KEYS = [GOAFFPRO_KEY, SHOPIFY_KEY]

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const integrationKey = body?.id as string | undefined
    if (!integrationKey || !SUPPORTED_KEYS.includes(integrationKey)) {
      return NextResponse.json({ error: "Unsupported integration" }, { status: 400 })
    }

    const brandId = body?.brandId as string | undefined

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

    // Soft disconnect — drops the encrypted secrets but keeps order history
    // (GoAffProOrder / ShopifyOrder rows) intact for reconnection later.
    await prisma.integrationConnection.upsert({
      where: { brand_id_integration_key: { brand_id: brandId, integration_key: integrationKey } },
      create: {
        brand_id: brandId,
        integration_key: integrationKey,
        connected: false,
        connected_as: null,
        config: {
          disconnectedAt: new Date().toISOString(),
        },
      },
      update: {
        connected: false,
        connected_as: null,
        config: {
          disconnectedAt: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[POST /settings/integrations/disconnect]", error)
    return NextResponse.json(
      { error: error?.message || "Failed to disconnect integration" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getGoAffProStoreInfo } from "@/lib/goaffpro"
import { encrypt } from "@/lib/crypto"

const GOAFFPRO_KEY = "goaffpro"

async function connectGoAffPro(brandId: string, body: any) {
  const accessToken = body?.accessToken as string | undefined
  const webhookSecret = body?.webhookSecret as string | undefined

  if (!accessToken) {
    return NextResponse.json({ error: "GoAffPro access token is required" }, { status: 400 })
  }

  let storeName: string | null
  try {
    const info = await getGoAffProStoreInfo(accessToken)
    storeName = info.storeName
  } catch {
    return NextResponse.json({ error: "Invalid GoAffPro access token" }, { status: 400 })
  }

  const config = {
    accessTokenEncrypted: encrypt(accessToken),
    ...(webhookSecret ? { webhookSecretEncrypted: encrypt(webhookSecret) } : {}),
    storeName,
    verifiedAt: new Date().toISOString(),
  }

  await prisma.integrationConnection.upsert({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: GOAFFPRO_KEY } },
    create: { brand_id: brandId, integration_key: GOAFFPRO_KEY, connected: true, connected_as: storeName ?? "GoAffPro", config },
    update: { connected: true, connected_as: storeName ?? "GoAffPro", config },
  })

  return NextResponse.json({ success: true, connectedAs: storeName ?? "GoAffPro" })
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
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

    if (body?.id === GOAFFPRO_KEY) {
      return await connectGoAffPro(brandId, body)
    }
    // Shopify connects via OAuth (GET /api/settings/integrations/shopify/install),
    // not this generic paste-a-token endpoint — that flow no longer exists for
    // new Shopify apps as of the Jan 2026 legacy-custom-app shutdown.
    return NextResponse.json({ error: "Unsupported integration" }, { status: 400 })
  } catch (error: any) {
    console.error("[POST /settings/integrations/connect]", error)
    return NextResponse.json(
      { error: error?.message || "Failed to connect integration" },
      { status: 500 }
    )
  }
}

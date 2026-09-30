import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkBrandAccess } from "@/lib/brand-access"
import { getShopifyConnection } from "@/lib/shopify-connection"
import { listShopifyProducts } from "@/lib/shopify"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const connection = await getShopifyConnection(brandId)
    if (!connection) {
      return NextResponse.json({ error: "Shopify is not connected" }, { status: 400 })
    }

    const products = await listShopifyProducts(connection.shopDomain, connection.accessToken)
    return NextResponse.json({ products })
  } catch (error: any) {
    console.error("[GET /brand/[brandId]/integrations/shopify/products]", error)
    return NextResponse.json(
      { error: error?.message || "Failed to load Shopify products" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { decodeShopifyLinkTicket } from "@/lib/shopify-oauth"
import { connectShopToBrand, getPendingInstallationTokens, shopifyLinkProblem } from "@/lib/shopify-installation"

const EXPIRED = "This link has expired. In your Shopify admin, open Apps → Instroom and click Link again."

// Owners only.
async function ownedBrands(userId: string) {
  return prisma.brand.findMany({
    where: { owner_id: userId, is_active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shop = decodeShopifyLinkTicket(req.nextUrl.searchParams.get("ticket") ?? "")
  if (!shop) return NextResponse.json({ error: EXPIRED }, { status: 400 })

  const brands = await ownedBrands(session.user.id)
  // Preselect a previously linked brand (reinstall).
  const previous = await prisma.integrationConnection.findFirst({
    where: {
      integration_key: "shopify",
      brand_id: { in: brands.map((b) => b.id) },
      config: { path: "$.shopDomain", equals: shop },
    },
    orderBy: { updated_at: "desc" },
    select: { brand_id: true },
  })

  return NextResponse.json({ shop, brands, previousBrandId: previous?.brand_id ?? null })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { ticket, brandId } = (await req.json().catch(() => ({}))) as { ticket?: string; brandId?: string }
  const shop = decodeShopifyLinkTicket(ticket ?? "")
  if (!shop) return NextResponse.json({ error: EXPIRED }, { status: 400 })
  if (!brandId) return NextResponse.json({ error: "Choose a brand" }, { status: 400 })

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, owner_id: session.user.id, is_active: true },
    select: { id: true },
  })
  if (!brand) return NextResponse.json({ error: "Only the brand's owner can connect a Shopify store" }, { status: 403 })

  const problem = await shopifyLinkProblem(shop, brandId)
  if (problem) return NextResponse.json({ error: problem }, { status: 409 })

  const tokens = await getPendingInstallationTokens(shop)
  if (!tokens) return NextResponse.json({ error: EXPIRED }, { status: 400 })

  const { storeName } = await connectShopToBrand({ brandId, shop, tokens, origin: req.nextUrl.origin })
  return NextResponse.json({ success: true, brandId, storeName })
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildShopifyInstallUrl, isValidShopDomain } from "@/lib/shopify-oauth"

// GET /api/settings/integrations/shopify/install?brandId=...&shopDomain=...
//
// Full-page redirect (not a fetch call) — the browser needs to follow the
// chain through Shopify's own OAuth consent screen and back to our callback.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", origin))
  }

  const brandId = searchParams.get("brandId")
  const shopDomainRaw = searchParams.get("shopDomain")

  if (!brandId || !shopDomainRaw) {
    return NextResponse.json({ error: "brandId and shopDomain are required" }, { status: 400 })
  }

  const shopDomain = shopDomainRaw.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")
  if (!isValidShopDomain(shopDomain)) {
    return NextResponse.json(
      { error: "Invalid shop domain — expected the form yourstore.myshopify.com" },
      { status: 400 }
    )
  }

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, owner_id: session.user.id },
    select: { id: true },
  })
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  const redirectUri = `${origin}/api/settings/integrations/shopify/callback`
  const installUrl = buildShopifyInstallUrl(shopDomain, redirectUri, brandId)

  return NextResponse.redirect(installUrl)
}

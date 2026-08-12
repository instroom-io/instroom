import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkBrandAccess } from "@/lib/brand-access"
import { syncShopifyOrdersForBrand } from "@/lib/shopify-orders"

// POST /api/settings/integrations/shopify/sync
// Body: { brandId }
//
// On-demand backstop for the Shopify pull-sync. Webhooks are the primary
// path; this exists because the app is on Vercel's Hobby plan, which
// rejects any cron schedule finer than daily (see the header comment on
// app/api/cron/shopify-sync/route.ts) — same fix already used for Post
// Tracker's auto-detection "Check now" button
// (app/api/post-tracker/detection/run/route.ts).
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await req.json()
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await syncShopifyOrdersForBrand(brandId)
    if (!result.success) {
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[POST /settings/integrations/shopify/sync]", error)
    return NextResponse.json(
      { error: error?.message || "Failed to sync Shopify orders" },
      { status: 500 }
    )
  }
}

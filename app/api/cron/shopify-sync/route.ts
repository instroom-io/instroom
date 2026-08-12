import { NextRequest, NextResponse } from "next/server"
import { listConnectedShopifyBrandIds } from "@/lib/shopify-connection"
import { syncShopifyOrdersForBrand } from "@/lib/shopify-orders"

// Background backstop for Shopify order sync (mirrors app/api/cron/goaffpro-sync).
//
// ─── CURRENTLY UNSCHEDULED ───────────────────────────────────────────────────
// Not wired into vercel.json's crons — the Vercel Hobby plan only permits one
// cron invocation per day, at daily-or-coarser granularity (see the header of
// app/api/cron/post-detection/route.ts, which hit this same wall). The real
// backstop today is the on-demand "Sync now" button:
//   POST /api/settings/integrations/shopify/sync (session-authenticated,
//   single brand) — calls the exact same syncShopifyOrdersForBrand() this
//   route calls, just triggered by a click instead of a timer.
// The primary sync path is the webhook (app/api/webhooks/shopify/orders/[brandId]),
// which Shopify retries automatically for up to 48h on failure.
//
// To re-enable on Vercel Pro:
//   1. Add to vercel.json: "crons": [{ "path": "/api/cron/shopify-sync", "schedule": "*/15 * * * *" }]
//   2. Set CRON_SECRET in the Vercel project environment.
// No code change is needed here.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const headerSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const querySecret = searchParams.get("secret")
  const providedSecret = headerSecret || querySecret

  if (!providedSecret || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const brandIds = await listConnectedShopifyBrandIds()
  const results: Record<string, any> = {}

  for (const brandId of brandIds) {
    try {
      results[brandId] = await syncShopifyOrdersForBrand(brandId)
    } catch (error: any) {
      console.error(`[cron/shopify-sync] failed for brand ${brandId}`, error)
      results[brandId] = { error: error?.message || "Sync failed" }
    }
  }

  return NextResponse.json({ success: true, brandsSynced: brandIds.length, results })
}

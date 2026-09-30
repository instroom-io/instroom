import { NextRequest, NextResponse } from "next/server"
import { listConnectedGoAffProBrandIds } from "@/lib/goaffpro-connection"
import { syncGoAffProForBrand } from "@/lib/goaffpro-sync"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const headerSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const querySecret = searchParams.get("secret")
  const providedSecret = headerSecret || querySecret

  if (!providedSecret || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const brandIds = await listConnectedGoAffProBrandIds()
  const results: Record<string, Record<string, number | string>> = {}

  for (const brandId of brandIds) {
    try {
      const result = await syncGoAffProForBrand(brandId)
      results[brandId] = result.success
        ? { ordersSynced: result.ordersSynced, trafficEntries: result.trafficEntries, influencersUpdated: result.influencersUpdated }
        : { error: "No valid connection" }
    } catch (error) {
      console.error(`[cron/goaffpro-sync] failed for brand ${brandId}`, error)
      results[brandId] = { error: (error instanceof Error && error.message) || "Sync failed" }
    }
  }

  return NextResponse.json({ success: true, brandsSynced: brandIds.length, results })
}

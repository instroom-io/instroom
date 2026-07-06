import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { listGoAffProOrders, listGoAffProTraffic } from "@/lib/goaffpro"
import { syncGoAffProOrder } from "@/lib/goaffpro-orders"
import {
  getGoAffProConnection,
  listConnectedGoAffProBrandIds,
  setGoAffProOrderSyncCursor,
} from "@/lib/goaffpro-connection"

type TrackedAffiliate = { id: string; affiliate_id: string }

async function getTrackedAffiliates(brandId: string): Promise<TrackedAffiliate[]> {
  const rows = await prisma.brandInfluencer.findMany({
    where: { brand_id: brandId, affiliate_id: { not: null } },
    select: { id: true, affiliate_id: true },
  })
  return rows as TrackedAffiliate[]
}

async function syncClicksForBrand(
  brandId: string,
  accessToken: string,
  days: number,
  tracked: TrackedAffiliate[]
) {
  const traffic = await listGoAffProTraffic(accessToken, days)

  const clickCounts = new Map<string, number>()
  for (const visit of traffic) {
    if (visit.affiliate_id === null || visit.affiliate_id === undefined || visit.affiliate_id === "") {
      continue
    }
    const affiliateId = String(visit.affiliate_id)
    clickCounts.set(affiliateId, (clickCounts.get(affiliateId) ?? 0) + 1)
  }

  for (const bi of tracked) {
    const clicks = clickCounts.get(bi.affiliate_id) ?? 0
    await prisma.brandInfluencer.update({ where: { id: bi.id }, data: { clicks } })
    await prisma.brandPartner.updateMany({ where: { brand_influencer_id: bi.id }, data: { clicks } })
  }

  return { trafficEntries: traffic.length, influencersUpdated: tracked.length }
}

// Only fetches orders for affiliates we actually track — this store's full
// order history can run into the thousands, most of it unrelated to any
// tracked affiliate, so an unfiltered pull is both slow and mostly wasted.
async function syncOrdersForBrand(
  brandId: string,
  accessToken: string,
  sinceCreatedAt: Date | null,
  tracked: TrackedAffiliate[]
) {
  let ordersSynced = 0

  for (const { affiliate_id } of tracked) {
    const orders = await listGoAffProOrders(accessToken, { sinceCreatedAt, affiliateId: affiliate_id })
    for (const order of orders) {
      await syncGoAffProOrder({ brandId, order })
    }
    ordersSynced += orders.length
  }

  await setGoAffProOrderSyncCursor(brandId, new Date())

  return { ordersSynced }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const headerSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const querySecret = searchParams.get("secret")
  const providedSecret = headerSecret || querySecret

  if (!providedSecret || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const daysParam = Number(searchParams.get("days") ?? "30")
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 3650) : 30

  const brandIds = await listConnectedGoAffProBrandIds()
  const results: Record<string, any> = {}

  for (const brandId of brandIds) {
    try {
      const connection = await getGoAffProConnection(brandId)
      if (!connection) {
        results[brandId] = { error: "No valid connection" }
        continue
      }

      const tracked = await getTrackedAffiliates(brandId)

      if (tracked.length === 0) {
        results[brandId] = { ordersSynced: 0, trafficEntries: 0, influencersUpdated: 0 }
        continue
      }

      const orderResult = await syncOrdersForBrand(brandId, connection.accessToken, connection.lastOrderSyncAt, tracked)
      const clicksResult = await syncClicksForBrand(brandId, connection.accessToken, days, tracked)

      results[brandId] = { ...orderResult, ...clicksResult }
    } catch (error: any) {
      console.error(`[cron/goaffpro-sync] failed for brand ${brandId}`, error)
      results[brandId] = { error: error?.message || "Sync failed" }
    }
  }

  return NextResponse.json({ success: true, brandsSynced: brandIds.length, results })
}

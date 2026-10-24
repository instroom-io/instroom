import { prisma } from "@/lib/prisma"
import { listGoAffProOrders, listGoAffProTraffic } from "@/lib/goaffpro"
import { syncGoAffProOrder } from "@/lib/goaffpro-orders"
import {
  getGoAffProConnection,
  getGoAffProClickSyncState,
  setGoAffProClickSyncState,
  setGoAffProOrderSyncCursor,
} from "@/lib/goaffpro-connection"

type TrackedAffiliate = { id: string; affiliate_id: string }

async function getTrackedAffiliates(brandId: string): Promise<TrackedAffiliate[]> {
  const rows = await prisma.attribution.findMany({
    where: { brand_id: brandId, affiliate_id: { not: null } },
    select: { brand_influencer_id: true, affiliate_id: true },
  })
  return rows.map((r) => ({ id: r.brand_influencer_id, affiliate_id: r.affiliate_id as string }))
}

// All-time running totals; recounts when nothing is counted yet or a new affiliate is linked.
async function syncClicksForBrand(
  brandId: string,
  accessToken: string,
  tracked: TrackedAffiliate[]
) {
  const state = await getGoAffProClickSyncState(brandId)
  const counted = new Set(state.countedAffiliateIds)
  const recount = !state.lastTrafficId || tracked.some((t) => !counted.has(t.affiliate_id))

  const traffic = await listGoAffProTraffic(accessToken, recount ? undefined : state.lastTrafficId ?? undefined)

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
    if (!recount && clicks === 0) continue
    await prisma.attribution.upsert({
      where: { brand_influencer_id: bi.id },
      update: { clicks: recount ? clicks : { increment: clicks } },
      create: { brand_id: brandId, brand_influencer_id: bi.id, affiliate_id: bi.affiliate_id, clicks },
    })
  }

  // Right after the totals, to keep the double-count window small.
  const lastVisit = traffic[traffic.length - 1]
  await setGoAffProClickSyncState(brandId, {
    lastTrafficId: lastVisit?.id ? String(lastVisit.id) : state.lastTrafficId,
    countedAffiliateIds: tracked.map((t) => t.affiliate_id),
  })

  return { trafficEntries: traffic.length, influencersUpdated: tracked.length, recounted: recount }
}

// Tracked affiliates only; the store's full order history is mostly unrelated.
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

export type GoAffProSyncResult =
  | { success: true; ordersSynced: number; trafficEntries: number; influencersUpdated: number; recounted: boolean }
  | { success: false; reason: string }

/** Pulls new orders (→ sales/revenue) and all-time click counts for one brand and saves them. */
export async function syncGoAffProForBrand(brandId: string): Promise<GoAffProSyncResult> {
  const connection = await getGoAffProConnection(brandId)
  if (!connection) return { success: false, reason: "GoAffPro is not connected" }

  const tracked = await getTrackedAffiliates(brandId)
  if (tracked.length === 0) {
    return { success: true, ordersSynced: 0, trafficEntries: 0, influencersUpdated: 0, recounted: false }
  }

  const orderResult = await syncOrdersForBrand(brandId, connection.accessToken, connection.lastOrderSyncAt, tracked)
  const clicksResult = await syncClicksForBrand(brandId, connection.accessToken, tracked)

  return { success: true, ...orderResult, ...clicksResult }
}

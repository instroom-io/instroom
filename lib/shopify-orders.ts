import { prisma } from "@/lib/prisma"
import { decrypt, encrypt } from "@/lib/crypto"
import { getShopifyConnection, setShopifyOrderSyncCursor } from "@/lib/shopify-connection"
import { listShopifyOrders, type ShopifyOrderEntry } from "@/lib/shopify"
import {
  mapClosedToPipelineFields,
  deriveShopifyTargetStatus,
  SHOPIFY_STAGE_RANK,
  type ClosedColumn,
} from "@/lib/post-tracker-status"

// ✅ Safe JSON parse (matches the convention in the manual PATCH route)
function safeParse(value: string | null) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function deriveShipmentStatus(order: ShopifyOrderEntry): string | null {
  const fulfillments = order.fulfillments ?? []
  const last = fulfillments[fulfillments.length - 1]
  return last?.shipment_status ?? null
}

type CouponAttribution = { brand_influencer_id: string; coupon: string | null }

const loadCouponAttributions = (brandId: string): Promise<CouponAttribution[]> =>
  prisma.attribution.findMany({
    where: { brand_id: brandId, coupon: { not: null } },
    select: { brand_influencer_id: true, coupon: true },
  })

async function matchInfluencerByDiscountCode(brandId: string, order: ShopifyOrderEntry, preloaded?: CouponAttribution[]) {
  const codes = (order.discount_codes ?? [])
    .map((dc) => dc.code?.trim().toUpperCase())
    .filter((code): code is string => Boolean(code))

  if (codes.length === 0) {
    return { brandInfluencerId: null, matchedCode: null }
  }

  const attributions = preloaded ?? await loadCouponAttributions(brandId)

  const match = attributions.find((a) => a.coupon && codes.includes(a.coupon.trim().toUpperCase()))

  return {
    brandInfluencerId: match?.brand_influencer_id ?? null,
    matchedCode: match ? codes.find((c) => c === match.coupon?.trim().toUpperCase()) ?? codes[0] : codes[0],
  }
}

export async function syncShopifyOrder(params: { brandId: string; order: ShopifyOrderEntry; attributions?: CouponAttribution[] }) {
  const { brandId, order, attributions } = params
  const orderId = String(order.id)

  const existing = await prisma.shopifyOrder.findUnique({
    where: { brand_id_shopify_order_id: { brand_id: brandId, shopify_order_id: orderId } },
  })

  // Webhooks can arrive out of order.
  const savedUpdatedAt = openOrder(existing?.raw)?.updated_at
  if (savedUpdatedAt && order.updated_at && new Date(order.updated_at) < new Date(savedUpdatedAt)) {
    return { success: true as const, orderId, brandInfluencerId: existing!.brand_influencer_id, skipped: "stale" as const }
  }

  let brandInfluencerId: string | null
  let discountCode: string | null

  if (existing?.source === "instroom") {
    // Link is already known — Instroom created this order, skip matching.
    brandInfluencerId = existing.brand_influencer_id
    discountCode = existing.discount_code
  } else {
    const match = await matchInfluencerByDiscountCode(brandId, order, attributions)
    brandInfluencerId = match.brandInfluencerId
    discountCode = match.matchedCode
  }

  await prisma.shopifyOrder.upsert({
    where: { brand_id_shopify_order_id: { brand_id: brandId, shopify_order_id: orderId } },
    create: {
      brand_id: brandId,
      shopify_order_id: orderId,
      brand_influencer_id: brandInfluencerId,
      discount_code: discountCode,
      source: existing?.source ?? "synced",
      financial_status: order.financial_status ?? null,
      fulfillment_status: order.fulfillment_status ?? null,
      shipment_status: deriveShipmentStatus(order),
      raw: sealOrder(order),
      shopify_created_at: order.created_at ? new Date(order.created_at) : null,
    },
    update: {
      brand_influencer_id: brandInfluencerId,
      discount_code: discountCode,
      financial_status: order.financial_status ?? null,
      fulfillment_status: order.fulfillment_status ?? null,
      shipment_status: deriveShipmentStatus(order),
      raw: sealOrder(order),
    },
  })

  if (!brandInfluencerId) {
    return { success: true as const, orderId, brandInfluencerId: null }
  }

  // Only Instroom's own order moves the card, not customers' coupon orders.
  if (existing?.source !== "instroom") {
    return { success: true as const, orderId, brandInfluencerId, skipped: "customer-order" as const }
  }

  const record = await prisma.brandInfluencer.findUnique({
    where: { id: brandInfluencerId },
    select: {
      shipped_at: true,
      delivered_at: true,
      posted_at: true,
      content_posted: true,
      product_details: true,
    },
  })

  if (!record) {
    return { success: true as const, orderId, brandInfluencerId }
  }

  const productDetails = safeParse(record.product_details)
  const storedStatus = productDetails.closedStatus as ClosedColumn | undefined

  // Override guard — never touch a card a human has moved to a terminal
  // state (Posted / No post), or one whose content is already posted.
  if (storedStatus === "Posted" || storedStatus === "No post" || record.content_posted) {
    return { success: true as const, orderId, brandInfluencerId, skipped: "terminal" as const }
  }

  const target = deriveShopifyTargetStatus(order)
  if (!target) {
    return { success: true as const, orderId, brandInfluencerId, skipped: "no-progress" as const }
  }

  const currentRank = storedStatus && storedStatus in SHOPIFY_STAGE_RANK
    ? SHOPIFY_STAGE_RANK[storedStatus as keyof typeof SHOPIFY_STAGE_RANK]
    : SHOPIFY_STAGE_RANK["For Order Creation"]
  const targetRank = SHOPIFY_STAGE_RANK[target]

  if (targetRank <= currentRank) {
    return { success: true as const, orderId, brandInfluencerId, skipped: "no-forward-progress" as const }
  }

  const mapped = mapClosedToPipelineFields(target, record)
  productDetails.closedStatus = target
  productDetails.lastSyncSource = "shopify"

  await prisma.brandInfluencer.update({
    where: { id: brandInfluencerId },
    data: {
      ...mapped,
      product_details: JSON.stringify(productDetails),
      updated_at: new Date(),
    },
  })

  return { success: true as const, orderId, brandInfluencerId, appliedStatus: target }
}

/** Fields Instroom reads; no buyer personal data. */
export type StoredOrder = {
  id?: string | number
  name?: string
  order_number?: number
  created_at?: string
  updated_at?: string
  cancelled_at?: string | null
  financial_status?: string | null
  fulfillment_status?: string | null
  total_price?: string
  total_discounts?: string
  discount_codes?: { code: string; amount?: string }[]
  fulfillments?: { status?: string | null; shipment_status?: string | null }[]
  line_items?: { price?: string; quantity?: number; name?: string; title?: string; variant_title?: string }[]
}

// Allow-list, so new personal fields are never stored.
function minimizeOrder(order: Record<string, any>): StoredOrder {
  return {
    id: order.id,
    name: order.name,
    order_number: order.order_number,
    created_at: order.created_at,
    updated_at: order.updated_at,
    cancelled_at: order.cancelled_at ?? null,
    financial_status: order.financial_status ?? null,
    fulfillment_status: order.fulfillment_status ?? null,
    total_price: order.total_price,
    total_discounts: order.total_discounts,
    discount_codes: (order.discount_codes ?? []).map((d: { code: string; amount?: string }) => ({ code: d.code, amount: d.amount })),
    fulfillments: (order.fulfillments ?? []).map((f: { status?: string | null; shipment_status?: string | null }) => ({
      status: f.status ?? null,
      shipment_status: f.shipment_status ?? null,
    })),
    line_items: (order.line_items ?? []).slice(0, 1).map((li: Record<string, any>) => ({
      price: li.price,
      quantity: li.quantity,
      name: li.name,
      title: li.title,
      variant_title: li.variant_title,
    })),
  }
}

/** Minimized, then encrypted. */
export function sealOrder(order: object): { enc: string } {
  return { enc: encrypt(JSON.stringify(minimizeOrder(order))) }
}

/** Reads encrypted or older plain rows. */
export function openOrder(raw: unknown): StoredOrder | null {
  if (!raw || typeof raw !== "object") return null
  const enc = (raw as { enc?: unknown }).enc
  if (typeof enc === "string") {
    try {
      return JSON.parse(decrypt(enc)) as StoredOrder
    } catch {
      return null
    }
  }
  return raw as StoredOrder
}

export async function syncShopifyOrdersForBrand(brandId: string) {
  const connection = await getShopifyConnection(brandId)
  if (!connection) {
    return { success: false as const, reason: "Shopify is not connected" }
  }

  const startedAt = new Date()
  const { orders, complete } = await listShopifyOrders(connection.shopDomain, connection.accessToken, {
    updatedAtMin: connection.lastOrderSyncAt,
  })
  const attributions = await loadCouponAttributions(brandId)

  let matched = 0
  let unmatched = 0

  for (const order of orders) {
    const result = await syncShopifyOrder({ brandId, order, attributions })
    if (result.brandInfluencerId) {
      matched += 1
    } else {
      unmatched += 1
    }
  }

  // Stopped early: resume from the last order so none are skipped.
  const lastUpdated = orders.at(-1)?.updated_at
  await setShopifyOrderSyncCursor(brandId, complete || !lastUpdated ? startedAt : new Date(lastUpdated))

  return { success: true as const, ordersSynced: orders.length, matched, unmatched, complete }
}

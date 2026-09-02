import { prisma } from "@/lib/prisma"
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

async function matchInfluencerByDiscountCode(brandId: string, order: ShopifyOrderEntry) {
  const codes = (order.discount_codes ?? [])
    .map((dc) => dc.code?.trim().toUpperCase())
    .filter((code): code is string => Boolean(code))

  if (codes.length === 0) {
    return { brandInfluencerId: null, matchedCode: null }
  }

  const attributions = await prisma.attribution.findMany({
    where: { brand_id: brandId, coupon: { not: null } },
    select: { brand_influencer_id: true, coupon: true },
  })

  const match = attributions.find((a) => a.coupon && codes.includes(a.coupon.trim().toUpperCase()))

  return {
    brandInfluencerId: match?.brand_influencer_id ?? null,
    matchedCode: match ? codes.find((c) => c === match.coupon?.trim().toUpperCase()) ?? codes[0] : codes[0],
  }
}

export async function syncShopifyOrder(params: { brandId: string; order: ShopifyOrderEntry }) {
  const { brandId, order } = params
  const orderId = String(order.id)

  const existing = await prisma.shopifyOrder.findUnique({
    where: { brand_id_shopify_order_id: { brand_id: brandId, shopify_order_id: orderId } },
  })

  let brandInfluencerId: string | null
  let discountCode: string | null

  if (existing?.source === "instroom") {
    // Link is already known — Instroom created this order, skip matching.
    brandInfluencerId = existing.brand_influencer_id
    discountCode = existing.discount_code
  } else {
    const match = await matchInfluencerByDiscountCode(brandId, order)
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
      raw: order as any,
      shopify_created_at: order.created_at ? new Date(order.created_at) : null,
    },
    update: {
      brand_influencer_id: brandInfluencerId,
      discount_code: discountCode,
      financial_status: order.financial_status ?? null,
      fulfillment_status: order.fulfillment_status ?? null,
      shipment_status: deriveShipmentStatus(order),
      raw: order as any,
    },
  })

  if (!brandInfluencerId) {
    return { success: true as const, orderId, brandInfluencerId: null }
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

// Strips customer PII out of a stored order's raw payload for a
// customers/redact GDPR request. `raw` can be either shape this codebase
// produces: a full REST-style webhook push (still carries customer/address/
// IP fields) or the slimmer object lib/shopify.ts's GraphQL functions build
// (which never included these fields to begin with) — deleting a key that
// isn't present is a harmless no-op, so the same field list handles both.
const PII_FIELDS = [
  "customer",
  "email",
  "phone",
  "shipping_address",
  "billing_address",
  "contact_email",
  "client_details", // carries browser_ip
]

export function redactOrderPII(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw
  const redacted: Record<string, unknown> = { ...(raw as Record<string, unknown>) }
  for (const field of PII_FIELDS) {
    delete redacted[field]
  }
  return redacted
}

export async function syncShopifyOrdersForBrand(brandId: string) {
  const connection = await getShopifyConnection(brandId)
  if (!connection) {
    return { success: false as const, reason: "Shopify is not connected" }
  }

  const orders = await listShopifyOrders(connection.shopDomain, connection.accessToken, {
    updatedAtMin: connection.lastOrderSyncAt,
  })

  let matched = 0
  let unmatched = 0

  for (const order of orders) {
    const result = await syncShopifyOrder({ brandId, order })
    if (result.brandInfluencerId) {
      matched += 1
    } else {
      unmatched += 1
    }
  }

  await setShopifyOrderSyncCursor(brandId, new Date())

  return { success: true as const, ordersSynced: orders.length, matched, unmatched }
}

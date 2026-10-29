import { prisma } from "@/lib/prisma"
import { getShopifyConnection } from "@/lib/shopify-connection"
import { openOrder, sealOrder } from "@/lib/shopify-orders"
import { orderProductsOf, type OrderProduct } from "@/lib/pipeline-transitions"
import {
  createShopifyDraftOrder,
  completeShopifyDraftOrder,
  getShopifyDiscountByCode,
  getShopifyOrder,
  findShopifyOrderIdByTag,
  findOpenDraftOrderIdByTag,
  type ShopifyShippingAddress,
  type ShopifyAppliedDiscount,
} from "@/lib/shopify"

export class ShopifyOrderExistsError extends Error {
  constructor(public orderNumber: string, public adminUrl: string) {
    super(`An order was already created for this influencer (${orderNumber})`)
  }
}

function safeParse(value: string | null) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    // Legacy plain-text product details predate this column being used as a
    // JSON store — rescue the original text into the new structure instead of
    // silently discarding it when this order-creation flow re-saves the
    // column (mirrors the same fallback in the closed/[id] PATCH route).
    return { note: value }
  }
}

export async function createShopifyOrderForInfluencer(params: {
  brandId: string
  brandInfluencerId: string
  variantId: string | number
  quantity: number
  shippingAddress: ShopifyShippingAddress
  productName?: string
  /** Confirmed extra order. */
  another?: boolean
}) {
  const { brandId, brandInfluencerId, variantId, quantity, shippingAddress, productName, another } = params

  const connection = await getShopifyConnection(brandId)
  if (!connection) {
    throw new Error("Shopify is not connected for this brand")
  }

  const brandInfluencer = await prisma.brandInfluencer.findFirst({
    where: { id: brandInfluencerId, brand_id: brandId },
    include: { attribution: true, influencer: true },
  })
  if (!brandInfluencer) {
    throw new Error("Influencer not found")
  }

  const productDetails = safeParse(brandInfluencer.product_details)
  const campaignType = productDetails.campaignType as string | undefined
  const coupon = brandInfluencer.attribution?.coupon ?? null

  const { shopDomain, accessToken } = connection

  const saved = await prisma.shopifyOrder.findMany({
    where: { brand_id: brandId, brand_influencer_id: brandInfluencerId, source: "instroom" },
    orderBy: { created_at: "desc" },
    select: { shopify_order_id: true, raw: true },
  })
  if (saved.length > 0 && !another) {
    const latest = saved[0]
    throw new ShopifyOrderExistsError(openOrder(latest.raw)?.name ?? latest.shopify_order_id, `https://${shopDomain}/admin/orders/${latest.shopify_order_id}`)
  }

  // One tag per order, so a retry reuses its failed attempt.
  const tag = saved.length === 0 ? `instroom-${brandInfluencerId}` : `instroom-${brandInfluencerId}-${saved.length + 1}`

  let appliedDiscount: ShopifyAppliedDiscount | undefined
  let discountAmount: string | null = null
  let orderId: string | null = await findShopifyOrderIdByTag(shopDomain, accessToken, tag)
  if (orderId && saved.some(s => s.shopify_order_id === String(orderId))) orderId = null

  if (!orderId) {
    let draftId = await findOpenDraftOrderIdByTag(shopDomain, accessToken, tag)
    if (!draftId) {
      let priceOverride: string | undefined
      if (campaignType === "gifting") {
        priceOverride = "0.00"
      } else if (coupon) {
        const discount = await getShopifyDiscountByCode(shopDomain, accessToken, coupon)
        if (discount) {
          appliedDiscount = { value_type: discount.valueType, value: discount.value, title: coupon }
          discountAmount = discount.value
        }
      }
      const draftOrder = await createShopifyDraftOrder(shopDomain, accessToken, {
        variantId,
        quantity,
        shippingAddress,
        note: `Instroom — ${brandInfluencer.influencer.full_name || brandInfluencer.influencer.handle}`,
        tags: ["instroom", tag],
        priceOverride,
        appliedDiscount,
      })
      draftId = draftOrder.id
    }

    const completed = await completeShopifyDraftOrder(shopDomain, accessToken, draftId)
    if (!completed.order_id) {
      throw new Error("Shopify did not return a completed order")
    }
    orderId = completed.order_id
  }

  const finalOrder = await getShopifyOrder(shopDomain, accessToken, orderId)
  const shopifyOrderId = String(finalOrder.id)

  // The webhook may insert this row concurrently; retry once.
  const save = () => prisma.shopifyOrder.upsert({
    where: { brand_id_shopify_order_id: { brand_id: brandId, shopify_order_id: shopifyOrderId } },
    create: {
      brand_id: brandId,
      shopify_order_id: shopifyOrderId,
      brand_influencer_id: brandInfluencerId,
      discount_code: coupon,
      source: "instroom",
      financial_status: finalOrder.financial_status ?? null,
      fulfillment_status: finalOrder.fulfillment_status ?? null,
      shipment_status: null,
      raw: sealOrder(finalOrder),
      shopify_created_at: finalOrder.created_at ? new Date(finalOrder.created_at) : null,
    },
    update: {
      brand_influencer_id: brandInfluencerId,
      discount_code: coupon,
      source: "instroom",
      financial_status: finalOrder.financial_status ?? null,
      fulfillment_status: finalOrder.fulfillment_status ?? null,
      raw: sealOrder(finalOrder),
    },
  })
  await save().catch((e: { code?: string }) => {
    if (e?.code === "P2002") return save()
    throw e
  })

  productDetails.shippingAddress = shippingAddress
  productDetails.variantId = String(variantId)
  // Cost is entered in the Order tab.
  const name = productName?.trim() || "Shopify product"
  const products = orderProductsOf(productDetails).filter(p => p.name.trim() || p.unitCost != null)
  productDetails.products = [...products, { name, qty: quantity, unitCost: null }]
  productDetails.note = productDetails.products.map((p: OrderProduct) => p.name).filter(Boolean).join("\n")
  await prisma.brandInfluencer.update({
    where: { id: brandInfluencerId },
    data: { product_details: JSON.stringify(productDetails) },
  })

  const lineItem = finalOrder.line_items?.[0]
  const productPrice = lineItem ? (parseFloat(lineItem.price) * lineItem.quantity).toFixed(2) : null

  return {
    success: true as const,
    shopifyOrderId,
    orderNumber: finalOrder.name ?? (finalOrder.order_number ? `#${finalOrder.order_number}` : shopifyOrderId),
    adminUrl: `https://${shopDomain}/admin/orders/${finalOrder.id}`,
    priceBreakdown: {
      productPrice,
      discountCode: appliedDiscount ? coupon : null,
      discountAmount,
      total: finalOrder.total_price ?? null,
    },
  }
}

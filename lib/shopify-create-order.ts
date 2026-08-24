import { prisma } from "@/lib/prisma"
import { getShopifyConnection } from "@/lib/shopify-connection"
import {
  createShopifyDraftOrder,
  completeShopifyDraftOrder,
  getShopifyDiscountByCode,
  getShopifyOrder,
  type ShopifyShippingAddress,
  type ShopifyAppliedDiscount,
} from "@/lib/shopify"

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
}) {
  const { brandId, brandInfluencerId, variantId, quantity, shippingAddress } = params

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

  const note = `Instroom — ${brandInfluencer.influencer.full_name || brandInfluencer.influencer.handle}`
  const tags = "instroom"

  let appliedDiscount: ShopifyAppliedDiscount | undefined
  let priceOverride: string | undefined
  let discountAmount: string | null = null

  if (campaignType === "gifting") {
    priceOverride = "0.00"
  } else if (coupon) {
    const discount = await getShopifyDiscountByCode(connection.shopDomain, connection.accessToken, coupon)
    if (discount) {
      appliedDiscount = { value_type: discount.valueType, value: discount.value, title: coupon }
      discountAmount = discount.value
    }
  }

  const draftOrder = await createShopifyDraftOrder(connection.shopDomain, connection.accessToken, {
    variantId,
    quantity,
    shippingAddress,
    note,
    tags,
    priceOverride,
    appliedDiscount,
  })

  const completed = await completeShopifyDraftOrder(connection.shopDomain, connection.accessToken, draftOrder.id)
  if (!completed.order_id) {
    throw new Error("Shopify did not return a completed order")
  }

  const finalOrder = await getShopifyOrder(connection.shopDomain, connection.accessToken, completed.order_id)
  const shopifyOrderId = String(finalOrder.id)

  await prisma.shopifyOrder.upsert({
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
      raw: finalOrder as any,
      shopify_created_at: finalOrder.created_at ? new Date(finalOrder.created_at) : null,
    },
    update: {
      brand_influencer_id: brandInfluencerId,
      discount_code: coupon,
      source: "instroom",
      financial_status: finalOrder.financial_status ?? null,
      fulfillment_status: finalOrder.fulfillment_status ?? null,
      raw: finalOrder as any,
    },
  })

  productDetails.shippingAddress = shippingAddress
  productDetails.variantId = String(variantId)
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
    adminUrl: `https://${connection.shopDomain}/admin/orders/${finalOrder.id}`,
    priceBreakdown: {
      productPrice,
      discountCode: appliedDiscount ? coupon : null,
      discountAmount,
      total: finalOrder.total_price ?? null,
    },
  }
}

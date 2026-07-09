import { prisma } from "@/lib/prisma"
import type { GoAffProOrderEntry } from "@/lib/goaffpro"

export async function syncGoAffProOrder(params: { brandId: string; order: GoAffProOrderEntry }) {
  const { brandId, order } = params

  const orderId = String(order.id)
  const affiliateId = String(order.affiliate_id)
  const status = String(order.status)

  const brandInfluencer = await prisma.brandInfluencer.findFirst({
    where: { brand_id: brandId, affiliate_id: affiliateId },
    select: { id: true },
  })

  await prisma.goAffProOrder.upsert({
    where: { brand_id_goaffpro_order_id: { brand_id: brandId, goaffpro_order_id: orderId } },
    create: {
      brand_id: brandId,
      goaffpro_order_id: orderId,
      affiliate_id: affiliateId,
      brand_influencer_id: brandInfluencer?.id ?? null,
      total: order.total ?? 0,
      subtotal: order.subtotal ?? 0,
      commission: order.commission ?? 0,
      status,
      goaffpro_created_at: order.created ? new Date(order.created) : null,
      raw: order as any,
    },
    update: {
      brand_influencer_id: brandInfluencer?.id ?? null,
      total: order.total ?? 0,
      subtotal: order.subtotal ?? 0,
      commission: order.commission ?? 0,
      status,
      goaffpro_created_at: order.created ? new Date(order.created) : null,
      raw: order as any,
    },
  })

  if (!brandInfluencer) {
    return { success: true, orderId, affiliateId, brandInfluencerId: null }
  }

  const agg = await prisma.goAffProOrder.aggregate({
    where: { brand_id: brandId, affiliate_id: affiliateId, status: "approved" },
    _count: { _all: true },
    _sum: { total: true },
  })

  const salesCount = agg._count._all
  const gmv = agg._sum.total ?? 0

  await prisma.brandInfluencer.update({
    where: { id: brandInfluencer.id },
    data: { sales_count: salesCount, gmv },
  })

  await prisma.brandPartner.updateMany({
    where: { brand_influencer_id: brandInfluencer.id },
    data: { sales_count: salesCount, gmv },
  })

  return { success: true, orderId, affiliateId, brandInfluencerId: brandInfluencer.id }
}

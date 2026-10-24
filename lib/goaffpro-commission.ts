import { prisma } from "@/lib/prisma"

/** GoAffPro commission on approved orders, summed per brand influencer in one query. */
export async function goaffproCommissionByInfluencer(
  brandId: string,
  brandInfluencerIds: string[]
): Promise<Map<string, number>> {
  if (brandInfluencerIds.length === 0) return new Map()
  const rows = await prisma.goAffProOrder.groupBy({
    by: ["brand_influencer_id"],
    where: { brand_id: brandId, status: "approved", brand_influencer_id: { in: brandInfluencerIds } },
    _sum: { commission: true },
  })
  return new Map(
    rows
      .filter((r) => r.brand_influencer_id)
      .map((r) => [r.brand_influencer_id as string, Number(r._sum.commission ?? 0)])
  )
}

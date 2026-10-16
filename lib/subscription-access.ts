import "server-only"
import { prisma } from "@/lib/prisma"

const ACTIVE = { in: ["active", "trialing"] }

/** Dashboard access: a team member's access comes from the brand owner's plan. */
export async function checkSubscriptionAccess(userId: string, brandId: string | null): Promise<boolean> {
  if (brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { owner_id: true },
    })

    if (brand) {
      const isMember =
        brand.owner_id === userId ||
        !!(await prisma.brandMember.findFirst({ where: { brand_id: brandId, user_id: userId } }))

      if (isMember) {
        const ownerSub = await prisma.userSubscription.findFirst({
          where: { user_id: brand.owner_id, status: ACTIVE },
        })
        return !!ownerSub
      }
    }
  }

  // Own plan, or any brand they belong to whose owner has one.
  const ownSub = await prisma.userSubscription.findFirst({
    where: { user_id: userId, status: ACTIVE },
  })
  if (ownSub) return true

  const memberships = await prisma.brandMember.findMany({
    where: { user_id: userId },
    select: { brand: { select: { owner_id: true } } },
  })
  const ownerIds = memberships.map((m) => m.brand.owner_id)
  if (ownerIds.length === 0) return false

  const ownerSub = await prisma.userSubscription.findFirst({
    where: { user_id: { in: ownerIds }, status: ACTIVE },
  })
  return !!ownerSub
}

import { prisma } from "./prisma"
import { type BrandCapability, roleHasCapability } from "./role-capabilities"

export type { BrandCapability }

export async function hasBrandCapability(
  brandId: string,
  userId: string,
  capability: BrandCapability
): Promise<boolean> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { owner_id: true },
  })
  if (!brand) return false
  if (brand.owner_id === userId) return true

  const member = await prisma.brandMember.findFirst({
    where: { brand_id: brandId, user_id: userId },
    select: { role: true },
  })
  if (!member) return false

  return roleHasCapability(member.role, capability)
}

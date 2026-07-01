import { prisma } from "@/lib/prisma"

export async function logActivity({
  brandId,
  userId,
  action,
  entityType,
  entityId,
  details,
}: {
  brandId: string
  userId: string
  action: string
  entityType: string
  entityId: string
  details?: Record<string, unknown>
}) {
  try {
    await prisma.activityLog.create({
      data: {
        brand_id: brandId,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: JSON.stringify(details ?? {}),
      },
    })
  } catch (e) {
    console.error("logActivity failed:", e)
  }
}
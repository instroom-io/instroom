import { prisma } from "./prisma"

/**
 * Records a platform-wide admin action. Fire-and-forget style (mirrors
 * lib/activity-log.ts's logActivity) — never let a logging failure block
 * the admin action itself.
 */
export async function logAdminAction(params: {
  adminEmail: string
  action: string
  targetType: string
  targetId?: string | null
  targetLabel?: string | null
  details?: Record<string, unknown>
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        admin_email: params.adminEmail,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId ?? null,
        target_label: params.targetLabel ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    })
  } catch (err) {
    console.error("logAdminAction failed:", err)
  }
}

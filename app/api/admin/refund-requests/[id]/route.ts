import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, getAdminSession, ADMIN_EMAIL } from "@/lib/admin-auth"
import { logAdminAction } from "@/lib/admin-audit-log"
import { sendNotification } from "@/lib/notifications"
import { appBaseUrl } from "@/lib/app-url"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (gate) return gate
  const session = await getAdminSession()
  const { id } = await params
  const APP_URL = appBaseUrl(req)

  const { action, adminNotes } = (await req.json().catch(() => ({}))) as {
    action?: "approve" | "deny"
    adminNotes?: string
  }

  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const refundRequest = await prisma.refundRequest.findUnique({ where: { id } })
  if (!refundRequest) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Idempotent — a double-click or a stale second tab just returns the
  // already-decided record, without re-sending the email or re-logging.
  if (refundRequest.status !== "pending") {
    return NextResponse.json({ refundRequest })
  }

  const user = await prisma.user.findUnique({
    where: { id: refundRequest.user_id },
    select: { email: true, name: true },
  })

  const status = action === "approve" ? "approved" : "denied"
  const adminEmail = session?.user.email || ADMIN_EMAIL

  const updated = await prisma.refundRequest.update({
    where: { id },
    data: {
      status,
      admin_notes: adminNotes?.trim() || null,
      decided_by: adminEmail,
      decided_at: new Date(),
    },
  })

  // Best-effort, and creates the in-app notification too (not just an email)
  // — same wrapper every other feature in this app uses to notify a user.
  sendNotification({
    userId: refundRequest.user_id,
    type: action === "approve" ? "refund_approved" : "refund_denied",
    title: action === "approve" ? "Your refund request was approved" : "Your refund request was not approved",
    message:
      action === "approve"
        ? `Your refund request for ${refundRequest.amount} ${refundRequest.currency} has been approved. It will be processed to your original payment method shortly.`
        : `Your refund request was reviewed and could not be approved at this time.`,
    actionUrl: `${APP_URL}/dashboard/settings/billing`,
  }).catch(() => void 0)

  await logAdminAction({
    adminEmail,
    action: action === "approve" ? "approved_refund_request" : "denied_refund_request",
    targetType: "refund_request",
    targetId: updated.id,
    targetLabel: user?.email ?? refundRequest.user_id,
    details: { amount: Number(refundRequest.amount), currency: refundRequest.currency },
  })

  return NextResponse.json({ refundRequest: updated })
}

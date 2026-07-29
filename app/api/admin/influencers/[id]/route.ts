import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, getAdminSession, ADMIN_EMAIL } from "@/lib/admin-auth"
import { logAdminAction } from "@/lib/admin-audit-log"

type Action = "approve" | "reject" | "suspend" | "reactivate"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (gate) return gate
  const session = await getAdminSession()
  const { id } = await params

  const { action } = await req.json() as { action?: Action }
  if (!action || !["approve", "reject", "suspend", "reactivate"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const target = await prisma.influencer.findUnique({ where: { id }, select: { handle: true, full_name: true } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const data: { verification_status?: string; is_suspended?: boolean } = {}
  if (action === "approve") data.verification_status = "verified"
  if (action === "reject")  data.verification_status = "rejected"
  if (action === "suspend") data.is_suspended = true
  if (action === "reactivate") data.is_suspended = false

  const influencer = await prisma.influencer.update({
    where: { id },
    data,
    select: { id: true, handle: true, full_name: true, verification_status: true, is_suspended: true },
  })

  const actionLabel: Record<Action, string> = {
    approve: "approved_influencer",
    reject: "rejected_influencer",
    suspend: "suspended_influencer",
    reactivate: "reactivated_influencer",
  }

  await logAdminAction({
    adminEmail: session?.user.email || ADMIN_EMAIL,
    action: actionLabel[action],
    targetType: "influencer",
    targetId: influencer.id,
    targetLabel: influencer.full_name || influencer.handle,
  })

  return NextResponse.json({ influencer })
}

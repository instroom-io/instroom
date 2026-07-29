import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, getAdminSession, ADMIN_EMAIL } from "@/lib/admin-auth"
import { logAdminAction } from "@/lib/admin-audit-log"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (gate) return gate
  const session = await getAdminSession()
  const { id } = await params

  const body = await req.json() as { action?: "close" | "archive"; name?: string; budget?: number }
  const target = await prisma.campaign.findUnique({ where: { id }, select: { name: true } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const data: { status?: string; name?: string; budget?: number } = {}
  let action = "edited_campaign"

  if (body.action === "close") { data.status = "closed"; action = "closed_campaign" }
  else if (body.action === "archive") { data.status = "archived"; action = "archived_campaign" }
  else {
    if (body.name !== undefined) data.name = body.name
    if (body.budget !== undefined) data.budget = body.budget
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data,
    select: { id: true, name: true, status: true, budget: true },
  })

  await logAdminAction({
    adminEmail: session?.user.email || ADMIN_EMAIL,
    action,
    targetType: "campaign",
    targetId: campaign.id,
    targetLabel: campaign.name,
  })

  return NextResponse.json({ campaign })
}

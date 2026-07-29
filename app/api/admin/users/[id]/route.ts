import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, getAdminSession, ADMIN_EMAIL } from "@/lib/admin-auth"
import { logAdminAction } from "@/lib/admin-audit-log"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (gate) return gate
  const session = await getAdminSession()
  const { id } = await params

  const { action } = await req.json() as { action?: "suspend" | "reactivate" }
  if (action !== "suspend" && action !== "reactivate") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { email: true, name: true } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (target.email === ADMIN_EMAIL) {
    return NextResponse.json({ error: "Cannot modify the admin account" }, { status: 403 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: { is_active: action === "reactivate" },
    select: { id: true, name: true, email: true, is_active: true },
  })

  await logAdminAction({
    adminEmail: session?.user.email || ADMIN_EMAIL,
    action: action === "suspend" ? "suspended_user" : "reactivated_user",
    targetType: "user",
    targetId: user.id,
    targetLabel: user.name || user.email || undefined,
  })

  return NextResponse.json({ user })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (gate) return gate
  const session = await getAdminSession()
  const { id } = await params

  const target = await prisma.user.findUnique({ where: { id }, select: { email: true, name: true } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (target.email === ADMIN_EMAIL) {
    return NextResponse.json({ error: "Cannot delete the admin account" }, { status: 403 })
  }

  await prisma.user.delete({ where: { id } })

  await logAdminAction({
    adminEmail: session?.user.email || ADMIN_EMAIL,
    action: "deleted_user",
    targetType: "user",
    targetId: id,
    targetLabel: target.name || target.email || undefined,
  })

  return NextResponse.json({ success: true })
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET() {
  const gate = await requireAdmin()
  if (gate) return gate

  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { created_at: "desc" },
    take: 300,
  })

  return NextResponse.json({ logs })
}

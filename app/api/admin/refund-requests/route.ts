import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  const status = req.nextUrl.searchParams.get("status")

  const requests = await prisma.refundRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { created_at: "desc" },
  })

  // No @relation to User (matches PaymentHistory/AdminAuditLog's existing
  // no-FK convention for cross-table admin references) — merge in JS.
  const userIds = [...new Set(requests.map((r) => r.user_id))]
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true },
      })
    : []
  const userById = new Map(users.map((u) => [u.id, u]))

  const formatted = requests.map((r) => ({
    ...r,
    amount: Number(r.amount),
    user: userById.get(r.user_id) ?? { id: r.user_id, email: "(deleted user)", name: null },
  }))

  return NextResponse.json({ requests: formatted })
}

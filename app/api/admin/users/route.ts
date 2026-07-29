import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  const q = req.nextUrl.searchParams.get("q")?.trim() || ""

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true, name: true, email: true, image: true,
      platform_role: true, is_active: true, created_at: true,
    },
  })

  return NextResponse.json({ users })
}

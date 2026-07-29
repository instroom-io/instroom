import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  const q = req.nextUrl.searchParams.get("q")?.trim() || ""

  const campaigns = await prisma.campaign.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true, name: true, status: true, budget: true, created_at: true,
      brand: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      brandName: c.brand?.name || "—",
      budget: c.budget ? Number(c.budget) : null,
      status: c.status,
      createdAt: c.created_at,
    })),
  })
}

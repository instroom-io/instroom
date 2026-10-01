import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSopAccess, serverError } from "@/lib/research-sop/auth"
import { RUN_LIST_SELECT } from "@/lib/research-sop/sops"

// GET — this brand's SOP run history, newest first (any member).
export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params
    const gate = await requireSopAccess(brandId)
    if (!gate.ok) return gate.response

    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 30))
    const runs = await prisma.researchSopRun.findMany({
      where: { brand_id: brandId },
      select: RUN_LIST_SELECT,
      orderBy: { created_at: "desc" },
      take: limit,
    })

    const userIds = Array.from(new Set(runs.map((r) => r.started_by).filter((v): v is string => !!v)))
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : []
    const names = new Map(users.map((u) => [u.id, u.name || u.email]))

    return NextResponse.json({
      data: runs.map((r) => ({ ...r, started_by_name: r.started_by ? names.get(r.started_by) ?? null : null })),
    })
  } catch (error) {
    return serverError("GET research-sop runs", error)
  }
}

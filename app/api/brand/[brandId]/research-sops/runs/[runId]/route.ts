import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSopAccess, serverError } from "@/lib/research-sop/auth"
import { RUN_LIST_SELECT } from "@/lib/research-sop/sops"

// GET — one run with every result row (any member). Results are scoped by
// run AND brand, and influencer handles are resolved within the brand only.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string; runId: string }> }
) {
  try {
    const { brandId, runId } = await params
    const gate = await requireSopAccess(brandId)
    if (!gate.ok) return gate.response

    const run = await prisma.researchSopRun.findFirst({
      where: { id: runId, brand_id: brandId },
      select: RUN_LIST_SELECT,
    })
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const results = await prisma.researchSopRunResult.findMany({
      where: { run_id: run.id, brand_id: brandId },
      select: {
        id: true,
        brand_influencer_id: true,
        field: true,
        current_value: true,
        proposed_value: true,
        source: true,
        confidence: true,
        value_type: true,
        status: true,
        evidence: true,
        error: true,
        reviewed_at: true,
        applied_at: true,
      },
      orderBy: { created_at: "asc" },
    })

    const biIds = Array.from(new Set(results.map((r) => r.brand_influencer_id)))
    const memberships = biIds.length
      ? await prisma.brandInfluencer.findMany({
          where: { id: { in: biIds }, brand_id: brandId },
          select: { id: true, influencer: { select: { id: true, handle: true, platform: true, full_name: true } } },
        })
      : []
    const influencers = new Map(memberships.map((m) => [m.id, m.influencer]))

    const starter = run.started_by
      ? await prisma.user.findUnique({ where: { id: run.started_by }, select: { name: true, email: true } })
      : null

    return NextResponse.json({
      data: {
        ...run,
        started_by_name: starter ? starter.name || starter.email : null,
        results: results.map((r) => ({
          ...r,
          confidence: r.confidence === null ? null : Number(r.confidence),
          influencer: influencers.get(r.brand_influencer_id) ?? null,
        })),
      },
    })
  } catch (error) {
    return serverError("GET research-sop run", error)
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSopAccess, serverError, SOP_RUN_CAPABILITY } from "@/lib/research-sop/auth"
import { applyApprovedResults } from "@/lib/research-sop/executor"

export const maxDuration = 60
export const dynamic = "force-dynamic"

// POST — write this run's APPROVED results onto the influencer records.
// Authorization, brand ownership, field whitelist and value validity are all
// re-checked here; a field edited since research ran becomes a "conflict"
// and is left untouched for another review.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string; runId: string }> }
) {
  try {
    const { brandId, runId } = await params
    const gate = await requireSopAccess(brandId, SOP_RUN_CAPABILITY)
    if (!gate.ok) return gate.response

    const run = await prisma.researchSopRun.findFirst({
      where: { id: runId, brand_id: brandId },
      select: { id: true, processed_count: true, total_count: true },
    })
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (run.processed_count < run.total_count) {
      return NextResponse.json({ error: "Wait for research to finish before applying." }, { status: 409 })
    }

    const summary = await applyApprovedResults(run.id, brandId, gate.userId)
    return NextResponse.json({ data: summary })
  } catch (error) {
    return serverError("POST research-sop apply", error)
  }
}

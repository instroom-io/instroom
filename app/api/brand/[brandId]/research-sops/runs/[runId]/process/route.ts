import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSopAccess, serverError, SOP_RUN_CAPABILITY } from "@/lib/research-sop/auth"
import { processRunBatch } from "@/lib/research-sop/executor"
import { RUN_LIST_SELECT } from "@/lib/research-sop/sops"

// Same bounds as the post-detection run route: provider lookups and the AI call
// are slow, but each request handles at most RUN_BATCH_SIZE influencers.
export const maxDuration = 300
export const dynamic = "force-dynamic"

// POST — research the next batch of a run and return its updated progress.
// The browser calls this repeatedly until the run is finished; a concurrent
// call while a batch is in flight returns "busy" without doing any work.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string; runId: string }> }
) {
  try {
    const { brandId, runId } = await params
    const gate = await requireSopAccess(brandId, SOP_RUN_CAPABILITY)
    if (!gate.ok) return gate.response

    const outcome = await processRunBatch(runId, brandId, gate.userId)
    if (outcome === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 })

    const run = await prisma.researchSopRun.findFirst({ where: { id: runId, brand_id: brandId }, select: RUN_LIST_SELECT })
    return NextResponse.json({ outcome, data: run })
  } catch (error) {
    return serverError("POST research-sop run process", error)
  }
}

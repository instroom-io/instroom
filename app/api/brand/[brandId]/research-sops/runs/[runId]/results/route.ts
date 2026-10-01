import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSopAccess, serverError, SOP_RUN_CAPABILITY } from "@/lib/research-sop/auth"
import { decideResults } from "@/lib/research-sop/executor"

// PATCH — approve or reject individual field proposals.
// Body: { result_ids: string[], decision: "approve" | "reject" }
// Only results of THIS run on THIS brand, in a decidable status, are touched.
// Approving changes nothing on the influencer — that happens only on apply.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; runId: string }> }
) {
  try {
    const { brandId, runId } = await params
    const gate = await requireSopAccess(brandId, SOP_RUN_CAPABILITY)
    if (!gate.ok) return gate.response

    const body = await req.json().catch(() => null)
    const decision = body?.decision
    const ids: string[] = Array.isArray(body?.result_ids)
      ? body.result_ids.filter((v: unknown): v is string => typeof v === "string")
      : []
    if ((decision !== "approve" && decision !== "reject") || !ids.length) {
      return NextResponse.json({ error: "Invalid review decision" }, { status: 400 })
    }

    const run = await prisma.researchSopRun.findFirst({ where: { id: runId, brand_id: brandId }, select: { id: true } })
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const updated = await decideResults(run.id, brandId, gate.userId, ids, decision)
    return NextResponse.json({ updated })
  } catch (error) {
    return serverError("PATCH research-sop results", error)
  }
}

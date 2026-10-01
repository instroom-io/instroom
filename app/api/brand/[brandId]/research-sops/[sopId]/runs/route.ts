import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSopAccess, serverError, SOP_RUN_CAPABILITY } from "@/lib/research-sop/auth"
import { writeMaybeUtf8mb4 } from "@/lib/research-sop/db"
import { RUN_TARGET_MODES, type RunTargetMode } from "@/lib/research-sop/fields"
import { MAX_RUN_TARGETS, fieldsFromSteps, resolveRunTargets } from "@/lib/research-sop/executor"

// POST — start a run of an ACTIVE SOP (anyone who can manage influencers).
//
// Body: { target_mode: "selected" | "missing" | "all", influencer_ids?: string[] }
// influencer_ids are the sheet's row ids (Influencer ids); they are resolved to
// this brand's BrandInfluencer rows server-side, so ids from another brand
// resolve to nothing. The run is created "queued" — the browser then drives it
// batch by batch through /runs/[runId]/process.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; sopId: string }> }
) {
  try {
    const { brandId, sopId } = await params
    const gate = await requireSopAccess(brandId, SOP_RUN_CAPABILITY)
    if (!gate.ok) return gate.response

    const body = await req.json().catch(() => null)
    const mode = body?.target_mode as RunTargetMode
    if (!RUN_TARGET_MODES.includes(mode)) {
      return NextResponse.json({ error: "Choose which influencers to research." }, { status: 400 })
    }
    const influencerIds: string[] = Array.isArray(body?.influencer_ids)
      ? body.influencer_ids.filter((v: unknown): v is string => typeof v === "string")
      : []

    const sop = await prisma.researchSop.findFirst({
      where: { id: sopId, brand_id: brandId },
      select: {
        id: true,
        name: true,
        version: true,
        status: true,
        steps: {
          orderBy: { position: "asc" },
          select: {
            position: true, title: true, instructions: true, required: true,
            target_field: true, verification_required: true, notes: true,
          },
        },
      },
    })
    if (!sop) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (sop.status !== "active") {
      return NextResponse.json({ error: "Only active SOPs can be run." }, { status: 409 })
    }

    const fields = fieldsFromSteps(sop.steps)
    if (!fields.length) {
      return NextResponse.json({ error: "This SOP has no steps mapped to an influencer field." }, { status: 400 })
    }

    const eligible = await resolveRunTargets(brandId, mode, fields, influencerIds)
    if (!eligible.length) {
      return NextResponse.json(
        { error: mode === "missing" ? "No influencers are missing these fields." : "No influencers to research." },
        { status: 400 }
      )
    }
    const targets = eligible.slice(0, MAX_RUN_TARGETS)

    // The step snapshot carries the SOP's own text, which may contain emoji.
    const run = await writeMaybeUtf8mb4(sop, (client) =>
      client.researchSopRun.create({
        data: {
          brand_id: brandId,
          sop_id: sop.id,
          sop_name: sop.name,
          sop_version: sop.version,
          steps_snapshot: sop.steps,
          target_mode: mode,
          target_ids: targets,
          total_count: targets.length,
          status: "queued",
          started_by: gate.userId,
        },
        select: { id: true, status: true, total_count: true },
      })
    )

    return NextResponse.json(
      {
        data: run,
        // Runs are capped so one click cannot queue an unbounded amount of
        // provider and AI work.
        truncated: eligible.length > targets.length,
        eligible_count: eligible.length,
      },
      { status: 201 }
    )
  } catch (error) {
    return serverError("POST research-sop run", error)
  }
}

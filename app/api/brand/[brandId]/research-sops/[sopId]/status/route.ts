import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSopAccess, serverError, SOP_MANAGE_CAPABILITY } from "@/lib/research-sop/auth"
import { SOP_STATUSES, isResearchField, type SopStatus } from "@/lib/research-sop/fields"

// PATCH — activate ("active"), deactivate ("draft") or archive ("archived")
// an SOP (Owner / Manager). Only active SOPs can be run. Archiving keeps the
// SOP and its run history; nothing is deleted.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; sopId: string }> }
) {
  try {
    const { brandId, sopId } = await params
    const gate = await requireSopAccess(brandId, SOP_MANAGE_CAPABILITY)
    if (!gate.ok) return gate.response

    const body = await req.json().catch(() => null)
    const status = body?.status as SopStatus
    if (!SOP_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const sop = await prisma.researchSop.findFirst({
      where: { id: sopId, brand_id: brandId },
      select: { id: true, steps: { select: { target_field: true } } },
    })
    if (!sop) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // An SOP that maps no field would run and research nothing.
    if (status === "active" && !sop.steps.some((s) => isResearchField(s.target_field))) {
      return NextResponse.json(
        { error: "Map at least one step to an influencer field before activating this SOP." },
        { status: 400 }
      )
    }

    const updated = await prisma.researchSop.update({
      where: { id: sop.id },
      data: { status },
      select: { id: true, status: true, version: true, updated_at: true },
    })
    return NextResponse.json({ data: updated })
  } catch (error) {
    return serverError("PATCH research-sop status", error)
  }
}

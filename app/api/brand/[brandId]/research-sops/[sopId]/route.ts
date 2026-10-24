import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSopAccess, serverError, SOP_MANAGE_CAPABILITY } from "@/lib/research-sop/auth"
import { writeMaybeUtf8mb4 } from "@/lib/research-sop/db"
import { SOP_SELECT, firstIssue, sopInputSchema, stepRows, withCreatorNames } from "@/lib/research-sop/sops"

type Params = { params: Promise<{ brandId: string; sopId: string }> }

const findUsers = (ids: string[]) =>
  prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })

// GET — one SOP with its ordered steps (any member).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { brandId, sopId } = await params
    const gate = await requireSopAccess(brandId)
    if (!gate.ok) return gate.response

    const sop = await prisma.researchSop.findFirst({ where: { id: sopId, brand_id: brandId }, select: SOP_SELECT })
    if (!sop) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const [withName] = await withCreatorNames([sop], findUsers)
    return NextResponse.json({ data: withName })
  } catch (error) {
    return serverError("GET research-sop", error)
  }
}

// PUT — replace name, description and the full ordered step list (Owner /
// Manager). Every saved edit is a new version; runs keep the version they used.
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { brandId, sopId } = await params
    const gate = await requireSopAccess(brandId, SOP_MANAGE_CAPABILITY)
    if (!gate.ok) return gate.response

    const existing = await prisma.researchSop.findFirst({
      where: { id: sopId, brand_id: brandId },
      select: { id: true, status: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (existing.status === "archived") {
      return NextResponse.json({ error: "Archived SOPs can't be edited. Duplicate it instead." }, { status: 409 })
    }

    const parsed = sopInputSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
    const input = parsed.data

    // One nested write: the old steps are removed and the new list created in
    // the same statement set, so a failed save never leaves half a step list.
    const sop = await writeMaybeUtf8mb4(input, (client) =>
      client.researchSop.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          description: input.description || null,
          applies_to: input.applies_to,
          version: { increment: 1 },
          steps: { deleteMany: {}, create: stepRows(input.steps) },
        },
        select: SOP_SELECT,
      })
    )
    const [withName] = await withCreatorNames([sop], findUsers)
    return NextResponse.json({ data: withName })
  } catch (error) {
    return serverError("PUT research-sop", error)
  }
}

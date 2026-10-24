import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isSopSchemaMissing, requireSopAccess, serverError, SOP_MANAGE_CAPABILITY } from "@/lib/research-sop/auth"
import { writeMaybeUtf8mb4 } from "@/lib/research-sop/db"
import { SOP_SELECT, firstIssue, sopInputSchema, stepRows, withCreatorNames } from "@/lib/research-sop/sops"

const findUsers = (ids: string[]) =>
  prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })

// GET — this brand's SOPs (any member). Archived ones only with ?include_archived=1.
export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params
    const gate = await requireSopAccess(brandId)
    if (!gate.ok) return gate.response

    const includeArchived = req.nextUrl.searchParams.get("include_archived") === "1"
    const sops = await prisma.researchSop.findMany({
      where: { brand_id: brandId, ...(includeArchived ? {} : { status: { not: "archived" } }) },
      select: SOP_SELECT,
      orderBy: { updated_at: "desc" },
    })
    return NextResponse.json({ data: await withCreatorNames(sops, findUsers) })
  } catch (error) {
    // Before the migration is applied, the list is simply empty — not an error.
    if (isSopSchemaMissing(error)) return NextResponse.json({ data: [], notReady: true })
    return serverError("GET research-sops", error)
  }
}

// POST — create an SOP (Owner / Manager). New SOPs start as drafts.
export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const { brandId } = await params
    const gate = await requireSopAccess(brandId, SOP_MANAGE_CAPABILITY)
    if (!gate.ok) return gate.response

    const parsed = sopInputSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
    const input = parsed.data

    const sop = await writeMaybeUtf8mb4(input, (client) =>
      client.researchSop.create({
        data: {
          brand_id: brandId,
          name: input.name,
          description: input.description || null,
          applies_to: input.applies_to,
          status: "draft",
          created_by: gate.userId,
          steps: { create: stepRows(input.steps) },
        },
        select: SOP_SELECT,
      })
    )
    const [withName] = await withCreatorNames([sop], findUsers)
    return NextResponse.json({ data: withName }, { status: 201 })
  } catch (error) {
    return serverError("POST research-sops", error)
  }
}

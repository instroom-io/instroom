import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSopAccess, serverError, SOP_MANAGE_CAPABILITY } from "@/lib/research-sop/auth"
import { writeMaybeUtf8mb4 } from "@/lib/research-sop/db"
import { SOP_SELECT } from "@/lib/research-sop/sops"

// POST — copy an SOP (steps included) as a new draft (Owner / Manager).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string; sopId: string }> }
) {
  try {
    const { brandId, sopId } = await params
    const gate = await requireSopAccess(brandId, SOP_MANAGE_CAPABILITY)
    if (!gate.ok) return gate.response

    const source = await prisma.researchSop.findFirst({ where: { id: sopId, brand_id: brandId }, select: SOP_SELECT })
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const copy = await writeMaybeUtf8mb4(source, (client) =>
      client.researchSop.create({
        data: {
          brand_id: brandId,
          name: `${source.name} (copy)`.slice(0, 150),
          description: source.description,
          applies_to: source.applies_to,
          status: "draft",
          created_by: gate.userId,
          steps: {
            create: source.steps.map((s) => ({
              position: s.position,
              title: s.title,
              instructions: s.instructions,
              required: s.required,
              target_field: s.target_field,
              verification_required: s.verification_required,
              notes: s.notes,
            })),
          },
        },
        select: SOP_SELECT,
      })
    )
    return NextResponse.json({ data: { ...copy, created_by_name: null } }, { status: 201 })
  } catch (error) {
    return serverError("POST research-sop duplicate", error)
  }
}

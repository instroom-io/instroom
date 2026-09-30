import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function checkBrandAccess(brandId: string, userId: string) {
  return prisma.brand.findFirst({
    where: {
      id: brandId,
      OR: [
        { owner_id: userId },
        { members: { some: { user_id: userId } } },
      ],
    },
    select: { id: true },
  })
}

// PATCH /api/brand/[brandId]/templates/[templateId]
// Body: { name?: string, subject?: string, body?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; templateId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, templateId } = await params
    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const name = body.name?.trim()
    const subject = body.subject?.trim()
    const templateBody = body.body?.trim()
    if (!name || !subject || !templateBody) {
      return NextResponse.json({ error: "name, subject, and body are required" }, { status: 400 })
    }

    const template = await prisma.emailTemplate.update({
      where: { id: templateId, brand_id: brandId },
      data: { name, subject, body: templateBody },
    })

    return NextResponse.json({ template })
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    console.error("PATCH template error:", error)
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}

// DELETE /api/brand/[brandId]/templates/[templateId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; templateId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, templateId } = await params
    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.emailTemplate.delete({
      where: { id: templateId, brand_id: brandId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    console.error("DELETE template error:", error)
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }
}

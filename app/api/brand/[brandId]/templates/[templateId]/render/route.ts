import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { fillTemplate } from "@/lib/template-placeholders"

async function checkBrandAccess(brandId: string, userId: string) {
  return prisma.brand.findFirst({
    where: {
      id: brandId,
      OR: [
        { owner_id: userId },
        { members: { some: { user_id: userId } } },
      ],
    },
    select: { id: true, name: true },
  })
}

// GET /api/brand/[brandId]/templates/[templateId]/render?email=<recipient>
// Fills template placeholders for the recipient.
export async function GET(
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

    const { searchParams } = new URL(req.url)
    const email = searchParams.get("email")?.toLowerCase().trim()

    const template = await prisma.emailTemplate.findFirst({
      where: { id: templateId, brand_id: brandId },
    })
    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Prefer this brand's influencer.
    const select = { full_name: true, handle: true, platform: true } as const
    const influencer = email
      ? (await prisma.brandInfluencer.findFirst({
          where: { brand_id: brandId, influencer: { email } },
          select: { influencer: { select } },
        }))?.influencer ??
        (await prisma.influencer.findFirst({ where: { email }, select }))
      : null

    const values = {
      name: influencer?.full_name,
      handle: influencer?.handle,
      platform: influencer?.platform,
      brand: brand.name,
    }
    return NextResponse.json({
      subject: fillTemplate(template.subject, values),
      body: fillTemplate(template.body, values),
    })
  } catch (error: any) {
    console.error("Render template error:", error)
    return NextResponse.json({ error: "Failed to render template" }, { status: 500 })
  }
}

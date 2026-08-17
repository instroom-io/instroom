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

function substitute(text: string, name: string, handle: string): string {
  return text
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*handle\s*\}\}/gi, handle)
}

// GET /api/brand/[brandId]/templates/[templateId]/render?email=<recipient>
// Substitutes {{name}} / {{handle}} with the matched influencer's real name
// and social handle, falling back to generic text when the recipient email
// doesn't match a known influencer — used by every "Use template" picker
// (Inbox compose, Inbox reply, EmailModal) so there's one substitution path.
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

    const influencer = email
      ? await prisma.influencer.findFirst({
          where: { email },
          select: { full_name: true, handle: true },
        })
      : null

    const name = influencer?.full_name ?? "there"
    const handle = influencer?.handle ?? ""

    return NextResponse.json({
      subject: substitute(template.subject, name, handle),
      body: substitute(template.body, name, handle),
    })
  } catch (error: any) {
    console.error("Render template error:", error)
    return NextResponse.json({ error: "Failed to render template" }, { status: 500 })
  }
}

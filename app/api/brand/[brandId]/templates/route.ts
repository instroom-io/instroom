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

// GET /api/brand/[brandId]/templates
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params
    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const templates = await prisma.emailTemplate.findMany({
      where: { brand_id: brandId },
      orderBy: { created_at: "desc" },
    })

    return NextResponse.json({ templates })
  } catch (error: any) {
    console.error("GET templates error:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}

// POST /api/brand/[brandId]/templates
// Body: { name: string, subject: string, body: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params
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

    const template = await prisma.emailTemplate.create({
      data: {
        brand_id: brandId,
        name,
        subject,
        body: templateBody,
        created_by: session.user.id,
      },
    })

    return NextResponse.json({ template })
  } catch (error: any) {
    console.error("POST template error:", error)
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 })
  }
}

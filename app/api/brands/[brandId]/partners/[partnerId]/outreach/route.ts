// app/api/brands/[brandId]/partners/[partnerId]/outreach/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ brandId: string; partnerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { partnerId } = await context.params

    const logs = await prisma.outreachLog.findMany({
      where: { brand_influencer_id: partnerId },
      orderBy: { created_at: "desc" },
    })

    return NextResponse.json({ data: logs })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch outreach logs" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ brandId: string; partnerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { partnerId } = await context.params
    const body = await req.json()

    if (!body.outreach_type) {
      return NextResponse.json({ error: "outreach_type is required" }, { status: 400 })
    }

    const log = await prisma.outreachLog.create({
      data: {
        brand_influencer_id: partnerId,
        outreach_type:       body.outreach_type,
        subject:             body.subject        ?? null,
        message:             body.message        ?? null,
        response_received:   body.response_received ?? false,
        response_date:       body.response_date ? new Date(body.response_date) : null,
        response_text:       body.response_text  ?? null,
      },
    })

    if (body.bump_status) {
      await prisma.brandInfluencer.update({
        where: { id: partnerId },
        data: {
          contact_status:  "contacted",
          outreach_method: body.outreach_type,
          stage:           2,
        },
      })
    }

    return NextResponse.json({ data: log }, { status: 201 })
  } catch (error) {
    console.error("[POST /outreach]", error)
    return NextResponse.json({ error: "Failed to log outreach" }, { status: 500 })
  }
}
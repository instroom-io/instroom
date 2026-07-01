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

    const posts = await prisma.contentPost.findMany({
      where: { brand_influencer_id: partnerId },
      orderBy: { posted_date: "desc" },
    })

    return NextResponse.json({ data: posts })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch content posts" }, { status: 500 })
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

    if (!body.post_url || !body.platform || !body.posted_date) {
      return NextResponse.json(
        { error: "post_url, platform, and posted_date are required" },
        { status: 400 }
      )
    }

    const post = await prisma.contentPost.create({
      data: {
        brand_influencer_id: partnerId,
        platform:            body.platform,
        post_url:            body.post_url,
        caption:             body.caption     ?? null,
        posted_date:         new Date(body.posted_date),
        likes:               body.likes        ?? 0,
        comments:            body.comments     ?? 0,
        shares:              body.shares       ?? 0,
        engagement_rate:     body.engagement_rate ?? 0,
        saved_count:         body.saved_count  ?? 0,
      },
    })

    await prisma.brandInfluencer.update({
      where: { id: partnerId },
      data: {
        content_posted: true,
        stage:          5,
        posted_at:      new Date(body.posted_date),
        post_url:       body.post_url,
        post_caption:   body.caption ?? null,
        likes_count:    body.likes   ?? 0,
        comments_count: body.comments ?? 0,
      },
    })

    return NextResponse.json({ data: post }, { status: 201 })
  } catch (error) {
    console.error("[POST /content]", error)
    return NextResponse.json({ error: "Failed to log content post" }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBrandAccess, getChannelMessages } from "@/lib/community-access"

// GET /api/community/messages?brandId=...&channelId=...
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const brandId = req.nextUrl.searchParams.get("brandId")
    const channelId = req.nextUrl.searchParams.get("channelId")
    if (!brandId || !channelId) {
      return NextResponse.json({ error: "brandId and channelId are required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const channel = await prisma.communityChannel.findFirst({
      where: { id: channelId, brand_id: brandId },
      select: { id: true },
    })
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 })
    }

    const enriched = await getChannelMessages(brandId, channelId)

    return NextResponse.json({ messages: enriched })
  } catch (error) {
    console.error("[GET /community/messages]", error)
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
  }
}

// POST /api/community/messages
// Body: { brandId: string, channelId: string, body: string }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await req.json()
    const { brandId, channelId, body } = payload
    const trimmed = body?.trim()

    if (!brandId || !channelId || !trimmed) {
      return NextResponse.json({ error: "brandId, channelId, and body are required" }, { status: 400 })
    }
    if (trimmed.length > 4000) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const channel = await prisma.communityChannel.findFirst({
      where: { id: channelId, brand_id: brandId },
      select: { id: true },
    })
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 })
    }

    const message = await prisma.communityMessage.create({
      data: {
        brand_id: brandId,
        channel_id: channelId,
        user_id: session.user.id,
        body: trimmed,
      },
    })

    return NextResponse.json({
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.created_at,
        user: {
          id: session.user.id,
          name: session.user.name ?? null,
          image: session.user.image ?? null,
          email: session.user.email ?? null,
        },
      },
    })
  } catch (error) {
    console.error("[POST /community/messages]", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}

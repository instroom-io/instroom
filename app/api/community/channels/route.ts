import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBrandAccess, ensureDefaultChannels, getChannelMessages } from "@/lib/community-access"

// GET /api/community/channels?brandId=...
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const brandId = req.nextUrl.searchParams.get("brandId")
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await ensureDefaultChannels(brandId)

    const channels = await prisma.communityChannel.findMany({
      where: { brand_id: brandId },
      orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
    })

    // Inline the default channel's messages so the client can render them
    // immediately instead of waiting on a second, fully sequential round trip
    // (channels -> pick active channel -> fetch its messages).
    const initialMessages = channels.length
      ? await getChannelMessages(brandId, channels[0].id)
      : []

    return NextResponse.json({
      channels,
      initialChannelId: channels[0]?.id ?? null,
      initialMessages,
    })
  } catch (error) {
    console.error("[GET /community/channels]", error)
    return NextResponse.json({ error: "Failed to load channels" }, { status: 500 })
  }
}

// POST /api/community/channels
// Body: { brandId: string, name: string, description?: string }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { brandId, name, description } = body

    if (!brandId || !name?.trim()) {
      return NextResponse.json({ error: "brandId and name are required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const channel = await prisma.communityChannel.create({
      data: {
        brand_id: brandId,
        name: name.trim(),
        description: description?.trim() || null,
      },
    })

    return NextResponse.json({ channel })
  } catch (error) {
    console.error("[POST /community/channels]", error)
    return NextResponse.json({ error: "Failed to create channel" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBrandAccess } from "@/lib/community-access"

// Reuses the existing generic IntegrationConnection table (same one the
// Settings > Integrations page uses for other providers), but under its own
// key so this Community-scoped connection never touches the "discord" entry
// shown on the Integrations page — the two are deliberately separate records.
const DISCORD_COMMUNITY_KEY = "discord_community"

type DiscordConfig = {
  serverName: string
  inviteUrl: string
}

// GET /api/community/discord?brandId=...
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

    const connection = await prisma.integrationConnection.findUnique({
      where: { brand_id_integration_key: { brand_id: brandId, integration_key: DISCORD_COMMUNITY_KEY } },
    })

    if (!connection?.connected) {
      return NextResponse.json({ connected: false })
    }

    const config = connection.config as DiscordConfig | null

    return NextResponse.json({
      connected: true,
      connectedAs: connection.connected_as,
      serverName: config?.serverName ?? null,
      inviteUrl: config?.inviteUrl ?? null,
    })
  } catch (error) {
    console.error("[GET /community/discord]", error)
    return NextResponse.json({ error: "Failed to load Discord connection" }, { status: 500 })
  }
}

// POST /api/community/discord — connect
// Body: { brandId: string, serverName: string, inviteUrl: string }
//
// There is no live Discord OAuth/bot wiring yet — a brand admin pastes their
// server's invite link to "connect" it. This persists a real record (not a
// UI mock) so the connected state survives reloads and is ready to be swapped
// for a real Discord OAuth + bot-webhook flow later without changing callers.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { brandId, serverName, inviteUrl } = body

    if (!brandId || !serverName?.trim() || !inviteUrl?.trim()) {
      return NextResponse.json({ error: "brandId, serverName, and inviteUrl are required" }, { status: 400 })
    }

    const inviteUrlTrimmed = inviteUrl.trim()
    if (!/^https:\/\/(discord\.gg|discord\.com\/invite)\//i.test(inviteUrlTrimmed)) {
      return NextResponse.json({ error: "Enter a valid discord.gg or discord.com/invite link" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const config: DiscordConfig = { serverName: serverName.trim(), inviteUrl: inviteUrlTrimmed }

    const connection = await prisma.integrationConnection.upsert({
      where: { brand_id_integration_key: { brand_id: brandId, integration_key: DISCORD_COMMUNITY_KEY } },
      create: {
        brand_id: brandId,
        integration_key: DISCORD_COMMUNITY_KEY,
        connected: true,
        connected_as: session.user.name ?? session.user.email ?? null,
        config,
      },
      update: {
        connected: true,
        connected_as: session.user.name ?? session.user.email ?? null,
        config,
      },
    })

    return NextResponse.json({
      connected: true,
      connectedAs: connection.connected_as,
      serverName: config.serverName,
      inviteUrl: config.inviteUrl,
    })
  } catch (error) {
    console.error("[POST /community/discord]", error)
    return NextResponse.json({ error: "Failed to connect Discord" }, { status: 500 })
  }
}

// DELETE /api/community/discord?brandId=... — disconnect
export async function DELETE(req: NextRequest) {
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

    await prisma.integrationConnection.updateMany({
      where: { brand_id: brandId, integration_key: DISCORD_COMMUNITY_KEY },
      data: { connected: false, connected_as: null },
    })

    return NextResponse.json({ connected: false })
  } catch (error) {
    console.error("[DELETE /community/discord]", error)
    return NextResponse.json({ error: "Failed to disconnect Discord" }, { status: 500 })
  }
}

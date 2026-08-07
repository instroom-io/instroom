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
  /** Numeric Discord guild (server) ID — required for live presence. */
  guildId?: string
}

/**
 * Resolve an invite code to its guild ID via Discord's public invite endpoint.
 * No credentials needed. Best-effort: if it fails the connection still saves,
 * just without live presence, and the admin can supply the ID manually.
 */
async function resolveGuildIdFromInvite(inviteUrl: string): Promise<string | null> {
  const code = inviteUrl.split("?")[0].replace(/\/+$/, "").split("/").pop()
  if (!code) return null
  try {
    const res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    })
    if (!res.ok) {
      console.warn(`[community/discord] invite lookup failed: HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    return typeof data?.guild?.id === "string" ? data.guild.id : null
  } catch (err) {
    console.warn("[community/discord] invite lookup errored:", err instanceof Error ? err.message : err)
    return null
  }
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
      guildId: config?.guildId ?? null,
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
    const { brandId, serverName, inviteUrl, guildId } = body

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

    // An explicitly supplied ID wins; otherwise try to resolve it from the
    // invite so the admin doesn't have to enable Developer Mode to find it.
    const explicitGuildId = typeof guildId === "string" && /^\d{17,20}$/.test(guildId.trim())
      ? guildId.trim()
      : null
    const resolvedGuildId = explicitGuildId ?? (await resolveGuildIdFromInvite(inviteUrlTrimmed))

    const config: DiscordConfig = {
      serverName: serverName.trim(),
      inviteUrl: inviteUrlTrimmed,
      ...(resolvedGuildId ? { guildId: resolvedGuildId } : {}),
    }

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
      guildId: config.guildId ?? null,
      // Lets the UI prompt for the ID when it couldn't be resolved.
      guildIdResolved: Boolean(config.guildId),
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

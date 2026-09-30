import { NextRequest, NextResponse } from "next/server"
import { guardBrandGuild, statusForCode } from "@/lib/discord/route-guard"
import { togglePin, getPinnedMessages } from "@/lib/discord/bot-provider"

// GET  ?channelId=          — every pinned message in the channel
// POST { channelId, messageId, on } — pin or unpin, same shape as /reactions
//
// Pinning is not restricted to the message's own author — see togglePin's own
// comment on why it is currently open to any brand member rather than gated
// behind a moderator role this app does not have yet.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const channelId = req.nextUrl.searchParams.get("channelId")
    if (!channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 })
    }

    const result = await getPinnedMessages(guard.guildId, guard.discordUserId, channelId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    return NextResponse.json({ messages: result.messages })
  } catch (error) {
    console.error("[GET discord/pins]", error)
    return NextResponse.json({ error: "Failed to load pinned messages" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const body = await req.json().catch(() => ({}))
    const { channelId, messageId, on } = body ?? {}

    if (typeof channelId !== "string" || !channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 })
    }
    if (typeof messageId !== "string" || !messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }

    const result = await togglePin(guard.guildId, guard.discordUserId, channelId, messageId, Boolean(on))
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST discord/pins]", error)
    return NextResponse.json({ error: "Failed to update pin" }, { status: 500 })
  }
}

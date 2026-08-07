import { NextRequest, NextResponse } from "next/server"
import { guardBrandGuild, statusForCode } from "@/lib/discord/route-guard"
import { toggleReaction } from "@/lib/discord/bot-provider"

// POST { channelId, messageId, emoji, on } — add or remove a reaction.
//
// One route rather than PUT/DELETE pairs, because the client always knows the
// desired end state (`on`) and never needs to care which verb produces it.
//
// Channel access is re-derived inside the provider from the caller's own
// Discord roles, so a messageId in a channel the caller can't see resolves to
// "not found" instead of reacting to it.
//
// The reaction is attributed to the Instroom bot — see toggleReaction's note.

const MAX_EMOJI_LENGTH = 64

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const body = await req.json().catch(() => ({}))
    const { channelId, messageId, emoji, on } = body ?? {}

    if (typeof channelId !== "string" || !channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 })
    }
    if (typeof messageId !== "string" || !messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }
    // Bounded so a long string can't be smuggled into the upstream path.
    if (typeof emoji !== "string" || !emoji || emoji.length > MAX_EMOJI_LENGTH) {
      return NextResponse.json({ error: "emoji is required" }, { status: 400 })
    }

    const result = await toggleReaction(
      guard.guildId,
      guard.discordUserId,
      channelId,
      messageId,
      emoji,
      Boolean(on)
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST discord/reactions]", error)
    return NextResponse.json({ error: "Failed to update reaction" }, { status: 500 })
  }
}

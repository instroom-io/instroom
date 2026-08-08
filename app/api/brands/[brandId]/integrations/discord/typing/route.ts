import { NextRequest, NextResponse } from "next/server"
import { guardBrandGuild, statusForCode } from "@/lib/discord/route-guard"
import { triggerTyping } from "@/lib/discord/bot-provider"

// POST /api/brands/:brandId/integrations/discord/typing
// Body: { channelId }
//
// Shows the bot as typing in Discord while an Instroom user composes. Discord's
// indicator lasts ~10s, so the client should call this at most every ~8s rather
// than per keystroke — it is a normal rate-limited route like any other.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const body = await req.json().catch(() => ({}))
    const channelId = body?.channelId
    if (typeof channelId !== "string" || !channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 })
    }

    const result = await triggerTyping(guard.guildId, guard.discordUserId, channelId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST discord/typing]", error)
    return NextResponse.json({ error: "Failed to send typing indicator" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { guardBrandGuild, statusForCode } from "@/lib/discord/route-guard"
import { getChannelsForUser } from "@/lib/discord/bot-provider"

// GET /api/brands/:brandId/integrations/discord/channels
//
// Channels the CALLER may see, not every channel the bot can see. The bot is
// usually in more channels than any one member, so the provider filters by the
// caller's own Discord roles before anything leaves the server.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const result = await getChannelsForUser(guard.guildId, guard.discordUserId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    return NextResponse.json({ channels: result.channels })
  } catch (error) {
    console.error("[GET discord/channels]", error)
    return NextResponse.json({ error: "Failed to load channels" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { guardBrand } from "@/lib/discord/route-guard"
import { connectBrandDiscord, refreshBrandConnection, botInstallUrl } from "@/lib/discord/connection"

// POST /api/brands/:brandId/integrations/discord/connect
// Body: { inviteUrl?: string }  — omit to re-verify the existing connection.
//
// The invite is resolved to a permanent guild ID server-side. The client never
// supplies a guildId; if it did, one brand could point itself at another
// brand's server.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrand(brandId)
    if (!guard.ok) return guard.response

    const body = await req.json().catch(() => ({}))
    const inviteUrl: unknown = body?.inviteUrl

    // No invite = "Reconnect": re-check the stored guild rather than requiring
    // the admin to find the invite link again.
    if (inviteUrl === undefined || inviteUrl === null || inviteUrl === "") {
      const result = await refreshBrandConnection(brandId)
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code, botInstallUrl: botInstallUrl() },
          { status: result.code === "not_connected" ? 404 : 409 }
        )
      }
      return NextResponse.json({ connected: true, connection: result.connection })
    }

    if (typeof inviteUrl !== "string") {
      return NextResponse.json({ error: "inviteUrl must be a string" }, { status: 400 })
    }

    const result = await connectBrandDiscord(brandId, inviteUrl, guard.userId)

    if (!result.ok) {
      // bot_missing is a 409, not a failure: the guild was resolved and saved,
      // the admin just needs to install the bot. The install URL is pre-scoped
      // to their guild so the picker is filled in for them.
      const status =
        result.code === "bot_missing" ? 409
        : result.code === "already_claimed" ? 409
        : result.code === "rate_limited" ? 429
        : 400
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          guildName: result.guildName ?? null,
          botInstallUrl: result.guildId ? botInstallUrl(result.guildId) : botInstallUrl(),
        },
        { status }
      )
    }

    return NextResponse.json({ connected: true, connection: result.connection })
  } catch (error) {
    console.error("[POST discord/connect]", error)
    return NextResponse.json({ error: "Failed to connect Discord" }, { status: 500 })
  }
}

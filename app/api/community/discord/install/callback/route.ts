import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkBrandAccess } from "@/lib/community-access"
import { connectBrandByGuildId } from "@/lib/discord/connection"
import { INSTALL_STATE_COOKIE, verifyInstallState } from "../route"
import { appBaseUrl } from "@/lib/app-url"

// GET /api/community/discord/install/callback
//
// Discord returns here after the owner picks a server and authorizes the bot.
// The chosen server arrives as `guild_id`, which is stored as the brand's
// permanent Discord identifier.

const LOG = "[discord:install]"

function backTo(req: NextRequest, returnTo: string, params: Record<string, string>) {
  const base = appBaseUrl(req)
  const qs = new URLSearchParams(params).toString()
  return NextResponse.redirect(`${base}${returnTo}${returnTo.includes("?") ? "&" : "?"}${qs}`)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const cookie = req.cookies.get(INSTALL_STATE_COOKIE)?.value
  const [cookieState, returnTo = "/dashboard/community"] = (cookie ?? "").split("|")

  if (!session?.user?.id) {
    return backTo(req, "/login", { error: "Sign in to connect Discord." })
  }

  const sp = req.nextUrl.searchParams

  // The owner cancelled on Discord's screen. Not an error — return quietly so
  // they land back on the onboarding screen rather than a failure page.
  if (sp.get("error")) {
    return backTo(req, returnTo, { discordCancelled: "1" })
  }

  const state = sp.get("state")
  const guildId = sp.get("guild_id")

  if (!state || !cookieState || state !== cookieState) {
    console.warn(`${LOG} state mismatch`)
    return backTo(req, returnTo, { discordError: "Security check failed. Please try again." })
  }

  const verified = verifyInstallState(state, session.user.id)
  if (!verified.ok) {
    console.warn(`${LOG} state signature invalid for user ${session.user.id}`)
    return backTo(req, returnTo, { discordError: "Security check failed. Please try again." })
  }

  // Re-check brand access on the callback too — the state proves intent, not
  // current authorisation, and membership could have changed mid-flow.
  const brand = await checkBrandAccess(verified.brandId, session.user.id)
  if (!brand) {
    return backTo(req, returnTo, { discordError: "You no longer have access to this workspace." })
  }

  if (!guildId) {
    // Happens if the user authorized without selecting a server.
    return backTo(req, returnTo, {
      discordError: "No server was selected. Please try again and choose a server.",
    })
  }

  const result = await connectBrandByGuildId(verified.brandId, guildId, session.user.id)

  const res = result.ok
    ? backTo(req, returnTo, { discordConnected: "1" })
    : backTo(req, returnTo, { discordError: result.error })

  res.cookies.delete(INSTALL_STATE_COOKIE)
  return res
}

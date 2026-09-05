import { NextRequest, NextResponse } from "next/server"
import { guardBrand } from "@/lib/discord/route-guard"
import { getBrandConnection, refreshBrandConnection, botInstallUrl } from "@/lib/discord/connection"
import { isBotTokenConfigured } from "@/lib/discord/bot-client"
import { appBaseUrl, appBaseUrlSource, appUrl } from "@/lib/app-url"
import { OAUTH_CALLBACK_PATH } from "@/app/api/community/discord/oauth/start/route"
import { INSTALL_CALLBACK_PATH } from "@/app/api/community/discord/install/route"

// GET /api/brands/:brandId/integrations/discord/status
// ?refresh=1 re-checks bot membership against Discord instead of reading cache.
//
// Returns only THIS brand's connection. A caller who isn't a member of the
// brand never reaches the query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrand(brandId)
    if (!guard.ok) return guard.response

    const wantsRefresh = req.nextUrl.searchParams.get("refresh") === "1"
    if (wantsRefresh) {
      // Best-effort: a failed re-check still returns the stored row below, with
      // its updated status, rather than erroring the whole request.
      await refreshBrandConnection(brandId).catch(() => null)
    }

    const connection = await getBrandConnection(brandId)

    // Deployment-level configuration. Presence only — never log secret values.
    const env = {
      DISCORD_CLIENT_ID: Boolean(process.env.DISCORD_CLIENT_ID),
      DISCORD_CLIENT_SECRET: Boolean(process.env.DISCORD_CLIENT_SECRET),
      DISCORD_BOT_TOKEN: Boolean(process.env.DISCORD_BOT_TOKEN),
      NEXTAUTH_URL: Boolean(process.env.NEXTAUTH_URL),
      NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
    }

    // The exact strings that must be registered in the Discord developer portal
    // for THIS deployment. Not a secret, and it turns "Invalid OAuth2
    // redirect_uri" from guesswork into a copy-paste — on localhost and on
    // production alike, since both resolve through the same helper.
    const redirectUris = {
      base: appBaseUrl(req),
      baseSource: appBaseUrlSource(req),
      oauth: appUrl(OAUTH_CALLBACK_PATH, req),
      install: appUrl(INSTALL_CALLBACK_PATH, req),
    }

    // The onboarding state machine, named explicitly so the client never has to
    // infer a step from the absence of a field.
    const configured = isBotTokenConfigured() && env.DISCORD_CLIENT_ID
    const connected = connection?.status === "connected"
    const botInstalled = connection ? connection.status !== "bot_missing" : false
    const accountLinked = Boolean(guard.discordUserId)
    const setupComplete = configured && connected && accountLinked

    // Logged only when the deployment itself is misconfigured — that is rare,
    // actionable, and names the missing variable. The previous unconditional
    // log ran on every poll of this route (every 4s per open tab during setup),
    // which is a lot of production noise for a line nobody reads when the
    // answer is "everything is fine".
    if (!configured) {
      const missing = Object.entries(env)
        .filter(([, present]) => !present)
        .map(([name]) => name)
      console.warn(
        `[community/status] Discord is not configured for this deployment. ` +
          `Missing: ${missing.join(", ") || "none — check DISCORD_BOT_TOKEN validity"}. ` +
          `base=${redirectUris.base} (via ${redirectUris.baseSource})`
      )
    }

    return NextResponse.json({
      configured,
      connected,
      botInstalled,
      accountLinked,
      setupComplete,
      connection,
      /** Presence only — safe to expose, tells the admin what to fix. */
      env,
      /** What to register in the Discord developer portal for this origin. */
      redirectUris,
      /** Which Discord account is linked, for the "Connected Account" row. */
      discordUsername: guard.discordUsername,
      /**
       * The `**DisplayName**: ` prefix every message THIS user sends carries —
       * see sendMessage's own comment. The client uses it only to decide
       * whether to SHOW the edit/delete actions on a message; the server
       * re-derives and re-checks the same thing independently in
       * isOwnMessage before either action is actually allowed to run.
       */
      displayName: guard.displayName,
      /** Retained for existing callers. */
      botConfigured: configured,
      discordLinked: accountLinked,
      /** Offered when the bot still needs adding to the brand's own server. */
      botInstallUrl: connection ? botInstallUrl(connection.guildId) : botInstallUrl(),
    })
  } catch (error) {
    console.error("[GET discord/status]", error)
    return NextResponse.json({ error: "Failed to load Discord status" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { STATE_COOKIE, verifyState, redirectUri } from "../start/route"
import { appBaseUrl } from "@/lib/app-url"

// GET /api/community/discord/oauth/callback
//
// Exchanges the code for the Discord user's identity, stores the linkage, and
// discards the token immediately.
//
// The access token is deliberately NOT persisted. It is used once, in this
// request, to read /users/@me — after that the bot does all the work, so
// keeping a user token would be storing a credential we never use and would
// have to refresh, rotate and protect. The only thing worth keeping is the
// Discord user id.

const LOG = "[discord:oauth]"

function fail(req: NextRequest, reason: string) {
  const base = appBaseUrl(req)
  return NextResponse.redirect(`${base}/dashboard/community?discordError=${encodeURIComponent(reason)}`)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return fail(req, "You must be signed in to link Discord.")

  const sp = req.nextUrl.searchParams
  if (sp.get("error")) {
    // User clicked Cancel on Discord's consent screen — not an error worth shouting about.
    return fail(req, "Discord linking was cancelled.")
  }

  const code = sp.get("code")
  const state = sp.get("state")
  if (!code || !state) return fail(req, "Discord returned an incomplete response.")

  const cookie = req.cookies.get(STATE_COOKIE)?.value
  if (!cookie) return fail(req, "The link request expired. Please try again.")
  const [cookieState, returnTo = "/dashboard/community"] = cookie.split("|")

  // Two checks: the state must match the cookie AND be a valid HMAC bound to
  // this session's user. Either alone is insufficient.
  if (cookieState !== state || !verifyState(state, session.user.id)) {
    console.warn(`${LOG} state mismatch for user ${session.user.id}`)
    return fail(req, "Security check failed. Please try linking again.")
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) return fail(req, "Discord OAuth isn't configured on the server.")

  let tokenRes: Response
  try {
    tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(req),
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    console.error(`${LOG} token exchange failed:`, err instanceof Error ? err.message : err)
    return fail(req, "Couldn't reach Discord. Please try again.")
  }

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "")
    console.error(`${LOG} token exchange HTTP ${tokenRes.status}: ${body.slice(0, 200)}`)
    return fail(req, "Discord rejected the link request.")
  }

  const token = (await tokenRes.json()) as { access_token?: string }
  if (!token.access_token) return fail(req, "Discord didn't return an access token.")

  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)

  if (!meRes?.ok) {
    console.error(`${LOG} /users/@me failed: HTTP ${meRes?.status}`)
    return fail(req, "Couldn't read your Discord profile.")
  }

  const me = (await meRes.json()) as { id?: string; username?: string; global_name?: string }
  if (!me.id) return fail(req, "Discord didn't return a user id.")

  // One Discord account per Instroom user, and vice versa — otherwise two
  // users could link the same Discord identity and inherit its permissions.
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM User WHERE discord_user_id = ${me.id} AND id != ${session.user.id} LIMIT 1`
  if (existing.length > 0) {
    return fail(req, "That Discord account is already linked to another Instroom user.")
  }

  const displayName = (me.global_name || me.username || "").slice(0, 64)
  await prisma.$executeRaw`
    UPDATE User
    SET discord_user_id = ${me.id}, discord_username = ${displayName}, discord_linked_at = NOW(3)
    WHERE id = ${session.user.id}`

  console.log(`${LOG} linked Instroom user ${session.user.id} → Discord ${me.id}`)

  const base = appBaseUrl(req)
  // `?` only when returnTo carries no query of its own, otherwise `&` — the
  // same join the install callback's backTo() already uses.
  //
  // This used to hardcode `?`. That was harmless only while returnTo was always
  // the bare "/dashboard/community"; once it started carrying the page's own
  // query (?brandId=...), the redirect became
  //
  //     /dashboard/community?brandId=cmt3tvtr4...?discordLinked=1
  //
  // and a second "?" is not a delimiter — it is part of the PRECEDING value. So
  // searchParams.get("brandId") returned "cmt3tvtr4...?discordLinked=1", which
  // the community page then encoded straight into the status path as
  // /api/brands/cmt3tvtr4...%3FdiscordLinked%3D1/integrations/discord/status —
  // a brand id that matches nothing, answered with 403. Exactly the failure the
  // Outlook callback documents for the same reason.
  const separator = returnTo.includes("?") ? "&" : "?"
  const res = NextResponse.redirect(`${base}${returnTo}${separator}discordLinked=1`)
  res.cookies.delete(STATE_COOKIE)
  return res
}

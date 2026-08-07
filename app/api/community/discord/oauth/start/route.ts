import { NextRequest, NextResponse } from "next/server"
import { randomBytes, createHmac } from "crypto"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { appUrl, appBaseUrlSource } from "@/lib/app-url"

// GET /api/community/discord/oauth/start?returnTo=/dashboard/community
//
// Begins the Discord account link. OAuth here is ONLY for identity — it tells
// us which Discord user this Instroom user is, so channel visibility can be
// computed from their real roles. All messaging is done by the bot; no user
// token is ever requested, stored, or used.
//
// Scopes are deliberately minimal:
//   identify            → the Discord user id (the whole point)
//   guilds.members.read → roles within a guild, for permission filtering

const SCOPES = ["identify", "guilds.members.read"].join(" ")
export const STATE_COOKIE = "discord_oauth_state"

/**
 * State is HMAC'd with NEXTAUTH_SECRET and bound to the session user, so a
 * state minted for one account can't be replayed to link a Discord identity
 * onto someone else's.
 */
export function signState(userId: string, nonce: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? ""
  const payload = `${userId}.${nonce}`
  const sig = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

export function verifyState(state: string, userId: string): boolean {
  const parts = state.split(".")
  if (parts.length !== 3) return false
  const [stateUserId, nonce, sig] = parts
  if (stateUserId !== userId) return false
  const expected = createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "")
    .update(`${stateUserId}.${nonce}`)
    .digest("base64url")
  // Length-safe comparison; both are base64url of the same digest length.
  return sig.length === expected.length && sig === expected
}

/**
 * The callback URL registered in the Discord developer portal.
 *
 * The path is fixed by where the callback route lives on disk; only the origin
 * varies by environment, and that comes from appBaseUrl — so localhost and
 * production are the same code path with different configuration, and neither
 * origin is written down here.
 */
export const OAUTH_CALLBACK_PATH = "/api/community/discord/oauth/callback"

export function redirectUri(req: NextRequest): string {
  return appUrl(OAUTH_CALLBACK_PATH, req)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Discord OAuth isn't configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET." },
      { status: 503 }
    )
  }

  const state = signState(session.user.id, randomBytes(16).toString("base64url"))

  // Only same-origin relative paths — prevents this becoming an open redirect.
  const requested = req.nextUrl.searchParams.get("returnTo") ?? "/dashboard/community"
  const returnTo = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard/community"

  const uri = redirectUri(req)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: uri,
    response_type: "code",
    scope: SCOPES,
    state,
    prompt: "consent",
  })

  const authorizeUrl = `https://discord.com/oauth2/authorize?${params}`

  // One line, and only what's needed if Discord rejects the redirect: the URI
  // it will compare against the portal entry, and where that origin came from.
  // (The encode/decode round-trip this used to print was scaffolding for
  // diagnosing a double-encoding bug that no longer exists.)
  console.log(`[discord:oauth] authorize redirect_uri=${uri} (via ${appBaseUrlSource(req)})`)

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set(STATE_COOKIE, `${state}|${returnTo}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must survive the redirect back from Discord
    path: "/",
    maxAge: 600,
  })
  return res
}

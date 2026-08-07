import { NextRequest, NextResponse } from "next/server"
import { randomBytes, createHmac } from "crypto"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkBrandAccess } from "@/lib/community-access"
import { appUrl } from "@/lib/app-url"

// GET /api/community/discord/install?brandId=...&returnTo=/dashboard/community
//
// Starts the "Connect Discord Server" flow for ONE brand.
//
// Uses Discord's bot authorization with response_type=code, which returns the
// chosen `guild_id` on the callback. That's why this is preferred over asking
// for an invite link: the owner picks their server in Discord's own UI, the bot
// is installed in the same step, and we get the permanent guild ID directly
// with nothing to expire.
//
// The brand id is carried inside signed state rather than a query param on the
// callback, so it can't be swapped for another brand mid-flow.

export const INSTALL_STATE_COOKIE = "discord_install_state"

// View Channels + Send Messages + Read History + Attach Files + Embed Links +
// Add Reactions + Manage Messages.
const BOT_PERMISSIONS = "126016"

export function signInstallState(userId: string, brandId: string, nonce: string): string {
  const payload = `${userId}:${brandId}:${nonce}`
  const sig = createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "").update(payload).digest("base64url")
  return `${payload}:${sig}`
}

export function verifyInstallState(
  state: string,
  userId: string
): { ok: true; brandId: string } | { ok: false } {
  const parts = state.split(":")
  if (parts.length !== 4) return { ok: false }
  const [stateUserId, brandId, nonce, sig] = parts
  if (stateUserId !== userId) return { ok: false }
  const expected = createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "")
    .update(`${stateUserId}:${brandId}:${nonce}`)
    .digest("base64url")
  if (sig.length !== expected.length || sig !== expected) return { ok: false }
  return { ok: true, brandId }
}

/** Path is fixed by the route's location on disk; only the origin varies. */
export const INSTALL_CALLBACK_PATH = "/api/community/discord/install/callback"

export function installRedirectUri(req: NextRequest): string {
  return appUrl(INSTALL_CALLBACK_PATH, req)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const brandId = req.nextUrl.searchParams.get("brandId")
  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 })
  }

  // Tenant boundary: only someone with access to this brand may connect a
  // server to it.
  const brand = await checkBrandAccess(brandId, session.user.id)
  if (!brand) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "Discord isn't configured on this server. Set DISCORD_CLIENT_ID." },
      { status: 503 }
    )
  }

  const state = signInstallState(session.user.id, brandId, randomBytes(12).toString("base64url"))

  const requested = req.nextUrl.searchParams.get("returnTo") ?? "/dashboard/community"
  const returnTo =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard/community"

  const params = new URLSearchParams({
    client_id: clientId,
    // `bot` installs the bot; `identify` lets the callback confirm who acted.
    scope: "bot identify",
    permissions: BOT_PERMISSIONS,
    response_type: "code",
    redirect_uri: installRedirectUri(req),
    state,
  })

  const authorizeUrl = `https://discord.com/oauth2/authorize?${params}`
  // The redirect_uri is the one thing worth having in the log: a mismatch with
  // the Discord developer portal entry is the most common cause of
  // "Invalid OAuth2 redirect_uri", and it's not a secret.
  console.log(`[discord:install] authorize redirect_uri=${installRedirectUri(req)}`)

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set(INSTALL_STATE_COOKIE, `${state}|${returnTo}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must survive the redirect back from Discord
    path: "/",
    maxAge: 900,
  })
  return res
}

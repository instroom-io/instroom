import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const stateParam = searchParams.get("state")
  const error = searchParams.get("error")

  // ── User denied access ────────────────────────────────────────────────────
  if (error) {
    return NextResponse.redirect(
      new URL(`/inbox?gmailError=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/inbox?gmailError=missing_params", req.url)
    )
  }

  // ── Decode state ──────────────────────────────────────────────────────────
  let userId: string
  let returnTo: string = "/inbox"

  try {
    const decoded = JSON.parse(
      Buffer.from(stateParam, "base64url").toString("utf-8")
    )
    userId = decoded.userId
    returnTo = decoded.returnTo || "/inbox"
  } catch {
    return NextResponse.redirect(
      new URL("/inbox?gmailError=invalid_state", req.url)
    )
  }

  // ── Double-check the session still belongs to the same user ───────────────
  // (guards against CSRF — state userId must match the active session)
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.id !== userId) {
    return NextResponse.redirect(
      new URL("/login?gmailError=session_mismatch", req.url)
    )
  }

  // ── Exchange code for tokens ──────────────────────────────────────────────
  let accessToken: string
  let refreshToken: string | null
  let expiresAt: number | null
  let googleAccountId: string
  let googleEmail: string
  let scope: string

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/gmail/callback`,
        grant_type: "authorization_code",
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Gmail token exchange failed:", tokenData)
      return NextResponse.redirect(
        new URL(
          `/inbox?gmailError=${encodeURIComponent(tokenData.error_description || "token_exchange_failed")}`,
          req.url
        )
      )
    }

    accessToken = tokenData.access_token
    refreshToken = tokenData.refresh_token || null
    scope = tokenData.scope || ""
    expiresAt = tokenData.expires_in
      ? Math.floor(Date.now() / 1000) + tokenData.expires_in
      : null

    // ── Fetch Google profile to get the stable Google account ID ─────────────
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const profile = await profileRes.json()
    googleAccountId = profile.id      // stable Google sub / account ID
    googleEmail = profile.email || ""
  } catch (err) {
    console.error("Gmail OAuth callback error:", err)
    return NextResponse.redirect(
      new URL("/inbox?gmailError=network_error", req.url)
    )
  }

  // ── Upsert into Account table ─────────────────────────────────────────────
  // If a Google Account row already exists for this user, update it.
  // If not, create one. This is separate from NextAuth's own account row
  // (NextAuth uses "openid email profile" scopes); we store the Gmail-scoped
  // tokens here so the credentials user gets Gmail access without re-logging in.
  try {
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: googleAccountId,
        },
      },
      create: {
        userId,
        type: "oauth",
        provider: "google",
        providerAccountId: googleAccountId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        token_type: "Bearer",
        scope,
        id_token: null,
      },
      update: {
        userId,                        // re-bind in case the Google account was previously linked elsewhere
        access_token: accessToken,
        // Only overwrite refresh_token if Google gave us a new one.
        // Google only returns refresh_token on the first consent or after revocation.
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
        expires_at: expiresAt,
        scope,
      },
    })
  } catch (err) {
    console.error("Failed to save Gmail tokens:", err)
    return NextResponse.redirect(
      new URL("/inbox?gmailError=db_error", req.url)
    )
  }

  // ── Done — redirect back to inbox ─────────────────────────────────────────
  return NextResponse.redirect(
    new URL(`${returnTo}?gmailConnected=1`, req.url)
  )
}
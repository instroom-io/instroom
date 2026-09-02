import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { GMAIL_PROVIDER } from "@/lib/gmail"
import { decodeOAuthConnectState } from "@/lib/oauth-connect-state"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const stateParam = searchParams.get("state")
  const error = searchParams.get("error")

  // ── User denied access ────────────────────────────────────────────────────
  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/inbox?gmailError=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/dashboard/inbox?gmailError=missing_params", req.url)
    )
  }

  // ── Decode state ──────────────────────────────────────────────────────────
  // Encrypted, so it's tamper-proof — only this server could have produced
  // it, and only for whoever was logged in when they clicked "Connect". That
  // makes this the identity check on its own; no separate live-session
  // comparison needed (and that comparison used to break whenever the
  // provider's sign-in page landed in a different browser context than the
  // one that started the flow — see lib/oauth-connect-state.ts).
  const decoded = decodeOAuthConnectState(stateParam)
  if (!decoded) {
    return NextResponse.redirect(
      new URL("/dashboard/inbox?gmailError=invalid_state", req.url)
    )
  }
  const { userId, returnTo } = decoded

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
          `/dashboard/inbox?gmailError=${encodeURIComponent(tokenData.error_description || "token_exchange_failed")}`,
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
      new URL("/dashboard/inbox?gmailError=network_error", req.url)
    )
  }

  // ── Upsert into Account table ─────────────────────────────────────────────
  // If a Gmail Account row already exists for this user, update it.
  // If not, create one. Stored under its own provider label (GMAIL_PROVIDER),
  // deliberately distinct from NextAuth's own "google" login row — both would
  // otherwise upsert the same (provider, providerAccountId) row for the same
  // real Google account, and a later plain login would blindly overwrite
  // these Gmail-scoped tokens with login's narrower ones (Google omits
  // refresh_token on a repeat login, so that overwrite can silently null out
  // a working Gmail connection). Keeping this on its own row means the login
  // flow never touches it.
  try {
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: GMAIL_PROVIDER,
          providerAccountId: googleAccountId,
        },
      },
      create: {
        userId,
        type: "oauth",
        provider: GMAIL_PROVIDER,
        providerAccountId: googleAccountId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        token_type: "Bearer",
        scope,
        id_token: null,
        email: googleEmail || null,
        last_selected_at: new Date(),
      },
      update: {
        userId,                        // re-bind in case the Google account was previously linked elsewhere
        access_token: accessToken,
        // Only overwrite refresh_token if Google gave us a new one.
        // Google only returns refresh_token on the first consent or after revocation.
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
        expires_at: expiresAt,
        scope,
        email: googleEmail || null,
        // The whole point of reconnecting — this is what makes THIS account
        // "the most recently connected one" again, not just refreshed tokens
        // on an account that's still second-most-recent.
        last_selected_at: new Date(),
      },
    })
  } catch (err) {
    console.error("Failed to save Gmail tokens:", err)
    return NextResponse.redirect(
      new URL("/dashboard/inbox?gmailError=db_error", req.url)
    )
  }

  // ── Done — redirect back to inbox ─────────────────────────────────────────
  // Built via URL/searchParams rather than string concatenation: returnTo
  // already carries `?brandId=...` once a workspace is selected, and naively
  // appending `?gmailConnected=1` produced a second `?` (…brandId=X?gmailConnected=1)
  // instead of `&` — brandId then failed to parse, and the page fell back to
  // "no workspace selected" until the user manually reselected one.
  const successUrl = new URL(returnTo, req.url)
  successUrl.searchParams.set("gmailConnected", "1")
  return NextResponse.redirect(successUrl)
}
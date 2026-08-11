import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  MICROSOFT_TOKEN_URL,
  OUTLOOK_NOT_CONFIGURED,
  logMissingMicrosoftConfig,
  outlookRedirectUri,
  readMicrosoftOAuthConfig,
} from "@/lib/microsoft-oauth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const stateParam = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/inbox?outlookError=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/dashboard/inbox?outlookError=missing_params", req.url)
    )
  }

  let userId: string
  let returnTo: string = "/dashboard/inbox"

  try {
    const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf-8"))
    userId = decoded.userId
    returnTo = decoded.returnTo || "/dashboard/inbox"
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/inbox?outlookError=invalid_state", req.url)
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.id !== userId) {
    return NextResponse.redirect(
      new URL("/login?outlookError=session_mismatch", req.url)
    )
  }

  // Same guard as /connect: without credentials the exchange would post
  // client_id=undefined and fail with an unrelated-looking error.
  const configResult = readMicrosoftOAuthConfig()
  if (!configResult.ok) {
    logMissingMicrosoftConfig("callback", configResult.missing)
    return NextResponse.redirect(
      new URL(`/dashboard/inbox?outlookError=${OUTLOOK_NOT_CONFIGURED}`, req.url)
    )
  }

  let accessToken: string
  let refreshToken: string | null
  let expiresAt: number | null
  let microsoftAccountId: string
  let scope: string

  try {
    const tokenRes = await fetch(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: configResult.config.clientId,
        client_secret: configResult.config.clientSecret,
        // Built by the same helper /connect used, so the two strings are
        // identical — Microsoft rejects the exchange if they differ at all.
        redirect_uri: outlookRedirectUri(req),
        grant_type: "authorization_code",
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/inbox?outlookError=${encodeURIComponent(tokenData.error_description || "token_exchange_failed")}`,
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

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const profile = await profileRes.json()
    microsoftAccountId = profile.id
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/inbox?outlookError=network_error", req.url)
    )
  }

  try {
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "microsoft",
          providerAccountId: microsoftAccountId,
        },
      },
      create: {
        userId,
        type: "oauth",
        provider: "microsoft",
        providerAccountId: microsoftAccountId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        token_type: "Bearer",
        scope,
        id_token: null,
      },
      update: {
        userId,
        access_token: accessToken,
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
        expires_at: expiresAt,
        scope,
      },
    })
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/inbox?outlookError=db_error", req.url)
    )
  }

  return NextResponse.redirect(
    new URL(`${returnTo}?outlookConnected=1`, req.url)
  )
}

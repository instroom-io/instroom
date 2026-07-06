import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

  let accessToken: string
  let refreshToken: string | null
  let expiresAt: number | null
  let microsoftAccountId: string
  let scope: string

  try {
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/outlook/callback`,
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

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  MICROSOFT_AUTHORIZE_URL,
  OUTLOOK_NOT_CONFIGURED,
  OUTLOOK_SCOPES,
  logMissingMicrosoftConfig,
  outlookRedirectUri,
  readMicrosoftOAuthConfig,
} from "@/lib/microsoft-oauth"

// Required env vars: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
// App registration: https://portal.azure.com → App registrations
// Redirect URI to add: {this deployment's origin}/api/outlook/callback
//   production: https://instroom.io/api/outlook/callback

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Validate BEFORE building the URL. Previously a missing MICROSOFT_CLIENT_ID
  // was interpolated as the string "undefined" and the user was redirected to
  // Microsoft with `client_id=undefined`, which fails at Microsoft with an
  // opaque error and leaves no trace in our logs.
  const configResult = readMicrosoftOAuthConfig()
  if (!configResult.ok) {
    logMissingMicrosoftConfig("connect", configResult.missing)
    return NextResponse.redirect(
      new URL(`/dashboard/inbox?outlookError=${OUTLOOK_NOT_CONFIGURED}`, req.url)
    )
  }

  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      returnTo: req.nextUrl.searchParams.get("returnTo") || "/dashboard/inbox",
    })
  ).toString("base64url")

  const params = new URLSearchParams({
    client_id: configResult.config.clientId,
    redirect_uri: outlookRedirectUri(req),
    response_type: "code",
    scope: OUTLOOK_SCOPES.join(" "),
    response_mode: "query",
    // Without this Microsoft silently reuses whichever account the browser is
    // already signed in to, so "Connect another Outlook account" only ever
    // refreshed the SAME Account row — there was never a second account to
    // switch to. The Gmail route has passed "consent select_account" all
    // along; this is the Microsoft equivalent.
    prompt: "select_account",
    state,
  })

  return NextResponse.redirect(`${MICROSOFT_AUTHORIZE_URL}?${params.toString()}`)
}

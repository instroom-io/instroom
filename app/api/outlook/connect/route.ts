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
import { appBaseUrlSource } from "@/lib/app-url"
import { decodeOAuthConnectState, encodeOAuthConnectState } from "@/lib/oauth-connect-state"

// Required env vars: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
// App registration: https://portal.azure.com → App registrations
// Redirect URI to add: {this deployment's origin}/api/outlook/callback
//   production: https://instroom.io/api/outlook/callback

export async function GET(req: NextRequest) {
  // The inbox page opens this route in a popup and can hand it a pre-built
  // identity token (minted by /api/oauth-handoff from the ORIGINAL tab,
  // which is guaranteed to have a live session) instead of relying on this
  // route's own session cookie — necessary because Microsoft's sign-in page
  // can land the popup in a different Edge browser profile with no
  // Instroom session at all before this code ever runs. Falls back to the
  // normal session check for any direct/non-popup access.
  const tokenParam = req.nextUrl.searchParams.get("token")
  let userId: string
  let returnTo: string

  if (tokenParam) {
    const decoded = decodeOAuthConnectState(tokenParam)
    if (!decoded) {
      return NextResponse.redirect(
        new URL("/dashboard/inbox?outlookError=invalid_state", req.url)
      )
    }
    userId = decoded.userId
    returnTo = decoded.returnTo
  } else {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
    userId = session.user.id
    returnTo = req.nextUrl.searchParams.get("returnTo") || "/dashboard/inbox"
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

  // Reuse the handoff token as-is when one was given (already encrypted,
  // freshly minted) instead of encoding a second one.
  const state = tokenParam ?? encodeOAuthConnectState({ userId, returnTo })

  // Logged so the exact string Microsoft must have registered is recoverable
  // from any deployment's logs, instead of being inferred. No secret in it.
  const redirectUri = outlookRedirectUri(req)
  console.log(
    `[outlook] connect: redirect_uri=${redirectUri} (origin resolved from ${appBaseUrlSource(req)}). ` +
      `This exact URI must be registered in Microsoft Entra → App registrations → Authentication → Redirect URIs (Web).`
  )

  const params = new URLSearchParams({
    client_id: configResult.config.clientId,
    redirect_uri: redirectUri,
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

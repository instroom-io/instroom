import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { decodeOAuthConnectState, encodeOAuthConnectState } from "@/lib/oauth-connect-state"

export async function GET(req: NextRequest) {
  // The inbox page opens this route in a popup and can hand it a pre-built
  // identity token (minted by /api/oauth-handoff from the ORIGINAL tab,
  // which is guaranteed to have a live session) instead of relying on this
  // route's own session cookie — same handoff Outlook's connect route uses,
  // kept consistent across both providers even though Google's sign-in page
  // doesn't trigger the Edge profile-switching issue that made this
  // necessary for Outlook. Falls back to the normal session check for any
  // direct/non-popup access.
  const tokenParam = req.nextUrl.searchParams.get("token")
  let userId: string
  let returnTo: string

  if (tokenParam) {
    const decoded = decodeOAuthConnectState(tokenParam)
    if (!decoded) {
      return NextResponse.redirect(
        new URL("/dashboard/inbox?gmailError=invalid_state", req.url)
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

  // Build the Google OAuth URL with Gmail scopes. Reuse the handoff token
  // as-is when one was given (already encrypted, freshly minted) instead of
  // encoding a second one.
  const state = tokenParam ?? encodeOAuthConnectState({ userId, returnTo })

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/gmail/callback`,
    response_type: "code",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ].join(" "),
    access_type: "offline",
    // "consent" guarantees a refresh_token every time; "select_account" forces
    // Google's account chooser even when only one Google session is active in
    // the browser, so switching which Gmail gets connected is always possible
    // without first signing out of Google elsewhere. Same reasoning already
    // applied to the login flow's Google provider — see lib/auth.ts.
    prompt: "consent select_account",
    state,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
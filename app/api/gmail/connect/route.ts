import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Build the Google OAuth URL with Gmail scopes.
  // We pass the user's internal ID as `state` so the callback
  // knows which DB user to attach the tokens to.
  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      returnTo: req.nextUrl.searchParams.get("returnTo") || "/dashboard/inbox",
    })
  ).toString("base64url")

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
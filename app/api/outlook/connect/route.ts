import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Required env vars: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
// App registration: https://portal.azure.com → App registrations
// Redirect URI to add: {NEXTAUTH_URL}/api/outlook/callback

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      returnTo: req.nextUrl.searchParams.get("returnTo") || "/dashboard/inbox",
    })
  ).toString("base64url")

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/outlook/callback`,
    response_type: "code",
    scope: [
      "openid",
      "email",
      "profile",
      "https://graph.microsoft.com/Mail.Read",
      "https://graph.microsoft.com/Mail.Send",
      "https://graph.microsoft.com/User.Read",
      "offline_access",
    ].join(" "),
    response_mode: "query",
    state,
  })

  return NextResponse.redirect(
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  )
}

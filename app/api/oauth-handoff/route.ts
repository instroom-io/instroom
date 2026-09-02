import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { encodeOAuthConnectState } from "@/lib/oauth-connect-state"

// Called from the ORIGINAL tab — guaranteed to have a live session — right
// before it opens the Gmail/Outlook "connect a mailbox" popup. Hands that
// popup a pre-built, encrypted identity token instead of requiring it to
// authenticate itself via cookie, because the popup can land in a
// completely different browser context by the time it matters: Microsoft's
// sign-in page triggers Edge's automatic profile-switching for Microsoft
// domains, which can drop the Instroom session cookie the popup would
// otherwise need. See lib/oauth-connect-state.ts for why the token itself
// is safe to trust without also checking a session.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/dashboard/inbox"
  const token = encodeOAuthConnectState({ userId: session.user.id, returnTo })
  return NextResponse.json({ token })
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getOutlookAccessToken, outlookTokenErrorMessage } from "@/lib/microsoft-oauth"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userId = session.user?.id
  if (!userId) {
    return NextResponse.json({ error: "No user session" }, { status: 401 })
  }

  const requestedAccountId = req.nextUrl.searchParams.get("accountId") || null
  const tokenResult = await getOutlookAccessToken(userId, "star", requestedAccountId)
  if (!tokenResult.ok) {
    return NextResponse.json(
      { error: outlookTokenErrorMessage(tokenResult.reason), reauth: true },
      { status: tokenResult.reason === "not_configured" ? 503 : 403 }
    )
  }
  const accessToken = tokenResult.accessToken

  const { conversationId, starred } = await req.json().catch(() => ({}))
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 })
  }

  try {
    const listRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(`conversationId eq '${conversationId}'`)}&$select=id`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!listRes.ok) {
      const err = await listRes.json().catch(() => ({}))
      throw new Error(err?.error?.message || "Failed to look up conversation messages")
    }
    const { value: messages = [] } = await listRes.json()

    await Promise.all(
      messages.map((msg: { id: string }) =>
        fetch(`https://graph.microsoft.com/v1.0/me/messages/${msg.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ flag: { flagStatus: starred ? "flagged" : "notFlagged" } }),
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update star" }, { status: 500 })
  }
}

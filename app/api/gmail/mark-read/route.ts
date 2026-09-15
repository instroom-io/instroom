import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getGmailAccessToken } from "@/lib/gmail"

// Removes the UNREAD label on Gmail's side — the local "read" state set by
// openEmail/markAsRead (page.tsx) only changes Instroom's own view, so
// without this a thread reverted to unread on the next fetch.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const accessToken = await getGmailAccessToken(session.user?.id)
  if (!accessToken) {
    return NextResponse.json(
      { error: "No Google account linked. Please connect your Gmail account.", reauth: true },
      { status: 403 }
    )
  }

  const { threadId } = await req.json().catch(() => ({}))
  if (!threadId) {
    return NextResponse.json({ error: "threadId is required" }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || "Failed to mark thread as read")
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to mark thread as read" }, { status: 500 })
  }
}

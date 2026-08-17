import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getGmailAccessToken, shapeGmailThread } from "@/lib/gmail"

// Lazily fetches full detail (format=full — message bodies included) for a
// single thread. Used when the frontend opens a lightweight "sent, awaiting
// reply" entry from app/api/gmail/threads/route.ts's sentAwaitingReply list,
// which only carries headers/snippet — this is the same format=full call
// that route already makes for every INBOX thread, just deferred to
// click-time for the (usually much smaller) sent-only set.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params

  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err?.error?.message || "Failed to fetch thread")
    }

    const rawThread = await res.json()
    const { hasReply, ...thread } = shapeGmailThread(rawThread)

    return NextResponse.json({ thread })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch thread" }, { status: 500 })
  }
}

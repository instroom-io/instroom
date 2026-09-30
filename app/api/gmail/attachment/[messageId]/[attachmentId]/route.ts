import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getGmailAccessToken, sanitizeFilename } from "@/lib/gmail"

// GET /api/gmail/attachment/[messageId]/[attachmentId]?filename=...&mimeType=...
// Fetches actual attachment bytes on demand — thread loading only ever carries
// metadata (see shapeGmailThread in lib/gmail.ts), never bytes. filename/
// mimeType are passed as query params since the client already has both from
// that same thread metadata; Gmail's attachment endpoint itself returns only
// { size, data }, so there's no reason to make it re-derive them.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string; attachmentId: string }> }
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

  const { messageId, attachmentId } = await params
  const filename = req.nextUrl.searchParams.get("filename") || "attachment"
  const mimeType = req.nextUrl.searchParams.get("mimeType") || "application/octet-stream"

  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || "Failed to fetch attachment")
    }

    const { data } = await res.json()
    // Gmail's attachment bytes are base64URL-encoded, the same alternate
    // alphabet as message bodies (see decodeBody in lib/gmail.ts) — NOT
    // plain base64. Decoding without the -/_ -> +/ swap silently corrupts
    // every attachment's bytes.
    const buffer = Buffer.from(String(data).replace(/-/g, "+").replace(/_/g, "/"), "base64")

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${sanitizeFilename(filename)}"`,
        "Content-Length": String(buffer.length),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch attachment" }, { status: 500 })
  }
}

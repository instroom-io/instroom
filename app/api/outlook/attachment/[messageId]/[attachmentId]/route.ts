import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  MICROSOFT_TOKEN_URL,
  isAccessTokenExpired,
  logMicrosoftRefreshFailure,
  logMissingMicrosoftConfig,
  readMicrosoftOAuthConfig,
} from "@/lib/microsoft-oauth"

// Same token-resolution shape as app/api/outlook/threads/route.ts and
// app/api/outlook/send/route.ts (ordered by last_selected_at so all three
// resolve the same linked account, refreshed by row id so a refresh never
// clobbers a different account's token).
async function getMicrosoftToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "microsoft" },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
    orderBy: [{ last_selected_at: "desc" }, { id: "desc" }],
  })

  if (!account?.access_token) return null

  if (isAccessTokenExpired(account.expires_at) && account.refresh_token) {
    const configResult = readMicrosoftOAuthConfig()
    if (!configResult.ok) {
      logMissingMicrosoftConfig("attachment token refresh", configResult.missing)
      return null
    }

    const res = await fetch(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configResult.config.clientId,
        client_secret: configResult.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) {
      logMicrosoftRefreshFailure("attachment token refresh", res.status, data)
      return null
    }

    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: data.access_token,
        expires_at: data.expires_in
          ? Math.floor(Date.now() / 1000) + data.expires_in
          : null,
      },
    })
    return data.access_token
  }

  return account.access_token
}

function sanitizeFilename(name: string): string {
  const safe = name.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "")
  return safe.trim() || "attachment"
}

// GET /api/outlook/attachment/[messageId]/[attachmentId]
// Fetches actual attachment bytes on demand — thread loading only ever
// carries metadata (see the $expand=attachments(...) in threads/route.ts).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions) as any
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userId = session.user?.id
  if (!userId) {
    return NextResponse.json({ error: "No user session" }, { status: 401 })
  }

  const accessToken = await getMicrosoftToken(userId)
  if (!accessToken) {
    return NextResponse.json(
      { error: "No Outlook account linked. Please connect your Outlook account.", reauth: true },
      { status: 403 }
    )
  }

  const { messageId, attachmentId } = await params

  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || "Failed to fetch attachment")
    }

    const att = await res.json()
    if (!att.contentBytes) {
      // An itemAttachment/referenceAttachment, or a fileAttachment large
      // enough that Graph didn't inline it here — out of v1 scope.
      return NextResponse.json({ error: "This attachment can't be downloaded yet" }, { status: 415 })
    }

    // Graph's contentBytes is plain base64 (no URL-safe alphabet swap needed,
    // unlike Gmail's attachment bytes).
    const buffer = Buffer.from(att.contentBytes, "base64")

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": att.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(att.name || "attachment")}"`,
        "Content-Length": String(buffer.length),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch attachment" }, { status: 500 })
  }
}

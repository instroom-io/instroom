import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─── Token helper ─────────────────────────────────────────────────────────────

async function getAccessToken(session: any): Promise<string | null> {
  if (session.accessToken) return session.accessToken

  const userId = session.user?.id
  if (!userId) return null

  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { access_token: true, refresh_token: true, expires_at: true },
  })

  if (!account?.access_token) return null

  const isExpired = account.expires_at
    ? Date.now() > account.expires_at * 1000
    : false

  if (isExpired && account.refresh_token) {
    return refreshToken(account.refresh_token, userId)
  }

  return account.access_token
}

async function refreshToken(refresh_token: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) return null

    await prisma.account.updateMany({
      where: { userId, provider: "google" },
      data: {
        access_token: data.access_token,
        expires_at: data.expires_in
          ? Math.floor(Date.now() / 1000) + data.expires_in
          : null,
      },
    })

    return data.access_token
  } catch {
    return null
  }
}

// ─── Build RFC 2822 email message ─────────────────────────────────────────────

function buildRawEmail({
  to,
  from,
  subject,
  body,
  threadId,
  inReplyTo,
}: {
  to: string
  from: string
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
}): string {
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ``,
    body,
  ]

  const raw = lines.join("\r\n")
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const accessToken = await getAccessToken(session)

  if (!accessToken) {
    return NextResponse.json(
      { error: "No Google account linked. Please connect your Gmail account.", reauth: true },
      { status: 403 }
    )
  }

  const { to, from, subject, body, threadId, inReplyTo } = await req.json()

  if (!to || !body) {
    return NextResponse.json({ error: "Missing required fields: to, body" }, { status: 400 })
  }

  try {
    const raw = buildRawEmail({ to, from, subject: subject || "", body, threadId, inReplyTo })

    const payload: any = { raw }
    if (threadId) payload.threadId = threadId

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!sendRes.ok) {
      const err = await sendRes.json()
      throw new Error(err?.error?.message || "Failed to send email")
    }

    const sent = await sendRes.json()
    return NextResponse.json({ success: true, messageId: sent.id })
  } catch (err: any) {
    console.error("Gmail send error:", err)
    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 500 })
  }
}
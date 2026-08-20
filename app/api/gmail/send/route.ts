import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserSignatureHtml, plainTextBodyToHtml } from "@/lib/signature"
import { autoMarkContactedOnSend } from "@/lib/pipeline"
import { getGmailAccessToken } from "@/lib/gmail"

// ─── Build RFC 2822 email message ─────────────────────────────────────────────

function buildRawEmail({
  to,
  from,
  subject,
  body,
  threadId,
  inReplyTo,
  signatureHtml,
}: {
  to: string
  from: string
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
  signatureHtml?: string | null
}): string {
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`

  const lines = signatureHtml
    ? [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${replySubject}`,
        `Content-Type: text/html; charset="UTF-8"`,
        `MIME-Version: 1.0`,
        ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
        ``,
        plainTextBodyToHtml(body) + signatureHtml,
      ]
    : [
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

  const accessToken = await getGmailAccessToken(session.user?.id)

  if (!accessToken) {
    return NextResponse.json(
      { error: "No Google account linked. Please connect your Gmail account.", reauth: true },
      { status: 403 }
    )
  }

  const { to, from, subject, body, threadId, inReplyTo, brandId } = await req.json()

  if (!to || !body) {
    return NextResponse.json({ error: "Missing required fields: to, body" }, { status: 400 })
  }

  try {
    const signatureHtml = await getUserSignatureHtml(session.user.id)
    const raw = buildRawEmail({ to, from, subject: subject || "", body, threadId, inReplyTo, signatureHtml })

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

    try {
      await autoMarkContactedOnSend(brandId, to)
    } catch (err) {
      console.error("Auto-advance to Contacted failed:", err)
    }

    return NextResponse.json({ success: true, messageId: sent.id })
  } catch (err: any) {
    console.error("Gmail send error:", err)
    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 500 })
  }
}
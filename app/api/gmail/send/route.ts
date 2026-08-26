import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserSignatureHtml, plainTextBodyToHtml } from "@/lib/signature"
import { autoMarkContactedOnSend } from "@/lib/pipeline"
import { getGmailAccessToken } from "@/lib/gmail"

// Vercel Serverless Functions cap request bodies well under Gmail's own
// ~25MB attachment limit, so that's the real binding constraint here.
const MAX_TOTAL_ATTACHMENT_BYTES = 4 * 1024 * 1024

type Attachment = { filename: string; mimeType: string; data: Buffer }

// ─── Build RFC 2822 email message ─────────────────────────────────────────────

/** Strip anything that isn't safe as a bare (non-encoded) MIME filename —
 *  full RFC 2231 filename* encoding for non-ASCII names is skipped for v1. */
function sanitizeFilename(name: string): string {
  const safe = name.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "")
  return safe.trim() || "attachment"
}

function wrapBase64(base64: string): string {
  return base64.replace(/.{1,76}/g, "$&\r\n").trim()
}

function buildRawEmail({
  to,
  from,
  subject,
  body,
  threadId,
  inReplyTo,
  signatureHtml,
  isHtmlBody = false,
  attachments = [],
}: {
  to: string
  from: string
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
  signatureHtml?: string | null
  isHtmlBody?: boolean
  attachments?: Attachment[]
}): string {
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`

  // The body itself already has real HTML when it came from the rich compose
  // editor (isHtmlBody) — running it through plainTextBodyToHtml would
  // double-escape it. Plain-text callers (reply box) are unaffected since
  // they never set isHtmlBody.
  let bodyContentType: string
  let bodyText: string
  if (isHtmlBody) {
    bodyContentType = "text/html"
    bodyText = body + (signatureHtml ?? "")
  } else if (signatureHtml) {
    bodyContentType = "text/html"
    bodyText = plainTextBodyToHtml(body) + signatureHtml
  } else {
    bodyContentType = "text/plain"
    bodyText = body
  }

  const headerLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `MIME-Version: 1.0`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
  ]

  if (attachments.length === 0) {
    const lines = [
      ...headerLines,
      `Content-Type: ${bodyContentType}; charset="UTF-8"`,
      ``,
      bodyText,
    ]
    return encodeRaw(lines.join("\r\n"))
  }

  const boundary = `----=_Part_${crypto.randomUUID()}`
  const lines = [
    ...headerLines,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: ${bodyContentType}; charset="UTF-8"`,
    ``,
    bodyText,
    ``,
  ]

  for (const att of attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType || "application/octet-stream"}; name="${sanitizeFilename(att.filename)}"`,
      `Content-Disposition: attachment; filename="${sanitizeFilename(att.filename)}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrapBase64(att.data.toString("base64")),
      ``
    )
  }
  lines.push(`--${boundary}--`)

  return encodeRaw(lines.join("\r\n"))
}

/** The OUTER base64url pass — runs once over the whole already-built raw
 *  message for Gmail's `raw` field. Separate from (and unrelated to) the
 *  per-attachment base64 wrapping above, which is an RFC 2045 requirement for
 *  the inner MIME parts themselves. */
function encodeRaw(raw: string): string {
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

  let to: string, from: string | undefined, subject: string | undefined, body: string
  let threadId: string | undefined, inReplyTo: string | undefined, brandId: string | undefined
  let isHtmlBody = false
  const attachments: Attachment[] = []

  const contentType = req.headers.get("content-type") || ""
  if (contentType.includes("multipart/form-data")) {
    // Compose or reply, whenever attachments are attached.
    const form = await req.formData()
    to = String(form.get("to") || "")
    subject = String(form.get("subject") || "")
    body = String(form.get("body") || "")
    brandId = form.get("brandId") ? String(form.get("brandId")) : undefined
    threadId = form.get("threadId") ? String(form.get("threadId")) : undefined
    isHtmlBody = form.get("isHtmlBody") === "true"

    const files = form.getAll("attachments").filter((v): v is File => v instanceof File)
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: `Attachments must total under ${Math.round(MAX_TOTAL_ATTACHMENT_BYTES / (1024 * 1024))}MB` },
        { status: 400 }
      )
    }
    for (const file of files) {
      attachments.push({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        data: Buffer.from(await file.arrayBuffer()),
      })
    }
  } else {
    const jsonBody = await req.json()
    to = jsonBody.to
    from = jsonBody.from
    subject = jsonBody.subject
    body = jsonBody.body
    threadId = jsonBody.threadId
    inReplyTo = jsonBody.inReplyTo
    brandId = jsonBody.brandId
    isHtmlBody = Boolean(jsonBody.isHtmlBody)
  }

  if (!to || !body) {
    return NextResponse.json({ error: "Missing required fields: to, body" }, { status: 400 })
  }

  try {
    const signatureHtml = await getUserSignatureHtml(session.user.id)
    const raw = buildRawEmail({
      to,
      from: from || "",
      subject: subject || "",
      body,
      threadId,
      inReplyTo,
      signatureHtml,
      isHtmlBody,
      attachments,
    })

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

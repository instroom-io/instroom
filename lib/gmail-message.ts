import { plainTextBodyToHtml } from "@/lib/signature"
import { sanitizeFilename } from "@/lib/gmail"

// Raw message builder for Gmail's messages.send.

export type Attachment = { filename: string; mimeType: string; data: Buffer }

function wrapBase64(base64: string): string {
  return base64.replace(/.{1,76}/g, "$&\r\n").trim()
}

export function buildRawEmail({
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
  // "Re:" only on replies.
  const isReply = Boolean(threadId || inReplyTo)
  const replySubject = isReply && !/^re:/i.test(subject) ? `Re: ${subject}` : subject

  // Rich-editor bodies are already HTML; escaping them again would break them.
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

/** Base64url-encodes the whole message for Gmail's `raw` field. */
function encodeRaw(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

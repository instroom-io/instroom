import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserSignatureHtml } from "@/lib/signature"
import { autoMarkContactedOnSend } from "@/lib/pipeline"
import { getGmailAccessToken } from "@/lib/gmail"
import { buildRawEmail, type Attachment } from "@/lib/gmail-message"

// Vercel Serverless Functions cap request bodies well under Gmail's own
// ~25MB attachment limit, so that's the real binding constraint here.
const MAX_TOTAL_ATTACHMENT_BYTES = 4 * 1024 * 1024

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
  let includeSignature = true
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
    includeSignature = form.get("includeSignature") !== "false"

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
    includeSignature = jsonBody.includeSignature !== false
  }

  if (!to || !body) {
    return NextResponse.json({ error: "Missing required fields: to, body" }, { status: 400 })
  }

  try {
    const signatureHtml = includeSignature ? await getUserSignatureHtml(session.user.id) : null
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

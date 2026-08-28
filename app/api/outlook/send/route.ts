import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  forceRefreshOutlookAccessToken,
  getOutlookAccessToken,
  outlookTokenErrorMessage,
} from "@/lib/microsoft-oauth"
import { getUserSignatureHtml, plainTextBodyToHtml } from "@/lib/signature"
import { autoMarkContactedOnSend } from "@/lib/pipeline"

// Same platform-driven cap as the Gmail send route (Vercel Serverless
// Functions' request body limit, well under either provider's own ceiling).
const MAX_TOTAL_ATTACHMENT_BYTES = 4 * 1024 * 1024

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as any

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userId = session.user?.id
  if (!userId) {
    return NextResponse.json({ error: "No user session" }, { status: 401 })
  }

  // Same shared token path as /api/outlook/threads, so both routes resolve the
  // same mailbox and refresh it the same way. This route used to keep its own
  // copy, which had not received the ordering or update-by-id fixes.
  // Read before the token is resolved so a reply always goes out from the
  // mailbox the inbox was showing, not from whichever row is newest by
  // last_selected_at at the moment the request lands.
  const requestedAccountId =
    req.nextUrl.searchParams.get("accountId") || null

  const tokenResult = await getOutlookAccessToken(userId, "send", requestedAccountId)

  if (!tokenResult.ok) {
    return NextResponse.json(
      { error: outlookTokenErrorMessage(tokenResult.reason), reauth: true },
      { status: tokenResult.reason === "not_configured" ? 503 : 403 }
    )
  }

  let accessToken = tokenResult.accessToken
  const accountId = tokenResult.accountId

  let to: string, subject: string | undefined, body: string, brandId: string | undefined
  let isHtmlBody = false
  const attachments: { name: string; mimeType: string; data: Buffer }[] = []

  const contentType = req.headers.get("content-type") || ""
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    to = String(form.get("to") || "")
    subject = form.get("subject") ? String(form.get("subject")) : undefined
    body = String(form.get("body") || "")
    brandId = form.get("brandId") ? String(form.get("brandId")) : undefined
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
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        data: Buffer.from(await file.arrayBuffer()),
      })
    }
  } else {
    const jsonBody = await req.json()
    to = jsonBody.to
    subject = jsonBody.subject
    body = jsonBody.body
    brandId = jsonBody.brandId
    isHtmlBody = Boolean(jsonBody.isHtmlBody)
  }

  if (!to || !body) {
    return NextResponse.json({ error: "Missing required fields: to, body" }, { status: 400 })
  }

  const replySubject = subject?.startsWith("Re:") ? subject : subject ? `Re: ${subject}` : "(No subject)"

  try {
    const signatureHtml = await getUserSignatureHtml(userId)
    // The body itself already has real HTML when it came from the rich
    // compose editor (isHtmlBody) — running it through plainTextBodyToHtml
    // would double-escape it.
    let messageBody: { contentType: string; content: string }
    if (isHtmlBody) {
      messageBody = { contentType: "HTML", content: body + (signatureHtml ?? "") }
    } else if (signatureHtml) {
      messageBody = { contentType: "HTML", content: plainTextBodyToHtml(body) + signatureHtml }
    } else {
      messageBody = { contentType: "Text", content: body }
    }

    // Graph's sendMail takes attachments as a plain JSON array with the
    // content already base64-encoded — no manual MIME building needed here,
    // unlike Gmail's raw-message approach.
    const graphAttachments = attachments.map((att) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name,
      contentType: att.mimeType,
      contentBytes: att.data.toString("base64"),
    }))

    const graphBody = JSON.stringify({
      message: {
        subject: replySubject,
        body: messageBody,
        toRecipients: [{ emailAddress: { address: to } }],
        ...(graphAttachments.length > 0 ? { attachments: graphAttachments } : {}),
      },
      saveToSentItems: true,
    })

    const sendMail = (token: string) =>
      fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: graphBody,
      })

    let sendRes = await sendMail(accessToken)

    // One forced refresh and retry when Graph rejects a token we believed was
    // valid — the same recovery the threads route does. Safe to retry: a 401 is
    // refused at the authentication layer, so no mail was sent.
    if (sendRes.status === 401) {
      console.warn(
        `[outlook] send: Graph returned 401 for a token still marked valid (account ${accountId}) — forcing a refresh and retrying once.`
      )
      const retried = await forceRefreshOutlookAccessToken(userId, accountId, "send")
      if (retried) {
        accessToken = retried
        sendRes = await sendMail(retried)
      }
    }

    if (!sendRes.ok) {
      const err = await sendRes.json().catch(() => ({}))
      const message: string = err?.error?.message || "Failed to send email"
      console.error(
        `[outlook] send: Graph /me/sendMail failed (HTTP ${sendRes.status}) — ` +
          `${err?.error?.code ?? "unknown_code"}: ${String(message).slice(0, 300)}`
      )
      if (sendRes.status === 401 || sendRes.status === 403) {
        return NextResponse.json(
          { error: "Outlook authentication failed. Please reconnect your Outlook account.", reauth: true },
          { status: 403 }
        )
      }
      throw new Error(message)
    }

    try {
      await autoMarkContactedOnSend(brandId, to)
    } catch (err) {
      console.error("Auto-advance to Contacted failed:", err)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[outlook] send: unhandled failure —", err?.message || err)
    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 500 })
  }
}

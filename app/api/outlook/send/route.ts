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
import { getUserSignatureHtml, plainTextBodyToHtml } from "@/lib/signature"
import { autoMarkContactedOnSend } from "@/lib/pipeline"

// Same platform-driven cap as the Gmail send route (Vercel Serverless
// Functions' request body limit, well under either provider's own ceiling).
const MAX_TOTAL_ATTACHMENT_BYTES = 4 * 1024 * 1024

async function getMicrosoftToken(userId: string): Promise<string | null> {
  // Ordered, and `id` selected — both for the reasons the threads route already
  // documents, which had not been applied here:
  //
  //   orderBy  findFirst with no ordering returns whichever row the database
  //            hands back. With two Outlook accounts linked, a send could go
  //            out from a DIFFERENT mailbox than the one the inbox is showing.
  //            Same [last_selected_at desc, id desc] rule as the threads route
  //            and lib/gmail.ts, so all three resolve the same account.
  //
  //   id       needed below so the refreshed token is written to THIS row only.
  const account = await prisma.account.findFirst({
    where: { userId, provider: "microsoft" },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
    orderBy: [{ last_selected_at: "desc" }, { id: "desc" }],
  })

  if (!account?.access_token) return null

  if (isAccessTokenExpired(account.expires_at) && account.refresh_token) {
    // A refresh with client_id=undefined fails as "unauthorized_client", which
    // looks like a revoked grant. Return null instead so the caller's existing
    // "reconnect required" path runs, and say why in the log.
    const configResult = readMicrosoftOAuthConfig()
    if (!configResult.ok) {
      logMissingMicrosoftConfig("send token refresh", configResult.missing)
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
      // Why Microsoft refused, instead of a silent null. See
      // logMicrosoftRefreshFailure — this is what made a restriction on the
      // user's Microsoft account indistinguishable from a revoked grant.
      logMicrosoftRefreshFailure("send token refresh", res.status, data)
      return null
    }

    // By id, not by (userId, provider). updateMany wrote the newly refreshed
    // token onto EVERY linked Outlook account, so all of them then
    // authenticated as this one. The threads route fixed this; this copy had
    // not been.
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

export async function POST(req: NextRequest) {
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

    const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: replySubject,
          body: messageBody,
          toRecipients: [{ emailAddress: { address: to } }],
          ...(graphAttachments.length > 0 ? { attachments: graphAttachments } : {}),
        },
        saveToSentItems: true,
      }),
    })

    if (!sendRes.ok) {
      const err = await sendRes.json()
      throw new Error(err?.error?.message || "Failed to send email")
    }

    try {
      await autoMarkContactedOnSend(brandId, to)
    } catch (err) {
      console.error("Auto-advance to Contacted failed:", err)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Outlook send error:", err)
    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 500 })
  }
}

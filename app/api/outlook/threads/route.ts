import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  forceRefreshOutlookAccessToken,
  getOutlookAccessToken,
  outlookTokenErrorMessage,
} from "@/lib/microsoft-oauth"
import { autoAdvanceRepliedToInConversation } from "@/lib/pipeline"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get("brandId")

  const requestedAccountId = searchParams.get("accountId")

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userId = session.user?.id
  if (!userId) {
    return NextResponse.json({ error: "No user session", reauth: true }, { status: 401 })
  }

  const tokenResult = await getOutlookAccessToken(userId, "threads", requestedAccountId)

  if (!tokenResult.ok) {
    return NextResponse.json(
      { error: outlookTokenErrorMessage(tokenResult.reason), reauth: true },
      // A misconfigured deployment is not the user's session being expired, so
      // it must not present as one — reconnecting cannot fix it.
      { status: tokenResult.reason === "not_configured" ? 503 : 403 }
    )
  }

  let accessToken = tokenResult.accessToken
  const accountId = tokenResult.accountId
  const connectedEmail = tokenResult.email

  try {
    // ── Two changes here, both about the ~7s this request took ──────────────
    const fetchInbox = (token: string) =>
      fetch(
        "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages" +
          "?$top=200&$select=id,subject,from,toRecipients,body,bodyPreview,receivedDateTime,isRead,conversationId,flag" +
          "&$orderby=receivedDateTime+desc",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Prefer: 'outlook.body-content-type="text"',
          },
        }
      )

    const messagesPromise = fetchInbox(accessToken)

    const brandPromise: Promise<string | null> = brandId
      ? Promise.resolve(brandId)
      : userId
        ? prisma.brandMember
            .findFirst({
              where: { user_id: userId },
              select: { brand_id: true },
              orderBy: { created_at: "desc" },
            })
            .then((bm) => bm?.brand_id ?? null)
        : Promise.resolve(null)

    let [msgRes, resolvedBrandId] = await Promise.all([messagesPromise, brandPromise])

    if (msgRes.status === 401) {
      console.warn(
        `[outlook] threads: Graph returned 401 for a token still marked valid (account ${accountId}) — forcing a refresh and retrying once.`
      )
      const retried = await forceRefreshOutlookAccessToken(userId, accountId, "threads")
      if (retried) {
        accessToken = retried
        msgRes = await fetchInbox(retried)
      }
    }

    if (!msgRes.ok) {
      const err = await msgRes.json().catch(() => ({}))
      const message: string = err?.error?.message || "Failed to fetch messages"
      // Server-side so the Graph error code and request id are recoverable. The
      // body is Graph's own error object — it carries no token and no secret.
      console.error(
        `[outlook] threads: Graph /mailFolders/inbox/messages failed (HTTP ${msgRes.status}) — ` +
          `${err?.error?.code ?? "unknown_code"}: ${String(message).slice(0, 300)}`
      )
      if (msgRes.status === 401 || msgRes.status === 403) {
        return NextResponse.json(
          { error: "Outlook authentication failed. Please reconnect your Outlook account.", reauth: true },
          { status: 403 }
        )
      }
      throw new Error(message)
    }

    const msgData = await msgRes.json()
    const messages: any[] = msgData.value || []

    // Group by conversationId so threads appear as one item
    const convMap = new Map<string, any[]>()
    for (const msg of messages) {
      const convId = msg.conversationId || msg.id
      if (!convMap.has(convId)) convMap.set(convId, [])
      convMap.get(convId)!.push(msg)
    }

    const shapedThreads = Array.from(convMap.entries()).map(([convId, msgs]) => {
      const first = msgs[0]
      const senderEmail = first.from?.emailAddress?.address?.toLowerCase().trim() || ""
      const senderName = first.from?.emailAddress?.name || senderEmail.split("@")[0] || "Unknown"

      const shapedMessages = msgs.map((msg: any) => {
        const fromName = msg.from?.emailAddress?.name || ""
        const fromAddr = msg.from?.emailAddress?.address || ""
        const bodyText =
          msg.body?.contentType === "html"
            ? stripHtml(msg.body.content)
            : msg.body?.content || msg.bodyPreview || ""

        const attachments = (msg.hasAttachments ? msg.attachments || [] : [])
          .filter((a: any) => !a.isInline && (!a["@odata.type"] || a["@odata.type"] === "#microsoft.graph.fileAttachment"))
          .map((a: any) => ({
            id: a.id,
            filename: a.name || "attachment",
            mimeType: a.contentType || "application/octet-stream",
            size: a.size ?? 0,
          }))

        return {
          id: msg.id,
          from: fromName ? `${fromName} <${fromAddr}>` : fromAddr,
          subject: msg.subject || "(No subject)",
          date: msg.receivedDateTime || new Date().toISOString(),
          snippet: msg.bodyPreview || "",
          body: bodyText,
          isUser: false,
          attachments,
        }
      })

      return {
        id: convId,
        subject: first.subject || "(No subject)",
        snippet: first.bodyPreview || "",
        unread: msgs.some((m: any) => !m.isRead),
        starred: msgs.some((m: any) => m.flag?.flagStatus === "flagged"),
        messages: shapedMessages,
        senderEmail,
        senderName,
        lastMessageId: msgs[msgs.length - 1]?.id,
        source: "outlook",
      }
    })

    // Already resolved, concurrently with the Graph request above.
    const brand_id = resolvedBrandId

    if (!brand_id) {
      return NextResponse.json({
        accountId,
        connectedEmail,
        threads: shapedThreads.map(({ senderEmail, senderName, ...t }) => ({
          ...t,
          brandInfluencer: null,
        })),
      })
    }

    const senderEmails = [...new Set(shapedThreads.map((t) => t.senderEmail).filter(Boolean))]

    const brandInfluencers = await prisma.brandInfluencer.findMany({
      where: {
        brand_id,
        influencer: { email: { in: senderEmails } },
      },
      select: {
        id: true,
        contact_status: true,
        content_posted: true,
        stage: true,
        order_status: true,
        influencer: { select: { email: true } },
      },
    })

    const biByEmail = new Map(
      brandInfluencers.map((bi) => [bi.influencer.email?.toLowerCase(), bi])
    )

    const threads = shapedThreads.map(({ senderEmail, senderName, ...thread }) => ({
      ...thread,
      senderEmail,
      brandInfluencer: biByEmail.get(senderEmail) ?? null,
    }))

    const replyBrandInfluencerIds = threads
      .filter((t) => t.brandInfluencer)
      .map((t) => t.brandInfluencer!.id)
    autoAdvanceRepliedToInConversation(brand_id, replyBrandInfluencerIds).catch((err) =>
      console.error("Auto-advance to In Conversation failed:", err)
    )

    return NextResponse.json({ accountId, connectedEmail, threads })
  } catch (err: any) {
    console.error("[outlook] threads: unhandled failure —", err?.message || err)
    if (isDatabaseCapacityError(err)) return databaseCapacityResponse()
    return NextResponse.json(
      { error: err?.message || "Failed to fetch Outlook messages" },
      { status: 500 }
    )
  }
}

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
  // Which connected Outlook mailbox to read. Sent by the inbox account
  // switcher; absent for older clients, which keeps the previous behaviour.
  const requestedAccountId = searchParams.get("accountId")

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userId = session.user?.id
  if (!userId) {
    return NextResponse.json({ error: "No user session", reauth: true }, { status: 401 })
  }

  // One shared token path, in lib/microsoft-oauth.ts. This route and
  // /api/outlook/send each used to resolve and refresh the account themselves;
  // the two copies drifted, so a send could go out from a different mailbox
  // than the inbox was displaying.
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
  // Echoed on every response below so the client can prove which mailbox the
  // threads came from and discard a reply that arrived after a switch. Just the
  // row id and the address — never a token.
  const connectedEmail = tokenResult.email

  try {
    // ── Two changes here, both about the ~7s this request took ──────────────
    //
    // 1. The Prefer header. `$select` includes `body`, and for 200 messages that
    //    was 200 full HTML email bodies — by far the largest part of the wall
    //    clock, and nearly all of it discarded: stripHtml() immediately reduced
    //    each one to plain text. Asking Graph for text instead moves that
    //    conversion to Microsoft's side and transfers a fraction of the bytes.
    //    The shaping below already handles both content types (it only calls
    //    stripHtml when contentType is "html"), so the body text this route
    //    returns is the same text either way and the response shape is
    //    unchanged. Graph falls back to HTML if it cannot honour the header,
    //    which that same branch still covers.
    //
    // 2. Started BEFORE the brand-context query rather than after it — see the
    //    Promise.all below. The two do not depend on each other.
    const fetchInbox = (token: string) =>
      fetch(
        "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages" +
          "?$top=200&$select=id,subject,from,toRecipients,body,bodyPreview,receivedDateTime,isRead,conversationId" +
          "&$orderby=receivedDateTime+desc",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Prefer: 'outlook.body-content-type="text"',
          },
        }
      )

    const messagesPromise = fetchInbox(accessToken)

    // Resolve the brand while Graph works. This query only needs `userId`, which
    // we have had since the top of the request, so waiting for the mailbox first
    // put a full database round trip on the critical path for nothing — measured
    // at ~507ms against this deployment's database.
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

    // Graph can reject a token that `expires_at` still considers valid — it was
    // revoked server-side, or this host's clock is behind Microsoft's. One
    // forced refresh and retry is far cheaper than telling the user to
    // reconnect a mailbox whose grant is perfectly good.
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

        // Only real, user-attached files — never inline images (e.g. a logo
        // embedded in an HTML signature) or item/reference attachments (a
        // forwarded email/contact/event, or a OneDrive link), which aren't
        // downloadable the same way and are out of scope for v1.
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

    // Auto-advance influencers who replied to "In Conversation" — fire-and-forget
    // so it never adds latency to the response. Every thread here comes from the
    // inbox folder only, so a matched brandInfluencer always means an inbound
    // message (no per-message SENT-label check exists for Outlook, unlike Gmail).
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

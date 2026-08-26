import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  MICROSOFT_TOKEN_URL,
  logMissingMicrosoftConfig,
  readMicrosoftOAuthConfig,
} from "@/lib/microsoft-oauth"
import { autoAdvanceRepliedToInConversation } from "@/lib/pipeline"

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

async function refreshMicrosoftToken(refresh_token: string, accountId: string): Promise<string | null> {
  try {
    // A refresh with client_id=undefined fails as "unauthorized_client", which
    // looks like a revoked grant. Return null instead so the caller's existing
    // "reconnect required" path runs, and say why in the log.
    const configResult = readMicrosoftOAuthConfig()
    if (!configResult.ok) {
      logMissingMicrosoftConfig("threads token refresh", configResult.missing)
      return null
    }

    const res = await fetch(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configResult.config.clientId,
        client_secret: configResult.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) return null

    // By id, not by (userId, provider): a user can have several Outlook
    // accounts linked, and updateMany wrote the newly refreshed token onto all
    // of them — every other account then authenticated as this one.
    await prisma.account.update({
      where: { id: accountId },
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get("brandId")

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userId = session.user?.id
  if (!userId) {
    return NextResponse.json({ error: "No user session", reauth: true }, { status: 401 })
  }

  // Ordered, not arbitrary: with more than one Outlook account linked,
  // findFirst without an orderBy returned whichever row the database handed
  // back, so the inbox could show a different mailbox than the one the user
  // just picked. Same ordering as lib/gmail.ts's resolver.
  const account = await prisma.account.findFirst({
    where: { userId, provider: "microsoft" },
    select: { id: true, email: true, access_token: true, refresh_token: true, expires_at: true },
    orderBy: [{ last_selected_at: "desc" }, { id: "desc" }],
  })

  if (!account?.access_token) {
    return NextResponse.json(
      { error: "No Outlook account linked. Please connect your Outlook account.", reauth: true },
      { status: 403 }
    )
  }

  let accessToken = account.access_token
  const isExpired = account.expires_at ? Date.now() > account.expires_at * 1000 : false

  if (isExpired && account.refresh_token) {
    const refreshed = await refreshMicrosoftToken(account.refresh_token, account.id)
    if (!refreshed) {
      return NextResponse.json(
        { error: "Outlook session expired. Please reconnect your Outlook account.", reauth: true },
        { status: 403 }
      )
    }
    accessToken = refreshed
  }

  try {
    const msgRes = await fetch(
      "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages" +
        "?$top=200&$select=id,subject,from,toRecipients,body,bodyPreview,receivedDateTime,isRead,conversationId" +
        "&$orderby=receivedDateTime+desc",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!msgRes.ok) {
      const err = await msgRes.json()
      const message: string = err?.error?.message || "Failed to fetch messages"
      if (msgRes.status === 401 || msgRes.status === 403) {
        return NextResponse.json({ error: message, reauth: true }, { status: 403 })
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

        return {
          id: msg.id,
          from: fromName ? `${fromName} <${fromAddr}>` : fromAddr,
          subject: msg.subject || "(No subject)",
          date: msg.receivedDateTime || new Date().toISOString(),
          snippet: msg.bodyPreview || "",
          body: bodyText,
          isUser: false,
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

    // Resolve brand context
    let brand_id = brandId
    if (!brand_id && userId) {
      const brandMember = await prisma.brandMember.findFirst({
        where: { user_id: userId },
        select: { brand_id: true },
        orderBy: { created_at: "desc" },
      })
      brand_id = brandMember?.brand_id || null
    }

    if (!brand_id) {
      return NextResponse.json({
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

    return NextResponse.json({ threads })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch Outlook messages" }, { status: 500 })
  }
}

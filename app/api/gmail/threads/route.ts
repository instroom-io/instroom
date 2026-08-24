import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendNotification } from "@/lib/notifications"
import { autoAdvanceRepliedToInConversation } from "@/lib/pipeline"
import { getGmailAccessToken, getGmailAccountEmail, shapeGmailThread, getHeader } from "@/lib/gmail"

// Short-TTL in-memory cache so rapid refresh/mount cycles (e.g. React effects
// firing twice, quick manual "Refresh" clicks) don't repeat the full N-thread
// Gmail fan-out fetch. Keyed by user + the brandId the request was made with.
const THREADS_CACHE_TTL_MS = 15_000
const threadsCache = new Map<string, { expiresAt: number; body: any }>()

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get("brandId")

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json(
      { error: "Session expired. Please sign in again.", reauth: true },
      { status: 401 }
    )
  }

  // NEVER use session.accessToken here — the login-time Google OAuth (see
  // lib/auth.ts) deliberately requests only "openid email profile", with no
  // Gmail scopes at all. Gmail access always comes from a separate consent
  // via /api/gmail/connect, stored in the Account table below. Using the
  // session token first meant every Google-login user's request used a
  // scope-less token and got permanently rejected by Gmail, no matter how
  // many times they reconnected — the correctly-scoped token was never even
  // looked at.
  const userId = session.user?.id
  const accessToken = await getGmailAccessToken(userId)
  const connectedEmail = await getGmailAccountEmail(userId)

  if (!accessToken) {
    return NextResponse.json(
      { error: "No Google account linked. Please connect your Gmail account.", reauth: true },
      { status: 403 }
    )
  }

  const cacheUserId = session.user?.id
  const cacheKey = cacheUserId ? `${cacheUserId}:${brandId ?? "auto"}` : null
  if (cacheKey) {
    const cached = threadsCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.body)
    }
  }

  try {
    // 1. List inbox threads
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=200&labelIds=INBOX",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!listRes.ok) {
      const err = await listRes.json()
      const message: string = err?.error?.message || "Failed to list threads"

      if (
        listRes.status === 403 ||
        message.toLowerCase().includes("insufficient authentication scopes") ||
        message.toLowerCase().includes("request had insufficient")
      ) {
        return NextResponse.json(
          { error: "Gmail access not granted. Please connect your Gmail account.", reauth: true },
          { status: 403 }
        )
      }

      throw new Error(message)
    }

    const listData = await listRes.json()
    const threadIds: string[] = (listData.threads || []).map((t: any) => t.id)

    // 2. Fetch full thread details in parallel (skipped entirely when there
    // are no INBOX threads — note this does NOT early-return the whole
    // request, since a user with zero replied-to conversations can still
    // have sent-but-unreplied threads worth surfacing below).
    const threadDetails = threadIds.length
      ? await Promise.all(
          threadIds.map((id) =>
            fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=full`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            ).then((r) => r.json())
          )
        )
      : []

    // 3. Shape threads + extract sender emails
    const shapedThreads = threadDetails.map(shapeGmailThread)

    // 4. Try to resolve brand context — if none found, return threads without pipeline data
    let brand_id = brandId
    if (!brand_id && userId) {
      const brandMember = await prisma.brandMember.findFirst({
        where: { user_id: userId },
        select: { brand_id: true },
        orderBy: { created_at: "desc" },
      })
      brand_id = brandMember?.brand_id || null
    }

    // No brand context — return threads without pipeline stage info.
    // Gmail is still connected; we just can't attach influencer data.
    if (!brand_id) {
      const threads = shapedThreads.map(({ senderEmail, hasReply, ...thread }) => ({
        ...thread,
        brandInfluencer: null,
      }))
      const body = { threads, sentAwaitingReply: [], connectedEmail }
      if (cacheKey) threadsCache.set(cacheKey, { expiresAt: Date.now() + THREADS_CACHE_TTL_MS, body })
      return NextResponse.json(body)
    }

    // 4b. Also list SENT threads not already covered by the INBOX fetch above
    // — a cold-outreach email with no reply yet has no INBOX label, so it was
    // otherwise invisible here. Only headers are fetched (format=metadata,
    // no body/attachment decoding) since these show as lightweight "awaiting
    // reply" entries, not full conversations — see lib/gmail.ts for why this
    // doesn't reuse the expensive format=full path used above.
    const sentListRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=200&labelIds=SENT",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const sentListData = sentListRes.ok ? await sentListRes.json() : { threads: [] }
    const inboxThreadIdSet = new Set(threadIds)
    const sentOnlyIds: string[] = (sentListData.threads || [])
      .map((t: any) => t.id)
      .filter((id: string) => !inboxThreadIdSet.has(id))

    const sentOnlyDetails = await Promise.all(
      sentOnlyIds.map((id) =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then((r) => (r.ok ? r.json() : null))
      )
    )

    const shapedSentOnly = sentOnlyDetails
      .filter(Boolean)
      .map((thread: any) => {
        const firstMsg = thread.messages?.[0]
        const headers = firstMsg?.payload?.headers || []
        const toHeader = getHeader(headers, "To")
        const nameMatch = toHeader.match(/^([^<]+)</)
        const emailMatch = toHeader.match(/<([^>]+)>/)
        const recipientEmail = (emailMatch ? emailMatch[1] : toHeader).toLowerCase().trim()
        const recipientName = nameMatch ? nameMatch[1].trim() : recipientEmail.split("@")[0] || "Unknown"

        // Instroom's own transactional emails (welcome, password reset,
        // verification, etc. — see lib/email.ts) are sent from this same
        // connected Gmail account via nodemailer, always as `Instroom <...>`.
        // If the recipient also happens to be a registered influencer (e.g.
        // they signed up for an Instroom account with the same address they
        // use for collabs), those system emails would otherwise get counted
        // as outreach — this excludes anything sent under that sender name.
        const fromHeader = getHeader(headers, "From")
        const fromName = (fromHeader.match(/^([^<]+)</)?.[1] || fromHeader).trim().toLowerCase()
        const isSystemEmail = fromName === "instroom"

        return {
          id: thread.id,
          subject: getHeader(headers, "Subject") || "(No subject)",
          snippet: thread.snippet || firstMsg?.snippet || "",
          date: getHeader(headers, "Date"),
          recipientEmail,
          recipientName,
          isSystemEmail,
        }
      })
      .filter((t) => t.recipientEmail && !t.isSystemEmail)

    const senderEmails = [...new Set([
      ...shapedThreads.map((t) => t.senderEmail),
      ...shapedSentOnly.map((t) => t.recipientEmail),
    ].filter(Boolean))]

    type BrandInfluencerRow = {
      id: string
      contact_status: string
      content_posted: boolean
      stage: number
      order_status: string | null
      influencer: { email: string | null }
    }

    const brandInfluencers: BrandInfluencerRow[] = await prisma.brandInfluencer.findMany({
      where: {
        brand_id: brand_id,
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

    // 5. Attach brandInfluencer to each thread (null for unknown senders)
    const threads = shapedThreads.map(({ senderEmail, hasReply, ...thread }) => ({
      ...thread,
      senderEmail,
      brandInfluencer: biByEmail.get(senderEmail) ?? null,
      hasReply,
    }))

    const sentAwaitingReply = shapedSentOnly.map(({ isSystemEmail, ...t }) => ({
      ...t,
      brandInfluencer: biByEmail.get(t.recipientEmail) ?? null,
      isLightweight: true as const,
    }))

    // Auto-advance influencers who replied to "In Conversation" — fire-and-forget,
    // same as the influencer_reply notifications below, so it never adds latency
    // to this already-slow endpoint.
    const replyBrandInfluencerIds = threads
      .filter((t) => t.hasReply && t.brandInfluencer)
      .map((t) => t.brandInfluencer!.id)
    autoAdvanceRepliedToInConversation(brand_id, replyBrandInfluencerIds).catch((err) =>
      console.error("Auto-advance to In Conversation failed:", err)
    )

    // 6. Send notifications for new unread messages from influencers (non-blocking)
    if (brand_id && session.user?.id) {
      const userId = session.user.id
      const appUrl = process.env.NEXTAUTH_URL ?? ""
      
      const notifyPromises = threads
        .filter(t => t.unread && t.brandInfluencer && t.messages.length > 0)
        .map(async (thread) => {
          try {
            // Only notify if this is from a known influencer
            if (!thread.brandInfluencer) return

            const firstMsg = thread.messages[0]
            const lastMsg = thread.messages[thread.messages.length - 1]
            
            // Only notify for recent messages (last 24 hours)
            const lastMsgDate = lastMsg?.date ? new Date(lastMsg.date).getTime() : Date.now()
            const oneHourAgo = Date.now() - 60 * 60 * 1000
            
            if (lastMsgDate < oneHourAgo) return

            // Check if we've recently notified for this thread (avoid duplicates)
            const recentNotif = await prisma.notification.findFirst({
              where: {
                user_id: userId,
                notification_type: "influencer_reply",
                created_at: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                },
                title: { contains: thread.senderEmail },
              },
              select: { id: true },
            })

            if (recentNotif) return // Already notified recently

            // Extract influencer name from sender email if available
            const senderName = thread.messages[0]?.from
              ? thread.messages[0].from.match(/^([^<]+)</)?.[1]?.trim() || thread.senderEmail.split("@")[0]
              : thread.senderEmail.split("@")[0]

            const inboxUrl = `${appUrl}/dashboard/inbox?brandId=${brand_id}`

            await sendNotification({
              userId,
              type: "influencer_reply",
              title: `New reply from ${senderName}`,
              message: `${senderName} replied to your outreach.`,
              actionUrl: inboxUrl,
            })
            console.log(`✅ Influencer reply notification sent for ${senderName}`)
          } catch (err) {
            console.error("❌ Failed to send influencer reply notification:", err)
          }
        })

      // Run notifications in background without blocking response
      Promise.allSettled(notifyPromises).catch(err => 
        console.error("Notification batch error:", err)
      )
    }

    const body = { threads: threads.map(({ hasReply, ...thread }) => thread), sentAwaitingReply, connectedEmail }
    if (cacheKey) threadsCache.set(cacheKey, { expiresAt: Date.now() + THREADS_CACHE_TTL_MS, body })
    return NextResponse.json(body)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch threads" }, { status: 500 })
  }
}
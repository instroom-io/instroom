import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendNotification } from "@/lib/notifications"

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ""
}

function decodeBody(data?: string): string {
  if (!data) return ""
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
  } catch {
    return ""
  }
}

function extractText(payload: any): string {
  if (!payload) return ""
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBody(payload.body.data)
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractText(part)
      if (text) return text
    }
  }
  return ""
}

async function refreshToken(refresh_token: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) return null

    await prisma.account.updateMany({
      where: { userId, provider: "google" },
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

  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json(
      { error: "Session expired. Please sign in again.", reauth: true },
      { status: 401 }
    )
  }

  // Try session first (Google OAuth login), fall back to DB Account table
  let accessToken = session.accessToken as string | undefined

  if (!accessToken) {
    const userId = session.user?.id
    if (!userId) {
      return NextResponse.json(
        { error: "Gmail access not granted. Please sign in with Google.", reauth: true },
        { status: 403 }
      )
    }

    const account = await prisma.account.findFirst({
      where: { userId, provider: "google" },
      select: { access_token: true, refresh_token: true, expires_at: true },
    })

    if (!account?.access_token) {
      return NextResponse.json(
        { error: "No Google account linked. Please connect your Gmail account.", reauth: true },
        { status: 403 }
      )
    }

    const isExpired = account.expires_at
      ? Date.now() > account.expires_at * 1000
      : false

    if (isExpired && account.refresh_token) {
      const refreshed = await refreshToken(account.refresh_token, userId)
      if (!refreshed) {
        return NextResponse.json(
          { error: "Gmail session expired. Please reconnect your Gmail account.", reauth: true },
          { status: 403 }
        )
      }
      accessToken = refreshed
    } else {
      accessToken = account.access_token
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

    if (threadIds.length === 0) {
      return NextResponse.json({ threads: [] })
    }

    // 2. Fetch full thread details in parallel
    const threadDetails = await Promise.all(
      threadIds.map((id) =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then((r) => r.json())
      )
    )

    // 3. Shape threads + extract sender emails
    const shapedThreads = threadDetails.map((thread) => {
      const messages = (thread.messages || []).map((msg: any) => {
        const headers = msg.payload?.headers || []
        return {
          id: msg.id,
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          subject: getHeader(headers, "Subject"),
          date: getHeader(headers, "Date"),
          snippet: msg.snippet || "",
          body: extractText(msg.payload),
          labelIds: msg.labelIds || [],
        }
      })

      const firstMsg = messages[0] || {}
      const labelIds: string[] = thread.messages?.[0]?.labelIds || []

      const fromHeader: string = firstMsg.from || ""
      const emailMatch = fromHeader.match(/<([^>]+)>/)
      const senderEmail = (emailMatch ? emailMatch[1] : fromHeader).toLowerCase().trim()

      return {
        id: thread.id,
        subject: firstMsg.subject || "(No subject)",
        snippet: thread.snippet || firstMsg.snippet || "",
        unread: labelIds.includes("UNREAD"),
        messages,
        senderEmail,
      }
    })

    // 4. Try to resolve brand context — if none found, return threads without pipeline data
    const userId = session.user?.id

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
      const threads = shapedThreads.map(({ senderEmail, ...thread }) => ({
        ...thread,
        brandInfluencer: null,
      }))
      return NextResponse.json({ threads })
    }

    const senderEmails = [...new Set(shapedThreads.map((t) => t.senderEmail).filter(Boolean))]

    type BrandInfluencerRow = {
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
    const threads = shapedThreads.map(({ senderEmail, ...thread }) => ({
      ...thread,
      senderEmail,
      brandInfluencer: biByEmail.get(senderEmail) ?? null,
    }))

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

    return NextResponse.json({ threads })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch threads" }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function getMicrosoftToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "microsoft" },
    select: { access_token: true, refresh_token: true, expires_at: true },
  })

  if (!account?.access_token) return null

  const isExpired = account.expires_at ? Date.now() > account.expires_at * 1000 : false

  if (isExpired && account.refresh_token) {
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.access_token) return null

    await prisma.account.updateMany({
      where: { userId, provider: "microsoft" },
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

  const { to, subject, body } = await req.json()

  if (!to || !body) {
    return NextResponse.json({ error: "Missing required fields: to, body" }, { status: 400 })
  }

  const replySubject = subject?.startsWith("Re:") ? subject : subject ? `Re: ${subject}` : "(No subject)"

  try {
    const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: replySubject,
          body: { contentType: "Text", content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    })

    if (!sendRes.ok) {
      const err = await sendRes.json()
      throw new Error(err?.error?.message || "Failed to send email")
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Outlook send error:", err)
    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 500 })
  }
}

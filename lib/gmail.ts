import "server-only"
import { prisma } from "@/lib/prisma"

// A distinct provider label from NextAuth's own "google" (used for login).
// Both used to upsert the same Account row (same provider + providerAccountId
// for the same real Google account), so a plain re-login would blindly
// overwrite Gmail's tokens/scope with login's narrower ones — Google omits
// refresh_token on any re-consent-less login, so this could silently null out
// a working Gmail connection. Keeping Gmail's row under its own provider
// label means the login flow never touches it, full stop.
export const GMAIL_PROVIDER = "gmail"

// ─── Token handling ───────────────────────────────────────────────────────────
// Previously duplicated near-identically in app/api/gmail/send/route.ts and
// inlined again in app/api/gmail/threads/route.ts — extracted here so a third
// call site (the single-thread endpoint) doesn't become a third copy.

export async function refreshGmailToken(refresh_token: string, accountId: string): Promise<string | null> {
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

    // Target this specific Account row, not every Google account linked to
    // the user — a user can have more than one (e.g. reconnected Gmail with
    // a different Google account), and this refresh_token only belongs to
    // one of them. Updating them all would overwrite unrelated accounts'
    // tokens with a token that isn't actually theirs.
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

export async function getGmailAccessToken(userId: string | null | undefined): Promise<string | null> {
  // NEVER use session.accessToken here — the login-time Google OAuth (see
  // lib/auth.ts) deliberately requests only "openid email profile", with no
  // Gmail scopes at all. Gmail access always comes from a separate consent
  // via /api/gmail/connect, stored in the Account table below.
  if (!userId) return null

  // A user can have more than one linked Google account (e.g. reconnected
  // Gmail with a different account than before) — most recently connected
  // wins, since that's the one they just told us to use. Ordering by
  // last_selected_at, not id: reconnecting an account used before updates
  // its existing row rather than creating a new one, so id alone can't tell
  // "just reconnected" apart from "connected a while ago." Rows from before
  // this field existed have it as null and fall back to id ordering among
  // themselves, same as before.
  const account = await prisma.account.findFirst({
    where: { userId, provider: GMAIL_PROVIDER },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
    orderBy: [{ last_selected_at: "desc" }, { id: "desc" }],
  })

  if (!account?.access_token) return null

  const isExpired = account.expires_at
    ? Date.now() > account.expires_at * 1000
    : false

  if (isExpired && account.refresh_token) {
    return refreshGmailToken(account.refresh_token, account.id)
  }

  return account.access_token
}

/** The email address of the currently-connected Gmail account, so callers can
 *  tell "a thread with an external contact" apart from "a thread with my own
 *  connected mailbox" (e.g. a self-sent verification/test email). Same
 *  most-recently-connected-wins rule as getGmailAccessToken. */
export async function getGmailAccountEmail(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null

  const account = await prisma.account.findFirst({
    where: { userId, provider: GMAIL_PROVIDER },
    select: { email: true },
    orderBy: [{ last_selected_at: "desc" }, { id: "desc" }],
  })

  return account?.email ?? null
}

// ─── Thread shaping ───────────────────────────────────────────────────────────
// Previously inline inside app/api/gmail/threads/route.ts's shaping .map() —
// extracted so the new single-thread endpoint shapes a raw Gmail thread
// exactly the same way, instead of a second, potentially-drifting copy.

export function getHeader(headers: { name: string; value: string }[], name: string): string {
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

function extractPart(payload: any, mimeType: string): string {
  if (!payload) return ""
  if (payload.mimeType === mimeType && payload.body?.data) {
    return decodeBody(payload.body.data)
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPart(part, mimeType)
      if (text) return text
    }
  }
  return ""
}

// Gmail messages can be text/plain, text/html, or (multipart/alternative)
// both. Plain text is preferred when present since it's simpler to render;
// HTML-only messages (e.g. our own signature-bearing sends, which are built
// as a single text/html part — see buildRawEmail in gmail/send/route.ts)
// previously fell through this function entirely (it only ever checked
// text/plain), silently returning "" and leaving callers to fall back to
// Gmail's auto-generated snippet — a plain-text approximation that strips
// all formatting and runs everything together with no line breaks, which is
// why a signature showed up as one garbled line instead of its real layout.
function extractBody(payload: any): { body: string; isHtml: boolean } {
  const plain = extractPart(payload, "text/plain")
  if (plain) return { body: plain, isHtml: false }
  const html = extractPart(payload, "text/html")
  if (html) return { body: html, isHtml: true }
  return { body: "", isHtml: false }
}

export type ShapedGmailThread = {
  id: string
  subject: string
  snippet: string
  unread: boolean
  messages: {
    id: string
    from: string
    to: string
    subject: string
    date: string
    snippet: string
    body: string
    isHtml: boolean
    labelIds: string[]
  }[]
  senderEmail: string
  hasReply: boolean
}

export function shapeGmailThread(thread: any): ShapedGmailThread {
  const messages = (thread.messages || []).map((msg: any) => {
    const headers = msg.payload?.headers || []
    const { body, isHtml } = extractBody(msg.payload)
    return {
      id: msg.id,
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      subject: getHeader(headers, "Subject"),
      date: getHeader(headers, "Date"),
      snippet: msg.snippet || "",
      body,
      isHtml,
      labelIds: msg.labelIds || [],
    }
  })

  const firstMsg = messages[0] || {}
  const labelIds: string[] = thread.messages?.[0]?.labelIds || []

  // messages[0] is the oldest message in the thread, which is often the outbound
  // message the user sent (cold outreach) rather than something from the contact.
  // Prefer the first message that isn't one the user sent.
  const contactMsg = messages.find((m: any) => !(m.labelIds || []).includes("SENT"))

  const fromHeader: string = contactMsg ? contactMsg.from || "" : firstMsg.to || firstMsg.from || ""
  const emailMatch = fromHeader.match(/<([^>]+)>/)
  const senderEmail = (emailMatch ? emailMatch[1] : fromHeader).toLowerCase().trim()

  return {
    id: thread.id,
    subject: firstMsg.subject || "(No subject)",
    snippet: thread.snippet || firstMsg.snippet || "",
    unread: labelIds.includes("UNREAD"),
    messages,
    senderEmail,
    hasReply: Boolean(contactMsg),
  }
}

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

// ─── Rate-limit-aware batch fetching ────────────────────────────────────────
// The threads route fans out one request per thread to hydrate full message
// bodies (up to 200 threads for a large inbox). Firing all of them truly in
// parallel trips Gmail's per-user rate limit — confirmed directly: 200
// simultaneous requests against a real account came back 155 OK / 45 HTTP
// 429. Those 429s used to get silently treated as empty threads (fixed
// separately), and under heavy enough load even the one-shot threads.list
// call ahead of this can 429 too. Batching keeps concurrency below the
// limit; the retry is the safety net for whatever a batch size can't avoid.

/** Retries only on 429, honoring Retry-After when Gmail sends one. */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3
): Promise<Response> {
  let res: Response
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    res = await fetch(url, options)
    if (res.status !== 429) return res
    if (attempt === maxAttempts - 1) return res
    const retryAfterHeader = res.headers.get("Retry-After")
    const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 500 * 2 ** attempt
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return res!
}

/** Runs `fn` over `items` in fixed-size concurrent chunks instead of all at once. */
export async function fetchInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    results.push(...(await Promise.all(batch.map(fn))))
  }
  return results
}

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

  if (!userId) return null


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


export async function getGmailAccountEmail(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null

  const account = await prisma.account.findFirst({
    where: { userId, provider: GMAIL_PROVIDER },
    select: { email: true },
    orderBy: [{ last_selected_at: "desc" }, { id: "desc" }],
  })

  return account?.email ?? null
}



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


function extractBody(payload: any): { body: string; isHtml: boolean } {
  // HTML preferred over plain text: Gmail's own auto-generated text/plain
  // alternative for an HTML message is lossy (bold becomes literal
  // "*asterisks*", adjacent lines run together) — renders via the sandboxed
  // HtmlMessageFrame either way, so there's no safety reason to prefer text.
  const html = extractPart(payload, "text/html")
  if (html) return { body: html, isHtml: true }
  const plain = extractPart(payload, "text/plain")
  if (plain) return { body: plain, isHtml: false }
  return { body: "", isHtml: false }
}

export type GmailAttachmentMeta = {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
}

// Gmail marks inline parts (e.g. a logo embedded in an HTML signature via a
// cid: reference) with Content-Disposition: inline — without filtering these
// out, every signature-bearing email would show a bogus "attachment".
function isInlinePart(part: any): boolean {
  const headers: { name: string; value: string }[] = part.headers || []
  return getHeader(headers, "Content-Disposition").toLowerCase().startsWith("inline")
}

// Mirrors extractPart's recursive walk over payload.parts, but collects ALL
// matches instead of returning the first — a message can have any number of
// real attachments, unlike extractPart's single-result body lookup.
function extractAttachments(payload: any): GmailAttachmentMeta[] {
  if (!payload) return []
  const results: GmailAttachmentMeta[] = []
  if (payload.body?.attachmentId && payload.filename && !isInlinePart(payload)) {
    results.push({
      attachmentId: payload.body.attachmentId,
      filename: payload.filename,
      mimeType: payload.mimeType || "application/octet-stream",
      size: payload.body.size ?? 0,
    })
  }
  if (payload.parts) {
    for (const part of payload.parts) results.push(...extractAttachments(part))
  }
  return results
}

type GmailInlineImage = { contentId: string; attachmentId: string; mimeType: string }

// Inline images (embedded logos etc.) referenced by "cid:" in the HTML —
// angle brackets stripped from Content-ID so it matches the bare cid: value.
function extractInlineImages(payload: any): GmailInlineImage[] {
  if (!payload) return []
  const results: GmailInlineImage[] = []
  if (payload.body?.attachmentId && isInlinePart(payload)) {
    const headers: { name: string; value: string }[] = payload.headers || []
    const contentId = getHeader(headers, "Content-ID").replace(/^<|>$/g, "")
    if (contentId) {
      results.push({
        contentId,
        attachmentId: payload.body.attachmentId,
        mimeType: payload.mimeType || "application/octet-stream",
      })
    }
  }
  if (payload.parts) {
    for (const part of payload.parts) results.push(...extractInlineImages(part))
  }
  return results
}


export function sanitizeFilename(name: string): string {
  const safe = name.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "")
  return safe.trim() || "attachment"
}

export type ShapedGmailThread = {
  id: string
  subject: string
  snippet: string
  unread: boolean
  starred: boolean
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
    attachments: GmailAttachmentMeta[]
  }[]
  senderEmail: string
  /** Who we originally emailed, if we sent first. */
  originalRecipientEmail?: string
  hasReply: boolean
}

export function shapeGmailThread(thread: any): ShapedGmailThread {
  const messages = (thread.messages || []).map((msg: any) => {
    const headers = msg.payload?.headers || []
    let { body, isHtml } = extractBody(msg.payload)
    const attachments = extractAttachments(msg.payload)

    // A "cid:" reference only resolves inside the original MIME structure —
    // rewritten here to the existing attachment route so it actually loads.
    if (isHtml && body.includes("cid:")) {
      for (const img of extractInlineImages(msg.payload)) {
        const src = `/api/gmail/attachment/${msg.id}/${img.attachmentId}?mimeType=${encodeURIComponent(img.mimeType)}`
        body = body.split(`cid:${img.contentId}`).join(src)
      }
    }

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
      attachments,
    }
  })

  const firstMsg = messages[0] || {}
  const isUnread = messages.some((m: any) => (m.labelIds || []).includes("UNREAD"))
  const isStarred = messages.some((m: any) => (m.labelIds || []).includes("STARRED"))

  const contactMsg = messages.find((m: any) => !(m.labelIds || []).includes("SENT"))

  const fromHeader: string = contactMsg ? contactMsg.from || "" : firstMsg.to || firstMsg.from || ""
  const emailMatch = fromHeader.match(/<([^>]+)>/)
  const senderEmail = (emailMatch ? emailMatch[1] : fromHeader).toLowerCase().trim()

  // First SENT message's "To" — a fallback for when the reply comes from a
  // different address (e.g. an agency rep) than the one we emailed.
  const firstSentMsg = messages.find((m: any) => (m.labelIds || []).includes("SENT"))
  const originalToHeader: string = firstSentMsg?.to || ""
  const originalEmailMatch = originalToHeader.match(/<([^>]+)>/)
  const originalRecipientEmail = (originalEmailMatch ? originalEmailMatch[1] : originalToHeader).toLowerCase().trim() || undefined

  return {
    id: thread.id,
    subject: firstMsg.subject || "(No subject)",
    snippet: thread.snippet || firstMsg.snippet || "",
    unread: isUnread,
    starred: isStarred,
    messages,
    senderEmail,
    originalRecipientEmail,
    hasReply: Boolean(contactMsg),
  }
}

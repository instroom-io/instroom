import "server-only"
import { getGmailAccessTokenForAccount } from "@/lib/gmail"
import { buildRawEmail } from "@/lib/gmail-message"
import { getOutlookAccessToken, forceRefreshOutlookAccessToken } from "@/lib/microsoft-oauth"
import { getUserSignatureHtml, plainTextBodyToHtml } from "@/lib/signature"
import type { OutreachSender } from "@/lib/auto-outreach"

/** A sent email's thread, for follow-ups. */
export type MailThread =
  | { provider: "gmail"; threadId: string; messageId: string | null; subject: string }
  | { provider: "outlook"; messageId: string; subject: string }

type Failure = { ok: false; kind: "auth" | "error"; message: string }
/** auth: mailbox needs reconnecting; error: this email failed. */
export type MailSendResult = { ok: true; thread: MailThread | null } | Failure

const failure = (status: number, message: string): Failure => ({
  ok: false,
  kind: status === 401 || status === 403 ? "auth" : "error",
  message,
})
const errorMessage = async (res: Response, fallback: string) =>
  ((await res.json().catch(() => ({})))?.error?.message as string | undefined) || `${fallback} returned ${res.status}`

/** Sends from a given mailbox (no session); replyTo sends in that thread. */
export async function sendFromMailbox(
  sender: OutreachSender,
  { to, subject, text, replyTo }: { to: string; subject: string; text: string; replyTo?: MailThread | null }
): Promise<MailSendResult> {
  const signatureHtml = await getUserSignatureHtml(sender.userId)
  return sender.provider === "gmail"
    ? sendGmail(sender, to, subject, text, signatureHtml, replyTo?.provider === "gmail" ? replyTo : null)
    : sendOutlook(sender, to, subject, text, signatureHtml, replyTo?.provider === "outlook" ? replyTo : null)
}

/** Has `from` emailed this mailbox since `since`? */
export async function hasReplyFrom(
  sender: OutreachSender,
  from: string,
  since: Date
): Promise<{ ok: true; replied: boolean } | Failure> {
  if (sender.provider === "gmail") {
    const token = await getGmailAccessTokenForAccount(sender.userId, sender.accountId)
    if (!token) return { ok: false, kind: "auth", message: "The sender Gmail is disconnected." }
    const q = encodeURIComponent(`from:${from} after:${Math.floor(since.getTime() / 1000)}`)
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return failure(res.status, await errorMessage(res, "Gmail"))
    const data = await res.json()
    return { ok: true, replied: (data.messages?.length ?? 0) > 0 }
  }

  const graph = await outlookClient(sender)
  if (!graph.ok) return graph
  const filter = `receivedDateTime ge ${since.toISOString()} and from/emailAddress/address eq '${from.replace(/'/g, "''")}'`
  const res = await graph.call(`/me/messages?$top=1&$select=id&$filter=${encodeURIComponent(filter)}`)
  if (!res.ok) return failure(res.status, await errorMessage(res, "Outlook"))
  const data = await res.json()
  return { ok: true, replied: (data.value?.length ?? 0) > 0 }
}

async function sendGmail(
  sender: OutreachSender,
  to: string,
  subject: string,
  text: string,
  signatureHtml: string | null,
  replyTo: Extract<MailThread, { provider: "gmail" }> | null
): Promise<MailSendResult> {
  const token = await getGmailAccessTokenForAccount(sender.userId, sender.accountId)
  if (!token) return { ok: false, kind: "auth", message: "The sender Gmail is disconnected." }
  const auth = { Authorization: `Bearer ${token}` }

  const raw = buildRawEmail({
    to,
    from: "",
    subject: replyTo?.subject ?? subject,
    body: text,
    signatureHtml,
    threadId: replyTo?.threadId,
    inReplyTo: replyTo?.messageId ?? undefined,
  })
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(replyTo ? { raw, threadId: replyTo.threadId } : { raw }),
  })
  if (!res.ok) return failure(res.status, await errorMessage(res, "Gmail"))
  const sent: { id: string; threadId: string } = await res.json()
  if (replyTo) return { ok: true, thread: replyTo }

  // Message-ID keeps the follow-up threaded in the recipient's app.
  const meta = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${sent.id}?format=metadata&metadataHeaders=Message-ID`,
    { headers: auth }
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
  const header = (meta?.payload?.headers as { name: string; value: string }[] | undefined)?.find(
    (h) => h.name.toLowerCase() === "message-id"
  )
  return { ok: true, thread: { provider: "gmail", threadId: sent.threadId, messageId: header?.value ?? null, subject } }
}

/** Graph client: immutable ids (survive the move to Sent) and one refresh on 401. */
async function outlookClient(sender: OutreachSender) {
  const token = await getOutlookAccessToken(sender.userId, "auto-outreach", sender.accountId)
  if (!token.ok) {
    return token.reason === "not_configured"
      ? ({ ok: false, kind: "error", message: "Outlook isn't configured on the server." } as const)
      : ({ ok: false, kind: "auth", message: "The sender Outlook mailbox is disconnected." } as const)
  }
  let accessToken = token.accessToken
  const call = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    const run = () =>
      fetch(`https://graph.microsoft.com/v1.0${path}`, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: 'IdType="ImmutableId"',
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      })
    let res = await run()
    // A 401 means nothing happened, so one retry is safe.
    if (res.status === 401) {
      const refreshed = await forceRefreshOutlookAccessToken(sender.userId, sender.accountId, "auto-outreach")
      if (refreshed) {
        accessToken = refreshed
        res = await run()
      }
    }
    return res
  }
  return { ok: true as const, call }
}

async function sendOutlook(
  sender: OutreachSender,
  to: string,
  subject: string,
  text: string,
  signatureHtml: string | null,
  replyTo: Extract<MailThread, { provider: "outlook" }> | null
): Promise<MailSendResult> {
  const graph = await outlookClient(sender)
  if (!graph.ok) return graph
  const body = signatureHtml
    ? { contentType: "HTML", content: plainTextBodyToHtml(text) + signatureHtml }
    : { contentType: "Text", content: text }

  // Draft first, so the sent message has an id to reply to.
  let draft: Response
  if (replyTo) {
    draft = await graph.call(`/me/messages/${replyTo.messageId}/createReply`, { method: "POST", body: {} })
    if (!draft.ok) return failure(draft.status, await errorMessage(draft, "Outlook"))
    const reply: { id: string; body?: { content?: string } } = await draft.json()
    // A reply to our own email is addressed to us; readdress it and keep the quote.
    const patch = await graph.call(`/me/messages/${reply.id}`, {
      method: "PATCH",
      body: {
        toRecipients: [{ emailAddress: { address: to } }],
        body: { contentType: "HTML", content: (body.contentType === "HTML" ? body.content : plainTextBodyToHtml(text)) + (reply.body?.content ?? "") },
      },
    })
    if (!patch.ok) return failure(patch.status, await errorMessage(patch, "Outlook"))
    const sent = await graph.call(`/me/messages/${reply.id}/send`, { method: "POST" })
    if (!sent.ok) return failure(sent.status, await errorMessage(sent, "Outlook"))
    return { ok: true, thread: replyTo }
  }

  draft = await graph.call("/me/messages", {
    method: "POST",
    body: { subject, body, toRecipients: [{ emailAddress: { address: to } }] },
  })
  if (!draft.ok) return failure(draft.status, await errorMessage(draft, "Outlook"))
  const created: { id: string } = await draft.json()
  const sent = await graph.call(`/me/messages/${created.id}/send`, { method: "POST" })
  if (!sent.ok) return failure(sent.status, await errorMessage(sent, "Outlook"))
  return { ok: true, thread: { provider: "outlook", messageId: created.id, subject } }
}

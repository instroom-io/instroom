import "server-only"
import { getGmailAccessTokenForAccount } from "@/lib/gmail"
import { buildRawEmail } from "@/lib/gmail-message"
import { getOutlookAccessToken, forceRefreshOutlookAccessToken } from "@/lib/microsoft-oauth"
import { getUserSignatureHtml, plainTextBodyToHtml } from "@/lib/signature"
import type { OutreachSender } from "@/lib/auto-outreach"

/** auth: mailbox needs reconnecting; error: this email failed. */
export type MailSendResult =
  | { ok: true }
  | { ok: false; kind: "auth" | "error"; message: string }

/** Sends a plain-text email with signature from a given mailbox (no session). */
export async function sendFromMailbox(
  sender: OutreachSender,
  { to, subject, text }: { to: string; subject: string; text: string }
): Promise<MailSendResult> {
  const signatureHtml = await getUserSignatureHtml(sender.userId)
  return sender.provider === "gmail"
    ? sendGmail(sender, to, subject, text, signatureHtml)
    : sendOutlook(sender, to, subject, text, signatureHtml)
}

async function sendGmail(
  sender: OutreachSender,
  to: string,
  subject: string,
  text: string,
  signatureHtml: string | null
): Promise<MailSendResult> {
  const token = await getGmailAccessTokenForAccount(sender.userId, sender.accountId)
  if (!token) return { ok: false, kind: "auth", message: "The sender Gmail is disconnected." }

  const raw = buildRawEmail({ to, from: "", subject, body: text, signatureHtml })
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  })
  if (res.ok) return { ok: true }
  const err = await res.json().catch(() => ({}))
  const message: string = err?.error?.message || `Gmail returned ${res.status}`
  return { ok: false, kind: res.status === 401 || res.status === 403 ? "auth" : "error", message }
}

async function sendOutlook(
  sender: OutreachSender,
  to: string,
  subject: string,
  text: string,
  signatureHtml: string | null
): Promise<MailSendResult> {
  const token = await getOutlookAccessToken(sender.userId, "auto-outreach", sender.accountId)
  if (!token.ok) {
    return token.reason === "not_configured"
      ? { ok: false, kind: "error", message: "Outlook isn't configured on the server." }
      : { ok: false, kind: "auth", message: "The sender Outlook mailbox is disconnected." }
  }

  const body = JSON.stringify({
    message: {
      subject,
      body: signatureHtml
        ? { contentType: "HTML", content: plainTextBodyToHtml(text) + signatureHtml }
        : { contentType: "Text", content: text },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  })
  const send = (accessToken: string) =>
    fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body,
    })

  let res = await send(token.accessToken)
  // A 401 means nothing was sent, so retrying once is safe.
  if (res.status === 401) {
    const refreshed = await forceRefreshOutlookAccessToken(sender.userId, sender.accountId, "auto-outreach")
    if (refreshed) res = await send(refreshed)
  }
  if (res.ok) return { ok: true }
  const err = await res.json().catch(() => ({}))
  const message: string = err?.error?.message || `Outlook returned ${res.status}`
  return { ok: false, kind: res.status === 401 || res.status === 403 ? "auth" : "error", message }
}

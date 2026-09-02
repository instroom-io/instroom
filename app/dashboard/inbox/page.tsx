"use client"

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SubscriptionGate } from "@/components/ui/subscription-gate"
import { ListSkeleton } from "@/components/shared/skeletons"
import { fetchCached, getCachedData, invalidateCache, useCachedFetch, useRestoredCache } from "@/lib/data-cache"
import { useSubscriptionGate } from "@/hooks/useSubscriptionGate"
import { invalidateInfluencerDerivedCaches } from "@/lib/cache-invalidation"
import {
  IconMailPlus,
  IconSearch,
  IconX,
  IconPlus,
  IconSend,
  IconMessageCircle,
  IconInbox,
  IconStar,
  IconStarFilled,
  IconArrowLeft,
  IconDotsVertical,
  IconUserPlus,
  IconMessage,
  IconUserCheck,
  IconShoppingCart,
  IconTruck,
  IconPackage,
  IconPhoto,
  IconCircleCheck,
  IconX as IconReject,
  IconChevronUp,
  IconChevronDown,
  IconPhone,
  IconVideo,
  IconFlag,
  IconArchive,
  IconTrash,
  IconBell,
  IconUser,
  IconClock,
  IconLock,
  IconCheck,
  IconMailForward,
  IconLayoutSidebar,
  IconBrandGmail,
  IconBrandWindows,
  IconRefresh,
  IconAlertCircle,
  IconTemplate,
  IconDeviceFloppy,
} from "@tabler/icons-react"
import { EmailTemplatesModal } from "@/components/shared/email-templates-modal"
import { UseTemplatePicker } from "@/components/shared/use-template-picker"
import { RichComposeEditor, type RichComposeEditorHandle, type PendingAttachment, AttachmentChipReadOnly } from "@/components/shared/rich-compose-editor"

function OutlookIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#0078D4" />
      <text x="12" y="17" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="Arial,sans-serif">O</text>
    </svg>
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

type PipelineStage =
  | "PROSPECT"
  | "REACHED_OUT"
  | "IN_CONVERSATION"
  | "ONBOARDED"
  | "FOR_ORDER_CREATION"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "POSTED"
  | "COMPLETED"
  | "REJECTED"

type GmailSyncState = "checking" | "not_connected" | "connecting" | "syncing" | "connected" | "error"

// ── OAuth hand-off between tabs ──────────────────────────────────────────────
// Both provider flows run entirely in a second tab: /api/{gmail,outlook}/connect
// 302s to accounts.google.com / login.microsoftonline.com there, the matching
// callback lands there too, and it finishes on
// /dashboard/inbox?{gmail,outlook}Connected=1. That tab therefore knows the
// outcome and the original tab does not. A same-origin BroadcastChannel carries
// the result back, so the original tab can leave its waiting state on its own
// rather than the user pressing Back or reloading. Same-origin only — no data
// crosses to Google's or Microsoft's tab, which are different origins and
// cannot listen.
const OAUTH_CHANNEL = "instroom-oauth"

type MailProvider = "gmail" | "outlook"
type OAuthResult = { provider: MailProvider; ok: boolean; error?: string }

/** Provider names as they already read in the inbox UI. */
const PROVIDER_LABEL: Record<MailProvider, string> = { gmail: "Gmail", outlook: "Outlook" }

/** One connected mailbox, as /api/mail/accounts reports it. Never carries tokens. */
type MailAccount = { id: string; provider: MailProvider; email: string | null; isSelected: boolean }

/** Shared-cache key for the connected-mailbox list. */
const MAIL_ACCOUNTS_KEY = "/api/mail/accounts"

/** Normalized attachment metadata, independent of provider — messageId +
 *  attachmentId + provider is everything openAttachment() needs to hit the
 *  right bytes-endpoint. Metadata only; bytes are fetched lazily on click. */
type EmailAttachment = {
  id: string
  messageId: string
  filename: string
  mimeType: string
  size: number
  provider: "gmail" | "outlook"
}

type Email = {
  id: number | string

  /**
   * Identity of this conversation WITHIN the inbox list.
   *
   * `id` is the provider's own thread id (a Gmail thread id, an Outlook
   * conversationId) and is what the send/thread routes need, so it stays as it
   * is. But Gmail and Outlook conversations share one `emails` array, and their
   * id spaces are unrelated and opaque — nothing guarantees a Gmail thread id
   * cannot equal an Outlook conversationId. Every place the UI looked a
   * conversation up by `id` (the stage update, the drag handler, the drag
   * overlay, the React list key) would then resolve to whichever provider's
   * thread came first in the array, so a drag on an Outlook conversation could
   * restage a Gmail one.
   *
   * `uid` namespaces that identity by provider AND by connected account, so it
   * is unique across every mailbox on screen. It is used for UI identity only
   * and is never sent to a provider.
   */
  uid: string

  /**
   * Which connected mailbox this conversation came from — the Account row id.
   *
   * Needed so a conversation keeps its account identity after it is mapped:
   * without it, an Outlook thread in `emails` was indistinguishable from an
   * Outlook thread belonging to a different connected account.
   */
  accountId?: string | null
  influencerId?: number
  name: string
  handle: string
  avatar: string
  subject: string
  preview: string
  message: string
  date: string
  timestamp: string
  status: PipelineStage | null
  read: boolean
  starred: boolean
  orderId?: string
  trackingNumber?: string
  postedLink?: string
  rejectionReason?: string
  replies?: { sender: string; message: string; timestamp: string; isUser?: boolean; isHtml?: boolean; attachments?: EmailAttachment[] }[]
  // Gmail-specific
  gmailThreadId?: string
  from?: string
  fromEmail?: string
  // Source tracking for multi-provider support
  source?: "gmail" | "outlook"
  outlookMessageId?: string
  // A "sent, awaiting reply" entry shown from headers/snippet only — no full
  // message body loaded yet. Opening it triggers a lazy fetch (see
  // loadFullGmailThread) that replaces the entry with real content.
  isLightweight?: boolean
}

type StageConfig = {
  id: PipelineStage
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  activeBgColor: string
  hoverBgColor: string
  borderColor: string
  arrowColor: string
}

// ─── Stage Configs ────────────────────────────────────────────────────────────

const stageConfigs: StageConfig[] = [
  { id: "PROSPECT", label: "Prospects", icon: <IconUserPlus size={16} />, color: "text-gray-700", bgColor: "bg-gray-100", activeBgColor: "bg-gray-600", hoverBgColor: "hover:bg-gray-500", borderColor: "border-gray-300", arrowColor: "#f3f4f6" },
  { id: "REACHED_OUT", label: "Reached Out", icon: <IconMessage size={16} />, color: "text-blue-700", bgColor: "bg-blue-100", activeBgColor: "bg-blue-600", hoverBgColor: "hover:bg-blue-500", borderColor: "border-blue-300", arrowColor: "#dbeafe" },
  { id: "IN_CONVERSATION", label: "In Conversation", icon: <IconMessageCircle size={16} />, color: "text-purple-700", bgColor: "bg-purple-100", activeBgColor: "bg-purple-600", hoverBgColor: "hover:bg-purple-500", borderColor: "border-purple-300", arrowColor: "#f3e8ff" },
  { id: "ONBOARDED", label: "Onboarded", icon: <IconUserCheck size={16} />, color: "text-indigo-700", bgColor: "bg-indigo-100", activeBgColor: "bg-indigo-600", hoverBgColor: "hover:bg-indigo-500", borderColor: "border-indigo-300", arrowColor: "#e0e7ff" },
  { id: "FOR_ORDER_CREATION", label: "For Order", icon: <IconShoppingCart size={16} />, color: "text-orange-700", bgColor: "bg-orange-100", activeBgColor: "bg-orange-600", hoverBgColor: "hover:bg-orange-500", borderColor: "border-orange-300", arrowColor: "#ffedd5" },
  { id: "IN_TRANSIT", label: "In-Transit", icon: <IconTruck size={16} />, color: "text-yellow-700", bgColor: "bg-yellow-100", activeBgColor: "bg-yellow-600", hoverBgColor: "hover:bg-yellow-500", borderColor: "border-yellow-300", arrowColor: "#fef9c3" },
  { id: "DELIVERED", label: "Delivered", icon: <IconPackage size={16} />, color: "text-teal-700", bgColor: "bg-teal-100", activeBgColor: "bg-teal-600", hoverBgColor: "hover:bg-teal-500", borderColor: "border-teal-300", arrowColor: "#ccfbf1" },
  { id: "POSTED", label: "Posted", icon: <IconPhoto size={16} />, color: "text-pink-700", bgColor: "bg-pink-100", activeBgColor: "bg-pink-600", hoverBgColor: "hover:bg-pink-500", borderColor: "border-pink-300", arrowColor: "#fce7f3" },
  { id: "COMPLETED", label: "Completed", icon: <IconCircleCheck size={16} />, color: "text-green-700", bgColor: "bg-green-100", activeBgColor: "bg-green-600", hoverBgColor: "hover:bg-green-500", borderColor: "border-green-300", arrowColor: "#dcfce7" },
  { id: "REJECTED", label: "Rejected", icon: <IconReject size={16} />, color: "text-red-700", bgColor: "bg-red-100", activeBgColor: "bg-red-600", hoverBgColor: "hover:bg-red-500", borderColor: "border-red-300", arrowColor: "#fee2e2" },
]

// ─── Pipeline Status Resolver ─────────────────────────────────────────────────

function getPipelineStatus(bi?: {
  contact_status?: string | null
  content_posted?: boolean | null
  stage?: number | null
  order_status?: string | null
} | null): PipelineStage | null {
  if (!bi) return null
  const { contact_status, content_posted, stage, order_status } = bi
  if (contact_status && ["not_interested", "no_response", "email_error"].includes(contact_status)) return "REJECTED"
  if (content_posted) return "POSTED"
  if (stage === 4) return "COMPLETED"
  if (order_status === "delivered") return "DELIVERED"
  if (order_status === "in_transit") return "IN_TRANSIT"
  if (order_status && ["not_sent", "sent_to_email"].includes(order_status)) return "FOR_ORDER_CREATION"
  if (contact_status === "agreed") return "ONBOARDED"
  if (contact_status && ["responded", "replied", "negotiating"].includes(contact_status)) return "IN_CONVERSATION"
  if (contact_status === "contacted") return "REACHED_OUT"
  if (stage === 1) return "PROSPECT"
  return null
}

// ─── Gmail Thread → Email Mapper ──────────────────────────────────────────────

/**
 * Build the namespaced UI identity for one conversation.
 *
 * Encoded as a JSON array rather than joined with a separator character: any
 * separator can in principle appear inside a provider's thread id, which would
 * let two different (provider, account, thread) triples collapse to the same
 * uid. JSON escaping makes the encoding injective, so that cannot happen.
 */
function conversationUid(
  source: "gmail" | "outlook",
  accountId: string | null | undefined,
  threadId: string | number
): string {
  return JSON.stringify([source, accountId ?? "selected", String(threadId)])
}

function mapGmailThreadToEmail(thread: any, index: number, accountId?: string | null): Email {
  const messages = thread.messages || []
  const firstMsg = messages[0] || {}
  const lastMsg = messages[messages.length - 1] || {}

  // messages[0] is the oldest message in the thread, which is often the outbound
  // message the user sent (cold outreach) rather than something from the contact.
  // Prefer the first message that isn't one the user sent; otherwise fall back to
  // who the first message was addressed to.
  const contactMsg = messages.find((m: any) => !(m.labelIds || []).includes("SENT"))
  const fromHeader = contactMsg ? contactMsg.from || contactMsg.sender || "" : firstMsg.to || firstMsg.from || firstMsg.sender || ""
  const nameMatch = fromHeader.match(/^([^<]+)</)
  const emailMatch = fromHeader.match(/<([^>]+)>/)
  const senderName = nameMatch ? nameMatch[1].trim() : fromHeader.split("@")[0] || "Unknown"
  const senderEmail = (emailMatch ? emailMatch[1] : fromHeader).toLowerCase().trim()

  // Tag each message with who actually sent it (via Gmail's SENT label) instead of
  // assuming the first message is always from the contact — the user may have sent
  // the first message themselves (cold outreach).
  const replies = messages.map((msg: any) => {
    const replyFrom = msg.from || msg.sender || ""
    const replyName = replyFrom.match(/^([^<]+)</)?.[1]?.trim() || replyFrom.split("@")[0] || "Unknown"
    const isUser = (msg.labelIds || []).includes("SENT")
    // Only trust the isHtml flag when it's paired with an actual body —
    // msg.body falls back to the plain-text msg.snippet/msg.text when the
    // real body couldn't be extracted, and that fallback is never HTML.
    const hasRealBody = Boolean(msg.body)
    return {
      sender: isUser ? "You" : replyName,
      message: msg.body || msg.snippet || msg.text || "",
      timestamp: msg.date || new Date().toISOString(),
      isUser,
      isHtml: hasRealBody && Boolean(msg.isHtml),
      attachments: (msg.attachments || []).map((a: any) => ({
        id: a.attachmentId,
        messageId: msg.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        provider: "gmail" as const,
      })),
    }
  })

  const status = getPipelineStatus(thread.brandInfluencer)
  // The conversation's date should reflect its most recent activity, not
  // when it started — use the last message, not the first (messages[0] is
  // the oldest, per the comment above). Matches how Outlook's timestamp is
  // already derived below.
  const timestamp = lastMsg.date || firstMsg.date || new Date().toISOString()

  return {
    id: thread.id || `gmail-${index}`,
    uid: conversationUid("gmail", accountId, thread.id || `gmail-${index}`),
    accountId: accountId ?? null,
    gmailThreadId: thread.id,
    name: senderName,
    handle: senderEmail,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=1FAE5B&color=fff&bold=true`,
    subject: thread.subject || firstMsg.subject || "(No subject)",
    preview: thread.snippet || firstMsg.snippet || lastMsg.snippet || "",
    message: firstMsg.body || firstMsg.snippet || firstMsg.text || "",
    date: formatRelativeDate(timestamp),
    timestamp,
    status,
    read: !thread.unread,
    starred: false,
    from: senderName,
    fromEmail: senderEmail,
    replies,
    source: "gmail" as const,
  }
}

// A cold-outreach thread with no reply yet — shown from headers/snippet only
// (see app/api/gmail/threads/route.ts's sentAwaitingReply). Deliberately
// separate from mapGmailThreadToEmail, which assumes a full messages[] array.
function mapLightweightSentThread(thread: any, index: number, accountId?: string | null): Email {
  const status = getPipelineStatus(thread.brandInfluencer)
  const timestamp = thread.date || new Date().toISOString()
  const recipientName = thread.recipientName || thread.recipientEmail?.split("@")[0] || "Unknown"

  return {
    id: thread.id || `gmail-sent-${index}`,
    uid: conversationUid("gmail", accountId, thread.id || `gmail-sent-${index}`),
    accountId: accountId ?? null,
    gmailThreadId: thread.id,
    name: recipientName,
    handle: thread.recipientEmail || "",
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(recipientName)}&background=1FAE5B&color=fff&bold=true`,
    subject: thread.subject || "(No subject)",
    preview: thread.snippet || "",
    message: "",
    date: formatRelativeDate(timestamp),
    timestamp,
    status,
    read: true,
    starred: false,
    from: recipientName,
    fromEmail: thread.recipientEmail || "",
    replies: undefined,
    source: "gmail" as const,
    isLightweight: true,
  }
}

function mapOutlookThreadToEmail(thread: any, index: number, accountId?: string | null): Email {
  const messages = thread.messages || []
  const firstMsg = messages[0] || {}

  const fromHeader = firstMsg.from || ""
  const nameMatch = fromHeader.match(/^([^<]+)</)
  const emailMatch = fromHeader.match(/<([^>]+)>/)
  const senderName = nameMatch ? nameMatch[1].trim() : fromHeader.split("@")[0] || "Unknown"
  const senderEmail = (emailMatch ? emailMatch[1] : fromHeader).toLowerCase().trim()

  // Outlook is fetched only from the inbox folder, so every message here is
  // genuinely from the contact (never something the user sent).
  const replies = messages.map((msg: any) => {
    const replyFrom = msg.from || ""
    const replyName = replyFrom.match(/^([^<]+)</)?.[1]?.trim() || replyFrom.split("@")[0] || "Unknown"
    return {
      sender: replyName,
      message: msg.body || msg.snippet || "",
      timestamp: msg.date || new Date().toISOString(),
      isUser: false,
      attachments: (msg.attachments || []).map((a: any) => ({
        id: a.id,
        messageId: msg.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        provider: "outlook" as const,
      })),
    }
  })

  const status = getPipelineStatus(thread.brandInfluencer)
  const timestamp = firstMsg.date || new Date().toISOString()

  return {
    id: thread.id || `outlook-${index}`,
    uid: conversationUid("outlook", accountId, thread.id || `outlook-${index}`),
    accountId: accountId ?? null,
    name: senderName,
    handle: senderEmail,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0078D4&color=fff&bold=true`,
    subject: thread.subject || firstMsg.subject || "(No subject)",
    preview: thread.snippet || firstMsg.snippet || "",
    message: firstMsg.body || firstMsg.snippet || "",
    date: formatRelativeDate(timestamp),
    timestamp,
    status,
    read: !thread.unread,
    starred: false,
    from: senderName,
    fromEmail: senderEmail,
    replies,
    source: "outlook" as const,
    outlookMessageId: thread.lastMessageId,
  }
}

function formatRelativeDate(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    return `${diffDays} days ago`
  } catch {
    return "Recently"
  }
}

// Renders untrusted HTML email content (e.g. a Gmail message whose body is
// text/html, including our own signature-bearing sends) inside a sandboxed
// iframe rather than dangerouslySetInnerHTML — inbound mail can come from
// anyone, and raw HTML from a third party is a script/XSS vector if rendered
// directly into the page. `allow-same-origin` (without `allow-scripts`) lets
// this component measure the rendered content's height to auto-size the
// iframe; scripts still cannot execute either way.
function HtmlMessageFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(80)
  const doc = `<!doctype html><html><head><meta charset="utf-8">` +
    `<style>body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;overflow-wrap:anywhere;}</style>` +
    `</head><body>${html}</body></html>`

  return (
    <iframe
      srcDoc={doc}
      sandbox="allow-same-origin"
      style={{ width: "100%", border: 0, height }}
      onLoad={(e) => {
        const body = e.currentTarget.contentWindow?.document?.body
        if (body) setHeight(body.scrollHeight + 8)
      }}
    />
  )
}

// Splits a plain-text email body into the new reply text and the quoted
// history beneath it (e.g. "On ... wrote:" followed by "> " lines), so the
// quoted part can be collapsed behind a toggle instead of always shown.
function splitQuotedText(body: string): { main: string; quoted: string | null } {
  const onWroteMatch = body.match(/\n?On [\s\S]*?wrote:\s*\n?/)
  if (onWroteMatch && onWroteMatch.index !== undefined) {
    const idx = onWroteMatch.index
    return { main: body.slice(0, idx).trim(), quoted: body.slice(idx).trim() }
  }
  const quoteLineMatch = body.match(/^>.*$/m)
  if (quoteLineMatch && quoteLineMatch.index !== undefined) {
    const idx = quoteLineMatch.index
    return { main: body.slice(0, idx).trim(), quoted: body.slice(idx).trim() }
  }
  return { main: body, quoted: null }
}

// Separates the "On ... wrote:" attribution line (which may itself be wrapped
// across multiple lines) from the actual quoted body, and strips the leading
// "> " markers from each quoted line so it reads as normal text once indented.
function parseQuotedBlock(quoted: string): { attribution: string | null; text: string } {
  const match = quoted.match(/^(On [\s\S]*?wrote:)\s*\n?([\s\S]*)$/)
  const attribution = match ? match[1].replace(/\s+/g, " ").trim() : null
  const rest = match ? match[2] : quoted
  const text = rest
    .split("\n")
    .map((line) => line.replace(/^>\s?/, ""))
    .join("\n")
    .trim()
  return { attribution, text }
}

// ─── Drag-and-drop: stage tab drop target / message row drag source ──────────

/**
 * The connected-mailbox menu behind an account chip.
 *
 * Lists every account already connected for that provider, switches between
 * them, offers a Remove action, and links out to the existing OAuth flow for
 * adding another. Purely presentational — every action is handled by the page.
 */
function AccountMenu({
  provider,
  accounts,
  busy,
  error,
  onSelect,
  onRemove,
  onConnectAnother,
  onClose,
}: {
  provider: MailProvider
  accounts: MailAccount[]
  busy: boolean
  error?: string
  onSelect: (account: MailAccount) => void
  onRemove: (account: MailAccount) => void
  onConnectAnother: () => void
  onClose: () => void
}) {
  return (
    <>
      {/* Click-away, matching the pattern the compose and stage modals use. */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5">
        <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {PROVIDER_LABEL[provider]} accounts
        </div>

        {accounts.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-400">No accounts listed yet.</div>
        ) : (
          accounts.map(account => (
            <div
              key={account.id}
              className={`group flex items-center gap-2 px-3 py-2 text-xs transition ${
                account.isSelected ? "bg-gray-50" : "hover:bg-gray-50"
              }`}
            >
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(account)}
                className="flex-1 flex items-center gap-2 text-left min-w-0 disabled:opacity-50"
              >
                <span className="w-3.5 flex-shrink-0">
                  {account.isSelected && <IconCheck size={13} className="text-[#1FAE5B]" />}
                </span>
                <span className={`truncate ${account.isSelected ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                  {account.email || "Connected account"}
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(account)}
                title="Remove account"
                aria-label={`Remove ${account.email || "account"}`}
                className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
              >
                <IconTrash size={13} />
              </button>
            </div>
          ))
        )}

        {error && <div className="px-3 py-1.5 text-[11px] text-red-500">{error}</div>}

        <div className="border-t border-gray-100 mt-1 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => { onClose(); onConnectAnother() }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <IconPlus size={13} className="text-gray-400" />
            Connect another {PROVIDER_LABEL[provider]} account
          </button>
        </div>
      </div>
    </>
  )
}

function DroppableStageTab({ id, isExit, children }: { id: string; isExit?: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`w-full h-full transition-colors ${isOver ? (isExit ? "ring-2 ring-inset ring-red-400" : "ring-2 ring-inset ring-[#1FAE5B]") : ""}`}
    >
      {children}
    </div>
  )
}

function DraggableEmailRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      {children}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function InboxContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId")

  // ── Subscription gate ──────────────────────────────────────────────────────
  // Served from the shared cache, so a return visit resolves on mount instead
  // of gating the inbox behind a skeleton again.
  // Inbox is Solo/Team only per the pricing page — Basic gets no Gmail/Outlook
  // access at all, unlike Pipeline and Post Tracker which Basic does include.
  const { isSubscribed, status: subscriptionStatus, planDisplayName, refetch: refetchSubscription } = useSubscriptionGate(brandId, ["solo", "team"])

  // Threads already fetched for this brand render immediately; the mount checks
  // below still run and update these silently in the background.
  // Relative path, built without `window`: this runs during the initial render,
  // which Next.js also performs on the server, where `window.location` does not
  // exist. It doubles as the shared-cache key and as the fetch URL — `fetch`
  // resolves a relative path against the current document in the browser.
  /**
   * The selected Outlook account's id, read straight out of the shared cache.
   *
   * Read this way rather than from `accountsData` because threadsKey() is used
   * inside state initialisers that run before that binding exists. Same cache
   * entry, same value — just available earlier.
   */
  /**
   * The selected Gmail account's id — used ONLY to stamp conversation identity
   * onto mapped threads, never in Gmail's cache key or fetch URL, which stay
   * exactly as they were.
   */
  const selectedGmailAccountId = (): string | null =>
    getCachedData<{ accounts: MailAccount[] }>(MAIL_ACCOUNTS_KEY)
      ?.accounts?.find(a => a.provider === "gmail" && a.isSelected)?.id ?? null

  const selectedOutlookAccountId = (): string | null =>
    getCachedData<{ accounts: MailAccount[] }>(MAIL_ACCOUNTS_KEY)
      ?.accounts?.find(a => a.provider === "outlook" && a.isSelected)?.id ?? null

  /**
   * Cache key and fetch URL for one provider's threads.
   *
   * The Outlook key now carries the account id. Without it, two connected
   * Outlook mailboxes shared a single cache entry keyed only by brand, so
   * returning to the inbox — or any read that landed before a switch's refetch
   * — painted the previous account's conversations under the newly selected
   * account's name. Keyed per account, each mailbox has its own entry and the
   * two can never be confused for one another.
   *
   * Gmail's key is unchanged, byte for byte.
   */
  const threadsKey = (provider: "gmail" | "outlook", accountId?: string | null) => {
    const parts: string[] = []
    if (brandId) parts.push(`brandId=${encodeURIComponent(brandId)}`)
    if (provider === "outlook") {
      const acc = accountId !== undefined ? accountId : selectedOutlookAccountId()
      if (acc) parts.push(`accountId=${encodeURIComponent(acc)}`)
    }
    return `/api/${provider}/threads${parts.length ? `?${parts.join("&")}` : ""}`
  }

  const cachedEmails = () => {
    const read = (provider: "gmail" | "outlook") => getCachedData<any>(threadsKey(provider))
    const gmail = read("gmail")
    const outlook = read("outlook")
    const gmailAccountId = selectedGmailAccountId()
    const outlookAccountId = selectedOutlookAccountId()
    return [
      ...((gmail?.threads ?? []) as any[]).map((t, i) => mapGmailThreadToEmail(t, i, gmailAccountId)),
      ...((gmail?.sentAwaitingReply ?? []) as any[]).map((t, i) => mapLightweightSentThread(t, i, gmailAccountId)),
      // Stamped with the account the Outlook cache entry belongs to, so two
      // connected Outlook mailboxes never produce colliding conversation uids.
      ...((outlook?.threads ?? []) as any[]).map((t, i) => mapOutlookThreadToEmail(t, i, outlook?.accountId ?? outlookAccountId)),
    ]
  }

  const [emails, setEmails] = useState<Email[]>(cachedEmails)
  // The connected Gmail account's own address — lets the UI tell a thread with
  // an external contact apart from a thread with the user's own mailbox (e.g.
  // a self-sent verification/test email), instead of treating the latter as
  // an unregistered influencer.
  const [gmailConnectedEmail, setGmailConnectedEmail] = useState<string | null>(
    () => getCachedData<any>(threadsKey("gmail"))?.connectedEmail ?? null
  )
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [loadingThreadId, setLoadingThreadId] = useState<string | number | null>(null)
  const [selectedStage, setSelectedStage] = useState<PipelineStage | "ALL">("ALL")
  const [openCompose, setOpenCompose] = useState(false)
  const [openTemplates, setOpenTemplates] = useState(false)
  const [reply, setReply] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | undefined>()
  const [replyAttachments, setReplyAttachments] = useState<PendingAttachment[]>([])
  const replyEditorRef = useRef<RichComposeEditorHandle>(null)

  // Received/sent attachments (as opposed to composeAttachments/replyAttachments,
  // which are files pending upload) — fetched lazily, only when clicked.
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null)

  const openAttachment = async (att: EmailAttachment) => {
    setDownloadingAttachmentId(att.id)
    try {
      const url =
        att.provider === "gmail"
          ? `/api/gmail/attachment/${att.messageId}/${att.id}?filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType)}`
          : `/api/outlook/attachment/${att.messageId}/${att.id}`

      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load attachment")
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)

      const isViewableInline = att.mimeType.startsWith("image/") || att.mimeType === "application/pdf"
      if (isViewableInline) {
        // Not revoked immediately — the new tab needs the blob URL to stay
        // valid while it's open.
        window.open(objectUrl, "_blank")
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      } else {
        const a = document.createElement("a")
        a.href = objectUrl
        a.download = att.filename
        a.style.display = "none"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
      }
    } catch {
      // Silent — this is a secondary action off an already-loaded thread;
      // nothing in this view is left in a broken state if it fails.
    } finally {
      setDownloadingAttachmentId(null)
    }
  }
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [updateStageModal, setUpdateStageModal] = useState<{ open: boolean; email: Email | null }>({ open: false, email: null })

  // ── Connected mailboxes ───────────────────────────────────────────────────
  // Read through the shared cache like every other inbox fetch, so the shell
  // and the chips render from whatever is already known and this list fills in
  // progressively instead of gating anything.
  const accountsFetcher = useCallback(async () => {
    const res = await fetch(MAIL_ACCOUNTS_KEY)
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || "Failed to load connected accounts")
    return json as { accounts: MailAccount[] }
  }, [])

  const { data: accountsData, refetch: refetchAccounts, mutate: mutateAccounts } =
    useCachedFetch<{ accounts: MailAccount[] }>(MAIL_ACCOUNTS_KEY, accountsFetcher)
  const mailAccounts = accountsData?.accounts ?? []
  const accountsFor = (provider: MailProvider) => mailAccounts.filter(a => a.provider === provider)
  const selectedAccount = (provider: MailProvider) =>
    mailAccounts.find(a => a.provider === provider && a.isSelected) ?? null

  /** Which provider's account menu is open, if any. */
  const [openAccountMenu, setOpenAccountMenu] = useState<MailProvider | null>(null)
  /** The account a Remove confirmation is currently about. */
  const [removeAccount, setRemoveAccount] = useState<MailAccount | null>(null)
  const [accountBusy, setAccountBusy] = useState(false)
  const [accountError, setAccountError] = useState<string | undefined>()
  const [stageNotification, setStageNotification] = useState<{ show: boolean; message: string; type: "error" | "success" }>({ show: false, message: "", type: "error" })
  const [showPipelineBar, setShowPipelineBar] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [showActions, setShowActions] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // "checking" only when this mailbox has nothing cached — a cached mailbox was
  // connected last time, so it renders as connected while the check re-runs.
  const hasCachedThreads = (provider: "gmail" | "outlook") =>
    getCachedData<any>(threadsKey(provider)) !== undefined

  const [gmailSyncState, setGmailSyncState] = useState<GmailSyncState>(
    () => (hasCachedThreads("gmail") ? "connected" : "checking")
  )
  const [gmailError, setGmailError] = useState<string | undefined>()
  const [gmailConnected, setGmailConnected] = useState(() => hasCachedThreads("gmail"))

  const [outlookSyncState, setOutlookSyncState] = useState<GmailSyncState>(
    () => (hasCachedThreads("outlook") ? "connected" : "checking")
  )
  const [outlookError, setOutlookError] = useState<string | undefined>()
  const [outlookConnected, setOutlookConnected] = useState(() => hasCachedThreads("outlook"))

  const [composeSource, setComposeSource] = useState<"gmail" | "outlook">("gmail")
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set())

  // Compose modal state
  const [composeTo, setComposeTo] = useState("")
  const [composeSubject, setComposeSubject] = useState("")
  const [composeBody, setComposeBody] = useState("")
  const [composeError, setComposeError] = useState<string | undefined>()
  const [isComposeSending, setIsComposeSending] = useState(false)
  const [composeSent, setComposeSent] = useState(false)

  // Save-current-draft-as-template popover (compose modal only — replies have no subject field)
  const [savingComposeAsTemplate, setSavingComposeAsTemplate] = useState(false)
  const [composeTemplateName, setComposeTemplateName] = useState("")
  const [isSavingComposeTemplate, setIsSavingComposeTemplate] = useState(false)
  const [saveComposeTemplateError, setSaveComposeTemplateError] = useState<string | undefined>()

  // Rich compose: attachments + formatting, sent via both Gmail and Outlook
  // (see sendCompose below — each provider's send route accepts the same
  // multipart request and builds whatever format its own API needs).
  const [composeAttachments, setComposeAttachments] = useState<PendingAttachment[]>([])
  const composeEditorRef = useRef<RichComposeEditorHandle>(null)
  const MAX_TOTAL_ATTACHMENT_BYTES = 4 * 1024 * 1024

  const handleAddComposeFiles = (newFiles: File[]) => {
    const built: PendingAttachment[] = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }))
    setComposeAttachments((prev) => [...prev, ...built])
  }

  const handleRemoveComposeFile = (id: string) => {
    setComposeAttachments((prev) => {
      const removed = prev.find((f) => f.id === id)
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }

  const clearComposeAttachments = () => {
    setComposeAttachments((prev) => {
      prev.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
      return []
    })
  }

  const handleAddReplyFiles = (newFiles: File[]) => {
    const built: PendingAttachment[] = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }))
    setReplyAttachments((prev) => [...prev, ...built])
  }

  const handleRemoveReplyFile = (id: string) => {
    setReplyAttachments((prev) => {
      const removed = prev.find((f) => f.id === id)
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }

  const clearReplyAttachments = () => {
    setReplyAttachments((prev) => {
      prev.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
      return []
    })
  }

  /** Strips a rich-compose HTML string down to plain text — used wherever
   *  the HTML body needs to become plain text (Outlook send, the optimistic
   *  sent-thread placeholder, and saving a template). */
  const htmlToPlainText = (html: string): string => {
    if (typeof document === "undefined") return html
    const el = document.createElement("div")
    el.innerHTML = html
    return (el.textContent || "").trim()
  }

  /** Inverse of the above, for applying a plain-text template into the rich
   *  compose box — escapes the text and turns newlines into <br>. Kept local
   *  (not imported from lib/signature.ts) since that module is server-only. */
  const plainTextToComposeHtml = (text: string): string =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>")

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Monotonically increasing request ids so a slow/stale gmail or outlook
  // fetch (e.g. issued for a previous brandId) can't overwrite state with
  // out-of-date results after a newer request has already resolved.
  const gmailRequestIdRef = useRef(0)
  const outlookRequestIdRef = useRef(0)

  // Persisted threads are handed over after mount — `cachedEmails` and
  // `hasCachedThreads` above read the cache during render and must stay empty
  // while React hydrates. The connection checks below still run and revalidate.
  useRestoredCache<any>(threadsKey("gmail"), (data) => {
    const restoredEmails = ((data?.threads ?? []) as any[]).map((t, i) => mapGmailThreadToEmail(t, i, selectedGmailAccountId()))
    if (restoredEmails.length) {
      setEmails((prev) => [...prev.filter((e) => e.source !== "gmail"), ...restoredEmails])
    }
    // A mailbox with stored threads was connected last time, so it renders as
    // connected while the check re-runs — the same rule the initializers use.
    setGmailConnected(true)
    setGmailSyncState((prev) => (prev === "checking" ? "connected" : prev))
  })
  useRestoredCache<any>(threadsKey("outlook"), (data) => {
    const restoredEmails = ((data?.threads ?? []) as any[]).map((t, i) => mapOutlookThreadToEmail(t, i, data?.accountId ?? selectedOutlookAccountId()))
    if (restoredEmails.length) {
      setEmails((prev) => [...prev.filter((e) => e.source !== "outlook"), ...restoredEmails])
    }
    setOutlookConnected(true)
    setOutlookSyncState((prev) => (prev === "checking" ? "connected" : prev))
  })

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)

    const params = new URLSearchParams(window.location.search)
    const justConnectedGmail = params.get("gmailConnected") === "1"
    const justConnectedOutlook = params.get("outlookConnected") === "1"

    // ── Are we the OAuth tab? ──────────────────────────────────────────────
    // Both callbacks finish by redirecting to the inbox with one of these
    // params, so a tab that was opened by another tab AND is carrying them is
    // the tab that just ran the flow. Its only remaining job is to tell the tab
    // that opened it what happened and get out of the way — no inbox load, no
    // threads fetch, nothing else. The original tab does the reload.
    const callbackErrors: Record<MailProvider, string | null> = {
      gmail: params.get("gmailError"),
      outlook: params.get("outlookError"),
    }
    const callbackSuccess: Record<MailProvider, boolean> = {
      gmail: justConnectedGmail,
      outlook: justConnectedOutlook,
    }
    const callbackProvider = (["gmail", "outlook"] as MailProvider[]).find(
      pr => callbackSuccess[pr] || callbackErrors[pr]
    )
    if (window.opener && callbackProvider) {
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(OAUTH_CHANNEL)
        const result: OAuthResult = callbackSuccess[callbackProvider]
          ? { provider: callbackProvider, ok: true }
          : {
              provider: callbackProvider,
              ok: false,
              error: decodeURIComponent(callbackErrors[callbackProvider] || ""),
            }
        channel.postMessage(result)
        channel.close()
      }
      window.close()
      // If the browser refuses to close a tab it did not script-open, fall
      // through to the normal inbox below rather than leaving a blank page.
    }

    // A fresh connect/reconnect can land on a still-valid client-side cache
    // entry from before the switch (e.g. Change Gmail to a different
    // account) — checkGmailConnection's force:false read would then keep
    // showing the previous account's threads. Force a real refetch instead
    // of the normal cached check whenever we're returning from that flow.
    if (justConnectedGmail) loadGmailThreads()
    else checkGmailConnection()

    if (justConnectedOutlook) loadOutlookThreads()
    else checkOutlookConnection()

    // Handle ?gmailConnected=1 redirect from OAuth callback
    if (justConnectedGmail) {
      const clean = new URL(window.location.href)
      clean.searchParams.delete("gmailConnected")
      window.history.replaceState({}, "", clean.toString())
    }

    // Handle ?gmailError=... from OAuth callback
    const gmailErr = params.get("gmailError")
    if (gmailErr) {
      setGmailError(decodeURIComponent(gmailErr))
      setGmailSyncState("error")
      const clean = new URL(window.location.href)
      clean.searchParams.delete("gmailError")
      window.history.replaceState({}, "", clean.toString())
    }

    // Handle ?outlookConnected=1 redirect from Outlook OAuth callback
    if (justConnectedOutlook) {
      const clean = new URL(window.location.href)
      clean.searchParams.delete("outlookConnected")
      window.history.replaceState({}, "", clean.toString())
    }

    // Handle ?outlookError=... from Outlook OAuth callback
    const outlookErr = params.get("outlookError")
    if (outlookErr) {
      setOutlookError(decodeURIComponent(outlookErr))
      setOutlookSyncState("error")
      const clean = new URL(window.location.href)
      clean.searchParams.delete("outlookError")
      window.history.replaceState({}, "", clean.toString())
    }

    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [selectedEmail?.replies])

  useEffect(() => {
    setExpandedQuotes(new Set())
  }, [selectedEmail?.id])

  // Debounce the search input so filtering doesn't run on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ── Gmail connection check ─────────────────────────────────────────────────

  /**
   * Thread fetch that goes through the shared cache.
   *
   * Mount checks read whatever is cached for this mailbox + brand, so returning
   * to the inbox shows the threads already loaded instead of dropping back to
   * "checking" and re-requesting. `force` is used by the explicit refresh
   * buttons, which must always hit the provider.
   */
  const fetchThreads = (provider: "gmail" | "outlook", force: boolean, accountId?: string | null) => {
    const href = threadsKey(provider, accountId)
    return fetchCached<any>(href, async () => {
      const res = await fetch(href)
      const json = await res.json()
      // A non-OK response is not cached: it is thrown with its body attached so
      // the reauth / error branches below behave exactly as before.
      if (!res.ok) throw Object.assign(new Error(json?.error || ""), { body: json, status: res.status })
      return json
    }, { force })
  }

  const checkGmailConnection = async () => {
    const requestId = ++gmailRequestIdRef.current
    try {
      const gmailAccountId = selectedGmailAccountId()
      const data = await fetchThreads("gmail", false)
      if (requestId !== gmailRequestIdRef.current) return // superseded by a newer request
      const mappedEmails = [
        ...(data.threads || []).map((t: any, i: number) => mapGmailThreadToEmail(t, i, gmailAccountId)),
        ...(data.sentAwaitingReply || []).map((t: any, i: number) => mapLightweightSentThread(t, i, gmailAccountId)),
      ]
      setEmails(prev => [...prev.filter(e => e.source !== "gmail"), ...mappedEmails])
      setGmailConnected(true)
      setGmailSyncState("connected")
      setGmailConnectedEmail(data.connectedEmail ?? null)
    } catch (err: any) {
      if (requestId !== gmailRequestIdRef.current) return
      // reauth = the provider says this account isn't linked (or its grant
      // lapsed). A bare 401/403 means the OAuth flow was never completed, which
      // is the same thing from the inbox's point of view: not connected, so the
      // existing disconnected state is shown rather than an error.
      if (err?.body?.reauth || err?.status === 401 || err?.status === 403) {
        setGmailSyncState("not_connected")
        return
      }
      setGmailError(err?.body?.error || err?.message || "Failed to check Gmail connection.")
      setGmailSyncState("error")
    }
  }


  // ── Connect a mailbox — one flow, both providers ──────────────────────────
  // Gmail and Outlook differ only in their route prefix and which slice of state
  // they own, so the tab handling, the waiting state and the cross-tab hand-off
  // live here once. Each provider keeps its own existing connect route,
  // callback, credentials and session handling — untouched.

  const setProviderSyncState = (provider: MailProvider, state: GmailSyncState) => {
    if (provider === "gmail") setGmailSyncState(state)
    else setOutlookSyncState(state)
  }

  const setProviderError = (provider: MailProvider, message: string) => {
    if (provider === "gmail") setGmailError(message)
    else setOutlookError(message)
  }

  /**
   * Start the OAuth flow for one provider.
   *
   * Everything — the authorization redirect, the account picker, consent and the
   * provider's callback — happens in the tab this opens. This tab does not
   * navigate anywhere; it holds on the inbox showing "Waiting for sign-in…"
   * until the other tab reports back or goes away.
   */
  const connectProvider = (provider: MailProvider) => {
    const returnTo = window.location.pathname + window.location.search
    // NOTE: no "noopener" here, deliberately. With noopener the browser returns
    // null from window.open even on success, so the old code could not tell a
    // blocked popup from an opened tab — it always took the fallback branch and
    // navigated THIS tab to Google / Microsoft. The tab we open is our own
    // origin, and the handle is what lets us notice it closing.
    //
    // Opened blank and navigated once the handoff token is ready, rather than
    // opening straight to /api/{provider}/connect — window.open must run
    // synchronously inside the click handler or browsers treat it as an
    // unrequested popup and block it, so the async token fetch below can't
    // happen before the popup opens, only before it navigates.
    const opened = window.open("", "_blank")
    if (!opened) {
      setProviderError(provider, "Your browser blocked the sign-in tab. Allow pop-ups for this site and try again.")
      setProviderSyncState(provider, "error")
      return
    }
    setProviderSyncState(provider, "connecting")

    // Hand the popup a pre-built identity token from THIS tab (guaranteed to
    // have a live session) instead of letting it authenticate itself —
    // Microsoft's sign-in page can land the popup in a different Edge
    // browser profile with no Instroom session at all, which broke this
    // when the popup relied on its own cookie. See lib/oauth-connect-state.ts.
    fetch(`/api/oauth-handoff?returnTo=${encodeURIComponent(returnTo)}`)
      .then((res) => {
        if (!res.ok) throw new Error("handoff failed")
        return res.json()
      })
      .then(({ token }: { token: string }) => {
        opened.location.href = `/api/${provider}/connect?token=${encodeURIComponent(token)}`
        awaitOAuthTab(provider, opened)
      })
      .catch(() => {
        opened.close()
        setProviderError(provider, "Couldn't start the sign-in flow. Please try again.")
        setProviderSyncState(provider, "error")
      })
  }

  /**
   * Keep this tab waiting while the OAuth tab works, and react once it reports.
   *
   * Three ways out, whichever comes first, and only the first one counts:
   *   1. the OAuth tab broadcasts its outcome — success or a callback error;
   *   2. the OAuth tab is closed (cancelled, or the message never arrived) — the
   *      connection is re-checked, since the grant may well have gone through;
   *   3. focus returns to this tab and that tab has gone — an immediate check
   *      instead of waiting up to 500ms for the next poll.
   */
  const awaitOAuthTab = (provider: MailProvider, oauthTab: Window) => {
    let settled = false
    let channel: BroadcastChannel | null = null
    let closedPoll: ReturnType<typeof setInterval> | null = null

    const cleanup = () => {
      window.removeEventListener("focus", onFocus)
      if (closedPoll) clearInterval(closedPoll)
      channel?.close()
    }

    const settle = (result: "connected" | "cancelled" | { error: string }) => {
      if (settled) return
      settled = true
      cleanup()
      if (result === "connected") {
        // The OAuth tab closes itself once it has broadcast; close it from here
        // too, for a browser that refuses a script-close of a tab it did not
        // itself open. We hold the handle because we opened it.
        if (!oauthTab.closed) {
          try { oauthTab.close() } catch { /* already gone, or refused */ }
        }
        // force:true — the shared cache may still hold the "not connected"
        // answer from a moment ago, or the previous account's threads.
        void (provider === "gmail" ? loadGmailThreads() : loadOutlookThreads())
        // Re-run the gate. A subscription check that happened to fail during the
        // OAuth transition is cached as "not subscribed" and leaves the locked
        // overlay sitting over a perfectly good inbox until something asks
        // again. This asks again — the same check, against the same route; it
        // does not skip or weaken it, and a genuinely unsubscribed user stays
        // locked.
        void refetchSubscription()
        // A newly connected mailbox has to appear in the account selector.
        void refetchAccounts()
      } else if (result === "cancelled") {
        // The tab went away without a verdict. It may still have completed, so
        // ask the server rather than assuming either way; the check helpers
        // already fall back to "not_connected" on a 401/403.
        void (provider === "gmail" ? checkGmailConnection() : checkOutlookConnection())
      } else {
        setProviderError(provider, result.error)
        setProviderSyncState(provider, "error")
      }
    }

    // Focus alone is not a verdict — the user may simply be tabbing back and
    // forth while the account picker is still open. It settles only if the OAuth
    // tab has actually gone.
    const onFocus = () => { if (oauthTab.closed) settle("cancelled") }
    window.addEventListener("focus", onFocus)

    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(OAUTH_CHANNEL)
      channel.onmessage = (event: MessageEvent<OAuthResult>) => {
        const data = event.data
        if (!data || data.provider !== provider) return
        settle(data.ok ? "connected" : { error: data.error || `${PROVIDER_LABEL[provider]} sign-in failed.` })
      }
    }

    closedPoll = setInterval(() => {
      if (oauthTab.closed) settle("cancelled")
    }, 500)
  }

  // ── Switching and removing mailboxes ──────────────────────────────────────

  /** Forget only this provider's cached threads. The other mailbox's cache and
   *  the rest of the inbox are untouched. */
  const dropProviderThreadsCache = (provider: MailProvider) => {
    invalidateCache(threadsKey(provider))
  }

  /** Remove this provider's conversations from the visible list — used when a
   *  mailbox goes away, not while switching (see switchAccount). */
  const clearProviderEmails = (provider: MailProvider) => {
    setEmails(prev => prev.filter(e => e.source !== provider))
    // The reading pane holds its own copy of the open conversation, so filtering
    // the list alone left that conversation on screen after its mailbox was
    // switched away or disconnected — and a reply typed into it would have been
    // sent from the newly selected account instead. Closed along with the list.
    setSelectedEmail(prev => (prev?.source === provider ? null : prev))
  }

  /** Move the selected marker within one provider, so the chip label and the
   *  menu's checkmark update on click instead of after the round trip. */
  const markAccountSelected = (account: MailAccount) => {
    const current = accountsData?.accounts
    if (!current) return
    mutateAccounts({
      accounts: current.map(a =>
        a.provider === account.provider ? { ...a, isSelected: a.id === account.id } : a
      ),
    })
  }

  /**
   * Switch to another already-connected mailbox of the same provider.
   *
   * The server side of this is a touch of `last_selected_at` — the same column
   * both providers' token resolvers already order by — so the following fetch
   * returns that account's conversations and only that account's.
   */
  const switchAccount = async (account: MailAccount) => {
    if (accountBusy || account.isSelected) { setOpenAccountMenu(null); return }
    const previous = accountsData?.accounts
    setAccountBusy(true)
    setAccountError(undefined)
    // Close and re-label immediately. The list itself is deliberately NOT
    // cleared: emptying it first made every switch flash a blank inbox, so the
    // outgoing account's threads stay on screen until the incoming ones land
    // and replace them by `source`.
    setOpenAccountMenu(null)
    markAccountSelected(account)
    // Clear the outgoing mailbox's conversations before the incoming ones load.
    // This briefly shows an empty list, which is the point: leaving the previous
    // account's threads on screen under the newly selected account's name is
    // exactly the confusion this switcher has to avoid.
    clearProviderEmails(account.provider)
    try {
      const res = await fetch(MAIL_ACCOUNTS_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to switch account")

      // Only the switched provider is invalidated and refetched. The other
      // provider's threads are left alone, and the two are never merged: each
      // load replaces just its own `source`.
      dropProviderThreadsCache(account.provider)
      await Promise.all([
        refetchAccounts(),
        // The chosen account is passed explicitly rather than left to the
        // server's "most recently selected" ordering, so this fetch reads the
        // mailbox the user just clicked even if another request is in flight.
        account.provider === "gmail" ? loadGmailThreads() : loadOutlookThreads(account.id),
      ])
    } catch (err: any) {
      // Put the marker back where it was — the switch did not happen.
      if (previous) mutateAccounts({ accounts: previous })
      setAccountError(err?.message || "Failed to switch account")
      setOpenAccountMenu(account.provider)
    } finally {
      setAccountBusy(false)
    }
  }

  /**
   * Disconnect a mailbox, then land on a sensible state.
   *
   * The route replies with what is still connected, so the fallback is decided
   * from server truth rather than guessed here: another account of the same
   * provider becomes current, otherwise that provider drops to its existing
   * "not connected" state and the connect-email UI appears when neither
   * provider has anything left.
   */
  const confirmRemoveAccount = async () => {
    const account = removeAccount
    if (!account || accountBusy) return
    setAccountBusy(true)
    setAccountError(undefined)
    try {
      const res = await fetch(`${MAIL_ACCOUNTS_KEY}?accountId=${encodeURIComponent(account.id)}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to remove account")

      const remaining: MailAccount[] = json.remaining ?? []
      const provider = account.provider

      setRemoveAccount(null)
      setOpenAccountMenu(null)
      dropProviderThreadsCache(provider)
      clearProviderEmails(provider)

      if (remaining.some(a => a.provider === provider)) {
        // Another mailbox of the same provider took over — show its threads.
        // The list refresh and the thread fetch don't depend on each other.
        await Promise.all([
          refetchAccounts(),
          provider === "gmail" ? loadGmailThreads() : loadOutlookThreads(),
        ])
      } else {
        await refetchAccounts()
        // None left for this provider: the existing disconnected state, which
        // is also what drives the connect-email UI once both are empty.
        setProviderSyncState(provider, "not_connected")
        if (provider === "gmail") {
          setGmailConnected(false)
          setGmailConnectedEmail(null)
        } else {
          setOutlookConnected(false)
        }
      }
    } catch (err: any) {
      setAccountError(err?.message || "Failed to remove account")
    } finally {
      setAccountBusy(false)
    }
  }

  const handleConnectGmail = () => connectProvider("gmail")

  const loadGmailThreads = async () => {
    const requestId = ++gmailRequestIdRef.current
    setGmailSyncState("syncing")
    try {
      const gmailAccountId = selectedGmailAccountId()
      const data = await fetchThreads("gmail", true)
      if (requestId !== gmailRequestIdRef.current) return // superseded by a newer request
      const mappedEmails = [
        ...(data.threads || []).map((t: any, i: number) => mapGmailThreadToEmail(t, i, gmailAccountId)),
        ...(data.sentAwaitingReply || []).map((t: any, i: number) => mapLightweightSentThread(t, i, gmailAccountId)),
      ]
      setEmails(prev => [...prev.filter(e => e.source !== "gmail"), ...mappedEmails])
      setGmailConnected(true)
      setGmailSyncState("connected")
      setGmailConnectedEmail(data.connectedEmail ?? null)
    } catch (err: any) {
      if (requestId !== gmailRequestIdRef.current) return
      if (err?.body?.reauth) {
        setGmailSyncState("not_connected")
        return
      }
      setGmailError(err?.body?.error || err?.message || "Failed to load Gmail threads.")
      setGmailSyncState("error")
    }
  }

  // ── Outlook connection check ───────────────────────────────────────────────

  const checkOutlookConnection = async () => {
    const requestId = ++outlookRequestIdRef.current
    try {
      const targetAccountId = selectedOutlookAccountId()
      const data = await fetchThreads("outlook", false, targetAccountId)
      if (requestId !== outlookRequestIdRef.current) return // superseded by a newer request
      if (data.accountId && targetAccountId && data.accountId !== targetAccountId) return
      const mappedEmails = (data.threads || []).map((t: any, i: number) => mapOutlookThreadToEmail(t, i, data.accountId ?? targetAccountId))
      setEmails(prev => [...prev.filter(e => e.source !== "outlook"), ...mappedEmails])
      setOutlookConnected(true)
      setOutlookSyncState("connected")
    } catch (err: any) {
      if (requestId !== outlookRequestIdRef.current) return
      // reauth = the provider says this account isn't linked (or its grant
      // lapsed). A bare 401/403 means the OAuth flow was never completed, which
      // is the same thing from the inbox's point of view: not connected, so the
      // existing disconnected state is shown rather than an error.
      if (err?.body?.reauth || err?.status === 401 || err?.status === 403) {
        setOutlookSyncState("not_connected")
        return
      }
      setOutlookError(err?.body?.error || err?.message || "Failed to check Outlook connection.")
      setOutlookSyncState("error")
    }
  }

  const handleConnectOutlook = () => connectProvider("outlook")

  const loadOutlookThreads = async (accountId?: string | null) => {
    const requestId = ++outlookRequestIdRef.current
    // Which mailbox this load is for. Captured now so a response that arrives
    // after another switch can be recognised as stale and dropped.
    const targetAccountId = accountId !== undefined ? accountId : selectedOutlookAccountId()
    setOutlookSyncState("syncing")
    try {
      const data = await fetchThreads("outlook", true, targetAccountId)
      if (requestId !== outlookRequestIdRef.current) return // superseded by a newer request
      // Second guard, on server truth rather than request ordering: the route
      // echoes the account it actually read. If that is not the mailbox now
      // selected, these threads belong to the previous account and must not be
      // rendered under the new one.
      if (data.accountId && targetAccountId && data.accountId !== targetAccountId) return
      const mappedEmails = (data.threads || []).map((t: any, i: number) => mapOutlookThreadToEmail(t, i, data.accountId ?? targetAccountId))
      setEmails(prev => [...prev.filter(e => e.source !== "outlook"), ...mappedEmails])
      setOutlookConnected(true)
      setOutlookSyncState("connected")
    } catch (err: any) {
      if (requestId !== outlookRequestIdRef.current) return
      if (err?.body?.reauth) {
        setOutlookSyncState("not_connected")
        return
      }
      setOutlookError(err?.body?.error || err?.message || "Failed to load Outlook threads.")
      setOutlookSyncState("error")
    }
  }

  const sendCompose = async () => {
    const bodyIsEmpty = htmlToPlainText(composeBody).trim().length === 0
    if (!composeTo.trim() || (bodyIsEmpty && composeAttachments.length === 0) || isComposeSending) return
    setComposeError(undefined)
    setIsComposeSending(true)
    try {
      // The Outlook send route is told which mailbox to send from, for the same
      // reason the thread fetch is: left to infer it, a compose could go out
      // from a different account than the one the inbox is showing. Gmail's URL
      // is unchanged.
      const outlookSendAccountId = selectedOutlookAccountId()
      const sendApi =
        composeSource === "outlook"
          ? `/api/outlook/send${outlookSendAccountId ? `?accountId=${encodeURIComponent(outlookSendAccountId)}` : ""}`
          : "/api/gmail/send"
      let res: Response
      // Both providers accept attachments now — Gmail via a multipart
      // request that gets built into a real MIME message server-side,
      // Outlook via the same multipart request but converted to Graph's
      // plain JSON attachments array server-side (see the two send routes).
      if (composeAttachments.length > 0) {
        const form = new FormData()
        form.append("to", composeTo.trim())
        form.append("subject", composeSubject.trim() || "(No subject)")
        form.append("body", composeBody)
        form.append("isHtmlBody", "true")
        if (brandId) form.append("brandId", brandId)
        composeAttachments.forEach((a) => form.append("attachments", a.file, a.file.name))
        // No Content-Type header — fetch generates the multipart boundary itself.
        res = await fetch(sendApi, { method: "POST", body: form })
      } else {
        res = await fetch(sendApi, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: composeTo.trim(),
            subject: composeSubject.trim() || "(No subject)",
            body: composeBody,
            brandId,
            isHtmlBody: true,
          }),
        })
      }
      const data = await res.json()
      if (!res.ok) {
        setComposeError(data?.error || "Failed to send email.")
      } else {
        // Show it in the list immediately rather than waiting for the next
        // real refresh — Gmail-only, since sentAwaitingReply (and its
        // lightweight-thread rendering) has no Outlook equivalent. A later
        // refresh replaces every gmail-sourced entry wholesale anyway, so
        // this placeholder is naturally superseded by the real one, not a
        // lasting duplicate.
        if (composeSource !== "outlook") {
          const placeholder = mapLightweightSentThread(
            {
              id: `local-sent-${Date.now()}`,
              recipientEmail: composeTo.trim(),
              subject: composeSubject.trim() || "(No subject)",
              snippet: htmlToPlainText(composeBody).slice(0, 140),
              date: new Date().toISOString(),
            },
            0,
            selectedGmailAccountId()
          )
          setEmails((prev) => [placeholder, ...prev])
        }
        setComposeSent(true)
        setTimeout(() => {
          setOpenCompose(false)
          setComposeTo("")
          setComposeSubject("")
          setComposeBody("")
          clearComposeAttachments()
          setComposeSent(false)
          setComposeError(undefined)
          setSavingComposeAsTemplate(false)
          setComposeTemplateName("")
          setSaveComposeTemplateError(undefined)
        }, 1500)
      }
    } catch {
      setComposeError("Network error. Please try again.")
    } finally {
      setIsComposeSending(false)
    }
  }

  const saveComposeAsTemplate = async () => {
    const plainBody = htmlToPlainText(composeBody)
    if (!brandId || !composeTemplateName.trim() || !composeSubject.trim() || !plainBody) {
      setSaveComposeTemplateError("Name, subject, and message are all required")
      return
    }
    setIsSavingComposeTemplate(true)
    setSaveComposeTemplateError(undefined)
    try {
      // Templates are shared with the still-plain-text reply box and
      // EmailModal, so the saved body must stay plain text — never the rich
      // editor's raw HTML.
      const res = await fetch(`/api/brand/${brandId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: composeTemplateName.trim(),
          subject: composeSubject.trim(),
          body: plainBody,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to save template")
      setSavingComposeAsTemplate(false)
      setComposeTemplateName("")
    } catch (err) {
      setSaveComposeTemplateError(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setIsSavingComposeTemplate(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const filteredEmails = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase()
    return emails
      .filter((email) => {
        const matchesStage = selectedStage === "ALL" || email.status === selectedStage
        const matchesSearch =
          query === "" ||
          email.name.toLowerCase().includes(query) ||
          email.handle.toLowerCase().includes(query) ||
          email.subject.toLowerCase().includes(query)
        return matchesStage && matchesSearch
      })
      // `emails` is built by concatenating Gmail and Outlook batches as each
      // provider finishes loading (see setEmails call sites below) — never
      // merged by date. Sort here, once, at the single point everything
      // actually renders from, rather than at every fetch call site.
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [emails, selectedStage, debouncedSearchQuery])

  // Pipeline-stage tabs count distinct contacts, not threads — "In
  // Conversation: 1" means one influencer at that stage, even if there are
  // several separate email threads with them (repeated outreach, multiple
  // "Welcome back" style follow-ups, etc.). `handle` is the contact's email
  // address in every mapper (Gmail, Outlook, and the lightweight
  // sent-awaiting-reply entries), so it's a reliable per-contact key. "All
  // Messages" deliberately stays a raw thread count — that view is about
  // message volume, not the pipeline.
  const getStageCount = (stage: PipelineStage | "ALL") => {
    if (stage === "ALL") return emails.length
    const handles = new Set(
      emails.filter((e) => e.status === stage).map((e) => e.handle)
    )
    return handles.size
  }

  const toggleStar = (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEmails((prev) => prev.map((email) => (email.id === id ? { ...email, starred: !email.starred } : email)))
  }

  const markAsRead = (id: number | string) => {
    setEmails((prev) => prev.map((email) => (email.id === id ? { ...email, read: true } : email)))
  }

  // Lightweight "sent, awaiting reply" entries only carry headers/snippet —
  // fetch full detail on open instead of upfront for every one of them.
  const openEmail = async (email: Email) => {
    setSelectedEmail(email)
    markAsRead(email.id)
    if (!email.isLightweight || !email.gmailThreadId) return

    setLoadingThreadId(email.id)
    try {
      const res = await fetch(`/api/gmail/thread/${email.gmailThreadId}`)
      const data = await res.json()
      if (!res.ok || !data.thread) return

      const fullEmail = mapGmailThreadToEmail({ ...data.thread, brandInfluencer: null }, 0, email.accountId)
      const merged: Email = {
        ...fullEmail,
        id: email.id,
        // Identity carried over from the row being replaced, not from the newly
        // mapped object: this is the same conversation gaining its full body.
        uid: email.uid,
        accountId: email.accountId,
        status: email.status,
        isLightweight: false,
      }
      setEmails((prev) => prev.map((e) => (e.uid === email.uid ? merged : e)))
      setSelectedEmail((prev) => (prev?.uid === email.uid ? merged : prev))
    } catch {
      // Leave the lightweight entry as-is — the snippet is still shown.
    } finally {
      setLoadingThreadId((prev) => (prev === email.id ? null : prev))
    }
  }

  // Keyed on `uid`, not `id`: `id` is the provider's own thread id, and Gmail
  // and Outlook conversations share this array, so an id match could resolve to
  // a different provider's — or a different Outlook account's — conversation.
  const updateEmailStage = async (emailUid: string, newStage: PipelineStage) => {
    setUpdateStageModal({ open: false, email: null })

    const email = emails.find((e) => e.uid === emailUid)
    if (!email?.fromEmail) return

    // This thread's other party is the user's own connected mailbox (e.g. a
    // self-sent verification/test email) — there's no influencer to update,
    // and hitting the API would just surface a confusing "not registered"
    // error for something that was never meant to be one.
    if (gmailConnectedEmail && email.fromEmail.toLowerCase() === gmailConnectedEmail.toLowerCase()) {
      setStageNotification({
        show: true,
        message: "This conversation is with your own connected mailbox — there's no influencer to update.",
        type: "error",
      })
      setTimeout(() => setStageNotification({ show: false, message: "", type: "error" }), 5000)
      return
    }

    const previousStatus = emails.find((e) => e.uid === emailUid)?.status
    setEmails((prev) => prev.map((e) => (e.uid === emailUid ? { ...e, status: newStage } : e)))
    if (selectedEmail?.uid === emailUid) {
      setSelectedEmail((prev) => (prev ? { ...prev, status: newStage } : null))
    }

    try {
      const res = await fetch("/api/inbox/stage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderEmail: email.fromEmail, stage: newStage, brandId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setEmails((prev) => prev.map((e) => (e.uid === emailUid ? { ...e, status: previousStatus || null } : e)))
        if (selectedEmail?.uid === emailUid) {
          setSelectedEmail((prev) => (prev ? { ...prev, status: previousStatus || null } : null))
        }
        const errorMsg = data?.error === "Influencer not registered"
          ? `${email.fromEmail} is not registered as an influencer`
          : data?.error === "Influencer not found in this brand"
          ? `${email.fromEmail} is not in your current brand`
          : data?.error || "Failed to save stage"
        setStageNotification({ show: true, message: errorMsg, type: "error" })
        setTimeout(() => setStageNotification({ show: false, message: "", type: "error" }), 5000)
      } else {
        // A stage set from the inbox is the same persisted change the Pipeline
        // board makes, so the views derived from it are marked stale.
        invalidateInfluencerDerivedCaches(brandId)
        setStageNotification({ show: true, message: "Stage updated successfully!", type: "success" })
        setTimeout(() => setStageNotification({ show: false, message: "", type: "success" }), 3000)
      }
    } catch {
      setEmails((prev) => prev.map((e) => (e.uid === emailUid ? { ...e, status: previousStatus || null } : e)))
      if (selectedEmail?.uid === emailUid) {
        setSelectedEmail((prev) => (prev ? { ...prev, status: previousStatus || null } : null))
      }
      // The revert alone left no trace of why the stage snapped back.
      setStageNotification({ show: true, message: "Network error — the stage was not saved", type: "error" })
      setTimeout(() => setStageNotification({ show: false, message: "", type: "error" }), 5000)
    }
  }

  // ── Drag-to-reassign: dragging a message row onto a pipeline stage tab ──────
  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return
    const draggedUid = active.id as string
    const targetStage = over.id as PipelineStage
    const email = emails.find((e) => e.uid === draggedUid)
    if (!email || email.status === targetStage) return
    updateEmailStage(email.uid, targetStage)
  }

  const sendReply = async () => {
    const plainReply = htmlToPlainText(reply)
    if ((plainReply.length === 0 && replyAttachments.length === 0) || !selectedEmail || isSending) return

    const isOutlookThread = selectedEmail.source === "outlook"
    const htmlBody = reply
    const attachmentsToSend = replyAttachments
    setSendError(undefined)
    setIsSending(true)

    const sentAt = new Date().toISOString()
    const newReply = {
      sender: "You",
      message: htmlBody,
      timestamp: sentAt,
      isUser: true,
      isHtml: true,
    }
    // Also update preview/timestamp — otherwise the list row keeps showing
    // whatever Gmail last returned, looking untouched even though a reply
    // was just sent, until the next real refresh happens to catch up.
    setEmails((prev) =>
      prev.map((email) =>
        email.id === selectedEmail.id
          ? { ...email, replies: [...(email.replies || []), newReply], preview: plainReply, timestamp: sentAt }
          : email
      )
    )
    setSelectedEmail((prev) =>
      prev ? { ...prev, replies: [...(prev.replies || []), newReply], preview: plainReply, timestamp: sentAt } : null
    )
    // Reply's editor stays mounted after sending (unlike compose, which swaps
    // to a "Message sent!" screen), so it must be cleared via the imperative
    // ref — setReply("") alone would update state but leave the visible
    // contentEditable content untouched.
    replyEditorRef.current?.setHtml("")
    clearReplyAttachments()

    try {
      const replyOutlookAccountId = isOutlookThread ? selectedOutlookAccountId() : null
      const replyApi = isOutlookThread
        ? `/api/outlook/send${replyOutlookAccountId ? `?accountId=${encodeURIComponent(replyOutlookAccountId)}` : ""}`
        : "/api/gmail/send"
      let res: Response
      // Both providers accept attachments now — see sendCompose for the same pattern.
      if (attachmentsToSend.length > 0) {
        const form = new FormData()
        form.append("to", selectedEmail.fromEmail || selectedEmail.handle)
        form.append("subject", selectedEmail.subject)
        form.append("body", htmlBody)
        form.append("isHtmlBody", "true")
        if (brandId) form.append("brandId", brandId)
        if (!isOutlookThread && selectedEmail.gmailThreadId) form.append("threadId", selectedEmail.gmailThreadId)
        attachmentsToSend.forEach((a) => form.append("attachments", a.file, a.file.name))
        res = await fetch(replyApi, { method: "POST", body: form })
      } else {
        const replyPayload: any = {
          to: selectedEmail.fromEmail || selectedEmail.handle,
          subject: selectedEmail.subject,
          body: htmlBody,
          brandId,
          isHtmlBody: true,
        }
        if (!isOutlookThread) replyPayload.threadId = selectedEmail.gmailThreadId

        res = await fetch(replyApi, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(replyPayload),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setSendError(data?.error || "Failed to send. Message not delivered.")
      }
    } catch {
      setSendError("Network error. Message may not have been delivered.")
    } finally {
      setIsSending(false)
      setTimeout(() => replyEditorRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendReply()
    }
  }

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch {
      return ""
    }
  }

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 0) return formatTime(timestamp)
      if (diffDays === 1) return "Yesterday"
      return date.toLocaleDateString([], { month: "short", day: "numeric" })
    } catch {
      return "Recently"
    }
  }

  const getStatusBadge = (status: PipelineStage | null) => {
    if (!status) return null
    const config = stageConfigs.find((s) => s.id === status)
    if (!config) return null
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    )
  }

  const currentStageConfig = selectedStage !== "ALL" ? stageConfigs.find((s) => s.id === selectedStage) : null
  const isGmailReady = gmailConnected && gmailSyncState === "connected"
  const isOutlookReady = outlookConnected && outlookSyncState === "connected"
  const isGmailLoading = gmailSyncState === "checking" || gmailSyncState === "syncing" || gmailSyncState === "connecting"
  const isOutlookLoading = outlookSyncState === "checking" || outlookSyncState === "syncing" || outlookSyncState === "connecting"
  const isLoading = (isGmailLoading || isOutlookLoading) && emails.length === 0
  const needsConnect = !gmailConnected && !outlookConnected && !isGmailLoading && !isOutlookLoading

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SubscriptionGate
      isSubscribed={isSubscribed}
      status={subscriptionStatus || "inactive"}
      featureName="the inbox"
      plans={["Solo", "Team"]}
      currentPlanDisplayName={planDisplayName}
    >
    <div className="flex flex-col h-screen bg-gray-50">
    <DndContext sensors={dragSensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

      {/* ── PIPELINE BAR ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm relative">
        {showPipelineBar ? (
          <>
            <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Pipeline Stages</span>
              <button onClick={() => setShowPipelineBar(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <IconChevronUp size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-x-auto overflow-y-hidden">
              <div className="flex min-w-max md:min-w-0">
                <button
                  onClick={() => setSelectedStage("ALL")}
                  className={`relative flex-1 min-w-[80px] md:min-w-[100px] px-3 md:px-4 py-2 md:py-3 text-center transition-all duration-200 ${
                    selectedStage === "ALL" ? "bg-gray-700 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <div className="text-lg md:text-2xl font-bold">{getStageCount("ALL")}</div>
                  <div className="text-[10px] md:text-xs font-medium flex items-center justify-center gap-1 mt-0.5 md:mt-1">
                    <IconInbox size={12} className="md:w-4 md:h-4" />
                    <span className="hidden sm:inline">All</span>
                  </div>
                </button>

                {stageConfigs.map((stage, index) => {
                  const isActive = selectedStage === stage.id
                  const isLast = index === stageConfigs.length - 1
                  return (
                    <div key={stage.id} className="relative flex-1 min-w-[80px] md:min-w-[100px]">
                      <DroppableStageTab id={stage.id} isExit={stage.id === "REJECTED"}>
                        <button
                          onClick={() => setSelectedStage(stage.id)}
                          className={`w-full h-full px-3 md:px-4 py-2 md:py-3 text-center transition-all duration-200 ${
                            isActive
                              ? `${stage.activeBgColor} text-white shadow-md`
                              : `${stage.bgColor} ${stage.color} hover:${stage.hoverBgColor} hover:text-white`
                          }`}
                        >
                          <div className="text-lg md:text-2xl font-bold">{getStageCount(stage.id)}</div>
                          <div className="text-[10px] md:text-xs font-medium flex items-center justify-center gap-1 mt-0.5 md:mt-1">
                            {stage.icon}
                            <span className="hidden sm:inline">{stage.label}</span>
                          </div>
                        </button>
                      </DroppableStageTab>
                      {!isLast && !isMobile && (
                        <div
                          className="absolute top-0 right-0 w-0 h-0 border-t-[40px] md:border-t-[44px] border-b-[40px] md:border-b-[44px] border-l-[12px] md:border-l-[16px] border-t-transparent border-b-transparent"
                          style={{
                            borderLeftColor: isActive
                              ? stage.activeBgColor === "bg-gray-600" ? "#4b5563"
                              : stage.activeBgColor === "bg-blue-600" ? "#2563eb"
                              : stage.activeBgColor === "bg-purple-600" ? "#9333ea"
                              : stage.activeBgColor === "bg-indigo-600" ? "#4f46e5"
                              : stage.activeBgColor === "bg-orange-600" ? "#ea580c"
                              : stage.activeBgColor === "bg-yellow-600" ? "#ca8a04"
                              : stage.activeBgColor === "bg-teal-600" ? "#0d9488"
                              : stage.activeBgColor === "bg-pink-600" ? "#db2777"
                              : stage.activeBgColor === "bg-green-600" ? "#16a34a"
                              : stage.activeBgColor === "bg-red-600" ? "#dc2626" : "#6b7280"
                              : stage.arrowColor,
                            right: "-12px",
                            zIndex: 10,
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() => setShowPipelineBar(false)}
              className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-full p-1.5 hover:bg-gray-50 transition-all shadow-md z-20"
            >
              <IconChevronUp size={14} className="text-gray-500" />
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPipelineBar(true)}
                data-tour="inbox-pipeline-toggle"
                className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors"
              >
                <IconLayoutSidebar size={14} />
                <span>Show Pipeline</span>
                <IconChevronDown size={12} />
              </button>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <IconInbox size={12} />
                <span>{getStageCount("ALL")} total</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div
                  className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                    isGmailReady
                      ? "bg-green-50 border-green-200 text-green-700 cursor-pointer hover:bg-green-100"
                      : gmailSyncState === "not_connected"
                      ? "bg-yellow-50 border-yellow-200 text-yellow-700 cursor-pointer hover:bg-yellow-100"
                      : isGmailLoading
                      ? "bg-gray-50 border-gray-200 text-gray-400"
                      : "bg-red-50 border-red-200 text-red-500"
                  }`}
                  onClick={
                    isGmailReady
                      ? () => setOpenAccountMenu(p => (p === "gmail" ? null : "gmail"))
                      : gmailSyncState === "not_connected"
                      ? handleConnectGmail
                      : undefined
                  }
                >
                  <IconBrandGmail size={11} />
                  {isGmailReady ? (
                    <>
                      {/* The selected address, when we know it — the chip is the
                          account control, so it should say which account. */}
                      <span>{selectedAccount("gmail")?.email || "Gmail"}</span>
                      <IconChevronDown size={10} />
                    </>
                  ) : (
                    <span>{gmailSyncState === "not_connected" ? "Connect Gmail" : gmailSyncState === "connecting" ? "Waiting for sign-in…" : isGmailLoading ? "Gmail…" : "Gmail error"}</span>
                  )}
                </div>
                {openAccountMenu === "gmail" && (
                  <AccountMenu
                    provider="gmail"
                    accounts={accountsFor("gmail")}
                    busy={accountBusy}
                    error={accountError}
                    onSelect={switchAccount}
                    onRemove={setRemoveAccount}
                    onConnectAnother={handleConnectGmail}
                    onClose={() => setOpenAccountMenu(null)}
                  />
                )}
              </div>
              <div className="relative">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                    isOutlookReady
                      ? "bg-blue-50 border-blue-200 text-blue-700 cursor-pointer hover:bg-blue-100"
                      : outlookSyncState === "not_connected"
                      ? "bg-yellow-50 border-yellow-200 text-yellow-700 cursor-pointer hover:bg-yellow-100"
                      : isOutlookLoading
                      ? "bg-gray-50 border-gray-200 text-gray-400"
                      : "bg-red-50 border-red-200 text-red-500"
                  }`}
                  onClick={
                    isOutlookReady
                      ? () => setOpenAccountMenu(p => (p === "outlook" ? null : "outlook"))
                      : outlookSyncState === "not_connected"
                      ? handleConnectOutlook
                      : undefined
                  }
                >
                  <OutlookIcon size={11} />
                  {isOutlookReady ? (
                    <>
                      <span>{selectedAccount("outlook")?.email || "Outlook"}</span>
                      <IconChevronDown size={10} />
                    </>
                  ) : (
                    <span>{outlookSyncState === "not_connected" ? "Connect Outlook" : outlookSyncState === "connecting" ? "Waiting for sign-in…" : isOutlookLoading ? "Outlook…" : "Outlook error"}</span>
                  )}
                </div>
                {openAccountMenu === "outlook" && (
                  <AccountMenu
                    provider="outlook"
                    accounts={accountsFor("outlook")}
                    busy={accountBusy}
                    error={accountError}
                    onSelect={switchAccount}
                    onRemove={setRemoveAccount}
                    onConnectAnother={handleConnectOutlook}
                    onClose={() => setOpenAccountMenu(null)}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="hidden sm:inline">Current:</span>
                <span className="font-medium text-gray-700">
                  {selectedStage === "ALL" ? "All Messages" : currentStageConfig?.label}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── CONTACT LIST PANEL ── */}
        {/* On narrow viewports this collapses to a single pane: list panel hides
            once a conversation is selected, and the back button (lg:hidden below)
            returns to it by clearing selectedEmail. */}
        <div className={`${selectedEmail ? "hidden lg:flex" : "flex"} w-full lg:w-80 border-r border-gray-200 flex-col bg-white flex-shrink-0 shadow-sm`}>
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 p-6">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#1FAE5B] animate-spin" />
              </div>
              <p className="text-sm text-gray-500 font-medium">
                {gmailSyncState === "connecting" || outlookSyncState === "connecting"
                  ? "Waiting for sign-in…"
                  : "Loading your inbox…"}
              </p>
            </div>
          ) : needsConnect ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-md border border-gray-100 flex items-center justify-center">
                  <IconBrandGmail size={24} className="text-[#EA4335]" />
                </div>
                <span className="text-gray-300 font-light text-lg">+</span>
                <div className="w-12 h-12 rounded-2xl bg-white shadow-md border border-gray-100 flex items-center justify-center">
                  <OutlookIcon size={24} />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Connect your email</p>
                <p className="text-xs text-gray-500 mt-1.5 max-w-[200px] leading-relaxed">
                  Connect Gmail or Outlook to start managing your influencer inbox.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 w-full" data-tour="inbox-connect-email">
                <button
                  onClick={handleConnectGmail}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1FAE5B] text-white text-sm rounded-xl hover:bg-[#0F6B3E] transition font-semibold shadow-md"
                >
                  <IconBrandGmail size={15} />
                  Connect Gmail
                </button>
                <button
                  onClick={handleConnectOutlook}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0078D4] text-white text-sm rounded-xl hover:bg-[#006CBE] transition font-semibold shadow-md"
                >
                  <OutlookIcon size={15} />
                  Connect Outlook
                </button>
              </div>
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <IconLock size={10} />
                Only asked once • Read &amp; send access
              </p>
            </div>
          ) : emails.length === 0 && gmailSyncState === "error" && outlookSyncState !== "connected" ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <IconAlertCircle size={24} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Failed to load inbox</p>
                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">{gmailError || outlookError}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadGmailThreads}
                  className="px-3 py-2 bg-[#1FAE5B] text-white text-xs rounded-xl hover:bg-[#0F6B3E] transition font-medium flex items-center gap-1.5"
                >
                  <IconRefresh size={13} /> Gmail
                </button>
                <button
                  onClick={() => loadOutlookThreads()}
                  className="px-3 py-2 bg-[#0078D4] text-white text-xs rounded-xl hover:bg-[#006CBE] transition font-medium flex items-center gap-1.5"
                >
                  <IconRefresh size={13} /> Outlook
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-shrink-0 px-4 py-3 sm:p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                  <div className="min-w-0">
                    <h1 className="truncate text-[17px] sm:text-lg font-semibold leading-tight text-gray-900">
                      {selectedStage === "ALL" ? "All Messages" : currentStageConfig?.label}
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isGmailReady && <span className="text-[10px] text-gray-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />Gmail</span>}
                      {isOutlookReady && <span className="text-[10px] text-gray-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />Outlook</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isGmailReady && (
                      <button
                        onClick={loadGmailThreads}
                        title="Refresh Gmail"
                        className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-500"
                      >
                        <IconRefresh size={16} />
                      </button>
                    )}
                    {isOutlookReady && (
                      <button
                        onClick={() => loadOutlookThreads()}
                        title="Refresh Outlook"
                        className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-500"
                      >
                        <IconRefresh size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => setOpenTemplates(true)}
                      title="Email Templates"
                      className="flex h-11 w-11 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-[#1FAE5B] text-white hover:bg-[#0F6B3E] active:bg-[#0F6B3E] transition-colors shadow-sm"
                    >
                      <IconTemplate size={16} />
                    </button>
                    <button
                      onClick={() => { setComposeSource(gmailConnected ? "gmail" : outlookConnected ? "outlook" : "gmail"); setOpenCompose(true) }}
                      className="flex h-11 w-11 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-[#1FAE5B] text-white hover:bg-[#0F6B3E] active:bg-[#0F6B3E] transition-colors shadow-sm"
                      title="New Message"
                    >
                      <IconMailPlus size={18} />
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    aria-label="Search conversations"
                    // text-base on phones is deliberate: under 16px iOS Safari
                    // zooms the page on focus. sm:text-sm restores desktop size.
                    className="h-11 sm:h-9 w-full pl-10 pr-4 text-base sm:text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1FAE5B]/20 focus:border-[#1FAE5B] transition-all"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredEmails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-gray-400">
                    <IconInbox size={48} stroke={1.5} />
                    <p className="mt-3 text-sm font-medium">No conversations</p>
                    <p className="text-xs mt-1">No messages in this stage</p>
                  </div>
                ) : (
                  filteredEmails.map((email) => (
                    <DraggableEmailRow key={email.uid} id={email.uid}>
                      <div
                        // Off-screen rows skip layout and paint; the row stays in
                        // the DOM so drag, selection and find-in-page are unchanged.
                        style={{ contentVisibility: "auto", containIntrinsicSize: "auto 68px" }}
                        onClick={() => openEmail(email)}
                        className={`flex items-start gap-3 px-4 py-3.5 sm:py-3 min-h-[68px] sm:min-h-0 cursor-pointer transition-colors duration-150 active:bg-gray-100 ${
                          selectedEmail?.id === email.id ? "bg-gray-100 shadow-[inset_3px_0_0_#1FAE5B]" : "hover:bg-gray-50"
                        } ${!email.read ? "bg-blue-50/40" : ""}`}
                      >
                        <div className="relative flex-shrink-0">
                          <img src={email.avatar} alt="" className="w-11 h-11 sm:w-10 sm:h-10 rounded-full object-cover" />
                          {!email.read && (
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#1FAE5B] rounded-full ring-2 ring-white" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-sm truncate ${!email.read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                                {email.name}
                              </span>
                              {email.isLightweight && (
                                <span
                                  className="flex items-center gap-0.5 flex-shrink-0 text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5"
                                  title="Sent — awaiting reply"
                                >
                                  <IconSend size={9} />
                                  Sent
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(email.timestamp)}</span>
                          </div>
                          <p className={`text-xs truncate mt-0.5 ${!email.read ? "text-gray-800 font-medium" : "text-gray-500"}`}>
                            {email.subject}
                          </p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{email.preview}</p>
                          {getStatusBadge(email.status) && <div className="mt-1.5">{getStatusBadge(email.status)}</div>}
                        </div>

                        <button onClick={(e) => toggleStar(email.id, e)} className="flex-shrink-0 mt-0.5 transition-opacity hover:opacity-80">
                          {email.starred ? (
                            <IconStarFilled size={14} className="text-yellow-500" />
                          ) : (
                            <IconStar size={14} className="text-gray-300" />
                          )}
                        </button>
                      </div>
                    </DraggableEmailRow>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* ── CHAT / MESSAGE AREA ── */}
        <div className={`${selectedEmail ? "flex" : "hidden lg:flex"} flex-1 flex-col bg-white`}>
          {isLoading ? (
            <ListSkeleton rows={6} label="Fetching data..." />
          ) : needsConnect || (emails.length === 0 && (gmailSyncState === "error" || outlookSyncState === "error")) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50 p-4">
              <div className="bg-white rounded-full p-6 mb-4 shadow-sm border border-gray-100">
                <IconBrandGmail size={48} stroke={1} className="text-gray-200" />
              </div>
              <p className="text-sm font-medium text-gray-400">
                {needsConnect ? "Connect Gmail or Outlook to get started" : "Could not load inbox"}
              </p>
            </div>
          ) : selectedEmail ? (
            <div className="flex flex-col h-full">
              {/* Chat Header */}
              <div className="flex-shrink-0 bg-white border-b border-gray-200">
                <div className="flex items-center justify-between px-4 md:px-6 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedEmail(null)} className="lg:hidden p-2 rounded-full hover:bg-gray-100 transition">
                      <IconArrowLeft size={20} />
                    </button>
                    <img src={selectedEmail.avatar} alt={selectedEmail.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-gray-900 text-sm md:text-base">{selectedEmail.name}</h2>
                        <span className="text-xs text-gray-400 hidden sm:inline">•</span>
                        <span className="text-xs text-gray-500 hidden sm:inline">{selectedEmail.handle}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {getStatusBadge(selectedEmail.status)}
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <IconClock size={12} />
                          <span className="hidden sm:inline">Last active</span> {formatDate(selectedEmail.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 md:px-6 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center gap-2">
                  {(() => {
                    const isSelfThread = !!gmailConnectedEmail && selectedEmail.fromEmail?.toLowerCase() === gmailConnectedEmail.toLowerCase()
                    return (
                      <button
                        onClick={() => !isSelfThread && setUpdateStageModal({ open: true, email: selectedEmail })}
                        disabled={isSelfThread}
                        className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                          isSelfThread
                            ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                        title={isSelfThread ? "This conversation is with your own connected mailbox — nothing to update" : undefined}
                      >
                        <IconUserCheck size={14} />
                        <span className="hidden sm:inline">Update Stage</span>
                      </button>
                    )
                  })()}
                </div>

                {showActions && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                    <div className="absolute right-4 md:right-6 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><IconUser size={14} />View Profile</button>
                      <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><IconStar size={14} />Star Conversation</button>
                      <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><IconCheck size={14} />Mark as Read</button>
                      <div className="border-t border-gray-100 my-1" />
                      <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><IconTrash size={14} />Delete Conversation</button>
                    </div>
                  </>
                )}
              </div>

              {/* Order Info Bar */}
              {(selectedEmail.orderId || selectedEmail.trackingNumber || selectedEmail.postedLink || selectedEmail.rejectionReason) && (
                <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 px-4 md:px-6 py-3">
                  <div className="flex flex-wrap gap-2 md:gap-4 text-sm">
                    {selectedEmail.orderId && (
                      <div className="flex items-center gap-2 bg-white px-2 md:px-3 py-1 rounded-full shadow-sm">
                        <IconShoppingCart size={14} className="text-gray-400" />
                        <span className="font-mono text-gray-900 text-xs font-medium">{selectedEmail.orderId}</span>
                      </div>
                    )}
                    {selectedEmail.trackingNumber && (
                      <div className="flex items-center gap-2 bg-white px-2 md:px-3 py-1 rounded-full shadow-sm">
                        <IconTruck size={14} className="text-gray-400" />
                        <span className="font-mono text-gray-900 text-xs font-medium">{selectedEmail.trackingNumber}</span>
                      </div>
                    )}
                    {selectedEmail.postedLink && (
                      <a href={selectedEmail.postedLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white px-2 md:px-3 py-1 rounded-full shadow-sm text-[#1FAE5B] hover:bg-green-50 transition text-xs">
                        <IconPhoto size={14} />View Post
                      </a>
                    )}
                    {selectedEmail.rejectionReason && (
                      <div className="flex items-center gap-2 bg-red-50 px-2 md:px-3 py-1 rounded-full shadow-sm">
                        <IconReject size={14} className="text-red-400" />
                        <span className="text-red-600 text-xs font-medium">{selectedEmail.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
                <div className="max-w-3xl">
                  <p className="text-xs text-gray-400 mb-3 font-medium">{selectedEmail.subject}</p>
                  {selectedEmail.isLightweight && loadingThreadId === selectedEmail.id ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
                      <span className="relative inline-block w-3.5 h-3.5 flex-shrink-0">
                        <span className="absolute inset-0 rounded-full border-2 border-gray-200" />
                        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1FAE5B] animate-spin" />
                      </span>
                      Loading message…
                    </div>
                  ) : (() => {
                    const allMessages = selectedEmail.replies?.length
                      ? selectedEmail.replies
                      : [{ sender: selectedEmail.name, message: selectedEmail.message || selectedEmail.preview, timestamp: selectedEmail.timestamp, isUser: false }]

                    const groups: { sender: string; isUser: boolean; items: typeof allMessages }[] = []
                    for (const msg of allMessages) {
                      const lastGroup = groups[groups.length - 1]
                      if (lastGroup && lastGroup.isUser === !!msg.isUser && lastGroup.sender === msg.sender) {
                        lastGroup.items.push(msg)
                      } else {
                        groups.push({ sender: msg.sender, isUser: !!msg.isUser, items: [msg] })
                      }
                    }

                    return groups.map((group, gIdx) => (
                      <div key={gIdx} className={`flex gap-3 mb-6 ${group.isUser ? "flex-row-reverse" : ""}`}>
                        {!group.isUser && <img src={selectedEmail.avatar} alt={selectedEmail.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />}
                        {group.isUser && <div className="w-8 h-8 rounded-full bg-[#1FAE5B] flex items-center justify-center text-white text-xs font-medium flex-shrink-0 shadow-sm">ME</div>}
                        <div className={`flex-1 max-w-[85%] md:max-w-[70%] ${group.isUser ? "items-end" : ""}`}>
                          <div className={`flex items-center gap-2 mb-1 ${group.isUser ? "justify-end" : ""}`}>
                            <span className="text-sm font-medium text-gray-900">{group.sender}</span>
                            <span className="text-xs text-gray-400">{formatTime(group.items[0].timestamp)}</span>
                          </div>
                          <div className={`flex flex-col gap-1 ${group.isUser ? "items-end" : "items-start"}`}>
                            {group.items.map((msg, mIdx) => {
                              // HTML messages (e.g. a signature-bearing send) skip the
                              // plain-text quote-splitting entirely — "On ... wrote:"/">"
                              // heuristics don't apply to markup, and the quoted portion
                              // of an HTML email is already part of its own rendered layout.
                              if (msg.isHtml) {
                                return (
                                  <div
                                    key={mIdx}
                                    className={`rounded-2xl px-4 md:px-5 py-3 shadow-sm overflow-hidden ${group.isUser ? "bg-gray-100 border border-gray-200 rounded-tr-none" : "bg-white border border-gray-100 rounded-tl-none"}`}
                                  >
                                    <HtmlMessageFrame html={msg.message} />
                                    {msg.attachments && msg.attachments.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {msg.attachments.map((att) => (
                                          <AttachmentChipReadOnly
                                            key={att.id}
                                            filename={att.filename}
                                            size={att.size}
                                            loading={downloadingAttachmentId === att.id}
                                            onOpen={() => openAttachment(att)}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              }

                              const { main, quoted } = splitQuotedText(msg.message)
                              const quoteKey = `${gIdx}-${mIdx}`
                              const isExpanded = expandedQuotes.has(quoteKey)
                              return (
                                <div
                                  key={mIdx}
                                  className={`rounded-2xl px-4 md:px-5 py-3 shadow-sm ${group.isUser ? "bg-gray-100 border border-gray-200 text-gray-800 rounded-tr-none" : "bg-white border border-gray-100 text-gray-700 rounded-tl-none"}`}
                                >
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{main}</p>
                                  {quoted && (
                                    <div className="mt-2">
                                      <button
                                        onClick={() =>
                                          setExpandedQuotes((prev) => {
                                            const next = new Set(prev)
                                            if (next.has(quoteKey)) next.delete(quoteKey)
                                            else next.add(quoteKey)
                                            return next
                                          })
                                        }
                                        className="text-xs underline underline-offset-2 text-gray-400 hover:text-gray-600"
                                      >
                                        {isExpanded ? "Hide quoted text" : "Show quoted text"}
                                      </button>
                                      {isExpanded && (() => {
                                        const { attribution, text } = parseQuotedBlock(quoted)
                                        return (
                                          <div
                                            className="mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed bg-gray-50 border border-gray-100"
                                          >
                                            {attribution && (
                                              <p className="mb-1.5 italic text-gray-400">
                                                {attribution}
                                              </p>
                                            )}
                                            <div
                                              className="pl-2.5 border-l-2 whitespace-pre-wrap border-gray-300 text-gray-500"
                                            >
                                              {text}
                                            </div>
                                          </div>
                                        )
                                      })()}
                                    </div>
                                  )}
                                  {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {msg.attachments.map((att) => (
                                        <AttachmentChipReadOnly
                                          key={att.id}
                                          filename={att.filename}
                                          size={att.size}
                                          loading={downloadingAttachmentId === att.id}
                                          onOpen={() => openAttachment(att)}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  })()}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Reply Input */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3 md:p-4 shadow-lg">
                <div className="flex justify-end mb-1.5">
                  <UseTemplatePicker
                    brandId={brandId}
                    recipientEmail={selectedEmail.fromEmail || selectedEmail.handle}
                    onApply={(_subject, body) => replyEditorRef.current?.setHtml(plainTextToComposeHtml(body))}
                  />
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-[#1FAE5B] flex items-center justify-center text-white text-xs font-medium shadow-sm flex-shrink-0 mt-1">ME</div>
                  <div className="flex-1 min-w-0">
                    <RichComposeEditor
                      ref={replyEditorRef}
                      html={reply}
                      onHtmlChange={setReply}
                      files={replyAttachments}
                      onAddFiles={handleAddReplyFiles}
                      onRemoveFile={handleRemoveReplyFile}
                      maxTotalBytes={MAX_TOTAL_ATTACHMENT_BYTES}
                      placeholder={`Reply to ${selectedEmail.name.split(" ")[0]}…`}
                      onKeyDown={handleKeyDown}
                      minHeightPx={44}
                      maxHeightPx={160}
                      emojiPickerSide="top"
                    />
                    <div className="flex items-center justify-between mt-2">
                      {sendError
                        ? <span className="text-xs text-red-500 flex items-center gap-1"><IconAlertCircle size={12} />{sendError}</span>
                        : <span className="text-xs text-gray-400 hidden sm:inline">Press Enter to send • Shift+Enter for new line</span>
                      }
                      <button
                        onClick={sendReply}
                        disabled={(htmlToPlainText(reply).length === 0 && replyAttachments.length === 0) || isSending}
                        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#1FAE5B] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0F6B3E] transition-all duration-200"
                      >
                        {isSending
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <IconSend size={16} />
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 p-4">
              <div className="bg-white rounded-full p-6 mb-4 shadow-md">
                <IconMessageCircle size={56} stroke={1.5} className="text-gray-300" />
              </div>
              <p className="text-base font-medium text-gray-500">Select a conversation</p>
              <p className="text-sm mt-1 text-gray-400 text-center">Choose from the list to start messaging</p>
            </div>
          )}
        </div>
      </div>

      {/* ── REMOVE ACCOUNT CONFIRMATION ── */}
      {/* Same shell as the stage and compose modals in this file. */}
      {removeAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { if (!accountBusy) setRemoveAccount(null) }} />
          <div className="relative w-full max-w-[400px] bg-white rounded-2xl shadow-2xl p-6 animate-scaleIn">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-lg text-gray-900">Remove account</h2>
              <button
                onClick={() => { if (!accountBusy) setRemoveAccount(null) }}
                className="p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <IconX size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Disconnect{" "}
              <span className="font-medium text-gray-900">
                {removeAccount.email || `this ${PROVIDER_LABEL[removeAccount.provider]} account`}
              </span>{" "}
              from Instroom? Its conversations will stop appearing in your inbox. Nothing is
              deleted from {PROVIDER_LABEL[removeAccount.provider]}, and you can connect it again
              at any time.
            </p>
            {accountError && <p className="mt-3 text-xs text-red-500">{accountError}</p>}
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setRemoveAccount(null)}
                disabled={accountBusy}
                className="h-9 px-4 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveAccount}
                disabled={accountBusy}
                className="h-9 px-4 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {accountBusy ? "Removing…" : "Remove account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPDATE STAGE MODAL ── */}
      {updateStageModal.open && updateStageModal.email && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setUpdateStageModal({ open: false, email: null })} />
          <div className="relative w-full max-w-[400px] bg-white rounded-2xl shadow-2xl p-6 animate-scaleIn">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-semibold text-xl text-gray-900">Update Pipeline Stage</h2>
              <button onClick={() => setUpdateStageModal({ open: false, email: null })} className="p-1 rounded-lg hover:bg-gray-100 transition"><IconX size={20} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Update stage for <span className="font-medium text-gray-900">{updateStageModal.email.name}</span></p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {stageConfigs.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => updateEmailStage(updateStageModal.email!.uid, stage.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                    updateStageModal.email?.status === stage.id ? `${stage.bgColor} ${stage.color} ring-2 ring-current` : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <div className={`p-1 rounded ${stage.bgColor} ${stage.color}`}>{stage.icon}</div>
                  <span className="flex-1 text-left text-sm font-medium">{stage.label}</span>
                  {updateStageModal.email?.status === stage.id && <IconCircleCheck size={18} className="text-green-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── COMPOSE MODAL ── */}
      {openCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { if (!isComposeSending) setOpenCompose(false) }} />
          <div className="relative w-full max-w-[500px] bg-white rounded-2xl shadow-2xl p-6 animate-scaleIn">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-semibold text-xl text-gray-900">New Message</h2>
              <button onClick={() => setOpenCompose(false)} disabled={isComposeSending} className="p-1 rounded-lg hover:bg-gray-100 transition disabled:opacity-50">
                <IconX size={20} />
              </button>
            </div>

            {composeSent ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <IconCircleCheck size={28} className="text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-800">Message sent!</p>
              </div>
            ) : (
              <>
                <div className="flex justify-end items-center gap-2 mb-1">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setSavingComposeAsTemplate((v) => !v); setSaveComposeTemplateError(undefined) }}
                      disabled={!composeSubject.trim() || htmlToPlainText(composeBody).length === 0}
                      title="Save this message as a template"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <IconDeviceFloppy size={14} /> Save as template
                    </button>
                    {savingComposeAsTemplate && (
                      <div className="absolute right-0 z-20 mt-1 w-64 bg-white border border-gray-100 rounded-lg shadow-lg p-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Template name</label>
                        <input
                          autoFocus
                          type="text"
                          value={composeTemplateName}
                          onChange={(e) => setComposeTemplateName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveComposeAsTemplate() }}
                          placeholder="e.g. Initial Outreach 1"
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition mb-2"
                        />
                        {saveComposeTemplateError && (
                          <p className="text-[11px] text-red-500 mb-2">{saveComposeTemplateError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setSavingComposeAsTemplate(false); setComposeTemplateName(""); setSaveComposeTemplateError(undefined) }}
                            className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveComposeAsTemplate}
                            disabled={isSavingComposeTemplate || !composeTemplateName.trim()}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition"
                          >
                            {isSavingComposeTemplate ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <UseTemplatePicker
                    brandId={brandId}
                    recipientEmail={composeTo}
                    onApply={(subject, body) => {
                      setComposeSubject(subject)
                      // Templates are plain text — imperatively push the
                      // converted HTML into the mounted editor (setHtml also
                      // updates composeBody state itself; see rich-compose-editor.tsx).
                      composeEditorRef.current?.setHtml(plainTextToComposeHtml(body))
                    }}
                  />
                </div>
                <div className="space-y-1">
                  {isGmailReady && isOutlookReady && (
                    <div className="flex items-center border-b border-gray-200 gap-2 py-2">
                      <span className="text-xs text-gray-400 w-14 flex-shrink-0">From</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setComposeSource("gmail")}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            composeSource === "gmail" ? "bg-green-50 border-green-300 text-green-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <IconBrandGmail size={12} /> Gmail
                        </button>
                        <button
                          onClick={() => setComposeSource("outlook")}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            composeSource === "outlook" ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <OutlookIcon size={12} /> Outlook
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center border-b border-gray-200 gap-2 py-2">
                    <span className="text-xs text-gray-400 w-14 flex-shrink-0">To</span>
                    <input
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      placeholder="recipient@email.com"
                      autoComplete="off"
                      className="flex-1 outline-none text-sm text-gray-800 placeholder:text-gray-300"
                    />
                  </div>
                  <div className="flex items-center border-b border-gray-200 gap-2 py-2">
                    <span className="text-xs text-gray-400 w-14 flex-shrink-0">Subject</span>
                    <input
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="What's this about?"
                      className="flex-1 outline-none text-sm text-gray-800 placeholder:text-gray-300"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <RichComposeEditor
                    ref={composeEditorRef}
                    html={composeBody}
                    onHtmlChange={setComposeBody}
                    files={composeAttachments}
                    onAddFiles={handleAddComposeFiles}
                    onRemoveFile={handleRemoveComposeFile}
                    maxTotalBytes={MAX_TOTAL_ATTACHMENT_BYTES}
                  />
                </div>

                {composeError && (
                  <div className="flex items-center gap-2 text-xs text-red-500 mt-2 bg-red-50 px-3 py-2 rounded-lg">
                    <IconAlertCircle size={13} />
                    {composeError}
                  </div>
                )}

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => { setOpenCompose(false); setComposeTo(""); setComposeSubject(""); setComposeBody(""); clearComposeAttachments(); setComposeError(undefined); setSavingComposeAsTemplate(false); setComposeTemplateName(""); setSaveComposeTemplateError(undefined) }}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                  >
                    Discard
                  </button>
                  <button
                    onClick={sendCompose}
                    disabled={!composeTo.trim() || (htmlToPlainText(composeBody).length === 0 && composeAttachments.length === 0) || isComposeSending}
                    className="bg-[#1FAE5B] text-white px-5 py-2 rounded-xl hover:bg-[#0F6B3E] transition-all duration-200 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {isComposeSending
                      ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending…</>
                      : <><IconSend size={14} />Send</>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <EmailTemplatesModal isOpen={openTemplates} onClose={() => setOpenTemplates(false)} brandId={brandId} />

      {/* ── STAGE NOTIFICATION ── */}
      {stageNotification.show && (
        <div className="fixed bottom-6 right-6 z-40 animate-slideUp">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            stageNotification.type === "error"
              ? "bg-red-50 border border-red-200"
              : "bg-green-50 border border-green-200"
          }`}>
            <IconAlertCircle size={18} className={stageNotification.type === "error" ? "text-red-500" : "text-green-500"} />
            <p className={`text-sm font-medium ${stageNotification.type === "error" ? "text-red-700" : "text-green-700"}`}>
              {stageNotification.message}
            </p>
            <button
              onClick={() => setStageNotification({ show: false, message: "", type: "error" })}
              className="ml-2 p-1 hover:opacity-70 transition"
            >
              <IconX size={16} className={stageNotification.type === "error" ? "text-red-500" : "text-green-500"} />
            </button>
          </div>
        </div>
      )}

      <DragOverlay>
        {activeDragId ? (() => {
          const draggedEmail = emails.find((e) => e.uid === activeDragId)
          if (!draggedEmail) return null
          return (
            <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-2.5 shadow-lg w-[220px] rotate-2">
              <img src={draggedEmail.avatar} alt={draggedEmail.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{draggedEmail.name}</div>
                <div className="text-xs text-gray-500 truncate">{draggedEmail.subject}</div>
              </div>
            </div>
          )
        })() : null}
      </DragOverlay>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </DndContext>
    </div>
    </SubscriptionGate>
  )
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InboxContent />
    </Suspense>
  )
}
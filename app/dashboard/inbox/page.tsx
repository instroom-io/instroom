"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { SubscriptionGate } from "@/components/ui/subscription-gate"
import {
  IconMail,
  IconSearch,
  IconX,
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
} from "@tabler/icons-react"

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

type Email = {
  id: number | string
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
  replies?: { sender: string; message: string; timestamp: string; isUser?: boolean }[]
  // Gmail-specific
  gmailThreadId?: string
  from?: string
  fromEmail?: string
  // Source tracking for multi-provider support
  source?: "gmail" | "outlook"
  outlookMessageId?: string
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

function mapGmailThreadToEmail(thread: any, index: number): Email {
  const messages = thread.messages || []
  const firstMsg = messages[0] || {}
  const lastMsg = messages[messages.length - 1] || {}

  const fromHeader = firstMsg.from || firstMsg.sender || ""
  const nameMatch = fromHeader.match(/^([^<]+)</)
  const emailMatch = fromHeader.match(/<([^>]+)>/)
  const senderName = nameMatch ? nameMatch[1].trim() : fromHeader.split("@")[0] || "Unknown"
  const senderEmail = (emailMatch ? emailMatch[1] : fromHeader).toLowerCase().trim()

  const replies = messages.slice(1).map((msg: any) => {
    const replyFrom = msg.from || msg.sender || ""
    const replyName = replyFrom.match(/^([^<]+)</)?.[1]?.trim() || replyFrom.split("@")[0] || "Unknown"
    const isUser = replyFrom.toLowerCase().includes("me") || msg.isUser
    return {
      sender: isUser ? "You" : replyName,
      message: msg.body || msg.snippet || msg.text || "",
      timestamp: msg.date || new Date().toISOString(),
      isUser,
    }
  })

  const status = getPipelineStatus(thread.brandInfluencer)
  const timestamp = firstMsg.date || new Date().toISOString()

  return {
    id: thread.id || `gmail-${index}`,
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

function mapOutlookThreadToEmail(thread: any, index: number): Email {
  const messages = thread.messages || []
  const firstMsg = messages[0] || {}

  const fromHeader = firstMsg.from || ""
  const nameMatch = fromHeader.match(/^([^<]+)</)
  const emailMatch = fromHeader.match(/<([^>]+)>/)
  const senderName = nameMatch ? nameMatch[1].trim() : fromHeader.split("@")[0] || "Unknown"
  const senderEmail = (emailMatch ? emailMatch[1] : fromHeader).toLowerCase().trim()

  const replies = messages.slice(1).map((msg: any) => {
    const replyFrom = msg.from || ""
    const replyName = replyFrom.match(/^([^<]+)</)?.[1]?.trim() || replyFrom.split("@")[0] || "Unknown"
    return {
      sender: replyName,
      message: msg.body || msg.snippet || "",
      timestamp: msg.date || new Date().toISOString(),
      isUser: false,
    }
  })

  const status = getPipelineStatus(thread.brandInfluencer)
  const timestamp = firstMsg.date || new Date().toISOString()

  return {
    id: thread.id || `outlook-${index}`,
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


// ─── Main Component ───────────────────────────────────────────────────────────

function InboxContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId")

  // ── Subscription gate ──────────────────────────────────────────────────────
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ status: string; isExpired: boolean } | null>(null)

  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/subscription/status")
      .then(res => res.json())
      .then(data => {
        setSubscriptionStatus(data)
        setIsSubscribed(data.status === "active" && !data.isExpired ? true : false)
      })
      .catch(() => {
        setSubscriptionStatus({ status: "inactive", isExpired: false })
        setIsSubscribed(false)
      })
  }, [session?.user?.id])

  const [emails, setEmails] = useState<Email[]>([])
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [selectedStage, setSelectedStage] = useState<PipelineStage | "ALL">("ALL")
  const [openCompose, setOpenCompose] = useState(false)
  const [reply, setReply] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState("")
  const [updateStageModal, setUpdateStageModal] = useState<{ open: boolean; email: Email | null }>({ open: false, email: null })
  const [stageNotification, setStageNotification] = useState<{ show: boolean; message: string; type: "error" | "success" }>({ show: false, message: "", type: "error" })
  const [showPipelineBar, setShowPipelineBar] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const [gmailSyncState, setGmailSyncState] = useState<GmailSyncState>("checking")
  const [gmailError, setGmailError] = useState<string | undefined>()
  const [gmailConnected, setGmailConnected] = useState(false)

  const [outlookSyncState, setOutlookSyncState] = useState<GmailSyncState>("checking")
  const [outlookError, setOutlookError] = useState<string | undefined>()
  const [outlookConnected, setOutlookConnected] = useState(false)

  const [composeSource, setComposeSource] = useState<"gmail" | "outlook">("gmail")

  // Compose modal state
  const [composeTo, setComposeTo] = useState("")
  const [composeSubject, setComposeSubject] = useState("")
  const [composeBody, setComposeBody] = useState("")
  const [composeError, setComposeError] = useState<string | undefined>()
  const [isComposeSending, setIsComposeSending] = useState(false)
  const [composeSent, setComposeSent] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    checkGmailConnection()
    checkOutlookConnection()

    const params = new URLSearchParams(window.location.search)

    // Handle ?gmailConnected=1 redirect from OAuth callback
    if (params.get("gmailConnected") === "1") {
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
    if (params.get("outlookConnected") === "1") {
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

  // ── Gmail connection check ─────────────────────────────────────────────────

  const checkGmailConnection = async () => {
    try {
      const url = new URL("/api/gmail/threads", window.location.origin)
      if (brandId) url.searchParams.append("brandId", brandId)
      const res = await fetch(url.toString())
      const data = await res.json()

      if (res.ok) {
        const mappedEmails = (data.threads || []).map((t: any, i: number) => mapGmailThreadToEmail(t, i))
        setEmails(prev => [...prev.filter(e => e.source !== "gmail"), ...mappedEmails])
        setGmailConnected(true)
        setGmailSyncState("connected")
      } else if (data?.reauth) {
        setGmailSyncState("not_connected")
      } else {
        setGmailError(data?.error || "Failed to load inbox.")
        setGmailSyncState("error")
      }
    } catch {
      setGmailError("Network error. Please check your connection.")
      setGmailSyncState("error")
    }
  }

  // ── Connect Gmail — separate OAuth flow, no NextAuth signIn ───────────────
  const handleConnectGmail = () => {
    setGmailSyncState("connecting")
    const returnTo = window.location.pathname + window.location.search
    window.location.href = `/api/gmail/connect?returnTo=${encodeURIComponent(returnTo)}`
  }

  const loadGmailThreads = async () => {
    setGmailSyncState("syncing")
    try {
      const url = new URL("/api/gmail/threads", window.location.origin)
      if (brandId) url.searchParams.append("brandId", brandId)
      const res = await fetch(url.toString())
      const data = await res.json()

      if (res.ok) {
        const mappedEmails = (data.threads || []).map((t: any, i: number) => mapGmailThreadToEmail(t, i))
        setEmails(prev => [...prev.filter(e => e.source !== "gmail"), ...mappedEmails])
        setGmailConnected(true)
        setGmailSyncState("connected")
      } else if (data?.reauth) {
        setGmailSyncState("not_connected")
      } else {
        setGmailError(data?.error || "Failed to load Gmail threads.")
        setGmailSyncState("error")
      }
    } catch (err: any) {
      setGmailError(err?.message || "Failed to load Gmail threads.")
      setGmailSyncState("error")
    }
  }

  // ── Outlook connection check ───────────────────────────────────────────────

  const checkOutlookConnection = async () => {
    try {
      const url = new URL("/api/outlook/threads", window.location.origin)
      if (brandId) url.searchParams.append("brandId", brandId)
      const res = await fetch(url.toString())
      const data = await res.json()

      if (res.ok) {
        const mappedEmails = (data.threads || []).map((t: any, i: number) => mapOutlookThreadToEmail(t, i))
        setEmails(prev => [...prev.filter(e => e.source !== "outlook"), ...mappedEmails])
        setOutlookConnected(true)
        setOutlookSyncState("connected")
      } else if (data?.reauth) {
        setOutlookSyncState("not_connected")
      } else {
        setOutlookError(data?.error || "Failed to load Outlook inbox.")
        setOutlookSyncState("error")
      }
    } catch {
      setOutlookError("Network error. Please check your connection.")
      setOutlookSyncState("error")
    }
  }

  // ── Connect Outlook — Microsoft OAuth flow ────────────────────────────────
  const handleConnectOutlook = () => {
    setOutlookSyncState("connecting")
    const returnTo = window.location.pathname + window.location.search
    window.location.href = `/api/outlook/connect?returnTo=${encodeURIComponent(returnTo)}`
  }

  const loadOutlookThreads = async () => {
    setOutlookSyncState("syncing")
    try {
      const url = new URL("/api/outlook/threads", window.location.origin)
      if (brandId) url.searchParams.append("brandId", brandId)
      const res = await fetch(url.toString())
      const data = await res.json()

      if (res.ok) {
        const mappedEmails = (data.threads || []).map((t: any, i: number) => mapOutlookThreadToEmail(t, i))
        setEmails(prev => [...prev.filter(e => e.source !== "outlook"), ...mappedEmails])
        setOutlookConnected(true)
        setOutlookSyncState("connected")
      } else if (data?.reauth) {
        setOutlookSyncState("not_connected")
      } else {
        setOutlookError(data?.error || "Failed to load Outlook threads.")
        setOutlookSyncState("error")
      }
    } catch (err: any) {
      setOutlookError(err?.message || "Failed to load Outlook threads.")
      setOutlookSyncState("error")
    }
  }

  const sendCompose = async () => {
    if (!composeTo.trim() || !composeBody.trim() || isComposeSending) return
    setComposeError(undefined)
    setIsComposeSending(true)
    try {
      const sendApi = composeSource === "outlook" ? "/api/outlook/send" : "/api/gmail/send"
      const res = await fetch(sendApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim() || "(No subject)",
          body: composeBody.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setComposeError(data?.error || "Failed to send email.")
      } else {
        setComposeSent(true)
        setTimeout(() => {
          setOpenCompose(false)
          setComposeTo("")
          setComposeSubject("")
          setComposeBody("")
          setComposeSent(false)
          setComposeError(undefined)
        }, 1500)
      }
    } catch {
      setComposeError("Network error. Please try again.")
    } finally {
      setIsComposeSending(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const filteredEmails = emails.filter((email) => {
    const matchesStage = selectedStage === "ALL" || email.status === selectedStage
    const matchesSearch =
      searchQuery === "" ||
      email.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStage && matchesSearch
  })

  const getStageCount = (stage: PipelineStage | "ALL") => {
    if (stage === "ALL") return emails.length
    return emails.filter((e) => e.status === stage).length
  }

  const toggleStar = (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEmails((prev) => prev.map((email) => (email.id === id ? { ...email, starred: !email.starred } : email)))
  }

  const markAsRead = (id: number | string) => {
    setEmails((prev) => prev.map((email) => (email.id === id ? { ...email, read: true } : email)))
  }

  const updateEmailStage = async (emailId: number | string, newStage: PipelineStage) => {
    const previousStatus = emails.find((e) => e.id === emailId)?.status
    setEmails((prev) => prev.map((email) => (email.id === emailId ? { ...email, status: newStage } : email)))
    if (selectedEmail?.id === emailId) {
      setSelectedEmail((prev) => (prev ? { ...prev, status: newStage } : null))
    }
    setUpdateStageModal({ open: false, email: null })

    const email = emails.find((e) => e.id === emailId)
    if (!email?.fromEmail) return
    try {
      const res = await fetch("/api/inbox/stage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderEmail: email.fromEmail, stage: newStage, brandId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, status: previousStatus || null } : e)))
        if (selectedEmail?.id === emailId) {
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
        setStageNotification({ show: true, message: "Stage updated successfully!", type: "success" })
        setTimeout(() => setStageNotification({ show: false, message: "", type: "success" }), 3000)
      }
    } catch {
      setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, status: previousStatus || null } : e)))
      if (selectedEmail?.id === emailId) {
        setSelectedEmail((prev) => (prev ? { ...prev, status: previousStatus || null } : null))
      }
    }
  }

  const sendReply = async () => {
    if (!reply.trim() || !selectedEmail || isSending) return

    const messageText = reply.trim()
    setSendError(undefined)
    setIsSending(true)

    const newReply = {
      sender: "You",
      message: messageText,
      timestamp: new Date().toISOString(),
      isUser: true,
    }
    setEmails((prev) =>
      prev.map((email) =>
        email.id === selectedEmail.id ? { ...email, replies: [...(email.replies || []), newReply] } : email
      )
    )
    setSelectedEmail((prev) =>
      prev ? { ...prev, replies: [...(prev.replies || []), newReply] } : null
    )
    setReply("")

    try {
      const replyApi = selectedEmail.source === "outlook" ? "/api/outlook/send" : "/api/gmail/send"
      const replyPayload: any = {
        to: selectedEmail.fromEmail || selectedEmail.handle,
        subject: selectedEmail.subject,
        body: messageText,
      }
      if (selectedEmail.source === "gmail") replyPayload.threadId = selectedEmail.gmailThreadId

      const res = await fetch(replyApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replyPayload),
      })

      if (!res.ok) {
        const data = await res.json()
        setSendError(data?.error || "Failed to send. Message not delivered.")
      }
    } catch {
      setSendError("Network error. Message may not have been delivered.")
    } finally {
      setIsSending(false)
      setTimeout(() => replyTextareaRef.current?.focus(), 100)
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
      status={subscriptionStatus?.status || "inactive"}
      featureName="the inbox"
      plans={["Solo", "Team"]}
    >
    <div className="flex flex-col h-screen bg-gray-50">

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
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                  isGmailReady
                    ? "bg-green-50 border-green-200 text-green-700"
                    : gmailSyncState === "not_connected"
                    ? "bg-yellow-50 border-yellow-200 text-yellow-700 cursor-pointer hover:bg-yellow-100"
                    : isGmailLoading
                    ? "bg-gray-50 border-gray-200 text-gray-400"
                    : "bg-red-50 border-red-200 text-red-500"
                }`}
                onClick={gmailSyncState === "not_connected" ? handleConnectGmail : undefined}
              >
                <IconBrandGmail size={11} />
                <span>{isGmailReady ? "Gmail" : gmailSyncState === "not_connected" ? "Connect Gmail" : isGmailLoading ? "Gmail…" : "Gmail error"}</span>
              </div>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                  isOutlookReady
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : outlookSyncState === "not_connected"
                    ? "bg-yellow-50 border-yellow-200 text-yellow-700 cursor-pointer hover:bg-yellow-100"
                    : isOutlookLoading
                    ? "bg-gray-50 border-gray-200 text-gray-400"
                    : "bg-red-50 border-red-200 text-red-500"
                }`}
                onClick={outlookSyncState === "not_connected" ? handleConnectOutlook : undefined}
              >
                <OutlookIcon size={11} />
                <span>{isOutlookReady ? "Outlook" : outlookSyncState === "not_connected" ? "Connect Outlook" : isOutlookLoading ? "Outlook…" : "Outlook error"}</span>
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
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white flex-shrink-0 shadow-sm">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 p-6">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#1FAE5B] animate-spin" />
              </div>
              <p className="text-sm text-gray-500 font-medium">
                {gmailSyncState === "connecting" ? "Redirecting to Google…" :
                 outlookSyncState === "connecting" ? "Redirecting to Microsoft…" :
                 "Loading your inbox…"}
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
              <div className="flex flex-col gap-2.5 w-full">
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
                  onClick={loadOutlookThreads}
                  className="px-3 py-2 bg-[#0078D4] text-white text-xs rounded-xl hover:bg-[#006CBE] transition font-medium flex items-center gap-1.5"
                >
                  <IconRefresh size={13} /> Outlook
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">
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
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                      >
                        <IconRefresh size={16} />
                      </button>
                    )}
                    {isOutlookReady && (
                      <button
                        onClick={loadOutlookThreads}
                        title="Refresh Outlook"
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                      >
                        <IconRefresh size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => { setComposeSource(isGmailReady ? "gmail" : "outlook"); setOpenCompose(true) }}
                      className="p-2 rounded-lg bg-[#1FAE5B] text-white hover:bg-[#0F6B3E] transition-all duration-200 shadow-sm"
                      title="New Message"
                    >
                      <IconMail size={18} />
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1FAE5B]/20 focus:border-[#1FAE5B] transition-all"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredEmails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <IconInbox size={48} stroke={1.5} />
                    <p className="mt-3 text-sm font-medium">No conversations</p>
                    <p className="text-xs mt-1">No messages in this stage</p>
                  </div>
                ) : (
                  filteredEmails.map((email) => (
                    <div
                      key={email.id}
                      onClick={() => { setSelectedEmail(email); markAsRead(email.id) }}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-150 ${
                        selectedEmail?.id === email.id ? "bg-gray-100 border-l-4 border-l-[#1FAE5B]" : "hover:bg-gray-50"
                      } ${!email.read ? "bg-blue-50/40" : ""}`}
                    >
                      <div className="relative flex-shrink-0">
                        <img src={email.avatar} alt={email.name} className="w-10 h-10 rounded-full object-cover" />
                        {!email.read && (
                          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#1FAE5B] rounded-full ring-2 ring-white" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate ${!email.read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                            {email.name}
                          </span>
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
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* ── CHAT / MESSAGE AREA ── */}
        <div className="flex-1 flex flex-col bg-white">
          {isLoading || needsConnect || (emails.length === 0 && (gmailSyncState === "error" || outlookSyncState === "error")) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50 p-4">
              <div className="bg-white rounded-full p-6 mb-4 shadow-sm border border-gray-100">
                <IconBrandGmail size={48} stroke={1} className="text-gray-200" />
              </div>
              <p className="text-sm font-medium text-gray-400">
                {isLoading ? "Loading your inbox…" : needsConnect ? "Connect Gmail or Outlook to get started" : "Could not load inbox"}
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
                  <button onClick={() => setUpdateStageModal({ open: true, email: selectedEmail })} className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <IconUserCheck size={14} />
                    <span className="hidden sm:inline">Update Stage</span>
                  </button>
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
                <div className="max-w-3xl mx-auto">
                  <div className="flex gap-3 mb-6">
                    <img src={selectedEmail.avatar} alt={selectedEmail.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{selectedEmail.name}</span>
                        <span className="text-xs text-gray-400">{formatTime(selectedEmail.timestamp)}</span>
                      </div>
                      <div className="bg-white rounded-2xl rounded-tl-none px-4 md:px-5 py-3 shadow-sm border border-gray-100">
                        <p className="text-xs text-gray-400 mb-1 font-medium">{selectedEmail.subject}</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedEmail.message || selectedEmail.preview}</p>
                      </div>
                    </div>
                  </div>

                  {selectedEmail.replies?.map((r, idx) => (
                    <div key={idx} className={`flex gap-3 mb-6 ${r.isUser ? "flex-row-reverse" : ""}`}>
                      {!r.isUser && <img src={selectedEmail.avatar} alt={selectedEmail.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />}
                      {r.isUser && <div className="w-8 h-8 rounded-full bg-[#1FAE5B] flex items-center justify-center text-white text-xs font-medium flex-shrink-0 shadow-sm">ME</div>}
                      <div className={`flex-1 max-w-[85%] md:max-w-[70%] ${r.isUser ? "items-end" : ""}`}>
                        <div className={`flex items-center gap-2 mb-1 ${r.isUser ? "justify-end" : ""}`}>
                          <span className="text-sm font-medium text-gray-900">{r.sender}</span>
                          <span className="text-xs text-gray-400">{formatTime(r.timestamp)}</span>
                        </div>
                        <div className={`rounded-2xl px-4 md:px-5 py-3 shadow-sm ${r.isUser ? "bg-[#1FAE5B] text-white rounded-tr-none" : "bg-white border border-gray-100 text-gray-700 rounded-tl-none"}`}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Reply Input */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3 md:p-4 shadow-lg">
                <div className="flex gap-3 items-end">
                  <div className="w-8 h-8 rounded-full bg-[#1FAE5B] flex items-center justify-center text-white text-xs font-medium shadow-sm flex-shrink-0">ME</div>
                  <div className="flex-1 relative">
                    <textarea
                      ref={replyTextareaRef}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Reply to ${selectedEmail.name.split(" ")[0]}…`}
                      rows={1}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-[#1FAE5B]/20 focus:border-[#1FAE5B] resize-none text-sm bg-gray-50"
                      style={{ minHeight: "44px", maxHeight: "120px" }}
                    />
                    <button
                      onClick={sendReply}
                      disabled={!reply.trim() || isSending}
                      className="absolute right-2 bottom-2 p-1.5 rounded-full bg-[#1FAE5B] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0F6B3E] transition-all duration-200"
                    >
                      {isSending
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <IconSend size={16} />
                      }
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  {sendError
                    ? <span className="text-xs text-red-500 flex items-center gap-1"><IconAlertCircle size={12} />{sendError}</span>
                    : <span />
                  }
                  <span className="text-xs text-gray-400 hidden sm:inline">Press Enter to send • Shift+Enter for new line</span>
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
                  onClick={() => updateEmailStage(updateStageModal.email!.id, stage.id)}
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

                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message…"
                  rows={6}
                  className="w-full mt-4 outline-none resize-none text-sm text-gray-800 placeholder:text-gray-300 p-0 border-0"
                />

                {composeError && (
                  <div className="flex items-center gap-2 text-xs text-red-500 mt-2 bg-red-50 px-3 py-2 rounded-lg">
                    <IconAlertCircle size={13} />
                    {composeError}
                  </div>
                )}

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => { setOpenCompose(false); setComposeTo(""); setComposeSubject(""); setComposeBody(""); setComposeError(undefined) }}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                  >
                    Discard
                  </button>
                  <button
                    onClick={sendCompose}
                    disabled={!composeTo.trim() || !composeBody.trim() || isComposeSending}
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

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
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
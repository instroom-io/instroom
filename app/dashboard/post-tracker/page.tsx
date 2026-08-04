// app/dashboard/post-tracker/page.tsx
// UI consistent with pipeline kanban:
// - Same column header style (colored bg, title, count badge, ⓘ info tooltip)
// - Description text removed from below header — moved into tooltip
// - Same card style (name, handle, platform, location, followers, eng)
// - Stage action buttons on cards (→ Next Stage arrows)
// - Profile drawer shows current stage with ability to change it

"use client"

import { useState, useCallback, useMemo, useRef, Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  DndContext, DragOverlay, closestCorners, PointerSensor,
  useSensor, useSensors, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core"
import { useDroppable } from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import {
  IconSearch, IconX, IconChevronDown, IconChevronUp,
  IconLayoutKanban, IconList, IconFilter, IconLocation,
  IconLayoutList, IconLink, IconArrowRight, IconAlertTriangle,
} from "@tabler/icons-react"
import { useClosedData, type ClosedInfluencer, type ClosedColumn } from "@/hooks/useClosedData"
import { useBrandCapabilities } from "@/hooks/useBrandCapabilities"
import { SubscriptionGate } from "@/components/ui/subscription-gate"
import { HistoryTab } from "@/components/InfluencerProfileSidebar"
import { PaidCollabTab } from "@/components/table-sheet/profile-sidebar"
import { BoardSkeleton } from "@/components/shared/skeletons"
import { StageDropdown, type StageOption } from "@/components/shared/stage-dropdown"
import AutoPostDetectionCard from "./AutoPostDetection"

// ─── Constants ────────────────────────────────────────────────────────────────
const NICHES    = ["Beauty","Fitness","Lifestyle","Food","Tech","Fashion","Travel"]
const LOCATIONS = ["Philippines","Singapore","United States","Australia","United Kingdom","Malaysia","Indonesia","Thailand","Vietnam"]

const COLUMNS: { key: ClosedColumn; title: string; color: string; description: string; move?: string; terminal?: boolean }[] = [
  {
    key:   "For Order Creation",
    title: "For Order Creation",
    color: "bg-[#1FAE5B]",
    description: "Order has not been placed yet. The influencer's deal is agreed and shipping address is confirmed — ready for fulfilment.",
    move: "Move to In-Transit once the order has been shipped.",
  },
  {
    key:   "In-Transit",
    title: "In-Transit",
    color: "bg-yellow-500",
    description: "Order shipped and tracking number obtained. Waiting for the product to arrive at the influencer's address.",
    move: "Move to Delivered once the influencer confirms receipt.",
  },
  {
    key:   "Delivered",
    title: "Delivered",
    color: "bg-cyan-500",
    description: "Product delivered. The influencer has the product and content creation is underway.",
    move: "Move to Posted once the content goes live.",
  },
  {
    key:      "Posted",
    title:    "Posted",
    color:    "bg-[#0F6B3E]",
    description: "Content is live. Track engagement metrics, download content, and log the post link.",
    terminal: true,
  },
  {
    key:      "No post",
    title:    "No post",
    color:    "bg-red-400",
    description: "No content was published. Product was sent but the influencer did not post. Flag for follow-up or mark as a loss.",
    terminal: true,
  },
]

// Badge colours for the stage dropdown — the soft 100/800 shades the Pipeline
// board's status badges use (getStatusColor in kanban-board.tsx), so both
// surfaces read as one system. "Posted" is the darker green end state.
const STAGE_BADGE_CLASS: Record<ClosedColumn, string> = {
  "For Order Creation": "bg-green-100 text-green-800 border-green-300",
  "In-Transit":         "bg-amber-100 text-amber-800 border-amber-300",
  "Delivered":          "bg-cyan-100 text-cyan-800 border-cyan-300",
  "Posted":             "bg-emerald-100 text-emerald-900 border-emerald-400",
  "No post":            "bg-red-100 text-red-800 border-red-300",
}

// Options for the shared badge dropdown (same component the Pipeline uses)
const STAGE_DROPDOWN_OPTIONS: StageOption[] = COLUMNS.map((c) => ({
  value:      c.key,
  label:      c.title,
  dotColor:   c.color,
  badgeClass: STAGE_BADGE_CLASS[c.key],
}))

// ─── Filter state ─────────────────────────────────────────────────────────────
// No name/handle fields — the global search bar is the only search input.
interface PostTrackerFilters {
  location: string
  niche:    string
  stages:   ClosedColumn[]
  types:    string[]
}

const EMPTY_FILTERS: PostTrackerFilters = { location: "all", niche: "all", stages: [], types: [] }

const STAGE_FILTER_OPTIONS = COLUMNS.map((c) => ({ value: c.key, label: c.title }))

// Stage order, used to gate quick actions on cards. Purely a UI concern — the
// stage dropdown and drag-and-drop still allow every transition.
const STAGE_RANK: Record<ClosedColumn, number> = {
  "For Order Creation": 0,
  "In-Transit":         1,
  "Delivered":          2,
  "Posted":             3,
  "No post":            4,
}

// "No post" is only a meaningful outcome once the product has actually landed,
// so the quick action stays hidden until Delivered. Before that a stray click
// would drop an influencer straight out of the workflow.
const canQuickMarkNoPost = (stage: ClosedColumn) => STAGE_RANK[stage] >= STAGE_RANK["Delivered"]

// ─── "Posted" requires evidence of a published post ───────────────────────────
// A manual move to Posted is only allowed when a Post URL exists. Automatic
// post detection is unaffected: it updates the record server-side and never
// goes through these user-initiated paths.
const hasPostUrl = (inf: Pick<ClosedInfluencer, "postUrl">) => Boolean(inf.postUrl?.trim())

// Forward flow
const NEXT_STAGE: Record<ClosedColumn, ClosedColumn | null> = {
  "For Order Creation": "In-Transit",
  "In-Transit":         "Delivered",
  "Delivered":          "Posted",
  "Posted":             null,
  "No post":            null,
}

// Canonical Collaboration Type list — same ids/labels as the Pipeline board's
// collab type modal (kanban-board.tsx COLLAB_TYPES), since this value is set
// there and only ever displayed (read-only) here.
const CAMPAIGN_TYPES = [
  { value: "gifting",           label: "Gifting",             color: "bg-purple-100 text-purple-700",  implied: "Product sent, no payment, no commission" },
  { value: "paid",              label: "Paid",                color: "bg-blue-100 text-blue-700",      implied: "Product sent + flat fee" },
  { value: "affiliate",         label: "Affiliate",           color: "bg-green-100 text-green-700",    implied: "Product sent + commission link" },
  { value: "ugc",               label: "UGC",                 color: "bg-orange-100 text-orange-700",  implied: "Product sent, brand owns content, no post required" },
  { value: "tiktok-shop",       label: "TikTok Shop",         color: "bg-pink-100 text-pink-700",      implied: "Product sent + in-app shop tagging + commission" },
  { value: "paid-affiliate",    label: "Paid + Affiliate",    color: "bg-indigo-100 text-indigo-700",  implied: "Product sent + flat fee + commission" },
  { value: "ugc-paid",          label: "UGC + Paid",          color: "bg-amber-100 text-amber-700",    implied: "Product sent + flat fee + brand owns content" },
  { value: "tiktok-shop-paid",  label: "TikTok Shop + Paid",  color: "bg-rose-100 text-rose-700",      implied: "TikTok Shop + flat fee on top" },
]

// Collaboration types with a paid component — only these show the
// "Paid collab details" tab. Gifting / Affiliate / UGC / TikTok Shop don't.
const PAID_COLLAB_TYPES = new Set(["paid", "paid-affiliate", "ugc-paid", "tiktok-shop-paid"])

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getAvatarColor(name: string) {
  const colors = ["bg-pink-500","bg-purple-500","bg-indigo-500","bg-blue-500","bg-cyan-500","bg-teal-500","bg-green-500","bg-yellow-500","bg-orange-500","bg-red-500","bg-rose-500"]
  return colors[name.charCodeAt(0) % colors.length]
}
// ─── Missing Post URL warning ─────────────────────────────────────────────────
function PostUrlRequiredDialog({ count, onGoToPostDetails, onCancel }: {
  /** How many influencers were blocked — >1 when a bulk move is rejected */
  count: number
  onGoToPostDetails: (() => void) | null
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="post-url-required-title"
        className="bg-white rounded-2xl shadow-2xl w-[440px] max-w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <IconAlertTriangle size={20} className="text-amber-600"/>
          </div>
          <div className="flex-1">
            <h2 id="post-url-required-title" className="text-base font-semibold text-gray-900">Cannot Move to Posted</h2>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              A Post URL is required before manually moving {count > 1 ? `these ${count} influencers` : "this influencer"} to the Posted stage.
            </p>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              Please add the post link first, or enable Automatic Post Detection to let the system update the stage automatically.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm font-medium text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
          >
            Cancel
          </button>
          {onGoToPostDetails && (
            <button
              autoFocus
              onClick={onGoToPostDetails}
              className="px-4 py-1.5 text-sm font-medium bg-[#1FAE5B] text-white rounded-lg hover:bg-[#178a48] transition focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:ring-offset-1"
            >
              Go to Post Details
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Chip multi-select for the filter panel. Deliberately local rather than
// imported from the Pipeline board — the two pages stay independent.
function TagSelect({ label, options, selected, onChange, colorClass = "bg-[#1FAE5B]/10 text-[#0F6B3E] border-[#1FAE5B]/30" }: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  colorClass?: string
}) {
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(s => s !== value) : [...selected, value])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        {selected.length > 0 && (
          <button onClick={()=>onChange([])} className="text-[10px] text-gray-400 hover:text-gray-600 transition underline underline-offset-2">Clear</button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(option => {
          const isSelected = selected.includes(option.value)
          return (
            <button
              key={option.value}
              onClick={()=>toggle(option.value)}
              aria-pressed={isSelected}
              className={`px-2.5 py-1 rounded-full text-xs border transition-all font-medium focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:ring-offset-1 ${
                isSelected ? `${colorClass} border-transparent` : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
              }`}
            >
              {isSelected && <span className="mr-1 text-[9px]">✓</span>}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
function CampaignBadge({ type }: { type: string | null }) {
  const found = CAMPAIGN_TYPES.find(t => t.value === type)
  if (!found) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Gifting</span>
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${found.color}`}>{found.label}</span>
}
function fmtMoney(v: number | null | undefined) {
  return v ? "$" + Math.round(v).toLocaleString() : "—"
}
function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString() : "—"
}

// ─── Column Info Tooltip — identical pattern to pipeline ──────────────────────
function ColumnInfoTooltip({ colKey, variant }: { colKey: ClosedColumn; variant: "dark" | "light" }) {
  const col = COLUMNS.find(c => c.key === colKey)
  if (!col) return null

  const borderColor = variant === "dark" ? "border-white/60" : "border-red-400/60"
  const textColor   = variant === "dark" ? "text-white"      : "text-red-700"

  return (
    <div className="relative group/info flex-shrink-0">
      <span
        className={`text-[10px] font-medium border ${borderColor} ${textColor} rounded-full w-4 h-4 flex items-center justify-center opacity-70 cursor-default select-none hover:opacity-100 transition-opacity`}
      >
        i
      </span>
      <div className="absolute top-full right-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-700 leading-relaxed z-[60] hidden group-hover/info:block shadow-lg pointer-events-none">
        <p className="font-semibold text-gray-900 mb-1 text-[11px]">{col.title}</p>
        <p className="text-gray-600">{col.description}</p>
        {col.move && (
          <p className="mt-1.5 text-gray-400 border-t border-gray-100 pt-1.5">
            <span className="font-medium text-gray-500">Next → </span>{col.move}
          </p>
        )}
        {col.terminal && (
          <p className="mt-1.5 text-[10px] font-medium text-red-500 border-t border-gray-100 pt-1.5 uppercase tracking-wide">
            Terminal — cannot be moved
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Post Tracker Card — consistent with pipeline card ────────────────────────
function PostTrackerCard({ inf, onOpen, onMove, canApproveInfluencers }: {
  inf: ClosedInfluencer
  onOpen: (inf: ClosedInfluencer) => void
  onMove: (id: string, col: ClosedColumn) => void
  canApproveInfluencers: boolean
}) {
  const nextStage  = NEXT_STAGE[inf.closedStatus]
  const isExit     = inf.closedStatus === "No post"
  const isTerminal = inf.closedStatus === "Posted" || isExit
  const showNoPost = !isTerminal && canQuickMarkNoPost(inf.closedStatus)

  return (
    <div className={`bg-white border rounded-lg p-3 hover:shadow-md transition-shadow ${
      isExit ? "border-red-100 bg-red-50/30" : "border-gray-200"
    }`}>
      {/* Clickable body — same layout as pipeline card */}
      <div className="cursor-pointer" onClick={() => onOpen(inf)}>
        {/* Name + handle */}
        <div className="flex flex-col text-sm mb-2">
          <span className="font-medium text-gray-900">{inf.influencer}</span>
          <span className="text-xs text-gray-500">@{inf.handle}</span>
        </div>

        {/* Platform + location */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
          <span>{inf.platform || "Instagram"}</span>
          <span>•</span>
          <span className="flex items-center gap-0.5">
            <IconLocation size={11} />{inf.location || "—"}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{inf.followers} followers</span>
          <span>{inf.engagementRate || "—"}% eng</span>
        </div>

        {/* Campaign badge */}
        <div className="mt-2">
          <CampaignBadge type={inf.campaignType} />
        </div>

        {/* Status pills */}
        {inf.closedStatus === "Delivered" && !inf.postedAt && (
          <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 rounded-full px-2.5 py-1 inline-block font-medium">
            ⚠️ Awaiting content
          </div>
        )}
        {inf.closedStatus === "Posted" && inf.postUrl && (
          <div className="mt-2 text-[10px] text-green-600 bg-green-50 rounded-full px-2.5 py-1 inline-flex items-center gap-1 font-medium">
            <IconLink size={10}/> Content live
          </div>
        )}
        {isExit && (
          <div className="mt-2 text-[10px] text-red-500 bg-red-50 rounded-full px-2.5 py-1 inline-block font-medium">
            ✕ No content published
          </div>
        )}
      </div>

      {/* Stage action buttons — same pattern as pipeline cards */}
      {!isTerminal && (nextStage || showNoPost) && (
        <div className="flex gap-1.5 mt-3 pt-2 border-t border-gray-100 flex-nowrap">
          {nextStage && (
            <button
              onClick={e => { e.stopPropagation(); if (!canApproveInfluencers) return; onMove(inf.id, nextStage) }}
              disabled={!canApproveInfluencers}
              title={!canApproveInfluencers ? "Only Owners and Managers can update post status" : undefined}
              className="text-[11px] font-medium px-2 py-1 rounded-full border bg-[#EAF7EF] text-[#0F6B3E] border-[#bfe5cf] hover:bg-[#d7f0e0] transition flex items-center gap-1 min-w-0 flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconArrowRight size={11} className="flex-shrink-0"/> <span className="truncate">{nextStage}</span>
            </button>
          )}
          {showNoPost && (
            <button
              onClick={e => { e.stopPropagation(); if (!canApproveInfluencers) return; onMove(inf.id, "No post") }}
              disabled={!canApproveInfluencers}
              title={!canApproveInfluencers ? "Only Owners and Managers can update post status" : undefined}
              className="text-[11px] font-medium px-2 py-1 rounded-full border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition flex items-center gap-1 min-w-0 flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconX size={11} className="flex-shrink-0"/> <span className="truncate">No post</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Droppable / Draggable ────────────────────────────────────────────────────
function DroppableColumn({ id, children, isExit }: { id: string; children: React.ReactNode; isExit?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef}
      className={`flex flex-col gap-3 transition-all rounded-lg ${
        isOver ? (isExit ? "bg-red-50" : "bg-gray-50") : ""
      }`}>
      {children}
    </div>
  )
}
function DraggableCard({ id, children, onClick, disabled }: { id: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
  return (
    <div ref={setNodeRef} style={style}
      title={disabled ? "Only Owners and Managers can update post status" : undefined}
      className={`${disabled ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "opacity-50" : ""}`}
      onClick={onClick} {...listeners} {...attributes}>
      {children}
    </div>
  )
}

// ─── Profile Drawer — structure mirrors Pipeline's InfluencerProfileSidebar ──
// Tabs: Basic, Order, Post, Stats, History (same names/order/behavior as Pipeline).
const STAGE_OPTIONS: ClosedColumn[] = ["For Order Creation", "In-Transit", "Delivered", "Posted", "No post"]
const PROFILE_TABS = ["Basic", "Order", "Post", "Stats", "Paid collab details", "History"]

function ProfileDrawer({ inf, brandId, onClose, onColumnChange, onCollabTypeChange, onPostUrlChange, canApproveInfluencers, subscriptionStatus, initialTab = 0, focusPostUrl = false }: {
  inf: ClosedInfluencer; brandId?: string; onClose: () => void
  onColumnChange: (id: string, col: ClosedColumn) => Promise<boolean>
  onCollabTypeChange: (id: string, type: string) => Promise<boolean>
  onPostUrlChange: (id: string, postUrl: string) => Promise<boolean>
  canApproveInfluencers: boolean
  subscriptionStatus?: string
  /** Tab to open on — used by the "Go to Post Details" warning action */
  initialTab?: number
  /** Focus + scroll the Post URL field once the drawer opens */
  focusPostUrl?: boolean
}) {
  const [profileTab, setProfileTab] = useState(initialTab)
  const [drawerToast, setDT]        = useState("")
  const [savingPost, setSavingPost] = useState(false)
  const postUrlRef = useRef<HTMLInputElement>(null)
  const showToast = (msg: string) => { setDT(msg); setTimeout(()=>setDT(""),2600) }

  // Land the user directly on the Post URL field when sent here from the
  // "Cannot Move to Posted" warning.
  useEffect(() => {
    if (!focusPostUrl) return
    const t = setTimeout(() => {
      postUrlRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      postUrlRef.current?.focus()
    }, 120)
    return () => clearTimeout(t)
  }, [focusPostUrl])

  const campaignType = inf.campaignType ?? "gifting"
  const showPaidCollabTab = PAID_COLLAB_TYPES.has(campaignType)

  // If the collab type changes (from Pipeline) while this tab is open and it's
  // no longer a paid type, fall back to Basic instead of showing an empty tab.
  useEffect(() => {
    if (profileTab === 4 && !showPaidCollabTab) setProfileTab(0)
  }, [showPaidCollabTab, profileTab])

  const [orderData, setOrderData] = useState({
    orderStatus: inf.orderStatus || "", productDetails: inf.productDetails || "",
    trackingNumber: inf.trackingNumber || "", shippedAt: inf.shippedAt ? inf.shippedAt.slice(0,10) : "",
    deliveredAt: inf.deliveredAt ? inf.deliveredAt.slice(0,10) : "", deadline: inf.deadline ? inf.deadline.slice(0,10) : "",
    deliverables: inf.deliverables || "", currency: inf.currency || "USD",
  })
  const [postData, setPostData] = useState({
    postUrl: inf.postUrl || "", postedAt: inf.postedAt ? inf.postedAt.slice(0,10) : "",
    likes: inf.likesCount ? String(inf.likesCount) : "", comments: inf.commentsCount ? String(inf.commentsCount) : "",
    engagement: inf.engagementCount ? String(inf.engagementCount) : "",
    scriptStatus: inf.scriptStatus || "", contentStatus: inf.contentStatus || "",
    internalRating: inf.internalRating ? String(inf.internalRating) : "",
  })

  const handleStageChange = async (newStage: ClosedColumn) => {
    const ok = await onColumnChange(inf.id, newStage)
    if (ok) showToast(`Moved to ${newStage}`)
  }
  const handleCollabTypeChange = async (newType: string) => {
    const ok = await onCollabTypeChange(inf.id, newType)
    if (ok) showToast("Collaboration type updated")
  }
  const handleSavePost = async () => {
    setSavingPost(true)
    const ok = await onPostUrlChange(inf.id, postData.postUrl)
    setSavingPost(false)
    showToast(ok ? "Post details saved" : "Failed to save post details")
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 400, cursor: "pointer" }} />

      <div className="pp">
        {/* ── Header ── */}
        <div className="pph">
          <div className="ppt">Influencer Profile</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            {inf.profileImageUrl ? (
              <img src={inf.profileImageUrl} alt={inf.influencer} className="pav" style={{ objectFit: "cover" }} />
            ) : (
              <div className="pav">{inf.influencer.charAt(0).toUpperCase()}</div>
            )}
            <div style={{ flex: 1 }}>
              <div className="pnm">{inf.influencer}</div>
              <div className="phd">@{inf.handle}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Stage</span>
                <select
                  className="ssel"
                  value={inf.closedStatus}
                  onChange={(e) => handleStageChange(e.target.value as ClosedColumn)}
                  disabled={!canApproveInfluencers}
                  title={!canApproveInfluencers ? "Only Owners and Managers can update post status" : undefined}
                  style={{
                    borderColor: inf.closedStatus === "No post" ? "#fca5a5" : undefined,
                    background:  inf.closedStatus === "No post" ? "#fef2f2" : undefined,
                    color:       inf.closedStatus === "No post" ? "#dc2626" : undefined,
                    opacity:     canApproveInfluencers ? undefined : 0.5,
                    cursor:      canApproveInfluencers ? undefined : "not-allowed",
                  }}
                >
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s} value={s} style={s === "No post" ? { color: "#dc2626", fontWeight: 600 } : undefined}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Collaboration Type</span>
                <select
                  className="csel"
                  value={campaignType}
                  onChange={(e) => handleCollabTypeChange(e.target.value)}
                  disabled={!canApproveInfluencers}
                  title={!canApproveInfluencers ? "Only Owners and Managers can update collaboration type" : "Inherited from Pipeline — change here if the collaboration changes"}
                  style={{ opacity: canApproveInfluencers ? undefined : 0.5, cursor: canApproveInfluencers ? undefined : "not-allowed" }}
                >
                  {CAMPAIGN_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>

              <button onClick={onClose} title="Close" className="close-btn">✕</button>
            </div>
          </div>


          {inf.closedStatus === "No post" && (
            <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 11, color: "#dc2626", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>✕</span> No content published
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="atag plat">{inf.platform || "Instagram"}</button>
            <button className="atag">Send Email</button>
            <button className="atag">Send DM</button>
            <button className="atag">Follow up</button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="pit-bar">
          {PROFILE_TABS.map((tab, idx) => (
            idx === 4 && !showPaidCollabTab ? null :
            <div key={idx} className={`pit ${profileTab === idx ? "active" : ""}`} onClick={() => setProfileTab(idx)}>
              {tab}
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="ppb">

          {/* ════ BASIC TAB ════ */}
          {profileTab === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="sr4">
                <div className="sbox"><div className="slb">Followers</div><div className="svl">{inf.followers}</div></div>
                <div className="sbox"><div className="slb">Eng Rate</div><div className="svl" style={{ color: "#2c8ec4" }}>{inf.engagementRate || "—"}</div></div>
                <div className="sbox"><div className="slb">Rate</div><div className="svl" style={{ color: "#1fae5b" }}>{fmtMoney(inf.agreedRate)}</div></div>
                <div className="sbox"><div className="slb">Rating</div><div className="svl">{inf.internalRating ? `${inf.internalRating}/5` : "—"}</div></div>
              </div>
              <div>
                <div className="section-label">Avg Metrics</div>
                <div className="avg-row">
                  <div className="avg-card"><div className="avg-val">{inf.likesCount?.toLocaleString() ?? "—"}</div><div className="avg-lbl">Likes</div></div>
                  <div className="avg-card"><div className="avg-val">{inf.commentsCount?.toLocaleString() ?? "—"}</div><div className="avg-lbl">Comments</div></div>
                  <div className="avg-card"><div className="avg-val">{inf.engagementCount?.toLocaleString() ?? "—"}</div><div className="avg-lbl">Engagement</div></div>
                </div>
              </div>
              <div className="fgrd">
                <div className="frow"><div className="flbl">Location</div><div className="fval">{inf.location || "—"}</div></div>
                <div className="frow"><div className="flbl">Niche</div><div className="fval">{inf.niche || "—"}</div></div>
                <div className="frow"><div className="flbl">Platform</div><div className="fval">{inf.platform || "—"}</div></div>
                <div className="frow"><div className="flbl">Email</div><div className="fval">{inf.email || "—"}</div></div>
                <div className="frow"><div className="flbl">Order Status</div><div className="fval">{inf.orderStatus || "—"}</div></div>
                <div className="frow"><div className="flbl">Stage</div><div className="fval">{inf.closedStatus}</div></div>
                <div className="frow"><div className="flbl">Campaign</div><div className="fval">{inf.campaignName || "—"}</div></div>
                <div className="frow"><div className="flbl">Contact Status</div><div className="fval">{inf.contactStatus || "—"}</div></div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>Notes</div>
                <textarea className="pfi" style={{ minHeight: 80, resize: "vertical" }} placeholder="Add notes..." defaultValue={inf.notes || ""} />
              </div>
            </div>
          )}

          {/* ════ ORDER TAB ════ */}
          {profileTab === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="pfg">
                <div className="pfl">Order Status</div>
                <select className="pfi" value={orderData.orderStatus} onChange={e => setOrderData(d => ({ ...d, orderStatus: e.target.value }))}>
                  <option value="">Select...</option><option value="pending">Pending</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option>
                </select>
              </div>
              <div className="pfg"><div className="pfl">Product Details</div><input className="pfi" value={orderData.productDetails} onChange={e => setOrderData(d => ({ ...d, productDetails: e.target.value }))} placeholder="Product Details" /></div>
              <div className="pfg"><div className="pfl">Tracking Number</div><input className="pfi" value={orderData.trackingNumber} onChange={e => setOrderData(d => ({ ...d, trackingNumber: e.target.value }))} placeholder="Tracking Number" /></div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Shipped At</div><input type="date" className="pfi" value={orderData.shippedAt} onChange={e => setOrderData(d => ({ ...d, shippedAt: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Delivered At</div><input type="date" className="pfi" value={orderData.deliveredAt} onChange={e => setOrderData(d => ({ ...d, deliveredAt: e.target.value }))} /></div>
              </div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Deadline</div><input type="date" className="pfi" value={orderData.deadline} onChange={e => setOrderData(d => ({ ...d, deadline: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Currency</div><input className="pfi" value={orderData.currency} onChange={e => setOrderData(d => ({ ...d, currency: e.target.value }))} /></div>
              </div>
              <div className="pfg"><div className="pfl">Deliverables</div><input className="pfi" value={orderData.deliverables} onChange={e => setOrderData(d => ({ ...d, deliverables: e.target.value }))} placeholder="Deliverables" /></div>
              <div
                style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
                  position: "sticky", bottom: -18, margin: "8px -20px -18px",
                  padding: "10px 20px", background: "#fff", borderTop: "1px solid #eee", zIndex: 2,
                }}
              >
                <button className="btn-secondary">Cancel</button>
                <button className="btn-primary">Save</button>
              </div>
            </div>
          )}

          {/* ════ POST TAB ════ */}
          {profileTab === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {brandId && <AutoPostDetectionCard brandId={brandId} biId={inf.id} subscriptionStatus={subscriptionStatus} />}
              <div className="pfg"><div className="pfl">Post URL</div><input ref={postUrlRef} className="pfi" value={postData.postUrl} onChange={e => setPostData(d => ({ ...d, postUrl: e.target.value }))} placeholder="Post URL" /></div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Posted At</div><input type="date" className="pfi" value={postData.postedAt} onChange={e => setPostData(d => ({ ...d, postedAt: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Internal Rating</div>
                  <select className="pfi" value={postData.internalRating} onChange={e => setPostData(d => ({ ...d, internalRating: e.target.value }))}>
                    <option value="">Select...</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Likes</div><input className="pfi" value={postData.likes} onChange={e => setPostData(d => ({ ...d, likes: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Comments</div><input className="pfi" value={postData.comments} onChange={e => setPostData(d => ({ ...d, comments: e.target.value }))} /></div>
              </div>
              <div className="pfg"><div className="pfl">Engagement</div><input className="pfi" value={postData.engagement} onChange={e => setPostData(d => ({ ...d, engagement: e.target.value }))} /></div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Script Status</div>
                  <select className="pfi" value={postData.scriptStatus} onChange={e => setPostData(d => ({ ...d, scriptStatus: e.target.value }))}>
                    <option value="">Select...</option><option value="pending">Pending</option><option value="revision_requested">Revision Requested</option><option value="approved">Approved</option>
                  </select>
                </div>
                <div className="pfg"><div className="pfl">Content Status</div>
                  <select className="pfi" value={postData.contentStatus} onChange={e => setPostData(d => ({ ...d, contentStatus: e.target.value }))}>
                    <option value="">Select...</option><option value="pending">Pending</option><option value="revision_requested">Revision Requested</option><option value="approved">Approved</option>
                  </select>
                </div>
              </div>
              <div
                style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
                  position: "sticky", bottom: -18, margin: "8px -20px -18px",
                  padding: "10px 20px", background: "#fff", borderTop: "1px solid #eee", zIndex: 2,
                }}
              >
                <button className="btn-secondary" onClick={() => setPostData(d => ({ ...d, postUrl: inf.postUrl || "" }))}>Cancel</button>
                <button className="btn-primary" onClick={handleSavePost} disabled={savingPost}>{savingPost ? "Saving…" : "Save"}</button>
              </div>
            </div>
          )}

          {/* ════ STATS TAB ════ */}
          {profileTab === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div className="stit">Engagement &amp; Performance</div>
              <div className="skg">
                <div className="skc"><div className="skv-dark">{inf.followers}</div><div className="skl">Followers</div></div>
                <div className="skc"><div className="skv-blue">{inf.engagementRate || "—"}</div><div className="skl">Eng. rate</div></div>
                <div className="skc"><div className="skv-dark">{inf.likesCount?.toLocaleString() ?? "—"}</div><div className="skl">Likes</div></div>
                <div className="skc"><div className="skv-dark">{inf.commentsCount?.toLocaleString() ?? "—"}</div><div className="skl">Comments</div></div>
                <div className="skc"><div className="skv-dark">{inf.engagementCount?.toLocaleString() ?? "—"}</div><div className="skl">Total engagement</div></div>
                <div className="skc"><div className="skv-green">{fmtMoney(inf.agreedRate)}</div><div className="skl">Rate</div></div>
              </div>
              <div className="stit">Timeline</div>
              <div className="skg">
                <div className="skc"><div className="skv-dark">{fmtDate(inf.shippedAt)}</div><div className="skl">Shipped</div></div>
                <div className="skc"><div className="skv-dark">{fmtDate(inf.deliveredAt)}</div><div className="skl">Delivered</div></div>
                <div className="skc"><div className="skv-dark">{fmtDate(inf.postedAt)}</div><div className="skl">Posted</div></div>
              </div>
            </div>
          )}

          {/* ════ PAID COLLAB DETAILS TAB ════ */}
          {profileTab === 4 && (
            <PaidCollabTab influencerName={inf.influencer} rateHint={inf.agreedRate ?? undefined} />
          )}

          {/* ════ HISTORY TAB ════ */}
          {profileTab === 5 && (
            <HistoryTab brandId={brandId} biId={inf.id} />
          )}

        </div>

        {drawerToast && <div className="drawer-toast">{drawerToast}</div>}

        <style jsx>{`
          .pp { position:fixed; top:0; right:0; width:520px; max-width:100vw; height:100%; background:#fff; box-shadow:-8px 0 40px rgba(0,0,0,0.14); z-index:500; display:flex; flex-direction:column; font-family:"Inter",system-ui,sans-serif; }
          .pph { padding:16px 20px; border-bottom:1px solid #f0f0f0; }
          .ppt { font-size:11px; font-weight:600; color:#9ca3af; letter-spacing:.1em; text-transform:uppercase; margin-bottom:12px; }
          .pav { width:44px; height:44px; border-radius:50%; background:#1fae5b; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; color:#fff; flex-shrink:0; box-shadow:0 0 0 3px #dcfce7; }
          .pnm { font-size:15px; font-weight:700; color:#111827; }
          .phd { font-size:12px; color:#6b7280; margin-top:2px; }
          .ssel { font-size:11px; padding:5px 10px; border-radius:8px; border:.5px solid #f4b740; background:#fffbeb; color:#854f0b; cursor:pointer; font-family:inherit; font-weight:500; transition:all .15s; }
          .csel { font-size:11px; padding:5px 10px; border-radius:8px; border:1px solid #e5e7eb; background:#f9fafb; color:#374151; cursor:pointer; font-family:inherit; font-weight:600; transition:all .15s; min-width:130px; }
          .close-btn { width:30px; height:30px; border-radius:50%; border:1.5px solid #e5e7eb; background:#f9fafb; color:#374151; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; flex-shrink:0; line-height:1; margin-top:14px; transition:background .15s,border-color .15s,color .15s; }
          .close-btn:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
          .atag { font-size:12px; font-weight:500; padding:6px 14px; border-radius:20px; cursor:pointer; border:1px solid #e5e7eb; background:#f9fafb; color:#555; }
          .atag.plat { background:#1fae5b; color:#fff; border-color:#1fae5b; }
          .pit-bar { display:flex; gap:0; padding:0 20px; border-bottom:1px solid #f0f0f0; overflow-x:auto; }
          .pit { font-size:12px; font-weight:600; padding:11px 14px; cursor:pointer; color:#9ca3af; border-bottom:2px solid transparent; white-space:nowrap; transition:color .15s; flex-shrink:0; }
          .pit.active { color:#1fae5b; border-bottom-color:#1fae5b; }
          .ppb { flex:1; overflow-y:auto; padding:18px 20px; }
          .sr4 { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; background:linear-gradient(135deg,#f0fdf4 0%,#f9fafb 100%); border-radius:12px; padding:14px; margin-bottom:4px; border:1px solid #dcfce7; }
          .sbox { text-align:center; }
          .slb { font-size:9px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:.07em; }
          .svl { font-size:16px; font-weight:700; color:#111827; margin-top:3px; }
          .section-label { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; padding-top:12px; border-top:1px solid #f3f4f6; }
          .avg-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
          .avg-card { background:#fff; border:1.5px solid #e5e7eb; border-radius:10px; padding:12px 8px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,.05); }
          .avg-val { font-size:18px; font-weight:700; color:#111827; }
          .avg-lbl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.07em; margin-top:3px; }
          .fgrd { display:grid; grid-template-columns:1fr 1fr; }
          .frow { padding:8px 0; border-bottom:.5px solid rgba(0,0,0,.05); }
          .flbl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
          .fval { font-size:13px; color:#111827; font-weight:500; }
          .pfr { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
          .pfg { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
          .pfl { font-size:10px; font-weight:600; color:#6b7280; }
          .pfi { width:100%; font-size:12px; padding:8px 10px; border-radius:8px; border:1.5px solid #e5e7eb; background:#f9fafb; color:#111827; font-family:inherit; box-sizing:border-box; outline:none; transition:border-color .15s,background .15s; }
          .pfi:focus { border-color:#1fae5b; background:#fff; }
          .pfi::placeholder { color:#c4c4c4; }
          textarea.pfi { resize:vertical; min-height:70px; }
          .stit { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.08em; padding:12px 0 8px; border-bottom:1px solid #f3f4f6; margin-bottom:10px; }
          .skg { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
          .skc { background:#f9fafb; border-radius:10px; padding:10px 12px; text-align:center; border:1px solid #f3f4f6; }
          .skl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; margin-top:3px; }
          .skv-green { font-size:16px; font-weight:700; color:#1fae5b; }
          .skv-dark  { font-size:16px; font-weight:700; color:#111827; }
          .skv-blue  { font-size:16px; font-weight:700; color:#2c8ec4; }
          .btn-primary { background:#1fae5b; color:#fff; border:none; padding:9px 20px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; font-family:inherit; transition:background .15s; }
          .btn-secondary { background:transparent; color:#6b7280; border:1.5px solid #e5e7eb; padding:9px 18px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; font-family:inherit; transition:background .15s,border-color .15s; }
          .btn-secondary:hover { background:#f9fafb; border-color:#d1d5db; }
          .btn-primary:hover { background:#0f6b3e; }
          .drawer-toast { position:absolute; bottom:20px; right:20px; background:#111827; color:#fff; font-size:13px; padding:8px 16px; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.2); z-index:600; }
        `}</style>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClosedPage() {
  return (
    <Suspense fallback={<BoardSkeleton label="Fetching data..." />}>
      <PostTrackerContent />
    </Suspense>
  )
}

function PostTrackerContent() {
  const session = useSession()
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId") ?? undefined
  const { canApproveInfluencers, loading: capabilitiesLoading } = useBrandCapabilities(brandId)
  const canApprove = !capabilitiesLoading && canApproveInfluencers
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null)
  // Deliberately starts undefined (not "inactive") — AutoPostDetectionCard's
  // usePlanAccess treats a defined prop as "already resolved, trust it";
  // seeding a placeholder string here made it look resolved before the real
  // /api/subscription/status check below ever ran, briefly unlocking a
  // premium feature for free-tier users. undefined correctly signals "not
  // loaded yet" until the fetch below sets the real value.
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | undefined>(undefined)

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const response = await fetch(brandId ? `/api/subscription/status?brandId=${brandId}` : "/api/subscription/status")
        const data = await response.json()
        setSubscriptionStatus(data.status || "inactive")
        setIsSubscribed((data.status === "active" || data.status === "trialing") && !data.isExpired)
      } catch (error) {
        console.error("Failed to check subscription:", error)
        setSubscriptionStatus("inactive")
        setIsSubscribed(false)
      }
    }

    if (session.status === "authenticated") {
      checkSubscription()
    }
  }, [session.status, brandId])

  const { data, isLoading, error, updateColumn, updateCampaignType, updatePostUrl, refetch } = useClosedData(brandId)

  const [view,                 setView]                 = useState<"Board"|"list">("Board")
  const [search,               setSearch]               = useState("")
  const [activeId,             setActiveId]             = useState<string|null>(null)
  const [selectedInf,          setSelectedInf]          = useState<ClosedInfluencer|null>(null)
  const [toastMsg,             setToastMsg]             = useState<string|null>(null)
  const [showFilterPanel,      setShowFilterPanel]      = useState(false)
  // Name/handle filtering lives in the global search bar only — the panel
  // holds filters that search can't express.
  const [filters,              setFilters]              = useState<PostTrackerFilters>(EMPTY_FILTERS)
  const [selectedColumnStatus, setSelectedColumnStatus] = useState<ClosedColumn|null>(null)
  const [sortOrder,            setSortOrder]            = useState<"newest"|"oldest">("newest")

  // ── Bulk selection (list view) ─────────────────────────────────────────────
  // Keyed on brandInfluencer ids, so a selection survives scrolling, sorting,
  // searching and filter changes. Mirrors the Pipeline list view.
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set())
  const [showBulkStageMenu, setShowBulkStageMenu] = useState(false)
  const [bulkBusy,          setBulkBusy]          = useState(false)
  const bulkMenuRef  = useRef<HTMLDivElement>(null)
  const bulkBtnRef   = useRef<HTMLButtonElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

  // Influencer(s) blocked from moving to Posted for want of a Post URL
  const [postUrlBlocked, setPostUrlBlocked] = useState<ClosedInfluencer[]>([])
  // Set when the drawer is opened from the warning's "Go to Post Details"
  const [drawerFocusPostUrl, setDrawerFocusPostUrl] = useState(false)

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(()=>setToastMsg(null),3000) }
  const sensors   = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:5}}))

  const handleMove = useCallback(async (id: string, col: ClosedColumn) => {
    if (!canApprove) {
      showToast("Only Owners and Managers can update post status")
      return false
    }
    const inf = data.find(d=>d.id===id)
    // A manual move to Posted needs evidence of a published post. Automatic
    // detection writes the record server-side and never runs through here.
    if (col === "Posted" && inf && !hasPostUrl(inf)) {
      setPostUrlBlocked([inf])
      return false
    }
    const ok  = await updateColumn(id, col)
    if (ok) {
      showToast(`${inf?.influencer} moved to ${col}`)
      setSelectedInf(p => p?.id===id ? {...p, closedStatus: col} : p)
    } else {
      showToast("Failed to move")
    }
    return ok
  }, [data, updateColumn, canApprove])

  const filteredData = useMemo(() => {
    let result = data.filter(inf =>
      inf.influencer.toLowerCase().includes(search.toLowerCase()) ||
      inf.handle.toLowerCase().includes(search.toLowerCase())
    )
    if (selectedColumnStatus)     result = result.filter(inf=>inf.closedStatus===selectedColumnStatus)
    if (filters.location!=="all") result = result.filter(inf=>inf.location===filters.location)
    if (filters.niche!=="all")    result = result.filter(inf=>inf.niche===filters.niche)
    if (filters.stages.length)    result = result.filter(inf=>filters.stages.includes(inf.closedStatus))
    // Rows with no collab type set read as Gifting, matching CampaignBadge
    if (filters.types.length)     result = result.filter(inf=>filters.types.includes(inf.campaignType ?? "gifting"))
    result = [...result].sort((a,b)=>{
      const da = new Date(a.createdAt ?? 0).getTime()
      const db = new Date(b.createdAt ?? 0).getTime()
      return sortOrder === "newest" ? db - da : da - db
    })
    return result
  }, [data, search, selectedColumnStatus, filters, sortOrder])

  // ── Bulk selection helpers ─────────────────────────────────────────────────
  // Ids that no longer exist in the dataset are ignored rather than pruned in
  // an effect, so the count can never overstate what's actually selected.
  const selectedInfluencers = useMemo(() => data.filter(d => selectedIds.has(d.id)), [data, selectedIds])
  const selectedCount       = selectedInfluencers.length
  const allVisibleSelected  = filteredData.length > 0 && filteredData.every(d => selectedIds.has(d.id))
  const someVisibleSelected = filteredData.some(d => selectedIds.has(d.id))

  const clearSelection   = () => setSelectedIds(new Set())
  const toggleRowSelection = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleSelectAllVisible = () => setSelectedIds(prev => {
    const next = new Set(prev)
    if (allVisibleSelected) filteredData.forEach(d => next.delete(d.id))
    else filteredData.forEach(d => next.add(d.id))
    return next
  })

  // Header checkbox shows a partial state when only some visible rows are selected
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected
  }, [someVisibleSelected, allVisibleSelected])

  // Close the Move to Stage menu on outside click / Escape
  useEffect(() => {
    if (!showBulkStageMenu) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!bulkMenuRef.current?.contains(t) && !bulkBtnRef.current?.contains(t)) setShowBulkStageMenu(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowBulkStageMenu(false); bulkBtnRef.current?.focus() }
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [showBulkStageMenu])

  // ── Bulk stage move ────────────────────────────────────────────────────────
  // Reuses the same per-row `updateColumn` that the single-row dropdown, the
  // card arrows and drag-and-drop all use — no new endpoint, no duplicated
  // stage logic. Sequential on purpose: `updateColumn` rolls back from a
  // full-list snapshot on failure, so overlapping calls could undo each
  // other's successful writes. Sequential keeps every success intact.
  const runBulkStageMove = async (col: ClosedColumn) => {
    const candidates = selectedInfluencers.filter(d => d.closedStatus !== col)

    // Same rule as the single-row paths: no Post URL, no manual move to Posted.
    // If any selected row is missing one, block the whole batch and name them,
    // rather than silently moving a subset.
    if (col === "Posted") {
      const missing = candidates.filter(d => !hasPostUrl(d))
      if (missing.length > 0) {
        setPostUrlBlocked(missing)
        return
      }
    }

    const targets = candidates
    const skipped = selectedCount - targets.length
    if (targets.length === 0) {
      showToast(`Nothing to move — the selected influencers are already in ${col}`)
      return
    }

    setBulkBusy(true)
    const failedIds: string[] = []
    let moved = 0
    for (const target of targets) {
      const ok = await updateColumn(target.id, col)
      if (ok) {
        moved += 1
        setSelectedInf(p => (p?.id === target.id ? { ...p, closedStatus: col } : p))
      } else {
        failedIds.push(target.id)
      }
    }
    setBulkBusy(false)

    // Keep only failures selected so they can be retried directly
    setSelectedIds(new Set(failedIds))

    const skippedNote = skipped > 0 ? ` · ${skipped} skipped` : ""
    showToast(failedIds.length === 0
      ? `${moved} influencer${moved === 1 ? "" : "s"} moved to ${col} ✓${skippedNote}`
      : `${moved} moved to ${col}, ${failedIds.length} failed${skippedNote} — the failed ones are still selected`)
  }

  const handleBulkStageSelect = (col: ClosedColumn) => {
    setShowBulkStageMenu(false)
    if (!canApprove) { showToast("Only Owners and Managers can update post status"); return }
    if (selectedCount === 0) return
    void runBulkStageMove(col)
  }

  const activeFilterCount  =
    (filters.location!=="all" ? 1 : 0) +
    (filters.niche!=="all" ? 1 : 0) +
    filters.stages.length +
    filters.types.length +
    (search ? 1 : 0) +
    (selectedColumnStatus ? 1 : 0)
  const hasActiveFilters   = activeFilterCount > 0
  const activeInf          = activeId ? data.find(d=>d.id===activeId) : null
  const selectedColumnInfo = selectedColumnStatus ? COLUMNS.find(col=>col.key===selectedColumnStatus) : null
  const getItemsByColumn   = (columnKey: ClosedColumn) => filteredData.filter(item=>item.closedStatus===columnKey)

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string)
  const handleDragEnd   = async (event: DragEndEvent) => {
    const {active,over} = event
    setActiveId(null)
    if (!over) return
    const id     = active.id as string
    const newCol = over.id as ClosedColumn
    const inf    = data.find(d=>d.id===id)
    if (!inf||inf.closedStatus===newCol) return
    await handleMove(id, newCol)
  }

  const handlePostUrlChange = useCallback(async (id: string, postUrl: string): Promise<boolean> => {
    const ok = await updatePostUrl(id, postUrl)
    if (ok) setSelectedInf(p => (p?.id === id ? { ...p, postUrl: postUrl.trim() || null } : p))
    return ok
  }, [updatePostUrl])

  const handleCollabTypeChange = useCallback(async (id: string, type: string): Promise<boolean> => {
    if (!canApprove) {
      showToast("Only Owners and Managers can update collaboration type")
      return false
    }
    const ok = await updateCampaignType(id, type)
    if (ok) { setSelectedInf(p=>p?.id===id?{...p,campaignType:type}:p); showToast("Collaboration type updated") }
    else showToast("Failed to update collaboration type")
    return ok
  }, [updateCampaignType, canApprove])

  const handleColumnClick = (column: typeof COLUMNS[0]) => {
    setSelectedColumnStatus(column.key)
    setView("list")
    showToast(`Showing "${column.title}"`)
  }
  const clearColumnFilter = () => { setSelectedColumnStatus(null); showToast("Showing all influencers") }

  if (!brandId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-5 max-w-sm w-full px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            <svg
              className="w-7 h-7 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold text-gray-900">No brand selected</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Choose a brand from the dropdown above to view and manage your post tracker.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) return <BoardSkeleton label="Fetching data..." />
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-3"><p className="text-red-500 text-sm">{error}</p><button onClick={refetch} className="text-[13px] px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">Retry</button></div>

  return (
    <SubscriptionGate isSubscribed={isSubscribed} status={subscriptionStatus} featureName="Post Tracker">
      <div className="flex flex-col gap-4 p-6">
      {toastMsg&&<div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2">{toastMsg}</div>}

      {postUrlBlocked.length>0&&(
        <PostUrlRequiredDialog
          count={postUrlBlocked.length}
          // With one influencer we can take the user straight to its Post tab;
          // for a bulk rejection there's no single record to open.
          onGoToPostDetails={postUrlBlocked.length===1 ? ()=>{
            const target = postUrlBlocked[0]
            setPostUrlBlocked([])
            setDrawerFocusPostUrl(true)
            setSelectedInf(target)
          } : null}
          onCancel={()=>setPostUrlBlocked([])}
        />
      )}

      {selectedInf&&(
        <ProfileDrawer
          // Remount when the target or the "jump to Post URL" intent changes,
          // so initialTab/focus apply even if the drawer is already open.
          key={`${selectedInf.id}${drawerFocusPostUrl ? ":post" : ""}`}
          inf={selectedInf} brandId={brandId}
          onClose={()=>{ setSelectedInf(null); setDrawerFocusPostUrl(false) }}
          onColumnChange={handleMove} onCollabTypeChange={handleCollabTypeChange}
          onPostUrlChange={handlePostUrlChange} canApproveInfluencers={canApprove}
          subscriptionStatus={subscriptionStatus}
          initialTab={drawerFocusPostUrl ? 2 : 0} focusPostUrl={drawerFocusPostUrl}/>
      )}

      {/* ── Single inline toolbar row — matches Manage Influencers layout ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search influencer..."
            className="w-full pl-9 pr-3 h-9 border border-[#0F6B3E]/20 rounded-lg outline-none focus:ring-2 focus:ring-[#1FAE5B] text-sm"/>
        </div>

        {/* Filters */}
        <div className="relative">
          <button onClick={()=>setShowFilterPanel(!showFilterPanel)}
            className={`h-9 px-3 rounded-lg text-sm flex items-center gap-1.5 border transition-colors ${hasActiveFilters?"bg-[#1FAE5B] text-white border-[#1FAE5B]":"border-[#0F6B3E]/20 hover:border-[#0F6B3E]/40"}`}>
            <IconFilter size={15}/> Filters
            {activeFilterCount > 0 && (
              <span className={`text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ${hasActiveFilters?"bg-white/20 text-white":"bg-[#1FAE5B] text-white"}`}>
                {activeFilterCount}
              </span>
            )}
          </button>
          {showFilterPanel&&(
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-30 w-[420px] max-w-[90vw] p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">Filter by</span>
                {hasActiveFilters&&<button className="text-xs text-gray-400 hover:text-red-500 transition flex items-center gap-1" onClick={()=>setFilters(EMPTY_FILTERS)}><IconX size={12}/> Clear all</button>}
              </div>
              <div className="flex flex-col gap-5">
                <TagSelect label="Post Stage" options={STAGE_FILTER_OPTIONS} selected={filters.stages}
                  onChange={v=>setFilters(p=>({...p,stages:v as ClosedColumn[]}))}
                  colorClass="bg-purple-50 text-purple-700 border-purple-200"/>
                <div className="border-t border-gray-100"/>
                <TagSelect label="Post Type" options={CAMPAIGN_TYPES.map(t=>({value:t.value,label:t.label}))} selected={filters.types}
                  onChange={v=>setFilters(p=>({...p,types:v}))}
                  colorClass="bg-amber-50 text-amber-700 border-amber-200"/>
                <div className="border-t border-gray-100"/>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Location</label><select value={filters.location} onChange={e=>setFilters(p=>({...p,location:e.target.value}))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] appearance-none cursor-pointer"><option value="all">All Locations</option>{LOCATIONS.map(l=><option key={l}>{l}</option>)}</select></div>
                  <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Niche</label><select value={filters.niche} onChange={e=>setFilters(p=>({...p,niche:e.target.value}))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] appearance-none cursor-pointer"><option value="all">All Niches</option>{NICHES.map(n=><option key={n}>{n}</option>)}</select></div>
                </div>
              </div>
              {/* Sort inside filter panel */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="text-xs text-gray-500 block mb-2">Sort by date</label>
                <div className="flex gap-2">
                  <button onClick={()=>setSortOrder("newest")}
                    className={`flex-1 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5 border font-medium transition-colors ${sortOrder==="newest"?"bg-[#1FAE5B] text-white border-[#1FAE5B]":"border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <IconChevronDown size={14}/> Newest
                  </button>
                  <button onClick={()=>setSortOrder("oldest")}
                    className={`flex-1 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5 border font-medium transition-colors ${sortOrder==="oldest"?"bg-[#1FAE5B] text-white border-[#1FAE5B]":"border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <IconChevronUp size={14}/> Oldest
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end mt-4">
                <button className="px-5 py-1.5 bg-[#1FAE5B] text-white rounded-lg text-sm font-medium hover:bg-[#178a48] transition" onClick={()=>setShowFilterPanel(false)}>Apply</button>
              </div>
            </div>
          )}
        </div>
        {/* Count */}
        <span className="text-sm text-gray-500 whitespace-nowrap ml-1">
          {filteredData.length} of {data.length} influencer{data.length!==1?"s":""}
        </span>

        {/* Spacer */}
        <div className="flex-1"/>

        {/* View toggle */}
{/* View toggle */}
<div className="inline-flex h-9 items-center rounded-lg border border-[#0F6B3E]/20 bg-white p-1">
  <button
    onClick={() => {
      setView("Board")
      setSelectedColumnStatus(null)
    }}
    className={`h-7 px-3 rounded-md text-sm flex items-center gap-1.5 transition-all ${
      view === "Board"
        ? "bg-[#1FAE5B] text-white shadow-sm"
        : "text-gray-600 hover:bg-gray-50 hover:text-[#0F6B3E]"
    }`}
  >
    <IconLayoutKanban size={15} />
    {/* Board */}
  </button>

  <button
    onClick={() => {
      setView("list")
      setSelectedColumnStatus(null)
    }}
    className={`h-7 px-3 rounded-md text-sm flex items-center gap-1.5 transition-all ${
      view === "list"
        ? "bg-[#1FAE5B] text-white shadow-sm"
        : "text-gray-600 hover:bg-gray-50 hover:text-[#0F6B3E]"
    }`}
  >
    <IconList size={15} />
    {/* List */}
  </button>
</div>
      </div>

      {/* ── KANBAN ── */}
      {view==="Board"&&(
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="rounded-xl border border-[#0F6B3E]/10 bg-white p-5 overflow-x-auto" style={{ scrollSnapType: "x proximity" }}>
            <div className="flex gap-4 min-w-max">

              {/* Main columns */}
              {COLUMNS.filter(c=>c.key!=="No post").map(col => {
                const items = getItemsByColumn(col.key)
                return (
                  <div key={col.key} className="w-[min(78vw,240px)] sm:w-[240px] flex-shrink-0" style={{ scrollSnapAlign: "start" }}>
                    <DroppableColumn id={col.key}>
                      {/* ── Column header — identical structure to pipeline ── */}
                      <div className={`${col.color} text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-between`}>
                        <span
                          onClick={() => handleColumnClick(col)}
                          className="flex-1 cursor-pointer hover:opacity-90 transition-opacity truncate mr-2"
                        >
                          {col.title}
                        </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <ColumnInfoTooltip colKey={col.key} variant="dark" />
                        <span className="bg-white/20 text-white rounded-full px-2 py-0.5 text-xs">{items.length}</span>
                      </div>
                      </div>
                      {/* No description text here — it's in the tooltip */}
                      <div className="flex flex-col gap-2 min-h-[400px] mt-2">
                        {items.length===0?(
                          <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">Drop here</div>
                        ):items.map(inf=>(
                          <DraggableCard key={inf.id} id={inf.id} onClick={()=>setSelectedInf(inf)} disabled={!canApprove}>
                            <PostTrackerCard inf={inf} onOpen={setSelectedInf} onMove={handleMove} canApproveInfluencers={canApprove}/>
                          </DraggableCard>
                        ))}
                      </div>
                    </DroppableColumn>
                  </div>
                )
              })}

              {/* Exit separator */}
              <div className="flex flex-col items-center justify-center px-2 flex-shrink-0">
                <div className="h-16 w-px bg-gray-200"/>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest py-2">exit</span>
                <div className="h-16 w-px bg-gray-200"/>
              </div>

              {/* No post — exit column, consistent with pipeline NI column */}
              {(()=>{
                const col   = COLUMNS.find(c=>c.key==="No post")!
                const items = getItemsByColumn(col.key)
                return (
                  <div className="w-[min(78vw,240px)] sm:w-[240px] flex-shrink-0" style={{ scrollSnapAlign: "start" }}>
                    <DroppableColumn id={col.key} isExit>
                      {/* Soft red style matching pipeline NI header */}
                      <div className="bg-red-100 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-between">
                        <span
                          onClick={() => handleColumnClick(col)}
                          className="flex-1 cursor-pointer hover:opacity-90 transition-opacity truncate mr-2"
                        >
                          {col.title}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <ColumnInfoTooltip colKey={col.key} variant="light" />
                          <span className="bg-red-200 text-red-700 rounded-full px-2 py-0.5 text-xs">{items.length}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 min-h-[400px] mt-2">
                        {items.length===0?(
                          <div className="border-2 border-dashed border-red-200 rounded-lg p-4 text-center text-xs text-gray-400">Drop here</div>
                        ):items.map(inf=>(
                          <DraggableCard key={inf.id} id={inf.id} onClick={()=>setSelectedInf(inf)} disabled={!canApprove}>
                            <PostTrackerCard inf={inf} onOpen={setSelectedInf} onMove={handleMove} canApproveInfluencers={canApprove}/>
                          </DraggableCard>
                        ))}
                      </div>
                    </DroppableColumn>
                  </div>
                )
              })()}
            </div>
          </div>
          <DragOverlay>
            {activeInf&&(
              <div className="bg-white border border-[#1FAE5B] rounded-lg p-3 shadow-lg rotate-1 w-[min(72vw,220px)] sm:w-[220px] ring-2 ring-[#1FAE5B]/20">
                <div className="font-medium text-sm text-gray-900">{activeInf.influencer}</div>
                <div className="text-xs text-gray-500 mt-0.5">@{activeInf.handle}</div>
                <div className="text-[11px] text-gray-400 mt-1">{activeInf.platform} · {activeInf.followers}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── BULK ACTION TOOLBAR — list view, only with a live selection ── */}
      {view==="list" && selectedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex-wrap">
          <span className="text-xs text-blue-700 font-medium">{selectedCount} selected</span>

          <div className="relative ml-auto sm:ml-0">
            <button
              ref={bulkBtnRef}
              onClick={()=>setShowBulkStageMenu(v=>!v)}
              disabled={bulkBusy}
              aria-haspopup="menu"
              aria-expanded={showBulkStageMenu}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#1FAE5B] text-white rounded-lg hover:bg-[#178a48] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:ring-offset-1"
            >
              {bulkBusy ? (
                <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"/> Moving…</>
              ) : (
                <>Move to Stage <IconChevronDown size={13}/></>
              )}
            </button>
            {showBulkStageMenu && !bulkBusy && (
              <div
                ref={bulkMenuRef}
                role="menu"
                aria-label="Move selected influencers to stage"
                className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-52 py-1"
              >
                {COLUMNS.map(col=>(
                  <button
                    key={col.key}
                    role="menuitem"
                    onClick={()=>handleBulkStageSelect(col.key)}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition"
                  >
                    <span className={`w-2 h-2 rounded-full ${col.color}`}/>
                    {col.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={clearSelection}
            disabled={bulkBusy}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 rounded-lg hover:bg-blue-100 transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
          >
            <IconX size={13}/> Clear Selection
          </button>
        </div>
      )}

      {/* ── LIST ── */}
      {view==="list"&&(
        <div className="bg-white border rounded-xl overflow-hidden">
          {selectedColumnStatus&&selectedColumnInfo&&(
            <div className={`${selectedColumnInfo.color} px-4 py-3 text-white flex items-center justify-between`}>
              <div className="flex items-center gap-2"><IconLayoutList size={20}/><span className="font-semibold">{selectedColumnInfo.title}</span><span className="text-sm bg-white/20 px-2 py-1 rounded">{filteredData.length} influencers</span></div>
              <button onClick={clearColumnFilter} className="text-white hover:bg-white/20 px-2 py-1 rounded transition flex items-center gap-1"><IconX size={16}/> Clear filter</button>
            </div>
          )}
          <div style={{overflowX:"auto"}}>
            <table className="w-full text-sm" style={{borderCollapse:"collapse"}}>
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-10">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      disabled={filteredData.length===0}
                      aria-label={allVisibleSelected ? "Deselect all visible influencers" : "Select all visible influencers"}
                      className="w-4 h-4 rounded accent-[#1FAE5B] cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:ring-offset-1"
                    />
                  </th>
                  {["Influencer","Platform","Handle","Location","Followers","Engagement","Niche","Type","Stage"].map(h=><th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredData.length===0?(
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No influencers found</td></tr>
                ):filteredData.map(inf=>(
                  <tr key={inf.id} className={`border-t hover:bg-gray-50 cursor-pointer transition ${selectedIds.has(inf.id)?"bg-blue-50/60":""}`} onClick={()=>setSelectedInf(inf)}>
                    <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inf.id)}
                        onChange={()=>toggleRowSelection(inf.id)}
                        aria-label={`Select ${inf.influencer}`}
                        className="w-4 h-4 rounded accent-[#1FAE5B] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:ring-offset-1"
                      />
                    </td>
                    <td className="px-4 py-3"><div className="flex items-center gap-3">{inf.profileImageUrl?<img src={inf.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"/>:<div className={`w-8 h-8 rounded-full flex-shrink-0 ${getAvatarColor(inf.influencer)} bg-opacity-20 flex items-center justify-center text-[#0F6B3E] font-semibold text-xs`}>{inf.influencer.charAt(0).toUpperCase()}</div>}<span className="font-medium">{inf.influencer}</span></div></td>
                    <td className="px-4 py-3">{inf.platform||"Instagram"}</td>
                    <td className="px-4 py-3 text-[#0F6B3E] font-medium">@{inf.handle}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1"><IconLocation size={14} className="text-gray-400"/>{inf.location||"—"}</div></td>
                    <td className="px-4 py-3">{inf.followers}</td>
                    <td className="px-4 py-3">{inf.engagementRate||"—"}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">{inf.niche||"—"}</span></td>
                    <td className="px-4 py-3"><CampaignBadge type={inf.campaignType}/></td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center" onClick={e=>e.stopPropagation()}>
                        <StageDropdown
                          value={inf.closedStatus}
                          options={STAGE_DROPDOWN_OPTIONS}
                          onChange={s=>{void handleMove(inf.id, s as ClosedColumn)}}
                          disabled={!canApprove}
                          disabledTitle="Only Owners and Managers can update post status"
                          ariaLabel="Change post tracker stage"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </SubscriptionGate>
  )
}
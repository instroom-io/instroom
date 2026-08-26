// app/dashboard/pipeline/kanban/kanban-board.tsx
// FIXED: Collaboration Type modal now fires BEFORE moving to Deal Agreed
// FIXED: Quick-move buttons simplified to "→ Deal Agreed" + "✕ Not Interested" only
// FIXED: Move to Post Tracker goes directly to For Order Creation (no modal)
// FIXED: For Order Creation and Not Interested cards persist on refresh
// ADDED: Column info tooltips (ⓘ) on all column headers
// ADDED: Niche + Location tag-based multi-select filters

"use client"

import { useState, useEffect, useMemo, useRef, useCallback, memo, type CSSProperties, type ReactNode } from "react"
import ReactDOM from "react-dom"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { useDroppable } from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import {
  IconLayoutKanban,
  IconList,
  IconFilter,
  IconSearch,
  IconLocation,
  IconBrandTwitter,
  IconX,
  IconLayoutList,
  IconChevronDown,
  IconChevronUp,
  IconAlertCircle,
  IconArrowRight,
  IconPackage,
  IconGift,
  IconCash,
  IconLink,
  IconCamera,
  IconShoppingBag,
  IconCoins,
  IconStar,
  IconLoader2,
} from "@tabler/icons-react"

import InfluencerProfileSidebar, {
  type Partner,
  type Campaign,
} from "@/components/InfluencerProfileSidebar"

import { usePipelineData, type PipelineInfluencer } from "@/hooks/usePipelineData"
import { invalidateInfluencerDerivedCaches, pipelineCacheKey } from "@/lib/cache-invalidation"
import { DataSyncStatus } from "@/components/data-sync-status"
import { useBrandCapabilities } from "@/hooks/useBrandCapabilities"
import { BoardSkeleton } from "@/components/shared/skeletons"

// ─── Platform Icons ──────────────────────────────────────────────────────────
export const PLATFORM_ICONS: Record<string, ReactNode> = {
  Instagram: (
    <img src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg" alt="Instagram" className="w-4 h-4" />
  ),
  TikTok: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.89 2.89 2.896 2.896 0 0 1-2.889-2.89 2.896 2.896 0 0 1 2.89-2.889c.302 0 .595.05.872.137V9.257a6.339 6.339 0 0 0-5.053 2.212 6.339 6.339 0 0 0-1.33 5.52 6.34 6.34 0 0 0 5.766 4.731 6.34 6.34 0 0 0 6.34-6.34V8.898a7.756 7.756 0 0 0 4.422 1.393V6.825a4.8 4.8 0 0 1-2.443-.139z" />
    </svg>
  ),
  YouTube: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  Twitter: <IconBrandTwitter size={14} className="text-blue-400" />,
}

// ─── Constants ────────────────────────────────────────────────────────────────
const NICHES    = ["Beauty", "Fitness", "Lifestyle", "Food", "Tech", "Fashion", "Travel"]
const LOCATIONS = ["Philippines", "Singapore", "United States", "Australia", "United Kingdom", "Malaysia", "Indonesia", "Thailand", "Vietnam"]

const NI_REASONS = [
  { r: "Fee too low / unpaid",                   bucket: "hard", color: "#E24B4A" },
  { r: "Brief too scripted",                     bucket: "hard", color: "#E8724A" },
  { r: "Won't allow content reuse",              bucket: "hard", color: "#F4A240" },
  { r: "Working with a competitor",              bucket: "hard", color: "#C97B3A" },
  { r: "Product doesn't fit their brand",        bucket: "hard", color: "#888780" },
  { r: "Wrong audience fit",                     bucket: "hard", color: "#6B7F7A" },
  { r: "Seen bad reviews about us",              bucket: "hard", color: "#A32D2D" },
  { r: "Fully booked",                           bucket: "soft", color: "#2C8EC4" },
  { r: "Temporarily unavailable / can't shoot",  bucket: "soft", color: "#5BAFD4" },
  { r: "Can't ship to their location",           bucket: "soft", color: "#7DC4E4" },
  { r: "Ghosted / no longer active",             bucket: "soft", color: "#B4B2A9" },
  { r: "Rate / deadline too tight",              bucket: "soft", color: "#F4B740" },
  { r: "Others",                                 bucket: "hard", color: "#D3D1C7" },
]

// ─── Collaboration Types ──────────────────────────────────────────────────────
/**
 * How many bulk status writes may be in flight at once.
 *
 * Two, not unbounded: the Prisma pool is capped at connection_limit=3, so a
 * request per selected row queues against three connections and crosses the
 * 10s pool timeout. Two leaves one connection for whatever the user does next.
 */
const BULK_CONCURRENCY = 2

const COLLAB_TYPES = [
  {
    id: "gifting",
    title: "Gifting",
    description: "Product sent, no payment, no commission",
    icon: <IconGift size={20} />,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    hoverColor: "hover:border-purple-400 hover:bg-purple-100",
    selectedColor: "border-purple-500 bg-purple-100 ring-2 ring-purple-500/20",
    dotColor: "bg-purple-500",
  },
  {
    id: "paid",
    title: "Paid",
    description: "Product sent + flat fee",
    icon: <IconCash size={20} />,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    hoverColor: "hover:border-blue-400 hover:bg-blue-100",
    selectedColor: "border-blue-500 bg-blue-100 ring-2 ring-blue-500/20",
    dotColor: "bg-blue-500",
  },
  {
    id: "affiliate",
    title: "Affiliate",
    description: "Product sent + commission link",
    icon: <IconLink size={20} />,
    color: "bg-green-50 text-green-700 border-green-200",
    hoverColor: "hover:border-green-400 hover:bg-green-100",
    selectedColor: "border-green-500 bg-green-100 ring-2 ring-green-500/20",
    dotColor: "bg-green-500",
  },
  {
    id: "ugc",
    title: "UGC",
    description: "Product sent, brand owns content, no post required",
    icon: <IconCamera size={20} />,
    color: "bg-orange-50 text-orange-700 border-orange-200",
    hoverColor: "hover:border-orange-400 hover:bg-orange-100",
    selectedColor: "border-orange-500 bg-orange-100 ring-2 ring-orange-500/20",
    dotColor: "bg-orange-500",
  },
  {
    id: "tiktok-shop",
    title: "TikTok Shop",
    description: "Product sent + in-app shop tagging + commission",
    icon: <IconShoppingBag size={20} />,
    color: "bg-pink-50 text-pink-700 border-pink-200",
    hoverColor: "hover:border-pink-400 hover:bg-pink-100",
    selectedColor: "border-pink-500 bg-pink-100 ring-2 ring-pink-500/20",
    dotColor: "bg-pink-500",
  },
  {
    id: "paid-affiliate",
    title: "Paid + Affiliate",
    description: "Product sent + flat fee + commission",
    icon: <IconCoins size={20} />,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    hoverColor: "hover:border-indigo-400 hover:bg-indigo-100",
    selectedColor: "border-indigo-500 bg-indigo-100 ring-2 ring-indigo-500/20",
    dotColor: "bg-indigo-500",
  },
  {
    id: "ugc-paid",
    title: "UGC + Paid",
    description: "Product sent + flat fee + brand owns content",
    icon: <IconStar size={20} />,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    hoverColor: "hover:border-amber-400 hover:bg-amber-100",
    selectedColor: "border-amber-500 bg-amber-100 ring-2 ring-amber-500/20",
    dotColor: "bg-amber-500",
  },
  {
    id: "tiktok-shop-paid",
    title: "TikTok Shop + Paid",
    description: "TikTok Shop + flat fee on top",
    icon: <IconShoppingBag size={20} />,
    color: "bg-rose-50 text-rose-700 border-rose-200",
    hoverColor: "hover:border-rose-400 hover:bg-rose-100",
    selectedColor: "border-rose-500 bg-rose-100 ring-2 ring-rose-500/20",
    dotColor: "bg-rose-500",
  },
] as const

type CollabType = (typeof COLLAB_TYPES)[number]["id"]

// ─── Column definitions ──────────────────────────────────────────────────────
const columns = [
  { key: "for-outreach",       title: "For Outreach",       color: "bg-yellow-400", status: "For Outreach",       visible: true },
  { key: "contacted",          title: "Contacted",           color: "bg-orange-400", status: "Contacted",          visible: true },
  { key: "in-conversation",    title: "In Conversation",     color: "bg-blue-400",   status: "In Conversation",    visible: true },
  { key: "deal-agreed",        title: "Deal Agreed",         color: "bg-green-500",  status: "Deal Agreed",        visible: true },
  { key: "for-order-creation", title: "For Order Creation",  color: "bg-[#1FAE5B]",  status: "For Order Creation", visible: false },
  { key: "not-interested",     title: "Not Interested",      color: "bg-red-500",    status: "Not Interested",     visible: true },
]

// ─── Column tooltip descriptions ─────────────────────────────────────────────
const COLUMN_INFO: Record<string, { short: string; move?: string; terminal?: boolean }> = {
  "For Outreach": {
    short: "Influencers you've identified and want to contact. No message sent yet — this is your ready-to-contact queue.",
    move:  "Move to Deal Agreed once you've locked terms, or Not Interested to skip them.",
  },
  "Contacted": {
    short: "Initial outreach sent via email, DM, or phone. Waiting for their reply — the ball is in their court.",
    move:  "Move to Deal Agreed when terms are locked, or Not Interested if they decline or go cold.",
  },
  "In Conversation": {
    short: "They replied and you're actively negotiating — rate, deliverables, timeline, or product fit.",
    move:  "Move to Deal Agreed when terms are locked, or Not Interested if negotiations fall apart.",
  },
  "Deal Agreed": {
    short: "Terms confirmed and collaboration type selected. Click 'Move to Post Tracker' to proceed with shipping.",
    move:  "Click the 'Move to Post Tracker' button on the card to proceed.",
  },
  "For Order Creation": {
    short: "Address confirmed — ready to order and ship the product. Cards here also appear in Post Tracker for your fulfilment team.",
    terminal: true,
  },
  "Not Interested": {
    short: "Collaboration didn't happen. Moving here requires a reason: Hard pass (don't contact again) or Soft pass (follow up next campaign).",
    terminal: true,
  },
}

// ─── Column info tooltip component ───────────────────────────────────────────
function ColumnInfoTooltip({ status, variant }: { status: string; variant: "light" | "dark" }) {
  const info = COLUMN_INFO[status]
  if (!info) return null

  const borderColor = variant === "dark" ? "border-white/60" : "border-red-400/60"
  const textColor   = variant === "dark" ? "text-white"      : "text-red-700"

  return (
    <div className="relative group/info flex-shrink-0">
      <span
        className={`text-[10px] font-medium border ${borderColor} ${textColor} rounded-full w-4 h-4 flex items-center justify-center opacity-70 cursor-default select-none hover:opacity-100 transition-opacity`}
      >
        i
      </span>
      {/* Tooltip panel */}
      <div className="absolute top-full right-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-700 leading-relaxed z-[60] hidden group-hover/info:block shadow-lg pointer-events-none">
        <p className="font-semibold text-gray-900 mb-1 text-[11px]">{status}</p>
        <p className="text-gray-600">{info.short}</p>
        {info.move && (
          <p className="mt-1.5 text-gray-400 border-t border-gray-100 pt-1.5">
            <span className="font-medium text-gray-500">Next → </span>{info.move}
          </p>
        )}
        {info.terminal && (
          <p className="mt-1.5 text-[10px] font-medium text-red-500 border-t border-gray-100 pt-1.5 uppercase tracking-wide">
            Terminal — cannot be moved
          </p>
        )}
      </div>
    </div>
  )
}

const isTerminal            = (status: string) => status === "Not Interested" || status === "For Order Creation"
const getStatusFromColumnKey = (key: string)   => columns.find((c) => c.key === key)?.status ?? key

const getStatusColor = (status: string) => {
  const col = columns.find((c) => c.status === status)
  if (!col) return "bg-gray-100 text-gray-700 border-gray-300"
  const map: Record<string, string> = {
    "bg-yellow-400": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "bg-orange-400": "bg-orange-100 text-orange-800 border-orange-300",
    "bg-blue-400":   "bg-blue-100 text-blue-800 border-blue-300",
    "bg-green-500":  "bg-green-100 text-green-800 border-green-300",
    "bg-[#1FAE5B]":  "bg-emerald-100 text-emerald-800 border-emerald-300",
    "bg-red-500":    "bg-red-100 text-red-800 border-red-300",
  }
  return map[col.color] ?? "bg-gray-100 text-gray-700 border-gray-300"
}

const getOptionDotColor = (status: string) => columns.find((c) => c.status === status)?.color ?? "bg-gray-400"
const getPlatformIcon   = (platform?: string): ReactNode => PLATFORM_ICONS[platform ?? ""] || PLATFORM_ICONS.Instagram
const getAvatarColor    = (name: string) => {
  const colors = ["bg-pink-500","bg-purple-500","bg-indigo-500","bg-blue-500","bg-cyan-500","bg-teal-500","bg-green-500","bg-yellow-500","bg-orange-500","bg-red-500","bg-rose-500"]
  return colors[name.charCodeAt(0) % colors.length]
}

// ─── Sequential pipeline: each stage only moves to the NEXT stage + Not Interested ──
// For Outreach    → Contacted (no NI shortcut — see below)
// Contacted       → In Conversation + Not Interested
// In Conversation → Deal Agreed (triggers collab type modal) + Not Interested
// Deal Agreed     → (only Move to Post Tracker button, + Not Interested)
// Terminal stages → nothing
//
// "Not Interested" is a destructive, terminal move, so the card shortcut is
// hidden at For Outreach — nobody has been contacted yet, so there's nothing to
// decline, and a stray click would drop the influencer out of the pipeline. The
// status is still reachable there from the profile drawer, the list-view status
// dropdown and by dragging onto the Not Interested column.
const getNextStages = (currentStatus: string): string[] => {
  if (isTerminal(currentStatus)) return []
  const sequence: Record<string, string> = {
    "For Outreach":    "Contacted",
    "Contacted":       "In Conversation",
    "In Conversation": "Deal Agreed",
  }
  const next = sequence[currentStatus]
  if (!next) return ["Not Interested"] // Deal Agreed: only NI (move to PT is a dedicated button)
  if (currentStatus === "For Outreach") return [next]
  return [next, "Not Interested"]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"]

function influencerToPartner(inf: PipelineInfluencer, brandId?: string): Partner {
  const nameParts = inf.influencer?.split(" ") || [""]
  const firstName = nameParts[0] || inf.handle?.slice(0, 6) || ""
  const lastName  = nameParts.slice(1).join(" ") || ""
  return {
    id:           inf.id as any,
    handle:       inf.handle || "",
    firstName,
    lastName,
    birthday:     "",
    plat:         inf.platform || "Instagram",
    niche:        inf.niche || "",
    gend:         "",
    loc:          inf.location || "",
    tier:         "",
    tierOverride: null,
    onRet:        false,
    retFee:       0,
    defComm:      0,
    commSt:       inf.pipelineStatus || "Pending",
    clicks:       inf.clicks || 0,
    cvr:          inf.clicks > 0 ? (inf.salesCount / inf.clicks) * 100 : 0,
    sales:        inf.salesCount || 0,
    aov:          inf.salesCount > 0 ? inf.gmv / inf.salesCount : 0,
    rev:          inf.gmv || 0,
    fol:          inf.followerCount,
    eng:          parseFloat(inf.engagementRate) || 0,
    avgV:         inf.avgViews ?? 0,
    avg_likes:    inf.avgLikes,
    avg_comments: inf.avgComments,
    avg_views:    inf.avgViews,
    gmv:          inf.gmv || 0,
    affiliate_id: inf.affiliateId,
    ref_code:     inf.refCode,
    coupon:       inf.coupon,
    spark_ads:    inf.sparkAds,
    affiliate_link: inf.affiliateLink,
    added:        inf.createdAt ? new Date(inf.createdAt) : new Date(),
    prods:        [],
    prodCost:     0,
    feesPaid:     inf.agreedRate || 0,
    commPaid:     0,
    totalSpend:   inf.agreedRate || 0,
    roi_val:      0,
    roas_val:     0,
    monthly:      MONTHS.map((m) => ({ month: m, posts: 0, clicks: 0, rev: 0, eng: 0, sales: 0 })),
    ppm:          0,
    hClicks:      0,
    hSales:       0,
    hRev:         0,
    hCVR:         0,
    hPosts:       0,
    email:              inf.email || null,
    brandId:            brandId,
    brandInfluencerId:  inf.id,
    collabType:         inf.collabType,
  }
}

// ─── Tag Multi-Select ─────────────────────────────────────────────────────────
interface TagSelectProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  colorClass?: string
  /** "wrap" flows chips in a row; "grid" keeps them in even columns so a long
   *  option list doesn't read as one crowded block. */
  layout?: "wrap" | "grid"
}

function TagSelect({ label, options, selected, onChange, colorClass = "bg-[#1FAE5B]/10 text-[#0F6B3E] border-[#1FAE5B]/30", layout = "wrap" }: TagSelectProps) {
  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[10px] text-gray-400 hover:text-gray-600 transition underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </div>
      <div className={layout === "grid" ? "grid grid-cols-2 sm:grid-cols-3 gap-2" : "flex flex-wrap gap-1.5"}>
        {options.map((option) => {
          const isSelected = selected.includes(option)
          return (
            <button
              key={option}
              onClick={() => toggle(option)}
              aria-pressed={isSelected}
              className={`rounded-full text-xs border transition-all font-medium focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:ring-offset-1 ${
                layout === "grid"
                  ? "h-8 px-2 flex items-center justify-center text-center min-w-0"
                  : "px-2.5 py-1"
              } ${
                isSelected
                  ? `${colorClass} border-transparent`
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
              }`}
            >
              {isSelected && (
                <span className="mr-1 text-[9px] flex-shrink-0">✓</span>
              )}
              <span className={layout === "grid" ? "truncate" : ""}>{option}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Searchable Multi-Select ──────────────────────────────────────────────────
// Renders as a single dropdown box (same shape as the Post Tracker's Location /
// Niche selects) but keeps the pipeline's existing multi-select semantics, and
// adds a type-ahead so long option lists stay usable.
function SearchableMultiSelect({ label, options, selected, onChange, allLabel }: {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  allLabel: string
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState("")
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const matches = options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
  const summary = selected.length === 0 ? allLabel : selected.length === 1 ? selected[0] : `${selected.length} selected`
  const toggle  = (option: string) =>
    onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option])

  return (
    <div className="flex flex-col gap-1" ref={wrapRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500">{label}</label>
        {selected.length > 0 && (
          <button onClick={() => onChange([])} className="text-[10px] text-gray-400 hover:text-gray-600 transition underline underline-offset-2">Clear</button>
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setQuery("") }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] cursor-pointer flex items-center justify-between gap-1 text-left ${
            selected.length > 0 ? "border-[#1FAE5B]/40 text-gray-800" : "border-gray-200 text-gray-500"
          }`}
        >
          <span className="truncate">{summary}</span>
          <IconChevronDown size={14} className={`flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div role="listbox" aria-label={label} className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-[#1FAE5B]"
              />
            </div>
            <div className="max-h-44 overflow-y-auto py-1">
              {matches.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">No matches</p>
              ) : matches.map((option) => {
                const isSelected = selected.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(option)}
                    className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition"
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 text-[9px] ${
                      isSelected ? "bg-[#1FAE5B] border-[#1FAE5B] text-white" : "border-gray-300"
                    }`}>
                      {isSelected && "✓"}
                    </span>
                    <span className="truncate text-gray-700">{option}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Not Interested Modal ─────────────────────────────────────────────────────
interface NIModalProps {
  influencer: PipelineInfluencer
  onConfirm: (reason: string) => void
  onCancel: () => void
  /** Set when the modal drives a bulk move — the single-influencer card is
   *  swapped for a "N influencers" summary and one reason applies to all. */
  bulkCount?: number
}

function NotInterestedModal({ influencer, onConfirm, onCancel, bulkCount }: NIModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const hardReasons = NI_REASONS.filter((r) => r.bucket === "hard")
  const softReasons = NI_REASONS.filter((r) => r.bucket === "soft")
  const initials = influencer.influencer.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const selected = NI_REASONS.find((r) => r.r === selectedReason)

  // Same shell, padding rhythm and footer as the Collaboration Type ("Deal
  // Agreed") modal; the card scrolls when the two reason columns run long.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-[760px] max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Mark as not interested</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {bulkCount
                ? `Select the reason to apply to all ${bulkCount} selected influencers.`
                : "Select the reason why this influencer declined or is not moving forward."}
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition ml-4 mt-0.5"><IconX size={18} /></button>
        </div>

        {/* Influencer Info */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2">
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-xl px-3 sm:px-4 py-3 border border-gray-100">
            {bulkCount ? (
              <>
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-semibold text-sm">{bulkCount}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{bulkCount} influencers selected</p>
                  <p className="text-xs text-gray-500">The reason below applies to all of them</p>
                </div>
              </>
            ) : (
              <>
                {influencer.profileImageUrl ? (
                  <img src={influencer.profileImageUrl} alt={influencer.influencer} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-semibold text-sm">{initials}</div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{influencer.influencer}</p>
                  <p className="text-xs text-gray-500">{influencer.instagramHandle}</p>
                </div>
              </>
            )}
            {selected && (
              <div className="ml-auto text-right">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Selected reason</p>
                <div className="flex items-center justify-end gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: selected.color }} />
                  <span className="text-sm font-semibold text-gray-900">{selected.r}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {selected.bucket === "soft"
                    ? "Can be re-approached in a future campaign"
                    : "Should not be contacted again soon"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reasons */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Reason</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-700">Hard pass</span>
                <span className="text-[10px] text-gray-400">&mdash; don&apos;t reach out soon</span>
              </div>
              <div className="flex flex-col gap-2">
                {hardReasons.map((reason) => (
                  <button key={reason.r} onClick={() => setSelectedReason(reason.r)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all w-full ${selectedReason === reason.r ? "border-red-400 bg-red-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"}`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: reason.color }} />
                    <span className="text-sm text-gray-700 flex-1 leading-snug">{reason.r}</span>
                    {selectedReason === reason.r && (
                      <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Soft pass</span>
                <span className="text-[10px] text-gray-400">&mdash; follow up next campaign</span>
              </div>
              <div className="flex flex-col gap-2">
                {softReasons.map((reason) => (
                  <button key={reason.r} onClick={() => setSelectedReason(reason.r)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all w-full ${selectedReason === reason.r ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"}`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: reason.color }} />
                    <span className="text-sm text-gray-700 flex-1 leading-snug">{reason.r}</span>
                    {selectedReason === reason.r && (
                      <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer — caption on the left, actions on the right */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <span className="text-[11px] text-gray-400">
            This marks the influencer as Not Interested and removes them from the active pipeline
          </span>
          <div className="flex items-center justify-end gap-2">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition bg-white">Cancel</button>
            <button onClick={() => selectedReason && onConfirm(selectedReason)} disabled={!selectedReason}
              className="px-4 sm:px-6 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Collaboration Type Modal ─────────────────────────────────────────────────
// Now fires when moving TO "Deal Agreed" — user picks collab type first, THEN it moves
interface CollabTypeModalProps {
  influencer: PipelineInfluencer
  onConfirm: (collabType: CollabType) => void
  onCancel: () => void
  /** Set when the modal drives a bulk move — one collab type applies to all. */
  bulkCount?: number
}

function CollabTypeModal({ influencer, onConfirm, onCancel, bulkCount }: CollabTypeModalProps) {
  const [selectedType, setSelectedType] = useState<CollabType | null>(null)
  const initials = influencer.influencer.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const selectedCollab = COLLAB_TYPES.find((c) => c.id === selectedType)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-[760px] max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Select Collaboration Type</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {bulkCount
                ? `Choose the collaboration type to apply to all ${bulkCount} selected influencers and move them to Post Tracker.`
                : "Choose the collaboration type to mark this deal agreed and move it to Post Tracker."}
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition ml-4 mt-0.5">
            <IconX size={18} />
          </button>
        </div>

        {/* Influencer Info */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2">
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-xl px-3 sm:px-4 py-3 border border-gray-100">
            {bulkCount ? (
              <>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm">{bulkCount}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{bulkCount} influencers selected</p>
                  <p className="text-xs text-gray-500">The collaboration type below applies to all of them</p>
                </div>
              </>
            ) : (
              <>
                {influencer.profileImageUrl ? (
                  <img src={influencer.profileImageUrl} alt={influencer.influencer} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm">{initials}</div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{influencer.influencer}</p>
                  <p className="text-xs text-gray-500">{influencer.instagramHandle}</p>
                </div>
              </>
            )}
            {selectedCollab && (
              <div className="ml-auto text-right">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Selected Collaboration</p>
                <div className="flex items-center justify-end gap-2 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${selectedCollab.dotColor}`} />
                  <span className="text-sm font-semibold text-gray-900">{selectedCollab.title}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collaboration Types Grid */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Collaboration Type</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {COLLAB_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  selectedType === type.id
                    ? type.selectedColor
                    : `${type.color} ${type.hoverColor}`
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  selectedType === type.id ? "bg-white" : "bg-white/70"
                }`}>
                  {type.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{type.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{type.description}</p>
                </div>
                {selectedType === type.id && (
                  <div className={`w-2.5 h-2.5 rounded-full ${type.dotColor} flex-shrink-0 mt-1.5`} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <p className="text-[11px] text-gray-400">
            This marks the deal agreed and moves the influencer to Post Tracker
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition bg-white"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedType && onConfirm(selectedType)}
              disabled={!selectedType}
              className="px-4 sm:px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
            >
              <IconArrowRight size={14} />
              Move to Post Tracker
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Pipeline Card ────────────────────────────────────────────────────────────
// Off-screen list items are skipped by the browser's own layout and paint pass
// (`content-visibility: auto`), with `contain-intrinsic-size` standing in for
// their height so the scrollbar geometry stays honest.
//
// Containment rather than JS windowing, deliberately: every item stays in the
// DOM, so dnd-kit keeps its drag sources and drop targets, find-in-page still
// works, and no interaction, measurement or markup changes — only the work the
// browser does for items nobody is looking at.
const OFFSCREEN_SKIP: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "auto 168px",
}

function PipelineCardBase({ influencer, onOpenSidebar, onStatusChange, canApproveInfluencers }: {
  influencer: PipelineInfluencer
  onOpenSidebar: (inf: PipelineInfluencer) => void
  onStatusChange: (id: string, newStatus: string) => void
  canApproveInfluencers: boolean
}) {
  // See getNextStages: [next stage] at For Outreach, [next stage, "Not Interested"]
  // for the middle stages, ["Not Interested"] at Deal Agreed, [] when terminal
  const nextStages = getNextStages(influencer.pipelineStatus)
  const terminal   = isTerminal(influencer.pipelineStatus)

  return (
    <div style={OFFSCREEN_SKIP} className={`bg-white border rounded-lg p-3 hover:shadow-md transition-shadow ${
      influencer.pipelineStatus === "Not Interested"      ? "border-red-100 bg-red-50/30"     :
      influencer.pipelineStatus === "For Order Creation"  ? "border-emerald-100 bg-emerald-50/30" :
      "border-gray-200"
    }`}>
      <div className="cursor-pointer" onClick={() => onOpenSidebar(influencer)}>
        <div className="flex flex-col text-sm mb-2">
          <span className="font-medium text-gray-900">{influencer.influencer}</span>
          <span className="text-xs text-gray-500">@{influencer.handle}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
          <span className="flex items-center gap-1">{getPlatformIcon(influencer.platform)}{influencer.platform || "Instagram"}</span>
          <span>•</span>
          <span className="flex items-center gap-0.5">
            <IconLocation size={11} />{influencer.location || "—"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{influencer.followers || "—"} followers</span>
          <span>{influencer.engagementRate || "—"}% eng</span>
        </div>

        {/* NI reason pill */}
        {influencer.pipelineStatus === "Not Interested" && influencer.niReason && (
          <div className="mt-2 text-[10px] text-red-500 bg-red-50 rounded-full px-2.5 py-1 inline-block font-medium">
            {influencer.niReason}
          </div>
        )}

        {/* ── Status row ──────────────────────────────────────────────────────
            "In Post Tracker" and the collaboration/payment type (Paid, Gifting,
            Affiliate, UGC — whatever the Pipeline's Deal Agreed step stored on
            this row) share ONE row now. They used to be two stacked blocks,
            each with its own mt-2, so a card that had both was 2 rows taller
            than a card that had one. Both badges keep their own styling; the
            row's `mt-2` and `gap-1.5` replace their individual margins, and it
            renders only when at least one of them has something to show. */}
        {(() => {
          const inPostTracker = influencer.pipelineStatus === "For Order Creation"
          // Deal Agreed now cascades straight to For Order Creation on confirm,
          // but legacy rows can still rest at Deal Agreed.
          const collab =
            (influencer.pipelineStatus === "For Order Creation" || influencer.pipelineStatus === "Deal Agreed") &&
            influencer.collabType
              ? COLLAB_TYPES.find((c) => c.id === influencer.collabType)
              : undefined

          if (!inPostTracker && !collab) return null

          return (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {inPostTracker && (
                <span className="text-[10px] text-green-600 bg-green-50 rounded-full px-2.5 py-1 inline-flex items-center gap-1 font-medium">
                  <IconPackage size={10} />
                  In Post Tracker
                </span>
              )}
              {collab && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${collab.color.split(" ")[0]} ${collab.color.split(" ")[1]}`}>
                  {collab.icon}
                  {collab.title}
                </span>
              )}
            </div>
          )
        })()}
      </div>

      {/* Quick-move buttons — only for non-terminal cards */}
      {nextStages.length > 0 && !terminal && (
        <div className="flex gap-1.5 mt-3 pt-2 border-t border-gray-100 flex-nowrap">
          {nextStages.map((stage) => (
            <button key={stage}
              onClick={(e) => { e.stopPropagation(); if (!canApproveInfluencers) return; onStatusChange(influencer.id, stage) }}
              disabled={!canApproveInfluencers}
              title={!canApproveInfluencers ? "Only Owners and Managers can approve influencers" : undefined}
              className={`text-[11px] font-medium px-2 py-1 rounded-full border transition flex items-center gap-1 min-w-0 flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed ${
                stage === "Not Interested"
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                  : "bg-[#EAF7EF] text-[#0F6B3E] border-[#bfe5cf] hover:bg-[#d7f0e0]"
              }`}>
              {stage === "Not Interested" ? <IconX size={11} className="flex-shrink-0" /> : <IconArrowRight size={11} className="flex-shrink-0" />}
              <span className="truncate">{stage}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Compared on the fields a card actually renders. Without this, one keystroke in
 * the search box re-rendered every card in every column.
 */
const PipelineCard = memo(PipelineCardBase, (prev, next) =>
  prev.influencer === next.influencer &&
  prev.canApproveInfluencers === next.canApproveInfluencers &&
  prev.onOpenSidebar === next.onOpenSidebar &&
  prev.onStatusChange === next.onStatusChange
)

// ─── Portal StatusDropdown ────────────────────────────────────────────────────
function StatusDropdown({ currentStatus, onStatusChange, canApproveInfluencers }: { currentStatus: string; onStatusChange: (s: string) => void; canApproveInfluencers: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const dropdownHeight = 300, dropdownWidth = 200
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceRight = window.innerWidth - rect.left
    const top  = spaceBelow >= dropdownHeight ? rect.bottom + 4 : rect.top - dropdownHeight - 4
    const left = spaceRight >= dropdownWidth  ? rect.left       : rect.right - dropdownWidth
    // Never narrower than the trigger, so the open menu lines up with it
    setDropdownStyle({ position: "fixed", top: Math.max(8, top), left: Math.max(8, left), zIndex: 9999, minWidth: Math.max(dropdownWidth, rect.width) })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        const portalEl = document.getElementById("status-dropdown-portal")
        if (!portalEl || !portalEl.contains(target)) setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [isOpen])

  const visibleColumns = columns.filter((c) => c.visible)

  const dropdown = isOpen ? (
    <div id="status-dropdown-portal" style={dropdownStyle} className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
      {visibleColumns.map((col, index) => (
        <div key={col.status}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onStatusChange(col.status); setIsOpen(false) }}
          className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${index !== visibleColumns.length - 1 ? "border-b border-gray-100" : ""} ${currentStatus === col.status ? "bg-gray-50 font-semibold" : ""}`}>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getOptionDotColor(col.status)}`} />
          <span className="text-gray-700 whitespace-nowrap">{col.title}</span>
        </div>
      ))}
    </div>
  ) : null

  return (
    <>
      {/* Fixed width (sized to the longest status, "For Order Creation") so
          every row's dropdown lines up; `max-w-full` lets it shrink inside a
          narrow cell, where the label truncates rather than wrapping. */}
      <button ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); if (!canApproveInfluencers) return; setIsOpen((p) => !p) }}
        disabled={!canApproveInfluencers}
        title={!canApproveInfluencers ? "Only Owners and Managers can approve influencers" : currentStatus}
        className={`inline-flex items-center justify-between gap-1 w-[150px] max-w-full px-2 py-1 rounded text-xs font-medium text-left whitespace-nowrap border ${getStatusColor(currentStatus)} ${!canApproveInfluencers ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
        <span className="truncate">{currentStatus}</span>
        <IconChevronDown size={12} className={`transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {mounted && dropdown && typeof document !== "undefined"
        ? ReactDOM.createPortal(dropdown, document.body)
        : null}
    </>
  )
}

// ─── Droppable / Draggable ────────────────────────────────────────────────────
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const isExit = id === "not-interested" || id === "for-order-creation"
  return (
    <div ref={setNodeRef}
      style={{ scrollSnapAlign: "start" }}
      className={`flex flex-col gap-3 w-[min(78vw,240px)] sm:w-[240px] flex-shrink-0 transition-all rounded-lg ${
        isOver ? (isExit ? "bg-red-50" : "bg-gray-50") : ""
      }`}>
      {children}
    </div>
  )
}

function DraggableCard({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      title={disabled ? "Only Owners and Managers can approve influencers" : undefined}
      className={`${disabled ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "opacity-50" : ""}`}>
      {children}
    </div>
  )
}

// ─── Filter state type ────────────────────────────────────────────────────────
// Name/handle filtering lives in the global search bar only — the panel holds
// filters that search can't express.
interface FilterState {
  locations: string[]
  niches:    string[]
  stages:    string[]
  approvals: string[]
}

const EMPTY_FILTERS: FilterState = {
  locations: [],
  niches:    [],
  stages:    [],
  approvals: [],
}

// Every stage a row can hold, including the hidden "For Order Creation" column
// so list-view rows in that stage are still filterable.
const STAGE_OPTIONS   = columns.map((c) => c.status)
const APPROVAL_OPTIONS = ["Approved", "Pending", "Declined"]

// ─── Main Page ────────────────────────────────────────────────────────────────
interface PipelinePageProps { brandId?: string }

export default function PipelinePage({ brandId }: PipelinePageProps) {
  const [view,                 setView]                 = useState<"Board" | "list">("Board")
  const [search,               setSearch]               = useState("")
  const [showSuccessMessage,   setShowSuccessMessage]   = useState<string | null>(null)
  // Every message used to render in the green success colour, including
  // "Failed to move …" and the permission refusals — a failure that looks like
  // a success. Same split the Post Tracker and Influencer List docks use:
  // green by default, red for an actual failure.
  const [toastType,            setToastType]            = useState<"success" | "error">("success")
  const [activeId,             setActiveId]             = useState<string | null>(null)
  const [sidebarOpen,          setSidebarOpen]          = useState(false)
  const [selectedPartner,      setSelectedPartner]      = useState<Partner | null>(null)
  const [selectedColumnStatus, setSelectedColumnStatus] = useState<string | null>(null)
  const [showFilterPanel,      setShowFilterPanel]      = useState(false)
  const [filters,              setFilters]              = useState<FilterState>(EMPTY_FILTERS)
  const [niModalInfluencer,    setNiModalInfluencer]    = useState<PipelineInfluencer | null>(null)
  const [pendingNiId,          setPendingNiId]          = useState<string | null>(null)
  const [sortOrder,            setSortOrder]            = useState<"newest"|"oldest">("newest")

  // ── Collab type modal — fires when moving TO "Deal Agreed" ──
  const [collabModalInfluencer, setCollabModalInfluencer] = useState<PipelineInfluencer | null>(null)
  const [pendingCollabId,       setPendingCollabId]       = useState<string | null>(null)

  // ── Bulk selection (list view) ──────────────────────────────────────────────
  // Selection lives on brandInfluencer ids, not row indexes, so it survives
  // re-sorts, filter changes and scrolling. Rows hidden by a filter stay
  // selected — the toolbar count always reflects the true selection.
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set())
  const [showBulkStageMenu, setShowBulkStageMenu] = useState(false)
  const [bulkBusy,          setBulkBusy]          = useState(false)
  const [bulkNiOpen,        setBulkNiOpen]        = useState(false)
  const [bulkCollabOpen,    setBulkCollabOpen]    = useState(false)
  const bulkMenuRef  = useRef<HTMLDivElement>(null)
  const bulkBtnRef   = useRef<HTMLButtonElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, error, updateStatus, isSaving, refetch } = usePipelineData(brandId)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { canApproveInfluencers, loading: capabilitiesLoading } = useBrandCapabilities(brandId)
  const canApprove = !capabilitiesLoading && canApproveInfluencers

  const toast = useCallback((msg: string, duration = 3000, type: "success" | "error" = "success") => {
    setToastType(type)
    setShowSuccessMessage(msg)
    setTimeout(() => setShowSuccessMessage(null), duration)
  }, [])

  // ── Collab type confirmed → deal agreed AND straight into Post Tracker ────
  // Confirming a Collaboration Type is the single action that both marks the
  // deal agreed and moves the influencer into Post Tracker with its default
  // initial status — no separate "Move to Post Tracker" click needed anymore.
  const handleCollabTypeConfirm = async (collabType: CollabType) => {
    if (!pendingCollabId || !collabModalInfluencer) return
    const success = await updateStatus(pendingCollabId, "Deal Agreed", { collaborationType: collabType })
    const collabName = COLLAB_TYPES.find((c) => c.id === collabType)?.title ?? collabType
    toast(
      success
        ? `${collabModalInfluencer.influencer} moved to Post Tracker · ${collabName} ✓`
        : `Failed to move ${collabModalInfluencer.influencer}`,
      3000,
      success ? "success" : "error"
    )
    setCollabModalInfluencer(null)
    setPendingCollabId(null)
  }

  // ── Collab type edited from the Influencer Profile sidebar ────────────────
  // Keeps Pipeline + Profile + Post Tracker in sync no matter which surface
  // the edit was made from — same PATCH, same persisted DB field.
  const handleCollabTypeChangeFromSidebar = async (biId: string, newType: string) => {
    const influencer = data.find((i) => i.id === biId)
    if (!influencer) return
    const success = await updateStatus(biId, influencer.pipelineStatus, { collaborationType: newType })
    if (success) {
      setSelectedPartner((prev) => (prev ? { ...prev, collabType: newType } : prev))
    }
    toast(success ? "Collaboration type updated ✓" : "Failed to update collaboration type", 3000, success ? "success" : "error")
  }

  const handleCollabTypeCancel = () => {
    setCollabModalInfluencer(null)
    setPendingCollabId(null)
  }

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string)

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const draggedId = active.id as string
    const destKey   = over.id as string
    const dragged   = data.find((item) => item.id === draggedId)
    if (!dragged) return

    if (!canApprove) {
      toast("Only Owners and Managers can approve influencers", 2500, "error")
      return
    }

    const newStatus = getStatusFromColumnKey(destKey)
    if (dragged.pipelineStatus === newStatus) return

    if (isTerminal(dragged.pipelineStatus)) {
      toast(`Cannot move from "${dragged.pipelineStatus}"`, 2000, "error")
      return
    }

    // Drag to Deal Agreed (or directly to the hidden For Order Creation column)
    // → open the collab type modal first. Confirming it both agrees the deal
    // and cascades straight into Post Tracker — there's no manual move step.
    if (newStatus === "Deal Agreed" || newStatus === "For Order Creation") {
      setPendingCollabId(draggedId)
      setCollabModalInfluencer(dragged)
      return
    }

    if (newStatus === "Not Interested") {
      setPendingNiId(draggedId)
      setNiModalInfluencer(dragged)
      return
    }

    const success = await updateStatus(draggedId, newStatus)
    const colTitle = columns.find((col) => col.key === destKey)?.title
    toast(success ? `${dragged.influencer} moved to ${colTitle}` : `Failed to move ${dragged.influencer}`, 3000, success ? "success" : "error")
  }

  const handleNiConfirm = async (reason: string) => {
    if (!pendingNiId || !niModalInfluencer) return
    const success = await updateStatus(pendingNiId, "Not Interested", { niReason: reason })
    toast(success
      ? `${niModalInfluencer.influencer} marked as Not Interested · ${reason}`
      : `Failed to update ${niModalInfluencer.influencer}`, 3000, success ? "success" : "error")
    setNiModalInfluencer(null)
    setPendingNiId(null)
  }

  const handleNiCancel = () => { setNiModalInfluencer(null); setPendingNiId(null) }

  // ── Status update from card buttons / list dropdown ───────────────────────
  const handleStatusUpdate = useCallback(async (id: string, newStatus: string) => {
    if (!canApprove) {
      toast("Only Owners and Managers can approve influencers", 2500, "error")
      return
    }
    if (newStatus === "Not Interested") {
      const influencer = data.find((i) => i.id === id)
      if (influencer) { setPendingNiId(id); setNiModalInfluencer(influencer) }
      return
    }
    // Moving to Deal Agreed → show collab type modal first
    if (newStatus === "Deal Agreed") {
      const influencer = data.find((i) => i.id === id)
      if (influencer) {
        setPendingCollabId(id)
        setCollabModalInfluencer(influencer)
      }
      return
    }
    const influencer = data.find((i) => i.id === id)
    const success = await updateStatus(id, newStatus)
    toast(success
      ? `${influencer?.influencer} moved to ${newStatus}`
      : `Failed to move ${influencer?.influencer}`, 2000, success ? "success" : "error")
  }, [data, canApprove, updateStatus, toast])

  // ── Bulk selection helpers ────────────────────────────────────────────────
  const clearSelection = () => setSelectedIds(new Set())

  const toggleRowSelection = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // ── Bulk stage move ───────────────────────────────────────────────────────
  // Reuses the exact same per-row `updateStatus` the single-row dropdown and
  // drag-and-drop use — no new endpoint, no duplicated status logic.
  //
  // Concurrency is capped rather than unbounded OR strictly serial:
  //
  //   * unbounded would put one request per selected row into a Prisma pool
  //     capped at connection_limit=3, which is what produced P2024 timeouts
  //     (see lib/dashboard-prefetch.ts for the measurements);
  //   * strictly serial was the previous behaviour, and its stated reason —
  //     that a failure rolls back a full-list snapshot — is no longer true.
  //     `updateStatus` restores only its own row now, so overlapping calls can
  //     no longer undo each other's successful writes.
  //
  // Two at a time leaves a connection free for whatever the user does next.
  const runBulkUpdate = async (
    newStatus: string,
    extra?: { niReason?: string; collaborationType?: string }
  ) => {
    const selected = data.filter((d) => selectedIds.has(d.id))
    // Same guards the single-row paths apply: terminal rows can't move, and
    // rows already in the target stage are a no-op.
    const targets = selected.filter((d) => !isTerminal(d.pipelineStatus) && d.pipelineStatus !== newStatus)
    const skipped = selected.length - targets.length
    const stageTitle = columns.find((c) => c.status === newStatus)?.title ?? newStatus

    if (targets.length === 0) {
      toast(`Nothing to move — the selected influencers are already in ${stageTitle} or can't be moved`, 3500, "error")
      return
    }

    setBulkBusy(true)
    const failedIds: string[] = []
    let moved = 0

    // Each worker takes the next index, so `BULK_CONCURRENCY` requests are in
    // flight at most, no matter how many rows are selected.
    let cursor = 0
    const worker = async () => {
      while (cursor < targets.length) {
        const target = targets[cursor++]
        // Derived views are marked stale ONCE after the run, not per row.
        const success = await updateStatus(target.id, newStatus, {
          ...extra,
          deferDerivedInvalidation: true,
        })
        if (success) moved += 1
        else failedIds.push(target.id)
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(BULK_CONCURRENCY, targets.length) }, worker)
    )

    // One invalidation for the whole run. The board's own entry is excluded —
    // it is already correct from the optimistic writes above.
    if (moved > 0 && brandId) {
      invalidateInfluencerDerivedCaches(brandId, [pipelineCacheKey(brandId)])
    }
    setBulkBusy(false)

    // Keep only the failures selected so the user can retry them directly;
    // everything that succeeded stays updated either way.
    setSelectedIds(new Set(failedIds))

    const skippedNote = skipped > 0 ? ` · ${skipped} skipped` : ""
    if (failedIds.length === 0) {
      toast(`${moved} influencer${moved === 1 ? "" : "s"} moved to ${stageTitle} ✓${skippedNote}`, 3500)
    } else {
      // A partial failure is still a failure — the user has rows to retry.
      toast(
        `${moved} moved to ${stageTitle}, ${failedIds.length} failed${skippedNote} — the failed ones are still selected`,
        5000,
        "error"
      )
    }
  }

  const handleBulkStageSelect = (newStatus: string) => {
    setShowBulkStageMenu(false)
    if (!canApprove) {
      toast("Only Owners and Managers can approve influencers", 2500, "error")
      return
    }
    if (selectedIds.size === 0) return
    // These two stages need extra input before they can be written; reuse the
    // existing modals, collecting one answer that applies to the whole batch.
    if (newStatus === "Not Interested") { setBulkNiOpen(true); return }
    if (newStatus === "Deal Agreed")    { setBulkCollabOpen(true); return }
    void runBulkUpdate(newStatus)
  }

  const handleBulkNiConfirm = async (reason: string) => {
    setBulkNiOpen(false)
    await runBulkUpdate("Not Interested", { niReason: reason })
  }

  const handleBulkCollabConfirm = async (collabType: CollabType) => {
    setBulkCollabOpen(false)
    await runBulkUpdate("Deal Agreed", { collaborationType: collabType })
  }

  const openSidebar = useCallback((inf: PipelineInfluencer) => {
    setSelectedPartner(influencerToPartner(inf, brandId))
    setSidebarOpen(true)
  }, [brandId])

  const handleColumnClick = (column: typeof columns[0]) => {
    setSelectedColumnStatus(column.status)
    setView("list")
    toast(`Showing "${column.title}"`, 2000)
  }

  const clearColumnFilter = () => {
    setSelectedColumnStatus(null)
    toast("Showing all influencers", 2000)
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  // Memoized so this filter/sort pipeline only recomputes when the inputs it
  // actually depends on change — not on every render (e.g. showFilterPanel
  // toggling, drag hover, tooltip hover).
  const filteredData = useMemo(() => {
    let result = data
      .filter((d) =>
        d.influencer.toLowerCase().includes(search.toLowerCase()) ||
        d.instagramHandle.toLowerCase().includes(search.toLowerCase())
      )
      .filter((d) => selectedColumnStatus ? d.pipelineStatus === selectedColumnStatus : true)

    if (filters.locations.length > 0) result = result.filter((p) => filters.locations.includes(p.location ?? ""))
    if (filters.niches.length > 0)    result = result.filter((p) => filters.niches.includes(p.niche ?? ""))
    if (filters.stages.length > 0)    result = result.filter((p) => filters.stages.includes(p.pipelineStatus))
    // A row with no approval decision yet reads as Pending
    if (filters.approvals.length > 0) result = result.filter((p) => filters.approvals.includes(p.approvalStatus ?? "Pending"))
    result = [...result].sort((a, b) => {
      const da = new Date(a.createdAt ?? 0).getTime()
      const db = new Date(b.createdAt ?? 0).getTime()
      return sortOrder === "newest" ? db - da : da - db
    })
    return result
  }, [data, search, filters, selectedColumnStatus, sortOrder])

  // ── Bulk selection derived state ──────────────────────────────────────────
  // Derived, not stored: ids that no longer exist in the dataset (e.g. after a
  // refetch) are ignored rather than pruned in an effect, so the count can
  // never claim more than is actually selectable.
  const selectedInfluencers = useMemo(
    () => data.filter((d) => selectedIds.has(d.id)),
    [data, selectedIds]
  )
  const selectedCount        = selectedInfluencers.length
  const allVisibleSelected   = filteredData.length > 0 && filteredData.every((d) => selectedIds.has(d.id))
  const someVisibleSelected  = filteredData.some((d) => selectedIds.has(d.id))

  // Header checkbox shows a partial state when only some visible rows are selected
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected
  }, [someVisibleSelected, allVisibleSelected])

  const toggleSelectAllVisible = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) filteredData.forEach((d) => next.delete(d.id))
      else filteredData.forEach((d) => next.add(d.id))
      return next
    })

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

  const activeFilterCount =
    filters.locations.length +
    filters.niches.length +
    filters.stages.length +
    filters.approvals.length +
    (search ? 1 : 0) +
    (selectedColumnStatus ? 1 : 0)

  const hasActiveFilters   = activeFilterCount > 0
  const activeInfluencer   = activeId ? data.find((item) => item.id === activeId) : null
  const selectedColumnInfo = selectedColumnStatus ? columns.find((col) => col.status === selectedColumnStatus) : null

  // Confirming a Collaboration Type sends the row straight to Post Tracker's
  // entry stage ("For Order Creation"), whose column is hidden on this board —
  // so the card vanished and Deal Agreed read as empty even though the deal had
  // just been closed. Display-only: the row keeps rendering under Deal Agreed,
  // with its collaboration details, while the persisted stage (and Post Tracker)
  // stay exactly as they are. One record, two views.
  const getItemsByColumn = (columnKey: string) => {
    const status = getStatusFromColumnKey(columnKey)
    if (status === "Deal Agreed") {
      return filteredData.filter(
        (item) => item.pipelineStatus === "Deal Agreed" || item.pipelineStatus === "For Order Creation"
      )
    }
    return filteredData.filter((item) => item.pipelineStatus === status)
  }

  const renderCard = (inf: PipelineInfluencer) => (
    <PipelineCard
      influencer={inf}
      onOpenSidebar={openSidebar}
      onStatusChange={handleStatusUpdate}
      canApproveInfluencers={canApprove}
    />
  )

  const visibleColumns = columns.filter((c) => c.visible)

  if (isLoading) return <BoardSkeleton columns={visibleColumns.length || 4} label="Fetching data..." />

  if (error) return (
    <div className="flex flex-col items-center justify-center gap-3 p-12">
      <IconAlertCircle size={32} className="text-red-500" />
      <span className="text-sm text-red-600">{error}</span>
      <button onClick={() => refetch()} className="px-4 py-2 bg-[#1FAE5B] text-white rounded-lg text-sm hover:bg-[#178a48] transition">Retry</button>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-6">
      {niModalInfluencer && (
        <NotInterestedModal influencer={niModalInfluencer} onConfirm={handleNiConfirm} onCancel={handleNiCancel} />
      )}

      {/* Collab type modal — fires before Deal Agreed */}
      {collabModalInfluencer && (
        <CollabTypeModal
          influencer={collabModalInfluencer}
          onConfirm={handleCollabTypeConfirm}
          onCancel={handleCollabTypeCancel}
        />
      )}

      {/* Bulk variants of the same modals — one answer applied to the batch */}
      {bulkNiOpen && selectedCount > 0 && (
        <NotInterestedModal
          influencer={data.find((d) => selectedIds.has(d.id))!}
          bulkCount={selectedCount}
          onConfirm={handleBulkNiConfirm}
          onCancel={() => setBulkNiOpen(false)}
        />
      )}
      {bulkCollabOpen && selectedCount > 0 && (
        <CollabTypeModal
          influencer={data.find((d) => selectedIds.has(d.id))!}
          bulkCount={selectedCount}
          onConfirm={handleBulkCollabConfirm}
          onCancel={() => setBulkCollabOpen(false)}
        />
      )}

      {/* A subtle "Saving" pill in the bottom-right corner while a status write
          is actually in flight, out of the way of the board. The outcome message
          lands in the top dock below. */}
      <div className="notice-dock">
        {isSaving && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900/90 text-white text-xs font-medium shadow-lg animate-in fade-in">
            <IconLoader2 size={12} className="animate-spin" />
            Saving
          </div>
        )}
      </div>

      {/* Outcome floating at the top right (`.notice-dock-top`,
          app/globals.css) — the answer the user was waiting for, where they
          are actually looking. h-9 is the toolbar Search field's height, so
          the two match without forcing the message to a fixed width. Slides
          in from the top to match the edge it now enters from; timing,
          wording and dismissal are untouched. */}
      <div className="notice-dock-top">
        {showSuccessMessage && (
          <div className={`flex h-9 max-w-full items-center rounded-lg px-3 shadow-lg text-white text-sm font-medium whitespace-nowrap animate-in slide-in-from-top-2 ${toastType === "error" ? "bg-red-600" : "bg-[#1FAE5B]"}`}>
            <span className="truncate">{showSuccessMessage}</span>
          </div>
        )}
      </div>

      {sidebarOpen && selectedPartner && (
        <InfluencerProfileSidebar
          partner={selectedPartner}
          campaigns={[] as Campaign[]}
          allPartners={[]}
          onClose={() => setSidebarOpen(false)}
          onCollabTypeChange={handleCollabTypeChangeFromSidebar}
        />
      )}

      {/* ── Single inline toolbar row ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search influencer..."
            data-tour="pipeline-search"
            className="w-full pl-9 pr-3 h-9 border border-[#0F6B3E]/20 rounded-lg outline-none focus:ring-2 focus:ring-[#1FAE5B] text-sm" />
        </div>

        {/* Filters */}
        <div className="relative">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            data-tour="pipeline-filters"
            className={`h-9 px-3 rounded-lg text-sm flex items-center gap-1.5 border transition-colors ${
              hasActiveFilters ? "bg-[#1FAE5B] text-white border-[#1FAE5B]" : "border-[#0F6B3E]/20 hover:border-[#0F6B3E]/40"
            }`}
          >
            <IconFilter size={15} />
            Filters
            {activeFilterCount > 0 && (
              <span className={`text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ${
                hasActiveFilters ? "bg-white/20 text-white" : "bg-[#1FAE5B] text-white"
              }`}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {showFilterPanel && (
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-30 w-[420px] max-w-[90vw] p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">Filter by</span>
                {hasActiveFilters && (
                  <button onClick={() => setFilters(EMPTY_FILTERS)}
                    className="text-xs text-gray-400 hover:text-red-500 transition flex items-center gap-1">
                    <IconX size={12} /> Clear all
                  </button>
                )}
              </div>
              {/* Section order, spacing and dividers mirror the Post Tracker
                  panel: chip groups first, then the two dropdowns in one row. */}
              <div className="flex flex-col gap-5">
                <TagSelect label="Pipeline Stage" options={STAGE_OPTIONS} selected={filters.stages}
                  onChange={(v) => setFilters((p) => ({ ...p, stages: v }))}
                  colorClass="bg-purple-50 text-purple-700 border-purple-200"
                  layout="grid" />
                <div className="border-t border-gray-100" />
                <TagSelect label="Approval Status" options={APPROVAL_OPTIONS} selected={filters.approvals}
                  onChange={(v) => setFilters((p) => ({ ...p, approvals: v }))}
                  colorClass="bg-amber-50 text-amber-700 border-amber-200" />
                <div className="border-t border-gray-100" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <SearchableMultiSelect label="Location" options={LOCATIONS} selected={filters.locations}
                    onChange={(v) => setFilters((p) => ({ ...p, locations: v }))}
                    allLabel="All Locations" />
                  <SearchableMultiSelect label="Niche" options={NICHES} selected={filters.niches}
                    onChange={(v) => setFilters((p) => ({ ...p, niches: v }))}
                    allLabel="All Niches" />
                </div>
              </div>
              {/* Sort inside filter panel */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="text-xs text-gray-500 block mb-2">Sort by date</label>
                <div className="flex gap-2">
                  <button onClick={() => setSortOrder("newest")}
                    className={`flex-1 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5 border font-medium transition-colors ${sortOrder === "newest" ? "bg-[#1FAE5B] text-white border-[#1FAE5B]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <IconChevronDown size={14} /> Newest
                  </button>
                  <button onClick={() => setSortOrder("oldest")}
                    className={`flex-1 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5 border font-medium transition-colors ${sortOrder === "oldest" ? "bg-[#1FAE5B] text-white border-[#1FAE5B]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <IconChevronUp size={14} /> Oldest
                  </button>
                </div>
              </div>
              {(filters.locations.length > 0 || filters.niches.length > 0 || filters.stages.length > 0 || filters.approvals.length > 0) && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-1.5">
                  {filters.stages.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[11px] font-medium">
                      {s}
                      <button onClick={() => setFilters((p) => ({ ...p, stages: p.stages.filter((x) => x !== s) }))} className="hover:text-purple-900 transition"><IconX size={10} /></button>
                    </span>
                  ))}
                  {filters.approvals.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[11px] font-medium">
                      {a}
                      <button onClick={() => setFilters((p) => ({ ...p, approvals: p.approvals.filter((x) => x !== a) }))} className="hover:text-amber-900 transition"><IconX size={10} /></button>
                    </span>
                  ))}
                  {filters.locations.map((l) => (
                    <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[11px] font-medium">
                      {l}
                      <button onClick={() => setFilters((p) => ({ ...p, locations: p.locations.filter((x) => x !== l) }))} className="hover:text-blue-900 transition"><IconX size={10} /></button>
                    </span>
                  ))}
                  {filters.niches.map((n) => (
                    <span key={n} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1FAE5B]/10 text-[#0F6B3E] rounded-full text-[11px] font-medium">
                      {n}
                      <button onClick={() => setFilters((p) => ({ ...p, niches: p.niches.filter((x) => x !== n) }))} className="hover:text-[#0F6B3E]/70 transition"><IconX size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end mt-4">
                <button onClick={() => setShowFilterPanel(false)}
                  className="px-5 py-1.5 bg-[#1FAE5B] text-white rounded-lg text-sm font-medium hover:bg-[#178a48] transition">
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Count — "N of M", as the Post Tracker toolbar reads, so a filtered
            view shows how much of the total is on screen. */}
        <span className="text-sm text-gray-500 whitespace-nowrap ml-1">
          {filteredData.length} of {data.length} influencer{data.length !== 1 ? "s" : ""}
        </span>

        {/* Real freshness, from the shared cache entry this board renders
            from — same component and placement on every board. */}
        <DataSyncStatus cacheKey={brandId ? `/api/brand/${brandId}/pipeline` : null} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="inline-flex h-9 items-center rounded-lg border border-[#0F6B3E]/20 bg-white p-1" data-tour="pipeline-view-toggle">
          <button
            onClick={() => { setView("Board"); setSelectedColumnStatus(null) }}
            className={`h-7 px-3 rounded-md text-sm flex items-center gap-1.5 transition-all ${
              view === "Board"
                ? "bg-[#1FAE5B] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50 hover:text-[#0F6B3E]"
            }`}
          >
            <IconLayoutKanban size={15} />
          </button>
          <button
            onClick={() => { setView("list"); setSelectedColumnStatus(null) }}
            className={`h-7 px-3 rounded-md text-sm flex items-center gap-1.5 transition-all ${
              view === "list"
                ? "bg-[#1FAE5B] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50 hover:text-[#0F6B3E]"
            }`}
          >
            <IconList size={15} />
          </button>
        </div>
      </div>

      {/* ── KANBAN VIEW ── */}
      {view === "Board" && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="rounded-xl border border-[#0F6B3E]/10 bg-white p-5 overflow-x-auto" style={{ scrollSnapType: "x proximity" }}>
            <div className="flex gap-4 min-w-max">

              {visibleColumns.filter((c) => c.key !== "not-interested").map((col, colIndex) => {
                const items = getItemsByColumn(col.key)
                return (
                  <DroppableColumn key={col.key} id={col.key}>
                    <div
                      className={`${col.color} text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-between`}
                      data-tour={colIndex === 0 ? "pipeline-board" : undefined}
                    >
                      <span
                        onClick={() => handleColumnClick(col)}
                        className="flex-1 cursor-pointer hover:opacity-90 transition-opacity truncate mr-2"
                      >
                        {col.title}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <ColumnInfoTooltip status={col.status} variant="dark" />
                        <span className="bg-white/20 text-white rounded-full px-2 py-0.5 text-xs">{items.length}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-h-[400px] mt-2">
                      {items.map((inf) => (
                        <DraggableCard key={inf.id} id={inf.id} disabled={!canApprove}>
                          {renderCard(inf)}
                        </DraggableCard>
                      ))}
                      {items.length === 0 && (
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">Drop here</div>
                      )}
                    </div>
                  </DroppableColumn>
                )
              })}

              {/* Exit separator */}
              <div className="flex flex-col items-center justify-center px-2 flex-shrink-0">
                <div className="h-16 w-px bg-gray-200" />
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest py-2">exit</span>
                <div className="h-16 w-px bg-gray-200" />
              </div>

              {/* Not Interested column */}
              {(() => {
                const col   = columns.find((c) => c.key === "not-interested")!
                const items = getItemsByColumn(col.key)
                return (
                  <DroppableColumn id={col.key}>
                    <div className="bg-red-100 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-between">
                      <span
                        onClick={() => handleColumnClick(col)}
                        className="flex-1 cursor-pointer hover:opacity-90 transition-opacity truncate mr-2"
                      >
                        {col.title}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <ColumnInfoTooltip status={col.status} variant="light" />
                        <span className="bg-red-200 text-red-700 rounded-full px-2 py-0.5 text-xs">{items.length}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-h-[400px] mt-2">
                      {items.map((inf) => (
                        <DraggableCard key={inf.id} id={inf.id} disabled={!canApprove}>
                          {renderCard(inf)}
                        </DraggableCard>
                      ))}
                      {items.length === 0 && (
                        <div className="border-2 border-dashed border-red-200 rounded-lg p-4 text-center text-xs text-gray-400">Drop here</div>
                      )}
                    </div>
                  </DroppableColumn>
                )
              })()}
            </div>
          </div>

          <DragOverlay>
            {activeInfluencer ? (
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg rotate-2 w-[min(78vw,240px)] sm:w-[240px]">
                {renderCard(activeInfluencer)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── BULK ACTION TOOLBAR — list view, only with a live selection ── */}
      {view === "list" && selectedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex-wrap">
          <span className="text-xs text-blue-700 font-medium">
            {selectedCount} selected
          </span>

          <div className="relative ml-auto sm:ml-0">
            <button
              ref={bulkBtnRef}
              onClick={() => setShowBulkStageMenu((v) => !v)}
              disabled={bulkBusy}
              aria-haspopup="menu"
              aria-expanded={showBulkStageMenu}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#1FAE5B] text-white rounded-lg hover:bg-[#178a48] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:ring-offset-1"
            >
              {bulkBusy ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Moving…
                </>
              ) : (
                <>
                  Move to Stage <IconChevronDown size={13} />
                </>
              )}
            </button>
            {showBulkStageMenu && !bulkBusy && (
              <div
                ref={bulkMenuRef}
                role="menu"
                aria-label="Move selected influencers to stage"
                className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-52 py-1"
              >
                {visibleColumns.map((col) => (
                  <button
                    key={col.key}
                    role="menuitem"
                    onClick={() => handleBulkStageSelect(col.status)}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition"
                  >
                    <span className={`w-2 h-2 rounded-full ${col.color}`} />
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
            <IconX size={13} /> Clear Selection
          </button>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="bg-white border rounded-xl overflow-hidden">
          {selectedColumnStatus && selectedColumnInfo && (
            <div className={`${selectedColumnInfo.color} px-4 py-3 text-white flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <IconLayoutList size={20} />
                <span className="font-semibold">{selectedColumnInfo.title}</span>
                <span className="text-sm bg-white/20 px-2 py-1 rounded">{filteredData.length} influencers</span>
              </div>
              <button onClick={clearColumnFilter} className="text-white hover:bg-white/20 px-2 py-1 rounded transition flex items-center gap-1">
                <IconX size={16} /> Clear filter
              </button>
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-10">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      disabled={filteredData.length === 0}
                      aria-label={allVisibleSelected ? "Deselect all visible influencers" : "Select all visible influencers"}
                      className="w-4 h-4 rounded accent-[#1FAE5B] cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:ring-offset-1"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Influencer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Platform</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Handle</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Followers</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Engagement</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Niche</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No influencers found</td></tr>
                ) : (
                  filteredData.map((inf) => (
                    <tr
                      key={inf.id}
                      className={`border-t hover:bg-gray-50 cursor-pointer transition ${selectedIds.has(inf.id) ? "bg-blue-50/60" : ""}`}
                      onClick={() => openSidebar(inf)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(inf.id)}
                          onChange={() => toggleRowSelection(inf.id)}
                          aria-label={`Select ${inf.influencer}`}
                          className="w-4 h-4 rounded accent-[#1FAE5B] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:ring-offset-1"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {inf.profileImageUrl ? (
                            <img src={inf.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 ${getAvatarColor(inf.influencer)} bg-opacity-20 flex items-center justify-center text-[#0F6B3E] font-semibold text-xs`}>
                              {inf.influencer.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">{inf.influencer}</span>
                            {inf.pipelineStatus === "Not Interested" && inf.niReason && (
                              <p className="text-[11px] text-red-500 mt-0.5">{inf.niReason}</p>
                            )}
                            {inf.pipelineStatus === "For Order Creation" && (
                              <>
                                <p className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-1">
                                  <IconPackage size={10} /> In Post Tracker
                                </p>
                                {inf.collabType && (
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {COLLAB_TYPES.find((c) => c.id === inf.collabType)?.title}
                                  </p>
                                )}
                              </>
                            )}
                            {inf.pipelineStatus === "Deal Agreed" && inf.collabType && (
                              <p className="text-[10px] text-green-600 mt-0.5">
                                {COLLAB_TYPES.find((c) => c.id === inf.collabType)?.title}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">{getPlatformIcon(inf.platform)}<span>{inf.platform || "Instagram"}</span></div>
                      </td>
                      <td className="px-4 py-3 text-[#0F6B3E] font-medium">{inf.instagramHandle}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1"><IconLocation size={14} className="text-gray-400" />{inf.location || "—"}</div>
                      </td>
                      <td className="px-4 py-3">{inf.followerCount?.toLocaleString() || inf.followers}</td>
                      <td className="px-4 py-3">{inf.engagementRate}</td>
                      <td className="px-4 py-3">
                        {inf.niche ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setFilters((p) => ({
                                ...p,
                                niches: p.niches.includes(inf.niche!)
                                  ? p.niches.filter((n) => n !== inf.niche)
                                  : [...p.niches, inf.niche!],
                              }))
                            }}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              filters.niches.includes(inf.niche)
                                ? "bg-[#1FAE5B]/15 text-[#0F6B3E] ring-1 ring-[#1FAE5B]/40"
                                : "bg-gray-100 text-gray-700 hover:bg-[#1FAE5B]/10 hover:text-[#0F6B3E]"
                            }`}
                          >
                            {inf.niche}
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                          <StatusDropdown currentStatus={inf.pipelineStatus} onStatusChange={(s) => handleStatusUpdate(inf.id, s)} canApproveInfluencers={canApprove} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
// app/dashboard/pipeline/kanban/kanban-board.tsx
// FIXED: Collaboration Type modal now fires BEFORE moving to Deal Agreed
// FIXED: Quick-move buttons simplified to "→ Deal Agreed" + "✕ Not Interested" only
// FIXED: Move to Post Tracker goes directly to For Order Creation (no modal)
// FIXED: For Order Creation and Not Interested cards persist on refresh
// ADDED: Column info tooltips (ⓘ) on all column headers
// ADDED: Niche + Location tag-based multi-select filters

"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
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
  IconLoader2,
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
} from "@tabler/icons-react"

import InfluencerProfileSidebar, {
  type Partner,
  type Campaign,
} from "@/components/InfluencerProfileSidebar"

import { usePipelineData, type PipelineInfluencer } from "@/hooks/usePipelineData"

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
// For Outreach    → Contacted
// Contacted       → In Conversation
// In Conversation → Deal Agreed (triggers collab type modal)
// Deal Agreed     → (only Move to Post Tracker button, + Not Interested)
// Terminal stages → nothing
const getNextStages = (currentStatus: string): string[] => {
  if (isTerminal(currentStatus)) return []
  const sequence: Record<string, string> = {
    "For Outreach":    "Contacted",
    "Contacted":       "In Conversation",
    "In Conversation": "Deal Agreed",
  }
  const next = sequence[currentStatus]
  if (!next) return ["Not Interested"] // Deal Agreed: only NI (move to PT is a dedicated button)
  return [next, "Not Interested"]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"]

function influencerToPartner(inf: PipelineInfluencer): Partner {
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
    clicks:       0,
    cvr:          0,
    sales:        0,
    aov:          0,
    rev:          0,
    fol:          inf.followerCount,
    eng:          parseFloat(inf.engagementRate) || 0,
    avgV:         0,
    gmv:          0,
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
  }
}

// ─── Tag Multi-Select ─────────────────────────────────────────────────────────
interface TagSelectProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  colorClass?: string
}

function TagSelect({ label, options, selected, onChange, colorClass = "bg-[#1FAE5B]/10 text-[#0F6B3E] border-[#1FAE5B]/30" }: TagSelectProps) {
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
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = selected.includes(option)
          return (
            <button
              key={option}
              onClick={() => toggle(option)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-all font-medium ${
                isSelected
                  ? `${colorClass} border-transparent`
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
              }`}
            >
              {isSelected && (
                <span className="mr-1 text-[9px]">✓</span>
              )}
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Not Interested Modal ─────────────────────────────────────────────────────
interface NIModalProps {
  influencer: PipelineInfluencer
  onConfirm: (reason: string) => void
  onCancel: () => void
}

function NotInterestedModal({ influencer, onConfirm, onCancel }: NIModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const hardReasons = NI_REASONS.filter((r) => r.bucket === "hard")
  const softReasons = NI_REASONS.filter((r) => r.bucket === "soft")
  const initials = influencer.influencer.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-[800px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-7 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Mark as not interested</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select the reason why this influencer declined or is not moving forward.</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition ml-4 mt-0.5"><IconX size={18} /></button>
        </div>
        <div className="px-7 pt-5">
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            {influencer.profileImageUrl ? (
              <img src={influencer.profileImageUrl} alt={influencer.influencer} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-semibold text-sm">{initials}</div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{influencer.influencer}</p>
              <p className="text-xs text-gray-500">{influencer.instagramHandle}</p>
            </div>
          </div>
        </div>
        <div className="px-7 pt-5 pb-3 grid grid-cols-2 gap-x-5 gap-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-700">Hard pass</span>
              <span className="text-[10px] text-gray-400">— don't reach out soon</span>
            </div>
            <div className="flex flex-col gap-1.5">
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
              <span className="text-[10px] text-gray-400">— follow up next campaign</span>
            </div>
            <div className="flex flex-col gap-1.5">
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
            {selectedReason && (
              <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Selected reason</p>
                <p className="text-sm font-medium text-gray-800">{selectedReason}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {NI_REASONS.find((r) => r.r === selectedReason)?.bucket === "soft"
                    ? "This influencer can be re-approached in a future campaign."
                    : "This influencer should not be contacted again soon."}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-7 py-4 border-t border-gray-100">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={() => selectedReason && onConfirm(selectedReason)} disabled={!selectedReason}
            className="px-6 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed">Confirm</button>
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
}

function CollabTypeModal({ influencer, onConfirm, onCancel }: CollabTypeModalProps) {
  const [selectedType, setSelectedType] = useState<CollabType | null>(null)
  const initials = influencer.influencer.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const selectedCollab = COLLAB_TYPES.find((c) => c.id === selectedType)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Select Collaboration Type</h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose the collaboration type before marking this deal as agreed.</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition ml-4 mt-0.5">
            <IconX size={18} />
          </button>
        </div>

        {/* Influencer Info */}
        <div className="px-7 pt-5 pb-2">
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            {influencer.profileImageUrl ? (
              <img src={influencer.profileImageUrl} alt={influencer.influencer} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm">{initials}</div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{influencer.influencer}</p>
              <p className="text-xs text-gray-500">{influencer.instagramHandle}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
              <IconArrowRight size={14} />
              <span>Moving to Deal Agreed</span>
            </div>
          </div>
        </div>

        {/* Collaboration Types Grid */}
        <div className="px-7 pt-5 pb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Collaboration Type</p>
          <div className="grid grid-cols-2 gap-3">
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

        {/* Selected Type Summary */}
        {selectedCollab && (
          <div className="px-7 pb-3">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Selected Collaboration</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${selectedCollab.dotColor}`} />
                <span className="text-sm font-semibold text-gray-900">{selectedCollab.title}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{selectedCollab.description}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <p className="text-[11px] text-gray-400">
            This will move the influencer to Deal Agreed
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition bg-white"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedType && onConfirm(selectedType)}
              disabled={!selectedType}
              className="px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <IconArrowRight size={14} />
              Confirm Deal Agreed
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Deal Agreed → Move to Post Tracker (no modal, direct action) ────────────
function DealAgreedMoveButton({ onMarkOrderPlaced }: {
  onMarkOrderPlaced: () => void
}) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onMarkOrderPlaced()
        }}
        className="w-full text-xs font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 bg-[#1FAE5B] text-white hover:bg-[#0f6b3e]"
      >
        <IconPackage size={12} />
        Move to Post Tracker
      </button>
    </div>
  )
}

// ─── Pipeline Card ────────────────────────────────────────────────────────────
function PipelineCard({ influencer, onOpenSidebar, onStatusChange, onMarkOrderPlaced }: {
  influencer: PipelineInfluencer
  onOpenSidebar: (inf: PipelineInfluencer) => void
  onStatusChange: (id: string, newStatus: string) => void
  onMarkOrderPlaced?: (id: string) => void
}) {
  // nextStages is now always ["Deal Agreed", "Not Interested"] for pre-deal cards,
  // ["Not Interested"] for Deal Agreed cards, and [] for terminal cards
  const nextStages = getNextStages(influencer.pipelineStatus)
  const terminal   = isTerminal(influencer.pipelineStatus)

  return (
    <div className={`bg-white border rounded-lg p-3 hover:shadow-md transition-shadow ${
      influencer.pipelineStatus === "Not Interested"      ? "border-red-100 bg-red-50/30"     :
      influencer.pipelineStatus === "For Order Creation"  ? "border-emerald-100 bg-emerald-50/30" :
      "border-gray-200"
    }`}>
      <div className="cursor-pointer" onClick={() => onOpenSidebar(influencer)}>
        <div className="flex flex-col text-sm mb-2">
          <span className="font-medium text-gray-900">{influencer.influencer}</span>
          <span className="text-xs text-gray-500">{influencer.instagramHandle}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
          <span className="flex items-center gap-1">{getPlatformIcon(influencer.platform)}{influencer.platform || "Instagram"}</span>
          <span>•</span>
          <span>{influencer.location || "—"}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{influencer.followerCount?.toLocaleString() || influencer.followers || "—"} followers</span>
          <span>{influencer.engagementRate || "—"}% eng</span>
        </div>

        {/* NI reason pill */}
        {influencer.pipelineStatus === "Not Interested" && influencer.niReason && (
          <div className="mt-2 text-xs text-red-600 bg-red-100 rounded-full px-2.5 py-1 inline-block font-medium">
            {influencer.niReason}
          </div>
        )}

        {/* For Order Creation badge */}
        {influencer.pipelineStatus === "For Order Creation" && (
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 rounded-full px-2.5 py-1 inline-flex font-medium">
            <IconPackage size={12} />
            In Post Tracker
          </div>
        )}

        {/* Collab type badge — shown on both Deal Agreed and For Order Creation */}
        {(influencer.pipelineStatus === "For Order Creation" || influencer.pipelineStatus === "Deal Agreed") && influencer.collabType && (
          <div className="mt-1.5">
            {(() => {
              const collab = COLLAB_TYPES.find((c) => c.id === influencer.collabType)
              if (!collab) return null
              return (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${collab.color.split(" ")[0]} ${collab.color.split(" ")[1]}`}>
                  {collab.icon}
                  {collab.title}
                </span>
              )
            })()}
          </div>
        )}
      </div>

      {/* Move to Post Tracker button — only on Deal Agreed cards */}
      {influencer.pipelineStatus === "Deal Agreed" && onMarkOrderPlaced && (
        <DealAgreedMoveButton
          onMarkOrderPlaced={() => onMarkOrderPlaced(influencer.id)}
        />
      )}

      {/* Quick-move buttons — only for non-terminal cards */}
      {nextStages.length > 0 && !terminal && (
        <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100 flex-wrap">
          {nextStages.map((stage) => (
            <button key={stage}
              onClick={(e) => { e.stopPropagation(); onStatusChange(influencer.id, stage) }}
              className={`text-xs px-2 py-1 rounded transition-all ${
                stage === "Not Interested"
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
              }`}>
              {stage === "Not Interested" ? "✕ Not Interested" : `→ ${stage}`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Portal StatusDropdown ────────────────────────────────────────────────────
function StatusDropdown({ currentStatus, onStatusChange }: { currentStatus: string; onStatusChange: (s: string) => void }) {
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
    setDropdownStyle({ position: "fixed", top: Math.max(8, top), left: Math.max(8, left), zIndex: 9999, minWidth: dropdownWidth })
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
      <button ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen((p) => !p) }}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap border ${getStatusColor(currentStatus)}`}>
        {currentStatus}
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
      className={`flex flex-col gap-3 w-[240px] flex-shrink-0 transition-colors rounded-lg ${
        isOver ? (isExit ? "bg-red-50" : "bg-gray-50") : ""
      }`}>
      {children}
    </div>
  )
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}>
      {children}
    </div>
  )
}

// ─── Filter state type ────────────────────────────────────────────────────────
interface FilterState {
  influencer: string
  handle:     string
  locations:  string[]
  niches:     string[]
}

const EMPTY_FILTERS: FilterState = {
  influencer: "",
  handle:     "",
  locations:  [],
  niches:     [],
}

// ─── Main Page ────────────────────────────────────────────────────────────────
interface PipelinePageProps { brandId?: string }

export default function PipelinePage({ brandId }: PipelinePageProps) {
  const [view,                 setView]                 = useState<"Board" | "list">("Board")
  const [search,               setSearch]               = useState("")
  const [showSuccessMessage,   setShowSuccessMessage]   = useState<string | null>(null)
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

  const { data, isLoading, error, updateStatus, refetch } = usePipelineData(brandId)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const toast = (msg: string, duration = 3000) => {
    setShowSuccessMessage(msg)
    setTimeout(() => setShowSuccessMessage(null), duration)
  }

  // ── Move to Post Tracker: NO modal, direct status update ──────────────────
  const handleMarkOrderPlaced = async (id: string) => {
    const influencer = data.find((i) => i.id === id)
    if (!influencer) return
    const success = await updateStatus(id, "For Order Creation")
    toast(
      success
        ? `${influencer.influencer} moved to Post Tracker ✓`
        : `Failed to move ${influencer.influencer}`
    )
  }

  // ── Collab type confirmed → move to Deal Agreed ───────────────────────────
  const handleCollabTypeConfirm = async (collabType: CollabType) => {
    if (!pendingCollabId || !collabModalInfluencer) return
    const success = await updateStatus(pendingCollabId, "Deal Agreed", {  })
    const collabName = COLLAB_TYPES.find((c) => c.id === collabType)?.title ?? collabType
    toast(
      success
        ? `${collabModalInfluencer.influencer} moved to Deal Agreed · ${collabName} ✓`
        : `Failed to move ${collabModalInfluencer.influencer}`
    )
    setCollabModalInfluencer(null)
    setPendingCollabId(null)
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

    const newStatus = getStatusFromColumnKey(destKey)
    if (dragged.pipelineStatus === newStatus) return

    if (isTerminal(dragged.pipelineStatus)) {
      toast(`Cannot move from "${dragged.pipelineStatus}"`, 2000)
      return
    }

    // Drag to Deal Agreed → open collab type modal first
    if (newStatus === "Deal Agreed") {
      setPendingCollabId(draggedId)
      setCollabModalInfluencer(dragged)
      return
    }

    // Drag to For Order Creation directly is blocked — must use button on Deal Agreed card
    if (newStatus === "For Order Creation") {
      toast("Please use the 'Move to Post Tracker' button on the Deal Agreed card.", 4000)
      return
    }

    if (newStatus === "Not Interested") {
      setPendingNiId(draggedId)
      setNiModalInfluencer(dragged)
      return
    }

    const success = await updateStatus(draggedId, newStatus)
    const colTitle = columns.find((col) => col.key === destKey)?.title
    toast(success ? `${dragged.influencer} moved to ${colTitle}` : `Failed to move ${dragged.influencer}`)
  }

  const handleNiConfirm = async (reason: string) => {
    if (!pendingNiId || !niModalInfluencer) return
    const success = await updateStatus(pendingNiId, "Not Interested", { niReason: reason })
    toast(success
      ? `${niModalInfluencer.influencer} marked as Not Interested · ${reason}`
      : `Failed to update ${niModalInfluencer.influencer}`)
    setNiModalInfluencer(null)
    setPendingNiId(null)
  }

  const handleNiCancel = () => { setNiModalInfluencer(null); setPendingNiId(null) }

  // ── Status update from card buttons / list dropdown ───────────────────────
  const handleStatusUpdate = async (id: string, newStatus: string) => {
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
      ? `${influencer?.influencer} updated to ${newStatus}`
      : `Failed to update ${influencer?.influencer}`, 2000)
  }

  const openSidebar = (inf: PipelineInfluencer) => {
    setSelectedPartner(influencerToPartner(inf))
    setSidebarOpen(true)
  }

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
  let filteredData = data
    .filter((d) =>
      d.influencer.toLowerCase().includes(search.toLowerCase()) ||
      d.instagramHandle.toLowerCase().includes(search.toLowerCase())
    )
    .filter((d) => selectedColumnStatus ? d.pipelineStatus === selectedColumnStatus : true)

  if (filters.influencer)           filteredData = filteredData.filter((p) => p.influencer.toLowerCase().includes(filters.influencer.toLowerCase()))
  if (filters.handle)               filteredData = filteredData.filter((p) => p.instagramHandle.toLowerCase().includes(filters.handle.toLowerCase()))
  if (filters.locations.length > 0) filteredData = filteredData.filter((p) => filters.locations.includes(p.location ?? ""))
  if (filters.niches.length > 0)    filteredData = filteredData.filter((p) => filters.niches.includes(p.niche ?? ""))
  filteredData = [...filteredData].sort((a, b) => {
    const da = new Date(a.createdAt ?? 0).getTime()
    const db = new Date(b.createdAt ?? 0).getTime()
    return sortOrder === "newest" ? db - da : da - db
  })

  const activeFilterCount =
    (filters.influencer ? 1 : 0) +
    (filters.handle ? 1 : 0) +
    filters.locations.length +
    filters.niches.length +
    (search ? 1 : 0) +
    (selectedColumnStatus ? 1 : 0)

  const hasActiveFilters   = activeFilterCount > 0
  const activeInfluencer   = activeId ? data.find((item) => item.id === activeId) : null
  const selectedColumnInfo = selectedColumnStatus ? columns.find((col) => col.status === selectedColumnStatus) : null

  const getItemsByColumn = (columnKey: string) =>
    filteredData.filter((item) => item.pipelineStatus === getStatusFromColumnKey(columnKey))

  const renderCard = (inf: PipelineInfluencer) => (
    <PipelineCard
      influencer={inf}
      onOpenSidebar={openSidebar}
      onStatusChange={handleStatusUpdate}
      onMarkOrderPlaced={handleMarkOrderPlaced}
    />
  )

  const visibleColumns = columns.filter((c) => c.visible)

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-gray-500">
      <IconLoader2 size={32} className="animate-spin text-[#1FAE5B]" />
      <span className="text-sm">Loading pipeline data...</span>
    </div>
  )

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

      {showSuccessMessage && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2">
          {showSuccessMessage}
        </div>
      )}

      {sidebarOpen && selectedPartner && (
        <InfluencerProfileSidebar partner={selectedPartner} campaigns={[] as Campaign[]} allPartners={[]} onClose={() => setSidebarOpen(false)} />
      )}

      {/* ── Single inline toolbar row ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search influencer..."
            className="w-full pl-9 pr-3 h-9 border border-[#0F6B3E]/20 rounded-lg outline-none focus:ring-2 focus:ring-[#1FAE5B] text-sm" />
        </div>

        {/* Filters */}
        <div className="relative">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
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
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-30 w-[420px] p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">Filter by</span>
                {hasActiveFilters && (
                  <button onClick={() => setFilters(EMPTY_FILTERS)}
                    className="text-xs text-gray-400 hover:text-red-500 transition flex items-center gap-1">
                    <IconX size={12} /> Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  {([
                    { label: "Influencer", key: "influencer" as const, placeholder: "Search by name..." },
                    { label: "Handle",     key: "handle"     as const, placeholder: "@username..."      },
                  ] as const).map(({ label, key, placeholder }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">{label}</label>
                      <input type="text" value={filters[key]}
                        onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]" />
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100" />
                <TagSelect label="Location" options={LOCATIONS} selected={filters.locations}
                  onChange={(v) => setFilters((p) => ({ ...p, locations: v }))}
                  colorClass="bg-blue-50 text-blue-700 border-blue-200" />
                <div className="border-t border-gray-100" />
                <TagSelect label="Niche" options={NICHES} selected={filters.niches}
                  onChange={(v) => setFilters((p) => ({ ...p, niches: v }))}
                  colorClass="bg-[#1FAE5B]/10 text-[#0F6B3E] border-[#1FAE5B]/30" />
                <div className="border-t border-gray-100" />
                <div>
                  <label className="text-xs text-gray-500 block mb-2">Sort by date</label>
                  <div className="flex gap-2">
                    <button onClick={() => setSortOrder("newest")}
                      className={`flex-1 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5 border font-medium transition-colors ${sortOrder === "newest" ? "bg-[#1FAE5B] text-white border-[#1FAE5B]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                      <IconChevronDown size={14} /> Newest
                    </button>
                    <button onClick={() => setSortOrder("oldest")}
                      className={`flex-1 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5 border font-medium transition-colors ${sortOrder === "oldest" ? "bg-[#1FAE5B] text-white border-[#1FAE5B]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                      <IconChevronDown size={14} className="rotate-180" /> Oldest
                    </button>
                  </div>
                </div>
              </div>
              {(filters.locations.length > 0 || filters.niches.length > 0) && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
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

        {/* Count */}
        <span className="text-sm text-gray-500 whitespace-nowrap ml-1">
          {data.length} influencer{data.length !== 1 ? "s" : ""}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="inline-flex h-9 items-center rounded-lg border border-[#0F6B3E]/20 bg-white p-1">
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
          <div className="rounded-xl border border-[#0F6B3E]/10 bg-white p-5 overflow-x-auto">
            <div className="flex gap-4 min-w-max">

              {visibleColumns.filter((c) => c.key !== "not-interested").map((col) => {
                const items = getItemsByColumn(col.key)
                return (
                  <DroppableColumn key={col.key} id={col.key}>
                    <div className={`${col.color} text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-between`}>
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

                    <div className="flex flex-col gap-2 min-h-[400px]">
                      {items.map((inf) => (
                        <DraggableCard key={inf.id} id={inf.id}>
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
                        <span className="bg-red-200 text-red-700 rounded-full px-2 py-0.5 text-xs">{items.length}</span>
                        <ColumnInfoTooltip status={col.status} variant="light" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-h-[400px]">
                      {items.map((inf) => (
                        <DraggableCard key={inf.id} id={inf.id}>
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
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg rotate-2 w-[240px]">
                {renderCard(activeInfluencer)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No influencers found</td></tr>
                ) : (
                  filteredData.map((inf) => (
                    <tr key={inf.id} className="border-t hover:bg-gray-50 cursor-pointer transition" onClick={() => openSidebar(inf)}>
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
                      <td className="px-4 py-3">
                        <div onClick={(e) => e.stopPropagation()}>
                          <StatusDropdown currentStatus={inf.pipelineStatus} onStatusChange={(s) => handleStatusUpdate(inf.id, s)} />
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
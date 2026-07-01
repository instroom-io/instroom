"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Input } from "@/components/ui/input"
import {
  IconSearch,
  IconTrash,
  IconLayoutKanban,
  IconHistory,
  IconX,
  IconList,
  IconFilter,
} from "@tabler/icons-react"

import AddInfluencerModal from "./modal/AddInfluencerModal"
import AddManualInfluencer from "./modal/AddManualInfluencer"
import AddInstagramInfluencer from "./modal/AddInstagramInfluencer"
import AddTiktokCreator from "./modal/AddTiktokCreator"
import ImportInfluencerList from "./modal/ImportInfluencerList"

// ─── Types ────────────────────────────────────────────────────────────────────
type ModalType = "select" | "manual" | "instagram" | "tiktok"

interface AddedBy {
  id: string
  name: string | null
  image: string | null
  added_at: string
}

interface InfluencerRow {
  id: string
  influencer_id: string
  contact_status: string
  stage: number
  approval_status: string | null
  created_at: string
  updated_at: string
  added_by: AddedBy | null
  influencer: {
    id: string
    handle: string
    platform: string
    full_name: string | null
    niche: string | null
    location: string | null
    profile_image_url: string | null
    follower_count: number
    engagement_rate: number
  }
}

interface ActivityLog {
  id: string
  action: string
  label: string
  details: Record<string, unknown>
  created_at: string
  user: {
    id: string
    name: string | null
    image: string | null
    initials: string
  } | null
}

interface FilterState {
  platform: string
  contact_status: string
  niche: string
  minFollowers: string
  maxFollowers: string
  minEngagement: string
  maxEngagement: string
  addedById: string  // filter by who added the influencer
}

const DEFAULT_FILTERS: FilterState = {
  platform: "",
  contact_status: "",
  niche: "",
  minFollowers: "",
  maxFollowers: "",
  minEngagement: "",
  maxEngagement: "",
  addedById: "",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string | null | undefined, fallback = "?") {
  const src = name ?? fallback
  return src
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({
  name,
  image,
  size = 8,
}: {
  name?: string | null
  image?: string | null
  size?: number
}) {
  const px = size * 4
  const style = { width: px, height: px, minWidth: px }

  if (image) {
    return (
      <img
        src={image}
        alt={name ?? ""}
        style={style}
        className="rounded-full object-cover flex-shrink-0"
      />
    )
  }
  return (
    <div
      style={style}
      className="rounded-full bg-[#1FAE5B]/20 flex items-center justify-center flex-shrink-0"
    >
      <span className="text-xs font-semibold text-[#0F6B3E]">
        {getInitials(name)}
      </span>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDetails(
  action: string,
  details: Record<string, unknown>
): string {
  switch (action) {
    case "pipeline.stage_changed":
      return `Stage ${details.from} → ${details.to}`
    case "pipeline.status_changed":
      if (details.ni_reason)
        return `${details.from} → ${details.to} · "${details.ni_reason}"`
      return `${details.from} → ${details.to}`
    case "influencer.approval_changed":
      return `${details.from ?? "—"} → ${details.to}${
        details.notes ? ` · "${details.notes}"` : ""
      }`
    case "influencer.added":
      return `via ${details.method ?? "manual"}${
        details.platform ? ` on ${details.platform}` : ""
      }`
    case "posttracker.stage_changed":
      return `${details.from} → ${details.to}`
    default:
      return ""
  }
}

const ACTION_COLORS: Record<string, string> = {
  "influencer.added":            "bg-green-100 text-green-700",
  "influencer.removed":          "bg-red-100 text-red-600",
  "influencer.approval_changed": "bg-purple-100 text-purple-700",
  "pipeline.stage_changed":      "bg-blue-100 text-blue-700",
  "pipeline.status_changed":     "bg-yellow-100 text-yellow-700",
  "posttracker.stage_changed":   "bg-teal-100 text-teal-700",
  "influencer.submitted":        "bg-orange-100 text-orange-700",
}

const STATUS_COLORS: Record<string, string> = {
  not_contacted:  "bg-gray-100 text-gray-600",
  contacted:      "bg-yellow-100 text-yellow-700",
  responded:      "bg-blue-100 text-blue-700",
  replied:        "bg-blue-100 text-blue-700",
  interested:     "bg-purple-100 text-purple-700",
  agreed:         "bg-green-100 text-green-700",
  not_interested: "bg-red-100 text-red-600",
  email_error:    "bg-orange-100 text-orange-700",
  no_response:    "bg-gray-100 text-gray-500",
  paid_collab:    "bg-emerald-100 text-emerald-700",
  negotiating:    "bg-indigo-100 text-indigo-700",
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────
function FilterModal({
  filters,
  influencers,
  onChange,
  onReset,
  onClose,
}: {
  filters: FilterState
  influencers: InfluencerRow[]
  onChange: (f: FilterState) => void
  onReset: () => void
  onClose: () => void
}) {
  const [local, setLocal] = useState<FilterState>(filters)

  // Derive unique options from data
  const platforms = Array.from(
    new Set(influencers.map((i) => i.influencer.platform).filter(Boolean))
  ).sort()

  const niches = Array.from(
    new Set(influencers.map((i) => i.influencer.niche).filter(Boolean) as string[])
  ).sort()

  const contactStatuses = Array.from(
    new Set(influencers.map((i) => i.contact_status).filter(Boolean))
  ).sort()

  // Derive unique "added by" users — deduplicated by user id
  const addedByUsers = Array.from(
    new Map(
      influencers
        .filter((i) => i.added_by !== null)
        .map((i) => [i.added_by!.id, i.added_by!])
    ).values()
  ).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))

  const set = (key: keyof FilterState, value: string) =>
    setLocal((prev) => ({ ...prev, [key]: value }))

  const handleApply = () => {
    onChange(local)
    onClose()
  }

  const handleReset = () => {
    setLocal(DEFAULT_FILTERS)
    onReset()
    onClose()
  }

  const activeCount = Object.values(local).filter(Boolean).length

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-[480px] max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <IconFilter size={18} className="text-[#1FAE5B]" />
            <h2 className="font-semibold text-gray-900">Filter Influencers</h2>
            {activeCount > 0 && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#1FAE5B]/15 text-[#0F6B3E]">
                {activeCount} active
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* ── Added By ─────────────────────────────────────────────────────── */}
          {addedByUsers.length > 0 && (
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Added by
                </label>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Filter by researcher or team member who added the influencer
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {/* "All" option */}
                <button
                  onClick={() => set("addedById", "")}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition ${
                    local.addedById === ""
                      ? "bg-[#1FAE5B]/10 border-[#1FAE5B] text-[#0F6B3E] font-medium"
                      : "bg-white border-gray-200 text-gray-600 hover:border-[#1FAE5B]/50 hover:bg-gray-50"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-gray-400">ALL</span>
                  </div>
                  <span className="flex-1 text-left">All team members</span>
                  <span className="text-xs text-gray-400">{influencers.length}</span>
                </button>

                {addedByUsers.map((user) => {
                  const count = influencers.filter(
                    (i) => i.added_by?.id === user.id
                  ).length
                  return (
                    <button
                      key={user.id}
                      onClick={() => set("addedById", user.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition ${
                        local.addedById === user.id
                          ? "bg-[#1FAE5B]/10 border-[#1FAE5B] text-[#0F6B3E] font-medium"
                          : "bg-white border-gray-200 text-gray-600 hover:border-[#1FAE5B]/50 hover:bg-gray-50"
                      }`}
                    >
                      <Avatar name={user.name} image={user.image} size={7} />
                      <span className="flex-1 text-left truncate">
                        {user.name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Divider */}
          {addedByUsers.length > 0 && (
            <div className="border-t border-gray-100" />
          )}

          {/* ── Platform ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Platform
            </label>
            <div className="flex flex-wrap gap-2">
              {["", ...platforms].map((p) => (
                <button
                  key={p || "__all__"}
                  onClick={() => set("platform", p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    local.platform === p
                      ? "bg-[#1FAE5B] text-white border-[#1FAE5B]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#1FAE5B] hover:text-[#0F6B3E]"
                  }`}
                >
                  {p || "All"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Contact Status ───────────────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Contact Status
            </label>
            <div className="flex flex-wrap gap-2">
              {["", ...contactStatuses].map((s) => (
                <button
                  key={s || "__all__"}
                  onClick={() => set("contact_status", s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    local.contact_status === s
                      ? "bg-[#1FAE5B] text-white border-[#1FAE5B]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#1FAE5B] hover:text-[#0F6B3E]"
                  }`}
                >
                  {s ? s.replace(/_/g, " ") : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Niche ────────────────────────────────────────────────────────── */}
          {niches.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Niche
              </label>
              <select
                value={local.niche}
                onChange={(e) => set("niche", e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]/30 focus:border-[#1FAE5B]"
              >
                <option value="">All niches</option>
                {niches.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Follower Range ───────────────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Followers
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={local.minFollowers}
                onChange={(e) => set("minFollowers", e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]/30 focus:border-[#1FAE5B]"
              />
              <span className="text-gray-400 text-sm">–</span>
              <input
                type="number"
                placeholder="Max"
                value={local.maxFollowers}
                onChange={(e) => set("maxFollowers", e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]/30 focus:border-[#1FAE5B]"
              />
            </div>
          </div>

          {/* ── Engagement Range ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Engagement Rate (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={local.minEngagement}
                onChange={(e) => set("minEngagement", e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]/30 focus:border-[#1FAE5B]"
              />
              <span className="text-gray-400 text-sm">–</span>
              <input
                type="number"
                placeholder="Max"
                value={local.maxEngagement}
                onChange={(e) => set("maxEngagement", e.target.value)}
                className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]/30 focus:border-[#1FAE5B]"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/60">
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 transition font-medium"
          >
            Reset all
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="h-9 px-5 bg-[#1FAE5B] text-white rounded-lg text-sm font-medium hover:bg-[#0f6b3e] transition"
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── History Modal ────────────────────────────────────────────────────────────
function HistoryModal({
  brandId,
  influencer,
  onClose,
}: {
  brandId: string
  influencer: InfluencerRow
  onClose: () => void
}) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const url = `/api/brand/${brandId}/influencers/${influencer.id}/activity`
    console.log("[HistoryModal] fetching:", url)
    console.log("[HistoryModal] bi.id:", influencer.id, "| influencer_id:", influencer.influencer_id)

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        console.log("[HistoryModal] response:", d)
        setLogs(d.logs ?? [])
        setLoading(false)
      })
      .catch((err) => {
        console.error("[HistoryModal] error:", err)
        setError("Failed to load history")
        setLoading(false)
      })
  }, [brandId, influencer.id])

  const displayName =
    influencer.influencer.full_name || `@${influencer.influencer.handle}`

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-[520px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Avatar
              name={influencer.influencer.full_name}
              image={influencer.influencer.profile_image_url}
              size={10}
            />
            <div>
              <p className="font-semibold text-gray-900">{displayName}</p>
              <p className="text-xs text-gray-400">
                @{influencer.influencer.handle} · Activity history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Loading history...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-400">
              <p className="text-sm">{error}</p>
              <p className="text-xs text-gray-400">
                Check the browser console for details
              </p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <IconHistory size={36} className="opacity-25" />
              <p className="text-sm font-medium">No activity recorded yet</p>
              <p className="text-xs text-gray-300 text-center max-w-[280px]">
                Actions like adding, approving, or moving this influencer will
                appear here
              </p>
              {/* Debug info — remove after confirming it works */}
              <p className="text-[10px] text-gray-200 font-mono mt-2">
                bi.id: {influencer.id}
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gray-100" />

              <div className="flex flex-col">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-4 pb-6 relative">
                    {/* User avatar */}
                    <div className="flex-shrink-0 z-10">
                      <Avatar
                        name={log.user?.name}
                        image={log.user?.image}
                        size={10}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">
                            {log.user?.name ?? "Unknown user"}
                          </span>
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              ACTION_COLORS[log.action] ??
                              "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {log.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      {formatDetails(log.action, log.details) && (
                        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5 inline-block mt-1">
                          {formatDetails(log.action, log.details)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InfluencerList() {
  const params = useParams()
  const brandId = params?.brandId as string

  const [view, setView] = useState<"table" | "kanban">("table")
  const [influencers, setInfluencers] = useState<InfluencerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [openModal, setOpenModal] = useState(false)
  const [openImport, setOpenImport] = useState(false)
  const [openFilter, setOpenFilter] = useState(false)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [modalType, setModalType] = useState<ModalType>("select")
  const [historyTarget, setHistoryTarget] = useState<InfluencerRow | null>(null)
  const [showTrialLimitModal, setShowTrialLimitModal] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ status: string; isExpired: boolean } | null>(null)

  const { data: session } = useSession()

  // Fetch subscription status for trial detection
  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/subscription/status")
      .then(res => res.json())
      .then(data => setSubscriptionStatus(data))
      .catch(() => setSubscriptionStatus({ status: "inactive", isExpired: false }))
  }, [session?.user?.id])

  const fetchInfluencers = useCallback(async (): Promise<void> => {
    if (!brandId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/brand/${brandId}/influencers`)
      const data = await res.json()
      setInfluencers(data.influencers ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    fetchInfluencers()
  }, [fetchInfluencers])

  const deleteInfluencer = async (id: string, influencerId: string) => {
    setInfluencers((prev) => prev.filter((i) => i.id !== id))
    await fetch(`/api/brand/${brandId}/influencers/${influencerId}`, {
      method: "DELETE",
    })
  }

  const handleAdded = () => {
    fetchInfluencers()
    setOpenModal(false)
  }

  // Count active filters for the badge on the Filter button
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const filtered = influencers.filter((item) => {
    // Search
    const name = (item.influencer.full_name ?? "").toLowerCase()
    const handle = item.influencer.handle.toLowerCase()
    const q = search.toLowerCase()
    if (q && !name.includes(q) && !handle.includes(q)) return false

    // Added by (matched on user id)
    if (filters.addedById && item.added_by?.id !== filters.addedById) return false

    // Platform
    if (filters.platform && item.influencer.platform !== filters.platform)
      return false

    // Contact status
    if (filters.contact_status && item.contact_status !== filters.contact_status)
      return false

    // Niche
    if (filters.niche && item.influencer.niche !== filters.niche) return false

    // Followers
    if (filters.minFollowers && item.influencer.follower_count < Number(filters.minFollowers))
      return false
    if (filters.maxFollowers && item.influencer.follower_count > Number(filters.maxFollowers))
      return false

    // Engagement
    if (filters.minEngagement && item.influencer.engagement_rate < Number(filters.minEngagement))
      return false
    if (filters.maxEngagement && item.influencer.engagement_rate > Number(filters.maxEngagement))
      return false

    return true
  })

  return (
    <div className="relative">
      <div className="p-6 flex flex-col gap-6">

        {/* HEADER */}
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[280px] max-w-[560px] relative">
            <IconSearch
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <Input
              placeholder="Search influencer"
              className="pl-9 h-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setModalType("select")
                setOpenModal(true)
              }}
              className="bg-[#1FAE5B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0f6b3e] transition"
            >
              + New Influencer
            </button>
            <button
              onClick={() => {
                if (subscriptionStatus?.status === "trialing") {
                  setShowTrialLimitModal(true)
                  return
                }
                setOpenImport(true)
              }}
              disabled={subscriptionStatus?.status === "trialing"}
              className={`h-10 px-4 border rounded-lg text-sm transition ${
                subscriptionStatus?.status === "trialing"
                  ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400"
                  : "hover:bg-gray-50 text-gray-600"
              }`}
              title={subscriptionStatus?.status === "trialing" ? "Import is not available during your free trial" : undefined}
            >
              Import
            </button>
            <button
              onClick={() => {
                if (subscriptionStatus?.status === "trialing") {
                  setShowTrialLimitModal(true)
                  return
                }
              }}
              disabled={subscriptionStatus?.status === "trialing"}
              className={`h-10 px-4 border rounded-lg text-sm transition ${
                subscriptionStatus?.status === "trialing"
                  ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400"
                  : "hover:bg-gray-50 text-gray-600"
              }`}
              title={subscriptionStatus?.status === "trialing" ? "Export is not available during your free trial" : undefined}
            >
              Export
            </button>

            {/* Filter button — solid green when active with inline count badge */}
            <button
              onClick={() => setOpenFilter(true)}
              className={`relative h-10 px-4 rounded-lg text-sm transition flex items-center gap-1.5 border font-medium ${
                activeFilterCount > 0
                  ? "bg-[#1FAE5B] border-[#1FAE5B] text-white hover:bg-[#0f6b3e]"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <IconFilter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-white/25 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ACTION BAR */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {loading
              ? "Loading..."
              : `${filtered.length} influencer${filtered.length !== 1 ? "s" : ""}${
                  activeFilterCount > 0 ? " (filtered)" : ""
                }`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("table")}
              className={`h-9 w-9 flex items-center justify-center border rounded-md transition ${
                view === "table"
                  ? "border-[#1FAE5B] bg-[#1FAE5B]/10 text-[#0F6B3E]"
                  : "border-gray-300 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <IconList size={16} />
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`h-9 w-9 flex items-center justify-center border rounded-md transition ${
                view === "kanban"
                  ? "border-[#1FAE5B] bg-[#1FAE5B]/10 text-[#0F6B3E]"
                  : "border-gray-300 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <IconLayoutKanban size={16} />
            </button>
          </div>
        </div>

        {/* TABLE VIEW */}
        {view === "table" && (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50/60">
                <tr>
                  <th className="px-3 py-3 w-8" />
                  <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Profile
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Handle
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Followers
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Eng %
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Niche
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Added by
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-12 text-gray-400 text-sm"
                    >
                      Loading influencers...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-12 text-gray-500 text-sm"
                    >
                      {search || activeFilterCount > 0
                        ? "No influencers match your search or filters."
                        : 'No influencers yet. Click "+ New Influencer" to add one.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t hover:bg-gray-50 transition"
                    >
                      <td className="px-3 py-3">
                        <input type="checkbox" />
                      </td>

                      {/* Avatar */}
                      <td className="px-3 py-3">
                        <Avatar
                          name={item.influencer.full_name}
                          image={item.influencer.profile_image_url}
                          size={9}
                        />
                      </td>

                      {/* Name */}
                      <td className="px-3 py-3 font-medium text-gray-900">
                        {item.influencer.full_name ||
                          `@${item.influencer.handle}`}
                      </td>

                      {/* Handle */}
                      <td className="px-3 py-3 text-[#0F6B3E] font-medium">
                        @{item.influencer.handle}
                      </td>

                      {/* Followers */}
                      <td className="px-3 py-3 text-gray-600">
                        {item.influencer.follower_count.toLocaleString()}
                      </td>

                      {/* Engagement */}
                      <td className="px-3 py-3 text-gray-600">
                        {item.influencer.engagement_rate}%
                      </td>

                      {/* Niche */}
                      <td className="px-3 py-3 text-gray-600">
                        {item.influencer.niche ?? "—"}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            STATUS_COLORS[item.contact_status] ??
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {item.contact_status.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Added by */}
                      <td className="px-3 py-3">
                        {item.added_by ? (
                          <div className="relative group inline-flex items-center gap-2">
                            <Avatar
                              name={item.added_by.name}
                              image={item.added_by.image}
                              size={7}
                            />
                            <span className="text-xs text-gray-600 hidden sm:block">
                              {item.added_by.name?.split(" ")[0] ?? "—"}
                            </span>
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-20 pointer-events-none">
                              <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 whitespace-nowrap shadow-xl">
                                <p className="font-semibold">
                                  {item.added_by.name ?? "Unknown"}
                                </p>
                                <p className="text-gray-400 mt-0.5">
                                  Added{" "}
                                  {formatShortDate(item.added_by.added_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              console.log(
                                "[History] bi.id:", item.id,
                                "| influencer_id:", item.influencer_id
                              )
                              setHistoryTarget(item)
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                            title="View history"
                          >
                            <IconHistory size={15} />
                          </button>
                          <button
                            onClick={() =>
                              deleteInfluencer(item.id, item.influencer_id)
                            }
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                            title="Remove"
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* KANBAN VIEW */}
        {view === "kanban" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(
              [
                { key: "not_contacted",  label: "Not Contacted", color: "bg-gray-400"  },
                { key: "contacted",      label: "Contacted",     color: "bg-yellow-400"},
                { key: "agreed",         label: "Agreed",        color: "bg-green-500" },
                { key: "not_interested", label: "Not Interested",color: "bg-red-400"   },
              ] as const
            ).map(({ key, label, color }) => {
              const stageItems = filtered.filter(
                (i) => i.contact_status === key
              )
              return (
                <div key={key} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <h3 className="text-sm font-semibold text-gray-700">
                      {label}
                    </h3>
                    <span className="ml-auto text-xs text-gray-400 bg-white border rounded-full px-2 py-0.5">
                      {stageItems.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {stageItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white border border-gray-100 rounded-xl p-3 hover:shadow-md transition cursor-pointer"
                        onClick={() => {
                          console.log("[History kanban] bi.id:", item.id)
                          setHistoryTarget(item)
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar
                            name={item.influencer.full_name}
                            image={item.influencer.profile_image_url}
                            size={8}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {item.influencer.full_name ||
                                `@${item.influencer.handle}`}
                            </p>
                            <p className="text-xs text-gray-400">
                              @{item.influencer.handle}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                          <span>
                            {item.influencer.follower_count.toLocaleString()}{" "}
                            followers
                          </span>
                          <span>{item.influencer.engagement_rate}% eng</span>
                        </div>
                        {item.added_by && (
                          <div className="flex items-center gap-1.5 pt-2 border-t border-gray-50">
                            <Avatar
                              name={item.added_by.name}
                              image={item.added_by.image}
                              size={5}
                            />
                            <span className="text-[11px] text-gray-400">
                              Added by{" "}
                              {item.added_by.name?.split(" ")[0] ?? "someone"}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {stageItems.length === 0 && (
                      <div className="text-center py-6 text-gray-300 text-xs border-2 border-dashed border-gray-100 rounded-xl">
                        No influencers here
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── History Modal ── */}
      {historyTarget && (
        <HistoryModal
          brandId={brandId}
          influencer={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {/* ── Filter Modal ── */}
      {openFilter && (
        <FilterModal
          filters={filters}
          influencers={influencers}
          onChange={setFilters}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          onClose={() => setOpenFilter(false)}
        />
      )}

      {/* ── Add Influencer Modals ── */}
      {openModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[560px] rounded-2xl shadow-xl p-8">
            {modalType === "select" && (
              <AddInfluencerModal
                setType={setModalType}
                onClose={() => setOpenModal(false)}
              />
            )}
            {modalType === "manual" && (
              <AddManualInfluencer
                onBack={() => setModalType("select")}
                onSave={handleAdded}
              />
            )}
            {modalType === "instagram" && (
              <AddInstagramInfluencer
                onBack={() => setModalType("select")}
                onSave={handleAdded}
              />
            )}
            {modalType === "tiktok" && (
              <AddTiktokCreator
                onBack={() => setModalType("select")}
                onSave={handleAdded}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      {openImport && (
        <ImportInfluencerList
          close={() => setOpenImport(false)}
          onImport={() => {
            fetchInfluencers()
            setOpenImport(false)
          }}
        />
      )}

      {/* ── Trial Limit Modal ── */}
      {showTrialLimitModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* Overlay covering only content area (not sidebar/navbar) */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(10,20,15,0.45)", backdropFilter: "blur(1px)" }}
            onClick={() => setShowTrialLimitModal(false)}
          />
          
          {/* Card centered on overlay */}
          <div
            className="flex flex-col items-center gap-6 rounded-2xl px-8 py-9 text-center relative"
            style={{
              background: "rgba(255,255,255,0.98)",
              boxShadow:
                "0 2px 0px rgba(15,107,62,0.08) inset, 0 32px 72px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(31,174,91,0.2)",
              maxWidth: 380,
              width: "88%",
              borderRadius: 20,
            }}
          >
            {/* Clock icon */}
            <div
              className="flex items-center justify-center"
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(145deg, #fef3c7 0%, #fde68a 100%)",
                boxShadow: "0 1px 3px rgba(180,83,9,0.15), 0 0 0 1px rgba(180,83,9,0.1)",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#b45309"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            {/* Text */}
            <div className="flex flex-col gap-2">
              <h2
                className="text-xl font-semibold leading-tight"
                style={{ color: "#111827", letterSpacing: "-0.025em" }}
              >
                Import unavailable on trial
              </h2>
              <p
                className="text-sm leading-relaxed mx-auto"
                style={{ color: "#6b7280", maxWidth: 280 }}
              >
                You're currently on a free trial with a 100-influencer limit. Upgrade to a paid plan to import influencers in bulk.
              </p>
            </div>

            {/* Plan pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {["Solo", "Team"].map((plan) => (
                <span
                  key={plan}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide"
                  style={{
                    background: "#f0faf5",
                    color: "#0F6B3E",
                    border: "1px solid #c3e6d4",
                    letterSpacing: "0.03em",
                  }}
                >
                  {plan}
                </span>
              ))}
            </div>

            {/* CTA */}
            <a
              href="/pricing"
              className="block w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg,#22c55e 0%,#0F6B3E 100%)",
                boxShadow: "0 4px 16px rgba(15,107,62,0.32), 0 1px 0 rgba(255,255,255,0.15) inset",
              }}
            >
              View pricing & upgrade
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
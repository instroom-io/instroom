"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { ChevronDown, Search, Plus, Loader2, CheckCircle2, AlertCircle, X, Users, UserPlus, Check } from "lucide-react"

// ─── Skeleton preview config (static, non-functional) ───────────────────────
const DISCOVERY_FILTER_LABELS = ["Platform", "Niche", "Location", "Audience size", "Engagement rate", "Sort"]
const DISCOVERY_SKELETON_CARD_COUNT = 12

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

function DiscoveryCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <SkeletonBlock className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <SkeletonBlock className="h-2.5 w-3/4" />
          <SkeletonBlock className="h-2 w-1/2" />
        </div>
        <SkeletonBlock className="h-4 w-12 rounded-full flex-shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 2 }).map((_, j) => (
          <div key={j} className="flex flex-col gap-1">
            <SkeletonBlock className="h-1.5 w-8" />
            <SkeletonBlock className="h-2.5 w-12" />
          </div>
        ))}
      </div>

      <SkeletonBlock className="h-6 w-full rounded-lg" />
    </div>
  )
}

// ─── API Config ─────────────────────────────────────────────────────────────
const API_ENDPOINTS = {
  instagram: (u: string) => `https://api.instroom.io/v2/${u}/instagram`,
  tiktok: (u: string) => `https://api.instroom.io/${u}/tiktok`,
}

const recommendedSearches = [
  "#EcoFriendlyLiving",
  "#MinimalistStyle",
  "#WellnessJourney",
  "#HandmadeWithLove",
]

type QuickResult = {
  username: string
  name: string
  avatar: string
  followers: string
  followersRaw: number
  platform: string
  engagement: string
  email: string
  location: string
  bio: string
  profileUrl: string
}

// ─── Shared localStorage key for influencer list ────────────────────────────
const INFLUENCER_LIST_KEY = "instroom_influencer_list"

type StoredInfluencer = {
  id: string
  handle: string
  platform: string
  full_name: string
  first_name: string
  email: string
  follower_count: string
  engagement_rate: string
  location: string
  social_link: string
  profile_picture: string
  contact_info: string
  niche: string
  contact_status: string
  stage: string
  agreed_rate: string
  notes: string
  gender: string
  approval_status: "Pending" | "Approved" | "Declined"
  transferred_date: string
  approval_notes: string
  decline_reason: string
  tier: string
  community_status: string
  custom: Record<string, string>
  addedAt: number // timestamp for deduplication
}

function addToInfluencerList(creator: QuickResult, selectedPlatform: string): { success: boolean; message: string } {
  try {
    const existing: StoredInfluencer[] = JSON.parse(localStorage.getItem(INFLUENCER_LIST_KEY) || "[]")

    const platformKey = selectedPlatform.toLowerCase()
    const cleanHandle = creator.username.replace(/^@/, "").toLowerCase()

    // Check for duplicates by handle + platform
    const isDuplicate = existing.some(
      (inf) => inf.handle.toLowerCase() === cleanHandle && inf.platform === platformKey
    )

    if (isDuplicate) {
      return { success: false, message: `@${cleanHandle} is already in your influencer list` }
    }

    const newInfluencer: StoredInfluencer = {
      id: crypto.randomUUID(),
      handle: cleanHandle,
      platform: platformKey,
      full_name: creator.name || "",
      first_name: creator.name ? creator.name.split(" ")[0] : "",
      email: creator.email || "",
      follower_count: String(creator.followersRaw || 0),
      engagement_rate: creator.engagement ? creator.engagement.replace("%", "") : "0",
      location: creator.location || "",
      social_link: creator.profileUrl || "",
      profile_picture: creator.avatar || "",
      contact_info: creator.email || "",
      niche: "",
      contact_status: "not_contacted",
      stage: "1",
      agreed_rate: "",
      notes: "",
      gender: "",
      approval_status: "Pending",
      transferred_date: "",
      approval_notes: "",
      decline_reason: "",
      tier: "Bronze",
      community_status: "Pending",
      custom: {},
      addedAt: Date.now(),
    }

    existing.push(newInfluencer)
    localStorage.setItem(INFLUENCER_LIST_KEY, JSON.stringify(existing))

    return { success: true, message: `@${cleanHandle} added to your influencer list!` }
  } catch (err) {
    console.error("Error adding to influencer list:", err)
    return { success: false, message: "Failed to add to list. Try again." }
  }
}

function isInInfluencerList(username: string, platform: string): boolean {
  try {
    const existing: StoredInfluencer[] = JSON.parse(localStorage.getItem(INFLUENCER_LIST_KEY) || "[]")
    const cleanHandle = username.replace(/^@/, "").toLowerCase()
    const platformKey = platform.toLowerCase()
    return existing.some(
      (inf) => inf.handle.toLowerCase() === cleanHandle && inf.platform === platformKey
    )
  } catch {
    return false
  }
}

// ─── Toast Component ────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed top-4 right-4 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg animate-in slide-in-from-right ${
      type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
    }`}>
      {type === "success" ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertCircle size={16} className="text-red-600" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

// ─── Coming Soon Modal ───────────────────────────────────────────────────────
// Absolutely positioned within the page's own (position:relative) container
// only — never fixed to the viewport, no page-level backdrop. It can only
// ever cover THIS page's content and can never reach the sidebar or header,
// which live outside this component's DOM subtree entirely.
function ComingSoonOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4 py-6">
      <div className="pointer-events-auto text-center px-7 py-7 sm:px-10 sm:py-9 bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-[600px]">
        <div className="w-12 h-12 bg-gradient-to-br from-[#0F6B3E] to-[#2A9D6E] rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803M10.5 7.5v3m0 0v3m0-3h3m-3 0H7.5" />
          </svg>
        </div>

        <span className="inline-block bg-[#0F6B3E]/10 text-[#0F6B3E] text-[11px] font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-3">
          Coming Soon
        </span>

        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          Influencer Discovery
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Search 15M+ creators, filter by niche, location, and engagement — we'll notify you when it launches.
        </p>
      </div>
    </div>
  )
}

function InfluencerDiscoveryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [brandId, setBrandId] = useState<string | null>(null)

  const [topic, setTopic] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState("Instagram")
  const [openPlatform, setOpenPlatform] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Quick add states
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickUsername, setQuickUsername] = useState("")
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickResult, setQuickResult] = useState<QuickResult | null>(null)
  const [quickError, setQuickError] = useState<string | null>(null)

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  // Track which creators have been added to list (for UI feedback)
  const [addedToList, setAddedToList] = useState<Set<string>>(new Set())

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("recentSearches")
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to load recent searches", e)
      }
    }
  }, [])

  // Watch for brand changes
  useEffect(() => {
    const id = searchParams.get("brandId")
    setBrandId(id)
  }, [searchParams])

  // Save recent search
  const saveRecentSearch = (searchTerm: string) => {
    const cleanTerm = searchTerm.replace("#", "")
    setRecentSearches((prev) => {
      const updated = [cleanTerm, ...prev.filter((s) => s !== cleanTerm)].slice(0, 5)
      localStorage.setItem("recentSearches", JSON.stringify(updated))
      return updated
    })
  }

  const searchCreators = () => {
    if (!topic.trim()) return

    const cleanTopic = topic.replace("#", "")
    saveRecentSearch(cleanTopic)

    const params = new URLSearchParams()
    params.set("topic", cleanTopic)
    params.set("platform", selectedPlatform)
    if (brandId) params.set("brandId", brandId)

    router.push(
      `/dashboard/influencer-discovery/search?${params.toString()}`
    )
  }

  const handleTagClick = (tag: string) => {
    const cleanTag = tag.replace("#", "")
    saveRecentSearch(cleanTag)

    const params = new URLSearchParams()
    params.set("topic", cleanTag)
    params.set("platform", selectedPlatform)
    if (brandId) params.set("brandId", brandId)

    router.push(
      `/dashboard/influencer-discovery/search?${params.toString()}`
    )
  }

  const handleRecentSearchClick = (search: string) => {
    setTopic(search)
    saveRecentSearch(search)

    const params = new URLSearchParams()
    params.set("topic", search)
    params.set("platform", selectedPlatform)
    if (brandId) params.set("brandId", brandId)

    router.push(
      `/dashboard/influencer-discovery/search?${params.toString()}`
    )
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem("recentSearches")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && topic.trim()) {
      searchCreators()
    }
  }

  // Quick lookup — hit the real API
  const handleQuickLookup = async () => {
    if (!quickUsername.trim()) return

    setQuickLoading(true)
    setQuickError(null)
    setQuickResult(null)

    const clean = quickUsername.trim().replace("@", "").toLowerCase()
    const platformKey = selectedPlatform.toLowerCase() as "instagram" | "tiktok"

    // Only Instagram & TikTok have endpoints
    if (platformKey !== "instagram" && platformKey !== "tiktok") {
      setQuickError(`${selectedPlatform} lookup is not supported yet. Only Instagram and TikTok are available.`)
      setQuickLoading(false)
      return
    }

    try {
      const url = API_ENDPOINTS[platformKey](clean)
      const res = await fetch(url)

      if (!res.ok) {
        if (res.status === 404) {
          setQuickError(`@${clean} not found on ${selectedPlatform}. Check the username.`)
        } else if (res.status === 429) {
          setQuickError("Rate limit reached. Wait a moment and try again.")
        } else {
          setQuickError(`API error (${res.status}). Try again.`)
        }
        setQuickLoading(false)
        return
      }

      const json = await res.json()
      const d = json.data || json.user || json

      const fol = Number(d.follower_count || d.followers || 0)
      const fmt = (n: number) => {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
        if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
        return n.toString()
      }

      const engRate = d.engagement_rate ? parseFloat(String(d.engagement_rate)).toFixed(2) : "0"

      const result: QuickResult = {
        username: d.username || clean,
        name: d.full_name || d.name || clean,
        avatar:
          d.profile_pic_url ||
          d.photo ||
          d.avatar ||
          `https://ui-avatars.com/api/?name=${clean}&background=0F6B3E&color=fff`,
        followers: fmt(fol),
        followersRaw: fol,
        platform: selectedPlatform,
        engagement: engRate + "%",
        email: d.email && d.email !== "Not Available" ? d.email : "",
        location: d.location || d.city || d.country || "",
        bio: d.biography || d.bio || "",
        profileUrl:
          d.profile_url ||
          (platformKey === "tiktok"
            ? `https://tiktok.com/@${clean}`
            : `https://instagram.com/${clean}`),
      }

      setQuickResult(result)

      // Check if already in list
      if (isInInfluencerList(clean, selectedPlatform)) {
        setAddedToList((prev) => new Set(prev).add(`${clean}:${platformKey}`))
      }
    } catch (err) {
      console.error(err)
      setQuickError("Network error. Check your connection.")
    } finally {
      setQuickLoading(false)
    }
  }

  // ★ Add to influencer list
  const handleAddToList = () => {
    if (!quickResult) return

    const result = addToInfluencerList(quickResult, selectedPlatform)
    setToast({ message: result.message, type: result.success ? "success" : "error" })

    if (result.success) {
      const platformKey = selectedPlatform.toLowerCase()
      setAddedToList((prev) => new Set(prev).add(`${quickResult.username.toLowerCase()}:${platformKey}`))
    }
  }

  // Navigate to search results with the looked-up username pre-loaded
  const handleGoToProfile = () => {
    if (!quickResult) return
    router.push(
      `/dashboard/influencer-discovery/search?topic=${encodeURIComponent(
        quickResult.username
      )}&platform=${encodeURIComponent(selectedPlatform)}&mode=username`
    )
  }

  const platforms = [
    {
      name: "Instagram",
      icon: (
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg"
          alt="Instagram"
          className="w-6 h-6"
        />
      ),
    },
    {
      name: "TikTok",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.89 2.89 2.896 2.896 0 0 1-2.889-2.89 2.896 2.896 0 0 1 2.89-2.889c.302 0 .595.05.872.137V9.257a6.339 6.339 0 0 0-5.053 2.212 6.339 6.339 0 0 0-1.33 5.52 6.34 6.34 0 0 0 5.766 4.731 6.34 6.34 0 0 0 6.34-6.34V8.898a7.756 7.756 0 0 0 4.422 1.393V6.825a4.8 4.8 0 0 1-2.443-.139z" />
        </svg>
      ),
    },
    {
      name: "YouTube",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
    },
  ]

  const currentPlatform = platforms.find((p) => p.name === selectedPlatform)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenPlatform(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const isAlreadyAdded = quickResult
    ? addedToList.has(`${quickResult.username.toLowerCase()}:${selectedPlatform.toLowerCase()}`)
    : false

  return (
    <div className="relative h-[calc(100vh-var(--header-height))] overflow-hidden bg-gradient-to-br from-[#F7F9F8] via-white to-[#F7F9F8]">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/*
        Skeleton preview of the future page — static, non-functional. The outer
        wrapper above is bounded to the viewport height below the header and
        clips overflow, so a second row of cards can render underneath (to
        show there's "more page" beneath the modal) without ever producing a
        page-level scrollbar — this crops intentional extra content, it does
        not mask a broken/overflowing layout.
      */}
      <div
        className="pointer-events-none select-none max-w-6xl mx-auto pt-4 pb-5 px-4 sm:px-6 lg:px-8"
        aria-hidden="true"
        style={{ opacity: 0.8 }}
      >
        {/* Search bar skeleton */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 mb-3">
          <div className="flex flex-col sm:flex-row gap-1.5">
            <SkeletonBlock className="h-9 w-full sm:w-24 rounded-lg" />
            <SkeletonBlock className="h-9 flex-1 rounded-lg" />
            <SkeletonBlock className="h-9 w-full sm:w-32 rounded-lg" />
          </div>
        </div>

        {/* Filter row skeleton */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {DISCOVERY_FILTER_LABELS.map((label) => (
            <SkeletonBlock key={label} className="h-6 w-[90px] rounded-full" />
          ))}
        </div>

        {/*
          Results grid skeleton — enough rows to fill down toward the bottom
          of the viewport on most screens. The outer wrapper is bounded to
          the viewport height and clips overflow, so on shorter screens this
          naturally ends mid-row (a "there's more below" peek) instead of a
          hard, empty cutoff — and never produces a page-level scrollbar.
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: DISCOVERY_SKELETON_CARD_COUNT }).map((_, i) => (
            <DiscoveryCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* ─── Coming Soon modal — centered above the skeleton, scoped to this page only ─── */}
      <ComingSoonOverlay />
    </div>
  )
}

export default function InfluencerDiscoveryPage() {
  return (
    <Suspense>
      <InfluencerDiscoveryContent />
    </Suspense>
  )
}
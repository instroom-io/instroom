"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { ChevronDown, Search, Plus, Loader2, CheckCircle2, AlertCircle, X, Users, UserPlus, Check } from "lucide-react"

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

// ─── Coming Soon Overlay ─────────────────────────────────────────────────────
function ComingSoonOverlay() {
  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center pt-16"
      style={{
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        backgroundColor: "rgba(247, 249, 248, 0.75)",
      }}
    >
      <div className="text-center px-10 py-10 bg-white rounded-3xl border border-gray-100 shadow-2xl w-full max-w-2xl mx-4">
        {/* Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-[#0F6B3E] to-[#2A9D6E] rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803M10.5 7.5v3m0 0v3m0-3h3m-3 0H7.5" />
          </svg>
        </div>

        {/* Badge */}
        <span className="inline-block bg-[#0F6B3E]/10 text-[#0F6B3E] text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-4">
          Coming Soon
        </span>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Influencer Discovery
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          We're building something powerful — search 15M+ creators across Instagram and TikTok, filter by niche, location, engagement rate, and add them directly to your campaigns.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {["15M+ profiles", "Instagram & TikTok", "Email capture", "1-click add"].map((f) => (
            <span key={f} className="bg-gray-50 border border-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-full">
              {f}
            </span>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          We'll notify you when it launches.
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
    <>
      {/* ─── Outer wrapper positions the Coming Soon overlay over the page ─── */}
      <div className="relative">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* ─── Page content — blurred & non-interactive behind the overlay ─── */}
        <div
          className="min-h-screen bg-gradient-to-br from-[#F7F9F8] via-white to-[#F7F9F8] pointer-events-none select-none"
          aria-hidden="true"
          style={{ filter: "blur(2px)" }}
        >
          <div className="max-w-6xl mx-auto py-16 px-4 sm:px-6 lg:px-8">

            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
                Find creators who
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E]">
                  influence your customers
                </span>
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Connect with authentic voices that resonate with your brand
              </p>
            </div>

            {/* Search Card */}
            <div className="max-w-4xl mx-auto mb-12">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-visible">
                <div className="p-2">
                  <div className="flex flex-col sm:flex-row gap-2">

                    {/* Platform Selector */}
                    <div ref={dropdownRef} className="relative z-10">
                      <button
                        type="button"
                        className="bg-gray-50 hover:bg-gray-100 rounded-xl px-5 py-4 flex items-center justify-center gap-2 transition-colors"
                      >
                        <div
                          className={`${
                            selectedPlatform === "Instagram"
                              ? "text-[#E4405F]"
                              : selectedPlatform === "TikTok"
                              ? "text-black"
                              : "text-[#FF0000]"
                          }`}
                        >
                          {currentPlatform?.icon}
                        </div>
                        <ChevronDown size={18} />
                      </button>
                    </div>

                    {/* Topic Input */}
                    <div className="flex-1 relative">
                      <input
                        value={topic}
                        readOnly
                        placeholder={`Search by topic on ${selectedPlatform}...`}
                        className="w-full px-4 py-4 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F6B3E]/20"
                      />
                    </div>

                    {/* Search Button */}
                    <button
                      disabled
                      className="bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] text-white font-semibold px-8 py-4 rounded-xl opacity-50 cursor-not-allowed"
                    >
                      Find Creators
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Username Lookup */}
            <div className="max-w-4xl mx-auto mb-12">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#0F6B3E] to-[#2A9D6E] rounded-xl flex items-center justify-center">
                    <Users size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Look up by Username</h3>
                    <p className="text-sm text-gray-500">
                      Fetch real data from {selectedPlatform} API instantly
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      @
                    </span>
                    <input
                      readOnly
                      placeholder="username"
                      className="w-full pl-9 pr-4 py-3 bg-gray-50 rounded-xl text-sm"
                    />
                  </div>
                  <button
                    disabled
                    className="bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] text-white font-medium px-6 py-3 rounded-xl opacity-50 cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <Search size={16} />
                    Lookup
                  </button>
                </div>

                <p className="text-xs text-gray-400 mt-3">
                  Supported: Instagram &amp; TikTok · YouTube coming soon
                </p>
              </div>
            </div>

            {/* Recommended Searches */}
            <div className="max-w-4xl mx-auto mb-16">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 px-2">
                Recommended Searches
              </h3>
              <div className="flex flex-wrap gap-3 justify-center">
                {recommendedSearches.map((tag) => (
                  <button
                    key={tag}
                    disabled
                    className="px-6 py-2.5 rounded-full bg-white border-2 border-gray-200 text-gray-600 cursor-not-allowed"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Coming Soon overlay ─── */}
        <ComingSoonOverlay />
      </div>
    </>
  )
}

export default function InfluencerDiscoveryPage() {
  return (
    <Suspense>
      <InfluencerDiscoveryContent />
    </Suspense>
  )
}
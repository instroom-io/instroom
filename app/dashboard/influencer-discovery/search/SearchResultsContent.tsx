"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  SlidersHorizontal, X, Bookmark, Eye, ExternalLink,
  Loader2, CheckCircle2, AlertCircle, Search, RefreshCw,
  Plus, Users, UserPlus, Check
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────
type Creator = {
  id: string
  name: string
  username: string
  avatar: string
  bio: string
  followers: string
  followersRaw: number
  engagement: string
  engagementRaw: number
  growth: string
  fee: string
  platform: string
  avgLikes: string
  avgComments: string
  totalPosts: string
  category: string
  location: string
  website: string
  email: string
  profileUrl: string
}

// ─── API Config ─────────────────────────────────────────────────────────────
const API_ENDPOINTS = {
  instagram: (u: string) => `https://api.instroom.io/v2/${u}/instagram`,
  tiktok: (u: string) => `https://api.instroom.io/${u}/tiktok`,
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
  addedAt: number
}

function addToInfluencerList(creator: Creator, platformName: string): { success: boolean; message: string } {
  try {
    const existing: StoredInfluencer[] = JSON.parse(localStorage.getItem(INFLUENCER_LIST_KEY) || "[]")

    const platformKey = platformName.toLowerCase()
    const cleanHandle = creator.username.replace(/^@/, "").toLowerCase()

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
      engagement_rate: creator.engagementRaw ? String(creator.engagementRaw) : "0",
      location: creator.location || "",
      social_link: creator.profileUrl || "",
      profile_picture: creator.avatar || "",
      contact_info: creator.email || "",
      niche: creator.category || "",
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
    <div className={`fixed top-4 right-4 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg ${
      type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
    }`}>
      {type === "success" ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertCircle size={16} className="text-red-600" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number): string => {
  if (!n || isNaN(n)) return "0"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return n.toString()
}

const estFee = (followers: number, eng: number): string => {
  if (!followers || isNaN(followers)) return "$0"
  let fee = Math.floor(followers * 0.012 * (1 + eng / 100))
  fee = Math.max(50, Math.min(50_000, fee))
  return "$" + fee.toLocaleString()
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────
class RateLimiter {
  private queue: (() => Promise<void>)[] = []
  private processing = false
  private lastRequestTime = 0
  private minDelay = 600

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      this.process()
    })
  }

  private async process() {
    if (this.processing) return
    this.processing = true
    while (this.queue.length > 0) {
      const now = Date.now()
      const gap = now - this.lastRequestTime
      if (gap < this.minDelay) {
        await new Promise((r) => setTimeout(r, this.minDelay - gap))
      }
      const fn = this.queue.shift()
      if (fn) {
        this.lastRequestTime = Date.now()
        await fn()
      }
    }
    this.processing = false
  }
}

const rateLimiter = new RateLimiter()

// ─── API Fetch ──────────────────────────────────────────────────────────────
async function fetchCreatorFromAPI(
  username: string,
  platformName: string
): Promise<Creator | null> {
  const clean = username.trim().replace("@", "").toLowerCase()
  if (!clean) return null

  const platformKey = platformName.toLowerCase() as "instagram" | "tiktok"

  if (platformKey !== "instagram" && platformKey !== "tiktok") return null

  try {
    const url = API_ENDPOINTS[platformKey](clean)
    const res = await rateLimiter.add(() => fetch(url))

    if (!res.ok) {
      if (res.status === 404) console.warn(`Not found: ${clean}`)
      return null
    }

    const json = await res.json()
    const d = json.data || json.user || json

    if (!d || typeof d !== "object") return null

    const followersCount = Number(d.follower_count || d.followers || 0)
    const avgLikesCount = Number(d.avg_likes || d.average_likes || d.averageLikes || 0)
    const avgCommentsCount = Number(d.avg_comments || d.average_comments || d.averageComments || 0)
    const totalPostsCount = Number(d.media_count || d.total_posts || d.video_count || 0)
    const growthRate = Number(d.growth_rate || d.growth || 0)

    let engRate = 0
    if (followersCount > 0) {
      const raw = ((avgLikesCount + avgCommentsCount) / followersCount) * 100
      engRate = isNaN(raw) || !isFinite(raw) ? 0 : parseFloat(raw.toFixed(2))
    }

    return {
      id: d.id || `${platformKey}-${clean}-${Date.now()}`,
      name: d.full_name || d.name || clean,
      username: d.username || clean,
      avatar:
        d.profile_pic_url ||
        d.photo ||
        d.avatar ||
        `https://ui-avatars.com/api/?name=${clean}&background=0F6B3E&color=fff`,
      bio: d.biography || d.bio || "",
      followers: fmt(followersCount),
      followersRaw: followersCount,
      engagement: engRate.toFixed(2) + "%",
      engagementRaw: engRate,
      growth: growthRate > 0 ? growthRate.toFixed(1) + "%" : "N/A",
      fee: estFee(followersCount, engRate),
      platform: platformName,
      avgLikes: fmt(avgLikesCount),
      avgComments: fmt(avgCommentsCount),
      totalPosts: fmt(totalPostsCount),
      category: d.category || d.business_category || "Creator",
      location: d.location || d.city || "",
      website: d.external_url || d.website || "",
      email: d.business_email || d.email || "",
      profileUrl:
        d.profile_url ||
        (platformKey === "tiktok"
          ? `https://tiktok.com/@${clean}`
          : `https://instagram.com/${clean}`),
    }
  } catch (err) {
    console.error(`Error fetching ${username}:`, err)
    return null
  }
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function SearchResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const topic = searchParams.get("topic")
  const platform = searchParams.get("platform") || "Instagram"
  const mode = searchParams.get("mode")

  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [additionalKeywords, setAdditionalKeywords] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [excludeSaved, setExcludeSaved] = useState(false)
  const [selectedOperator, setSelectedOperator] = useState("AND")

  const [minFollowers, setMinFollowers] = useState("")
  const [maxBudget, setMaxBudget] = useState("")
  const [minEngagement, setMinEngagement] = useState("")

  const [savedCreators, setSavedCreators] = useState<Set<string>>(new Set())
  const [peekCreator, setPeekCreator] = useState<Creator | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addMode, setAddMode] = useState<"single" | "bulk">("single")
  const [singleUsername, setSingleUsername] = useState("")
  const [bulkUsernames, setBulkUsernames] = useState("")
  const [addingInfluencer, setAddingInfluencer] = useState(false)
  const [addStatus, setAddStatus] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })
  const [addedCreators, setAddedCreators] = useState<Creator[]>([])

  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  // Track which creators have been added to the influencer list
  const [addedToListSet, setAddedToListSet] = useState<Set<string>>(new Set())

  // ─── Load saved creators & check which are in the influencer list ─────────
  useEffect(() => {
    const saved = localStorage.getItem("savedCreators")
    if (saved) {
      try {
        setSavedCreators(new Set(JSON.parse(saved)))
      } catch (e) {
        console.error("Error loading saved creators:", e)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      "savedCreators",
      JSON.stringify(Array.from(savedCreators))
    )
  }, [savedCreators])

  // Refresh which creators are already in the influencer list
  const refreshAddedToList = useCallback(() => {
    try {
      const existing: StoredInfluencer[] = JSON.parse(localStorage.getItem(INFLUENCER_LIST_KEY) || "[]")
      const set = new Set(existing.map((inf) => `${inf.handle.toLowerCase()}:${inf.platform}`))
      setAddedToListSet(set)
    } catch {
      setAddedToListSet(new Set())
    }
  }, [])

  useEffect(() => {
    refreshAddedToList()
  }, [refreshAddedToList])

  const toggleSave = (username: string) => {
    setSavedCreators((prev) => {
      const next = new Set(prev)
      if (next.has(username)) next.delete(username)
      else next.add(username)
      return next
    })
  }

  // ★ Add creator to influencer list
  const handleAddCreatorToList = (creator: Creator) => {
    const result = addToInfluencerList(creator, platform)
    setToast({ message: result.message, type: result.success ? "success" : "error" })
    if (result.success) {
      refreshAddedToList()
    }
  }

  const isCreatorInList = (creator: Creator): boolean => {
    const cleanHandle = creator.username.replace(/^@/, "").toLowerCase()
    const platformKey = platform.toLowerCase()
    return addedToListSet.has(`${cleanHandle}:${platformKey}`)
  }

  // ─── Initial load ─────────────────────────────────────────────────────────
  const loadInitialData = useCallback(async () => {
    if (!topic) {
      setLoading(false)
      return
    }

    setLoading(true)
    setSearchError(null)

    if (mode === "username") {
      const creator = await fetchCreatorFromAPI(topic, platform)
      if (creator) {
        setCreators([creator])
      } else {
        setSearchError(
          `Could not find @${topic} on ${platform}. Check the username.`
        )
      }
      setLoading(false)
      return
    }

    setCreators([])
    setSearchError(null)
    setLoading(false)
  }, [topic, platform, mode])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // ─── Add single influencer ────────────────────────────────────────────────
  const handleAddSingleInfluencer = async () => {
    if (!singleUsername.trim()) return

    setAddingInfluencer(true)
    setAddStatus({ type: null, message: "" })

    const username = singleUsername.trim().replace("@", "")
    const creator = await fetchCreatorFromAPI(username, platform)

    if (creator) {
      setCreators((prev) => {
        const exists = prev.some(
          (c) => c.username.toLowerCase() === creator.username.toLowerCase()
        )
        if (exists) {
          setAddStatus({
            type: "error",
            message: `@${creator.username} is already in the list`,
          })
          return prev
        }
        setAddStatus({
          type: "success",
          message: `@${creator.username} added successfully!`,
        })
        return [creator, ...prev]
      })
      setAddedCreators((prev) => {
        const exists = prev.some(
          (c) => c.username.toLowerCase() === creator.username.toLowerCase()
        )
        return exists ? prev : [creator, ...prev]
      })
      setSingleUsername("")
    } else {
      setAddStatus({
        type: "error",
        message: `Could not find @${username} on ${platform}. Check the username.`,
      })
    }

    setAddingInfluencer(false)
  }

  // ─── Add bulk influencers ─────────────────────────────────────────────────
  const handleAddBulkInfluencers = async () => {
    if (!bulkUsernames.trim()) return

    setAddingInfluencer(true)
    setAddStatus({ type: null, message: "" })

    const usernames = [
      ...new Set(
        bulkUsernames
          .split(/[,\n]+/)
          .map((u) => u.trim().replace("@", ""))
          .filter((u) => u.length > 0)
      ),
    ]

    const newCreators: Creator[] = []
    const errors: string[] = []
    const duplicates: string[] = []

    for (let i = 0; i < usernames.length; i++) {
      const username = usernames[i]
      setAddStatus({
        type: "success",
        message: `Processing ${i + 1}/${usernames.length}: @${username}...`,
      })

      const creator = await fetchCreatorFromAPI(username, platform)
      if (creator) {
        const existsInCurrent = creators.some(
          (c) => c.username.toLowerCase() === creator.username.toLowerCase()
        )
        const existsInNew = newCreators.some(
          (c) => c.username.toLowerCase() === creator.username.toLowerCase()
        )
        if (!existsInCurrent && !existsInNew) {
          newCreators.push(creator)
        } else {
          duplicates.push(creator.username)
        }
      } else {
        errors.push(username)
      }
    }

    if (newCreators.length > 0) {
      setCreators((prev) => [...newCreators, ...prev])
      setAddedCreators((prev) => [...newCreators, ...prev])
    }

    let message = ""
    if (newCreators.length > 0)
      message += `Added ${newCreators.length} creator(s). `
    if (duplicates.length > 0)
      message += `${duplicates.length} already in list. `
    if (errors.length > 0)
      message += `Failed: ${errors.slice(0, 3).join(", ")}${
        errors.length > 3 ? ` +${errors.length - 3} more` : ""
      }`

    setAddStatus({
      type: newCreators.length > 0 ? "success" : "error",
      message: message || "No creators were added",
    })

    if (newCreators.length > 0) setBulkUsernames("")
    setAddingInfluencer(false)
  }

  // ─── Sidebar peek ─────────────────────────────────────────────────────────
  const openPeek = (creator: Creator) => {
    setPeekCreator(creator)
    setSidebarOpen(true)
  }

  const openProfile = (profileUrl: string) => {
    window.open(profileUrl, "_blank", "noopener,noreferrer")
  }

  const getPlatformIcon = () => {
    switch (platform) {
      case "TikTok":
        return "🎵"
      case "YouTube":
        return "▶️"
      default:
        return "📷"
    }
  }

  const handleSearch = () => {
    if (additionalKeywords) {
      const combinedTopic =
        selectedOperator === "AND"
          ? `${topic} ${additionalKeywords}`
          : `${topic} OR ${additionalKeywords}`

      router.push(
        `/dashboard/influencer-discovery/search?topic=${encodeURIComponent(
          combinedTopic
        )}&platform=${encodeURIComponent(platform)}`
      )
    }
  }

  const handleBackToSearch = () => {
    router.push("/dashboard/influencer-discovery")
  }

  // ─── Filter & sort ────────────────────────────────────────────────────────
  const filteredCreators = creators.filter((creator) => {
    if (excludeSaved && savedCreators.has(creator.username)) return false
    if (minFollowers && creator.followersRaw < parseInt(minFollowers))
      return false
    if (maxBudget) {
      const feeValue = parseInt(creator.fee.replace(/[$,]/g, ""))
      if (feeValue > parseInt(maxBudget)) return false
    }
    if (minEngagement) {
      if (creator.engagementRaw < parseFloat(minEngagement)) return false
    }
    return true
  })

  const sortedCreators = [...filteredCreators].sort(
    (a, b) => b.followersRaw - a.followersRaw
  )

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7F9F8] via-white to-[#F7F9F8]">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={handleBackToSearch}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-[#0F6B3E] transition group"
        >
          <svg
            className="w-5 h-5 group-hover:-translate-x-1 transition"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Search
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            {mode === "username" ? (
              <>
                Profile:{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E]">
                  @{topic}
                </span>
              </>
            ) : (
              <>
                Results for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E]">
                  #{topic}
                </span>
              </>
            )}
          </h1>
          <p className="text-gray-600">
            Platform: <span className="font-medium">{platform}</span>
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl">{getPlatformIcon()}</span>
              <span className="text-sm text-gray-600">
                Show influencers who talk about
              </span>
              <div className="bg-gradient-to-r from-[#0F6B3E]/10 to-[#2A9D6E]/10 px-3 py-1.5 rounded-full text-sm font-medium text-[#0F6B3E]">
                #{topic}
              </div>
              <input
                placeholder="Add more keywords..."
                className="flex-1 min-w-[200px] border-none outline-none text-sm bg-gray-50 px-4 py-2 rounded-xl focus:ring-2 focus:ring-[#0F6B3E]/20 transition"
                value={additionalKeywords}
                onChange={(e) => setAdditionalKeywords(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="border border-gray-200 px-3 py-2 rounded-xl text-sm bg-white hover:bg-gray-50 transition"
              >
                <option>AND</option>
                <option>OR</option>
              </select>
              <button
                onClick={handleSearch}
                disabled={!additionalKeywords}
                className="bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] hover:from-[#0c5a34] hover:to-[#238b5a] text-white px-5 py-2 rounded-xl font-medium text-sm transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Search
              </button>
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="border border-gray-200 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-gray-50 transition"
              >
                <SlidersHorizontal size={16} />
                Filters
                {(minFollowers || maxBudget || minEngagement) && (
                  <span className="ml-1 w-2 h-2 bg-[#0F6B3E] rounded-full" />
                )}
              </button>
            </div>

            {filterOpen && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-2">
                    Min Followers
                  </label>
                  <input
                    type="number"
                    placeholder="1000"
                    value={minFollowers}
                    onChange={(e) => setMinFollowers(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#0F6B3E]/20 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-2">
                    Max Budget ($)
                  </label>
                  <input
                    type="number"
                    placeholder="5000"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#0F6B3E]/20 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-2">
                    Min Engagement Rate (%)
                  </label>
                  <input
                    type="number"
                    placeholder="2"
                    step="0.1"
                    value={minEngagement}
                    onChange={(e) => setMinEngagement(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#0F6B3E]/20 focus:border-transparent outline-none"
                  />
                </div>
                {(minFollowers || maxBudget || minEngagement) && (
                  <div className="md:col-span-3 flex justify-end">
                    <button
                      onClick={() => {
                        setMinFollowers("")
                        setMaxBudget("")
                        setMinEngagement("")
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Result Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Showing{" "}
              <span className="font-semibold text-gray-900">
                {sortedCreators.length}
              </span>{" "}
              creators
              {creators.length > 0 &&
                sortedCreators.length !== creators.length && (
                  <span className="text-gray-400">
                    {" "}
                    (filtered from {creators.length})
                  </span>
                )}
            </span>
            {searchError && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle size={14} />
                {searchError}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeSaved}
                onChange={(e) => setExcludeSaved(e.target.checked)}
                className="rounded border-gray-300 text-[#0F6B3E] focus:ring-[#0F6B3E]"
              />
              Exclude Saved ({savedCreators.size})
            </label>
            <button
              onClick={() => setAddModalOpen(true)}
              className="bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] text-white px-5 py-2 rounded-xl font-medium text-sm hover:shadow-md transition flex items-center gap-2"
            >
              <Plus size={16} /> Add Influencer
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#0F6B3E] rounded-full border-t-transparent animate-spin" />
            </div>
            <p className="mt-4 text-gray-500 font-medium">
              Looking up data on {platform}...
            </p>
          </div>
        )}

        {/* Results Table */}
        {!loading && sortedCreators.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Creator
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Username
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Followers
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Eng Rate
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Growth
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Est Fee
                    </th>
                    <th className="p-4 text-left font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCreators.map((creator) => {
                    const inList = isCreatorInList(creator)
                    return (
                      <tr
                        key={creator.id}
                        className="border-t border-gray-100 hover:bg-gray-50 transition"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={creator.avatar}
                              alt={creator.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-gray-100"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${creator.username}&background=0F6B3E&color=fff`
                              }}
                            />
                            <span className="font-medium text-gray-900">
                              {creator.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600">
                          @{creator.username}
                        </td>
                        <td className="p-4 font-semibold text-gray-800">
                          {creator.followers}
                        </td>
                        <td className="p-4">
                          <span className="text-green-600 font-medium">
                            {creator.engagement}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-blue-600">{creator.growth}</span>
                        </td>
                        <td className="p-4 font-semibold text-[#0F6B3E]">
                          {creator.fee}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {/* ★ Add to Influencer List button */}
                            <button
                              onClick={() => handleAddCreatorToList(creator)}
                              disabled={inList}
                              className={`p-2 rounded-xl border transition group ${
                                inList
                                  ? "border-green-200 bg-green-50 cursor-default"
                                  : "border-gray-200 hover:bg-green-50 hover:border-green-300"
                              }`}
                              title={inList ? "Already in your influencer list" : "Add to influencer list"}
                            >
                              {inList ? (
                                <Check size={18} className="text-green-600" />
                              ) : (
                                <UserPlus
                                  size={18}
                                  className="text-gray-400 group-hover:text-green-600"
                                />
                              )}
                            </button>
                            <button
                              onClick={() => toggleSave(creator.username)}
                              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 transition group"
                              title={
                                savedCreators.has(creator.username)
                                  ? "Unsave"
                                  : "Save"
                              }
                            >
                              <Bookmark
                                size={18}
                                className={
                                  savedCreators.has(creator.username)
                                    ? "fill-[#0F6B3E] text-[#0F6B3E]"
                                    : "text-gray-400 group-hover:text-[#0F6B3E]"
                                }
                              />
                            </button>
                            <button
                              onClick={() => openPeek(creator)}
                              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 transition group"
                              title="Quick peek"
                            >
                              <Eye
                                size={18}
                                className="text-gray-400 group-hover:text-[#0F6B3E]"
                              />
                            </button>
                            <button
                              onClick={() => openProfile(creator.profileUrl)}
                              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 transition group"
                              title="View profile"
                            >
                              <ExternalLink
                                size={18}
                                className="text-gray-400 group-hover:text-[#0F6B3E]"
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && sortedCreators.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-6">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {mode === "username"
                ? "Creator not found"
                : "Add influencers to get started"}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              {searchError ||
                `Use the "Add Influencer" button to look up creators by their ${platform} username. The API will fetch their real profile data.`}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setAddModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] text-white rounded-xl hover:shadow-lg transition flex items-center gap-2"
              >
                <Plus size={18} />
                Add Influencer
              </button>
              <button
                onClick={handleBackToSearch}
                className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition"
              >
                Back to Search
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Peek Sidebar ──────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {peekCreator && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">
                Creator Profile
              </h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center gap-4 mb-6">
                <img
                  src={peekCreator.avatar}
                  alt={peekCreator.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-[#0F6B3E]/20"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${peekCreator.username}&background=0F6B3E&color=fff`
                  }}
                />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {peekCreator.name}
                  </h3>
                  <p className="text-gray-500">@{peekCreator.username}</p>
                </div>
              </div>

              {peekCreator.bio && (
                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                  {peekCreator.bio}
                </p>
              )}

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-gradient-to-br from-[#0F6B3E]/5 to-[#2A9D6E]/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#0F6B3E]">
                    {peekCreator.followers}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Followers</p>
                </div>
                <div className="bg-gradient-to-br from-[#0F6B3E]/5 to-[#2A9D6E]/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#0F6B3E]">
                    {peekCreator.engagement}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Engagement</p>
                </div>
                <div className="bg-gradient-to-br from-[#0F6B3E]/5 to-[#2A9D6E]/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#0F6B3E]">
                    {peekCreator.growth}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Growth</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  ["Avg Likes", peekCreator.avgLikes],
                  ["Avg Comments", peekCreator.avgComments],
                  ["Total Posts", peekCreator.totalPosts],
                  ["Category", peekCreator.category || "—"],
                  ["Location", peekCreator.location || "—"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between py-2 border-b border-gray-100"
                  >
                    <span className="text-gray-500 text-sm">{label}</span>
                    <span className="font-medium text-gray-900">{value}</span>
                  </div>
                ))}
                {peekCreator.website && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">Website</span>
                    <a
                      href={peekCreator.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#0F6B3E] hover:underline truncate max-w-[200px]"
                    >
                      {peekCreator.website.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                {peekCreator.email && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">Email</span>
                    <a
                      href={`mailto:${peekCreator.email}`}
                      className="font-medium text-[#0F6B3E] hover:underline"
                    >
                      {peekCreator.email}
                    </a>
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] rounded-xl p-5 text-white">
                <p className="text-sm opacity-90 mb-1">Estimated Fee</p>
                <p className="text-3xl font-bold">{peekCreator.fee}</p>
                <p className="text-xs opacity-75 mt-2">per sponsored post</p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100">
              <div className="flex gap-3">
                {/* ★ Add to List from sidebar */}
                {(() => {
                  const inList = isCreatorInList(peekCreator)
                  return (
                    <button
                      onClick={() => handleAddCreatorToList(peekCreator)}
                      disabled={inList}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                        inList
                          ? "bg-green-50 text-green-700 border border-green-200 cursor-default"
                          : "bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700"
                      }`}
                    >
                      {inList ? (
                        <>
                          <Check size={16} />
                          In List
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} />
                          Add to List
                        </>
                      )}
                    </button>
                  )
                })()}
                <button
                  onClick={() => openProfile(peekCreator.profileUrl)}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] text-white rounded-xl font-medium text-sm hover:shadow-md transition flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} />
                  View Profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Add Influencer Modal ──────────────────────────────────────────── */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Add Influencer
                </h3>
                <button
                  onClick={() => {
                    setAddModalOpen(false)
                    setAddStatus({ type: null, message: "" })
                    setSingleUsername("")
                    setBulkUsernames("")
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setAddMode("single")}
                  className={`flex-1 py-2 px-4 rounded-xl font-medium transition ${
                    addMode === "single"
                      ? "bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => setAddMode("bulk")}
                  className={`flex-1 py-2 px-4 rounded-xl font-medium transition ${
                    addMode === "bulk"
                      ? "bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Bulk
                </button>
              </div>

              {/* Platform Info */}
              <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-700 flex items-center gap-2">
                  {getPlatformIcon()}
                  Fetching real data from {platform} API
                </p>
              </div>

              {/* Status */}
              {addStatus.type && (
                <div
                  className={`mb-4 p-3 rounded-xl flex items-start gap-2 ${
                    addStatus.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {addStatus.type === "success" ? (
                    <CheckCircle2
                      size={18}
                      className="flex-shrink-0 mt-0.5"
                    />
                  ) : (
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  )}
                  <span className="text-sm">{addStatus.message}</span>
                </div>
              )}

              {/* Single */}
              {addMode === "single" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {platform} Username
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        @
                      </span>
                      <input
                        type="text"
                        placeholder="username"
                        value={singleUsername}
                        onChange={(e) => setSingleUsername(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleAddSingleInfluencer()
                        }
                        className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6B3E]/20 focus:border-[#0F6B3E] outline-none"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={handleAddSingleInfluencer}
                      disabled={addingInfluencer || !singleUsername.trim()}
                      className="bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {addingInfluencer && (
                        <Loader2 size={16} className="animate-spin" />
                      )}
                      Fetch & Add
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Enter the exact {platform} username without @
                  </p>
                </div>
              )}

              {/* Bulk */}
              {addMode === "bulk" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste usernames (comma or newline separated)
                  </label>
                  <textarea
                    placeholder={`cristiano, leomessi\nselenagomez\nkimkardashian`}
                    value={bulkUsernames}
                    onChange={(e) => setBulkUsernames(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0F6B3E]/20 focus:border-[#0F6B3E] outline-none resize-none"
                    rows={6}
                    autoFocus
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    {bulkUsernames && (
                      <span>
                        {
                          bulkUsernames
                            .split(/[,\n]+/)
                            .filter((u) => u.trim()).length
                        }{" "}
                        username(s) detected
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleAddBulkInfluencers}
                    disabled={addingInfluencer || !bulkUsernames.trim()}
                    className="mt-3 w-full bg-gradient-to-r from-[#0F6B3E] to-[#2A9D6E] text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {addingInfluencer && (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    {addingInfluencer ? "Fetching..." : "Fetch All Creators"}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Rate limited to ~2 requests/second to avoid API throttling
                  </p>
                </div>
              )}

              {/* Recently Added */}
              {addedCreators.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Recently Added ({addedCreators.length})
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {addedCreators.slice(0, 5).map((creator) => {
                      const inList = isCreatorInList(creator)
                      return (
                        <div
                          key={creator.id}
                          className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                        >
                          <img
                            src={creator.avatar}
                            alt={creator.name}
                            className="w-8 h-8 rounded-full"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${creator.username}&background=0F6B3E&color=fff`
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {creator.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              @{creator.username} · {creator.followers}
                            </p>
                          </div>
                          <button
                            onClick={() => handleAddCreatorToList(creator)}
                            disabled={inList}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                              inList
                                ? "bg-green-100 text-green-700 cursor-default"
                                : "bg-[#0F6B3E] text-white hover:bg-[#0c5a34]"
                            }`}
                          >
                            {inList ? (
                              <>
                                <Check size={12} />
                                In List
                              </>
                            ) : (
                              <>
                                <UserPlus size={12} />
                                Add
                              </>
                            )}
                          </button>
                        </div>
                      )
                    })}
                    {addedCreators.length > 5 && (
                      <p className="text-xs text-gray-500 text-center py-1">
                        And {addedCreators.length - 5} more...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setAddModalOpen(false)}
                className="w-full py-2.5 text-gray-600 font-medium hover:text-gray-900 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
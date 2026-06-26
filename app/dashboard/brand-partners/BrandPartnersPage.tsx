"use client"

import { useState, useEffect, useCallback } from "react"
import TierSettingsModal from "./TierSettingsModal"
import AddPartnerModal from "./AddPartnerModal"
import NewCampaignModal from "./NewCampaignModal"
import InfluencerProfileSidebar from "./InfluencerProfileSidebar"
import { IconSearch, IconFilter } from "@tabler/icons-react"
import { ReactNode } from "react"
import { useBrandTaxonomy } from "@/hooks/useBrandTaxonomy"

import {
  partnersApi,
  campaignsApi,
  tierSettingsApi,
  BrandInfluencerRecord,
  CampaignRecord,
} from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Partner {
  id: string
  influencer_id: string
  handle: string
  firstName: string
  lastName: string
  plat: string
  niche: string
  gend: string
  loc: string
  tier: string
  tierOverride: string | null
  onRet: boolean
  retFee: number
  defComm: number
  commSt: string
  clicks: number
  cvr: number
  sales: number
  aov: number
  rev: number
  fol: number
  eng: number
  avgV: number
  gmv: number
  added: Date
  prodCost: number
  feesPaid: number
  commPaid: number
  totalSpend: number
  roi_val: number
  roas_val: number
  likes_count: number
  comments_count: number
  engagement_count: number
  contact_status: string
  stage: number
  content_posted: boolean
  post_url: string | null
  notes: string | null
  agreed_rate: number | null
  internal_rating: number | null
  campaign_id: string | null
  monthly: { month: string; rev: number; clicks: number; sales: number }[]
  avg_likes: number
  avg_comments: number
  avg_views: number
  email: string | null
  bio: string | null
  profile_image_url: string | null
  social_link: string | null
  follower_count: number
  engagement_rate: number
  _raw: BrandInfluencerRecord
}

interface Campaign {
  id: string
  name: string
  status: string
  start: string
  end: string
  budget: number
  type: string
  notes: string
  partner_count: number
  posts_done: number
  posts_total: number
  total_rev: number
  partners: { pid: string }[]
  _raw: CampaignRecord
}

interface FilterState {
  tier: string
  platform: string
  niche: string
  location: string
  contact_status: string
}

interface TierSettings {
  bronzeMin: number
  bronzeMax: number
  silverMin: number
  silverMax: number
  goldMin: number
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function formatMoney(v: number) {
  return "$" + Math.round(v).toLocaleString()
}

// ─── Platform icons ───────────────────────────────────────────────────────────
export const PLATFORM_ICONS: Record<string, ReactNode> = {
  instagram: (
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg"
      alt="Instagram"
      className="w-4 h-4"
    />
  ),
  tiktok: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.89 2.89 2.896 2.896 0 0 1-2.889-2.89 2.896 2.896 0 0 1 2.89-2.889c.302 0 .595.05.872.137V9.257a6.339 6.339 0 0 0-5.053 2.212 6.339 6.339 0 0 0-1.33 5.52 6.34 6.34 0 0 0 5.766 4.731 6.34 6.34 0 0 0 6.34-6.34V8.898a7.756 7.756 0 0 0 4.422 1.393V6.825a4.8 4.8 0 0 1-2.443-.139z" />
    </svg>
  ),
  youtube: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.376.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.376-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
}

// ─── Status styles ────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  not_contacted: { bg: "#f0f0f0",  color: "#888"    },
  contacted:     { bg: "#fff8e1",  color: "#854F0B" },
  interested:    { bg: "#e6f1fb",  color: "#185FA5" },
  agreed:        { bg: "#e6f9ee",  color: "#0F6B3E" },
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  brandId: string
}

export default function BrandPartnersPage({ brandId }: Props) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<FilterState>({
    tier: "all",
    platform: "all",
    niche: "all",
    location: "all",
    contact_status: "all",
  })
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [sortCol, setSortCol] = useState("added")
  const [sortAsc, setSortAsc] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 50

  const [showTierModal, setShowTierModal] = useState(false)
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false)
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [showCampaignDetail, setShowCampaignDetail] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)

  // ── Tier thresholds ──────────────────────────────────────────────────────
  const [tierThresholds, setTierThresholds] = useState({ bronzeMax: 2000, silverMax: 10000 })

  const autoTier = useCallback(
    (rev: number): string => {
      if (rev >= tierThresholds.silverMax + 1) return "Gold"
      if (rev >= tierThresholds.bronzeMax + 1) return "Silver"
      return "Bronze"
    },
    [tierThresholds]
  )

  // ── DB record → Partner ──────────────────────────────────────────────────
  const dbToPartner = useCallback(
    (bi: BrandInfluencerRecord): Partner => {
      const inf = bi.influencer
      const bp = bi.partner
      const nameParts = (inf.full_name || inf.handle.replace("@", "")).split(" ")
      const rev = bi.agreed_rate ? Number(bi.agreed_rate) : 0

      const prodCost   = bp ? Number(bp.product_cost) : 0
      const feesPaid   = bp ? Number(bp.fees_paid) : 0
      const commPaid   = bp ? Number(bp.commission_paid) : 0
      const totalSpend = prodCost + feesPaid + commPaid

      const clicks = bp?.clicks ?? 0
      const sales  = bp?.sales_count ?? 0
      const cvr    = clicks > 0 ? (sales / clicks) * 100 : 0

      return {
        id: bi.id,
        influencer_id: bi.influencer_id,
        handle: inf.handle,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        plat: inf.platform,
        niche: inf.niche || "",
        gend: inf.gender || "",
        loc: inf.location || "",
        tier: autoTier(rev),
        tierOverride: bp?.tier_override ?? null,
        onRet: bp?.on_retainer ?? false,
        retFee: bp ? Number(bp.retainer_fee) : 0,
        defComm: bp ? Number(bp.default_commission) : 0,
        commSt: bi.contact_status || "not_contacted",
        clicks,
        cvr,
        sales,
        aov: 0,
        rev,
        fol: inf.follower_count || 0,
        eng: Number(inf.engagement_rate) || 0,
        avgV: inf.avg_views || 0,
        gmv: bp ? Number(bp.gmv) : 0,
        added: new Date(bi.created_at),
        prodCost,
        feesPaid,
        commPaid,
        totalSpend,
        roi_val: totalSpend > 0 ? ((rev - totalSpend) / totalSpend) * 100 : 0,
        roas_val: totalSpend > 0 ? rev / totalSpend : 0,
        likes_count: bi.likes_count,
        comments_count: bi.comments_count,
        engagement_count: bi.engagement_count,
        contact_status: bi.contact_status,
        stage: bi.stage,
        content_posted: bi.content_posted,
        post_url: bi.post_url,
        notes: bi.notes,
        agreed_rate: bi.agreed_rate ? Number(bi.agreed_rate) : null,
        internal_rating: bi.internal_rating ? Number(bi.internal_rating) : null,
        campaign_id: bi.campaign_id,
        monthly: [],
        avg_likes: inf.avg_likes || 0,
        avg_comments: inf.avg_comments || 0,
        avg_views: inf.avg_views || 0,
        email: inf.email || null,
        bio: inf.bio || null,
        profile_image_url: inf.profile_image_url || null,
        social_link: inf.social_link || null,
        follower_count: inf.follower_count || 0,
        engagement_rate: Number(inf.engagement_rate) || 0,
        _raw: bi,
      }
    },
    [autoTier]
  )

  // ── DB record → Campaign ─────────────────────────────────────────────────
  function dbToCampaign(c: CampaignRecord): Campaign {
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      start: c.start_date?.slice(0, 10) ?? c.created_at?.slice(0, 10) ?? "",
      end: c.end_date?.slice(0, 10) ?? "",
      budget: c.budget ? Number(c.budget) : 0,
      type: c.type || "—",
      notes: c.description || "",
      partner_count: c._stats?.partner_count ?? c.influencers?.length ?? 0,
      posts_done: c._stats?.posts_done ?? 0,
      posts_total: c._stats?.posts_total ?? 0,
      total_rev: c._stats?.total_rev ?? 0,
      partners: (c.influencers ?? []).map((bi: any) => ({ pid: bi.id ?? bi.influencer_id })),
      _raw: c,
    }
  }

  // ── Taxonomy ─────────────────────────────────────────────────────────────
  const { niches, locations } = useBrandTaxonomy(brandId)

  // ── Initial data load ────────────────────────────────────────────────────
  useEffect(() => {
    if (!brandId) {
      setLoading(false)
      setError("No brand ID provided. Check your URL.")
      return
    }

    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const [camps, partnerRecords, tierSettings] = await Promise.all([
          campaignsApi.list(brandId),
          partnersApi.list(brandId),
          tierSettingsApi.get(brandId),
        ])

        setTierThresholds({
          bronzeMax: Number(tierSettings.bronze_max),
          silverMax: Number(tierSettings.silver_max),
        })
        setCampaigns(camps.map(dbToCampaign))
        setPartners(partnerRecords.map(dbToPartner))
      } catch (e: any) {
        setError(
          e?.message?.includes("Unauthorized")
            ? "Session expired. Please refresh the page."
            : e?.message || "Failed to load data."
        )
      } finally {
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId])

  // ── Tier helpers ─────────────────────────────────────────────────────────
  const getDisplayTier = useCallback((p: Partner) => p.tierOverride || autoTier(p.rev), [autoTier])

  const handleTierSave = async (settings: TierSettings) => {
    try {
      await tierSettingsApi.save(brandId, {
        bronzeMax: settings.bronzeMax,
        silverMax: settings.silverMax,
      })
      setTierThresholds({ bronzeMax: settings.bronzeMax, silverMax: settings.silverMax })
      setPartners((prev) =>
        prev.map((p) => ({
          ...p,
          tier: p.tierOverride || (
            p.rev >= settings.silverMax + 1 ? "Gold" :
            p.rev >= settings.bronzeMax + 1 ? "Silver" : "Bronze"
          ),
        }))
      )
    } catch (e: any) {
      alert("Failed to save tier settings: " + (e.message || "Unknown error"))
    }
  }

  // ── Manual tier override ─────────────────────────────────────────────────
  const handleTierOverride = async (partnerId: string, tier: string | null) => {
    try {
      const updated = await partnersApi.updateFinancials(brandId, partnerId, {
        tier_override: tier,
      })
      setPartners((prev) =>
        prev.map((p) => (p.id === partnerId ? dbToPartner(updated) : p))
      )
    } catch (e: any) {
      alert("Failed to update tier: " + (e.message || "Unknown error"))
    }
  }

  // ── Campaign status update ───────────────────────────────────────────────
  const handleCampaignStatusUpdate = async (campaignId: string, status: string) => {
    try {
      await fetch(`/api/brands/${brandId}/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      setSelectedCampaign((prev) => prev ? { ...prev, status } : prev)
      setCampaigns((prev) =>
        prev.map((c) => c.id === campaignId ? { ...c, status } : c)
      )
    } catch (e: any) {
      alert("Failed to update campaign status: " + (e.message || "Unknown error"))
    }
  }

  // ── Add partner ──────────────────────────────────────────────────────────
  const handleAddPartner = async (formData: any) => {
    try {
      if (formData.type === "search") {
        for (const inf of formData.influencers) {
          try {
            const bi = await partnersApi.add(brandId, {
              influencer_id: inf.id,
              notes: formData.notes || null,
            })
            setPartners((prev) => [...prev, dbToPartner(bi)])
          } catch (e: any) {
            if (e.message?.includes("already added") || e.message?.includes("409")) {
              // skip silently
            } else {
              throw e
            }
          }
        }
        return
      }

      const res = await fetch("/api/influencers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: formData.handle,
          platform: formData.platform?.toLowerCase(),
          full_name: formData.full_name || null,
          email: formData.email || null,
          niche: formData.niche || null,
          location: formData.location || null,
          notes: formData.notes || null,
          brandId,
        }),
      })

      const json = await res.json()

      if (res.status === 403) {
        alert(json.message || "Influencer limit reached. Please upgrade your plan.")
        return
      }

      if (res.status === 409) {
        if (json.id) {
          try {
            const bi = await partnersApi.add(brandId, {
              influencer_id: json.id,
              notes: formData.notes || null,
            })
            setPartners((prev) => [...prev, dbToPartner(bi)])
          } catch (linkErr: any) {
            if (linkErr.message?.includes("already added")) {
              alert("This influencer is already in your brand partner list.")
            } else {
              throw linkErr
            }
          }
        }
        return
      }

      if (!res.ok) {
        throw new Error(json.error || `Server error ${res.status}`)
      }

      const freshBIs = await partnersApi.list(brandId, { search: json.handle })
      const justAdded = freshBIs.find((bi: BrandInfluencerRecord) => bi.influencer_id === json.id)
      if (justAdded) {
        setPartners((prev) => [...prev, dbToPartner(justAdded)])
      }
    } catch (e: any) {
      alert("Failed to add partner: " + (e.message || "Unknown error"))
    }
  }

  // ── Update partner ───────────────────────────────────────────────────────
  const handleUpdatePartner = async (partnerId: string, updates: Partial<BrandInfluencerRecord>) => {
    try {
      const updated = await partnersApi.update(brandId, partnerId, updates)
      setPartners((prev) =>
        prev.map((p) => (p.id === partnerId ? dbToPartner(updated) : p))
      )
    } catch (e: any) {
      alert("Failed to update: " + e.message)
    }
  }

  // ── Update partner financials ─────────────────────────────────────────────
  const handleUpdateFinancials = async (
    partnerId: string,
    updates: Parameters<typeof partnersApi.updateFinancials>[2]
  ) => {
    try {
      const updated = await partnersApi.updateFinancials(brandId, partnerId, updates)
      setPartners((prev) =>
        prev.map((p) => (p.id === partnerId ? dbToPartner(updated) : p))
      )
    } catch (e: any) {
      alert("Failed to update financials: " + e.message)
    }
  }

  // ── Remove partner ───────────────────────────────────────────────────────
  const handleRemovePartner = async (partnerId: string) => {
    if (!confirm("Remove this partner from the brand?")) return
    try {
      await partnersApi.remove(brandId, partnerId)
      setPartners((prev) => prev.filter((p) => p.id !== partnerId))
    } catch (e: any) {
      alert("Failed to remove partner: " + e.message)
    }
  }

  // ── Open sidebar ─────────────────────────────────────────────────────────
  const openPartnerSidebar = (p: Partner) => {
    setSelectedPartner(p)
    setShowProfilePanel(true)
  }

  // ── Sorting & filtering ──────────────────────────────────────────────────
  const getFilteredPartners = useCallback(() => {
    let filtered = [...partners]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter((p) =>
        `${p.handle} ${p.niche} ${p.plat} ${p.firstName} ${p.lastName} ${p.loc}`.toLowerCase().includes(q)
      )
    }
    if (filters.tier !== "all") filtered = filtered.filter((p) => getDisplayTier(p) === filters.tier)
    if (filters.platform !== "all")
      filtered = filtered.filter((p) => p.plat.toLowerCase() === filters.platform.toLowerCase())
    if (filters.niche !== "all") filtered = filtered.filter((p) => p.niche === filters.niche)
    if (filters.location !== "all") filtered = filtered.filter((p) => p.loc === filters.location)
    if (filters.contact_status !== "all")
      filtered = filtered.filter((p) => p.contact_status === filters.contact_status)

    const tierOrder: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 }
    filtered.sort((a, b) => {
      let v = 0
      switch (sortCol) {
        case "revenue":    v = a.rev - b.rev; break
        case "followers":  v = a.fol - b.fol; break
        case "engagement": v = a.eng - b.eng; break
        case "stage":      v = a.stage - b.stage; break
        case "alpha":      v = a.handle.localeCompare(b.handle); break
        case "tier":       v = tierOrder[getDisplayTier(a)] - tierOrder[getDisplayTier(b)]; break
        case "added":      v = new Date(a.added).getTime() - new Date(b.added).getTime(); break
        case "spend":      v = a.totalSpend - b.totalSpend; break
        case "clicks":     v = a.clicks - b.clicks; break
        case "cvr":        v = a.cvr - b.cvr; break
        case "sales":      v = a.sales - b.sales; break
        case "roas":       v = a.roas_val - b.roas_val; break
        default: v = 0
      }
      return sortAsc ? v : -v
    })
    return filtered
  }, [partners, searchQuery, filters, sortCol, sortAsc, getDisplayTier])

  const filteredPartners = getFilteredPartners()
  const totalPages = Math.max(1, Math.ceil(filteredPartners.length / rowsPerPage))
  const paginatedPartners = filteredPartners.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const goldCount   = partners.filter((p) => getDisplayTier(p) === "Gold").length
  const silverCount = partners.filter((p) => getDisplayTier(p) === "Silver").length
  const bronzeCount = partners.filter((p) => getDisplayTier(p) === "Bronze").length

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(false) }
    setCurrentPage(1)
  }

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontFamily: "'Inter', sans-serif", color: "#888" }}>
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontFamily: "'Inter', sans-serif", color: "#E24B4A", flexDirection: "column", gap: 8 }}>
        <div>⚠ {error}</div>
        <button onClick={() => window.location.reload()} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "0.5px solid #E24B4A", background: "transparent", color: "#E24B4A", cursor: "pointer" }}>
          Retry
        </button>
      </div>
    )
  }

  // ── Campaign detail derived data ─────────────────────────────────────────
  const campPartners = selectedCampaign
    ? partners.filter((p) => p.campaign_id === selectedCampaign.id)
    : []

  const campRev     = campPartners.reduce((a, p) => a + (p.agreed_rate ?? 0), 0)
  const campSpend   = campPartners.reduce((a, p) => a + p.totalSpend, 0)
  const campCOGS    = campPartners.reduce((a, p) => a + p.prodCost, 0)
  const campFees    = campPartners.reduce((a, p) => a + p.feesPaid, 0)
  const campComm    = campPartners.reduce((a, p) => a + p.commPaid, 0)
  const campViews   = campPartners.reduce((a, p) => a + p.avgV, 0)
  const campLikes   = campPartners.reduce((a, p) => a + p.likes_count, 0)
  const campPosted  = campPartners.filter((p) => p.content_posted).length
  const campRoasNum = campSpend > 0 ? campRev / campSpend : 0
  const campRoiNum  = campSpend > 0 ? (campRev - campSpend) / campSpend * 100 : 0
  const campRoas    = campSpend > 0 ? campRoasNum.toFixed(1) + "x" : "—"
  const campRoi     = campSpend > 0 ? campRoiNum.toFixed(1) + "%" : "—"
  const avgEng      = campPartners.length > 0
    ? (campPartners.reduce((a, p) => a + p.eng, 0) / campPartners.length).toFixed(2)
    : "0"
  const isProfitable = campRev > campSpend

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#f7f9f8", minHeight: "100vh" }}>

      {/* ── Top Bar ── */}
      <div className="topbar">
        <div>
          <div style={{ fontWeight: 600 }}>Brand Partners</div>
          <div className="topbar-sub">
            {partners.length} total · {goldCount} Gold · {silverCount} Silver · {bronzeCount} Bronze
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn-outline" onClick={() => setShowTierModal(true)}>⚙ Tier Settings</button>
          <button className="btn-outline" onClick={() => setShowCampaignModal(true)}>+ New Campaign</button>
          <button className="btn-primary" onClick={() => setShowAddPartnerModal(true)}>+ Add Partner</button>
        </div>
      </div>

      {/* ── Tab Bar + Search ── */}
      {!showCampaignDetail && (
        <div className="tab-search-row">
          <div className="tab-bar">
            {["Partner List", "Campaigns"].map((tab, idx) => (
              <div key={idx} className={`tab ${activeTab === idx ? "active" : ""}`} onClick={() => setActiveTab(idx)}>
                {tab}
              </div>
            ))}
          </div>
          <div className="sfg">
            <div className="sw relative">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="sb pl-9"
                placeholder="Search creators…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="fw">
              <button onClick={() => setShowFilterPanel(!showFilterPanel)} className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 border border-[#0F6B3E]/20">
                <IconFilter size={16} /> Filters
              </button>
              {showFilterPanel && (
                <div className="fp open">
                  <div className="fp-title">Filter by</div>
                  <div className="fg">
                    {[
                      { label: "Tier",     key: "tier",           options: ["Gold", "Silver", "Bronze"] },
                      { label: "Platform", key: "platform",       options: ["instagram", "tiktok", "youtube"] },
                      { label: "Niche",    key: "niche",          options: niches.map(n => n.name) },
                      { label: "Location", key: "location",       options: locations.map(l => l.name) },
                      { label: "Status",   key: "contact_status", options: ["not_contacted", "contacted", "interested", "agreed"] },
                    ].map(({ label, key, options }) => (
                      <div key={key}>
                        <label>{label}</label>
                        <select
                          value={(filters as any)[key]}
                          onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.value }))}
                        >
                          <option value="all">All</option>
                          {options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="fa">
                    <button className="fc-btn" onClick={() => setFilters({ tier: "all", platform: "all", niche: "all", location: "all", contact_status: "all" })}>
                      Clear all
                    </button>
                    <button className="fa-btn" onClick={() => setShowFilterPanel(false)}>Apply</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PARTNER LIST TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 0 && !showCampaignDetail && (
        <div className="content">
          {partners.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No partners yet</div>
              <div style={{ fontSize: 12 }}>Click "+ Add Partner" to add your first influencer</div>
            </div>
          ) : (
            <div className="tw">
              <table className="pt">
                <thead>
                  <tr>
                    <th style={{ width: 28, color: "#bbb" }}>#</th>
                    <th><div className="thi" onClick={() => handleSort("alpha")}><span className="cl">Creator</span><span className="sa">↕</span></div></th>
                    <th><span className="cl">Platform</span></th>
                    <th><span className="cl">Niche</span></th>
                    <th><span className="cl">Location</span></th>
                    <th><div className="thi" onClick={() => handleSort("tier")}><span className="cl">Tier</span><span className="sa">↕</span></div></th>
                    <th><div className="thi" onClick={() => handleSort("stage")}><span className="cl">Stage</span><span className="sa">↕</span></div></th>
                    <th><span className="cl">Retainer</span></th>
                    <th><div className="thi" onClick={() => handleSort("spend")}><span className="cl">Total spend</span><span className="sa">↕</span></div></th>
                    <th><div className="thi" onClick={() => handleSort("clicks")}><span className="cl">Clicks</span><span className="sa">↕</span></div></th>
                    <th><div className="thi" onClick={() => handleSort("cvr")}><span className="cl">CVR</span><span className="sa">↕</span></div></th>
                    <th><div className="thi" onClick={() => handleSort("sales")}><span className="cl">Sales (units)</span><span className="sa">↕</span></div></th>
                    <th><div className="thi" onClick={() => handleSort("revenue")}><span className="cl">Revenue</span><span className="sa">↕</span></div></th>
                    <th><div className="thi" onClick={() => handleSort("roas")}><span className="cl">ROAS / ROI</span><span className="sa">↕</span></div></th>
                    <th><span className="cl">Status</span></th>
                    <th><span className="cl">Posted</span></th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPartners.map((p, idx) => {
                    const tier = getDisplayTier(p)
                    const tierClass = tier === "Gold" ? "tg" : tier === "Silver" ? "ts" : "tbr"
                    const tierIcon  = tier === "Gold" ? "🥇" : tier === "Silver" ? "🥈" : "🥉"
                    return (
                      <tr
                        key={p.id}
                        className="dr"
                        onClick={() => openPartnerSidebar(p)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ color: "#bbb", fontSize: 11 }}>{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                        <td style={{ fontWeight: 500, fontSize: 12 }}>{p.handle}</td>
                        <td>
                          <div className="flex justify-center items-center">
                            {PLATFORM_ICONS[p.plat.toLowerCase()] || <span style={{ fontSize: 11 }}>{p.plat}</span>}
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: "#888" }}>{p.niche || "—"}</td>
                        <td style={{ fontSize: 11, color: "#888" }}>{p.loc || "—"}</td>
                        <td>
                          <div className="flex justify-center">
                            <span
                              className={`tb ${tierClass}`}
                              title={p.tierOverride ? "Manually overridden — click to reset to auto" : "Click to manually override"}
                              style={{ cursor: "pointer" }}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (p.tierOverride) {
                                  handleTierOverride(p.id, null)
                                } else {
                                  const next = tier === "Bronze" ? "Silver" : tier === "Silver" ? "Gold" : "Gold"
                                  handleTierOverride(p.id, next)
                                }
                              }}
                            >
                              {tierIcon}{p.tierOverride ? " ✎" : ""}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="stage-badge" data-stage={p.stage}>Stage {p.stage}</span>
                        </td>
                        <td style={{ fontSize: 11, color: "#aaa", textAlign: "center" }}>—</td>
                        <td style={{ fontSize: 12 }}>
                          {p.totalSpend > 0 ? (
                            <>
                              <div style={{ fontWeight: 600 }}>{formatMoney(p.totalSpend)}</div>
                              <div style={{ fontSize: 10, color: "#888" }}>
                                {formatMoney(p.prodCost)} COGS + {formatMoney(p.feesPaid)} fees
                              </div>
                            </>
                          ) : (
                            <span style={{ color: "#ccc" }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: 11 }}>{p.clicks > 0 ? p.clicks.toLocaleString() : "—"}</td>
                        <td style={{ fontSize: 11, color: "#185FA5" }}>{p.clicks > 0 ? p.cvr.toFixed(0) + "%" : "—"}</td>
                        <td style={{ fontSize: 11 }}>{p.sales > 0 ? p.sales.toLocaleString() : "—"}</td>
                        <td style={{ fontWeight: 600, color: "#1FAE5B", fontSize: 12 }}>
                          {p.agreed_rate ? formatMoney(p.agreed_rate) : "—"}
                        </td>
                        <td>
                          {p.totalSpend > 0 ? (
                            <>
                              <div style={{ fontWeight: 600, color: p.roas_val >= 1 ? "#1FAE5B" : "#E24B4A", fontSize: 12 }}>
                                {p.roas_val.toFixed(1)}x
                              </div>
                              <div style={{ fontSize: 10, color: "#888" }}>
                                {p.roi_val >= 0 ? "+" : ""}{p.roi_val.toFixed(1)}% ROI
                              </div>
                            </>
                          ) : (
                            <span style={{ color: "#ccc", fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge s-${p.contact_status?.replace(/_/g, "-")}`}>
                            {p.contact_status?.replace(/_/g, " ") || "—"}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, textAlign: "center" }}>
                          {p.content_posted ? "✅" : "—"}
                        </td>
                        <td>
                          <button
                            className="abt del"
                            onClick={(e) => { e.stopPropagation(); handleRemovePartner(p.id) }}
                            title="Remove partner"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="pgbar">
                <div style={{ fontSize: 11, color: "#888" }}>
                  {(currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredPartners.length)} of {filteredPartners.length}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="pb" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>‹</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((n) => (
                    <button key={n} className={`pb ${n === currentPage ? "pb-active" : ""}`} onClick={() => setCurrentPage(n)}>{n}</button>
                  ))}
                  <button className="pb" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>›</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CAMPAIGNS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 1 && !showCampaignDetail && (
        <div className="content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em" }}>All campaigns</div>
            <button className="btn-primary" onClick={() => setShowCampaignModal(true)}>+ New Campaign</button>
          </div>
          {campaigns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 600 }}>No campaigns yet</div>
              <div style={{ fontSize: 12 }}>Click "+ New Campaign" to get started</div>
            </div>
          ) : (
            campaigns.map((c) => (
              <div
                key={c.id}
                className="camp-card"
                onClick={() => { setSelectedCampaign(c); setShowCampaignDetail(true) }}
              >
                <div className="cc-header">
                  <div>
                    <div className="cc-name">{c.name}</div>
                    <div className="cc-meta">
                      {c.start ? `${c.start}${c.end ? ` → ${c.end}` : " → Open-ended"}` : ""}
                      {c.type && c.type !== "—" ? ` · ${c.type}` : ""}
                      {c.budget ? ` · Budget: ${formatMoney(c.budget)}` : ""}
                    </div>
                    {c.notes && <div className="cc-meta" style={{ marginTop: 2 }}>{c.notes}</div>}
                  </div>
                  <span className={`cs c-${c.status.toLowerCase()}`}>{c.status}</span>
                </div>
                <div className="cc-stats">
                  <div><div className="csv">{c.partner_count}</div><div className="csl">creators</div></div>
                  <div><div className="csv">{c.posts_done}/{c.posts_total}</div><div className="csl">posts done</div></div>
                  <div><div className="csv" style={{ color: "#1FAE5B" }}>{formatMoney(c.total_rev)}</div><div className="csl">revenue</div></div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CAMPAIGN DETAIL
      ══════════════════════════════════════════════════════════════════════ */}
      {showCampaignDetail && selectedCampaign && (
        <div>
          {/* Back */}
          <div style={{ background: "#fff", borderBottom: "0.5px solid rgba(0,0,0,0.08)", padding: "10px 20px" }}>
            <button
              style={{ fontSize: 12, color: "#1FAE5B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
              onClick={() => setShowCampaignDetail(false)}
            >
              ← Back to Campaigns
            </button>
          </div>

          <div className="content">

            {/* ── Header ── */}
            <div className="cd-section">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedCampaign.name}</div>
                    <span className={`cs c-${selectedCampaign.status.toLowerCase()}`}>
                      {selectedCampaign.status}
                    </span>
                    {campSpend > 0 && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                        background: isProfitable ? "#e6f9ee" : "#fdecea",
                        color: isProfitable ? "#0F6B3E" : "#a32d2d",
                      }}>
                        {isProfitable ? "✓ Profitable" : "✗ Loss"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                    {selectedCampaign.start
                      ? selectedCampaign.end
                        ? `${selectedCampaign.start} → ${selectedCampaign.end}`
                        : `${selectedCampaign.start} → Open-ended`
                      : ""}
                    {selectedCampaign.type && selectedCampaign.type !== "—" ? ` · ${selectedCampaign.type}` : ""}
                    {selectedCampaign.budget ? ` · Budget: ${formatMoney(selectedCampaign.budget)}` : ""}
                  </div>
                  {selectedCampaign.notes && (
                    <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{selectedCampaign.notes}</div>
                  )}
                </div>

                {/* ── Edit / Activate / Complete buttons ── */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    className="btn-outline"
                    onClick={() => {/* TODO: open edit modal */}}
                  >
                    Edit
                  </button>
                  {selectedCampaign.status !== "active" && selectedCampaign.status !== "completed" && (
                    <button
                      className="btn-primary"
                      onClick={() => handleCampaignStatusUpdate(selectedCampaign.id, "active")}
                    >
                      Activate
                    </button>
                  )}
                  {selectedCampaign.status === "active" && (
                    <button
                      className="btn-outline"
                      style={{ color: "#185FA5", borderColor: "#b5d4f4" }}
                      onClick={() => {
                        if (confirm("Mark this campaign as completed?")) {
                          handleCampaignStatusUpdate(selectedCampaign.id, "completed")
                        }
                      }}
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Performance summary ── */}
            <div className="cd-section">
              <div className="cd-section-title">Performance summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 8 }}>
                <div className="kpi-card">
                  <div className="kpi-l">Total revenue</div>
                  <div className="kpi-v g">{campRev ? formatMoney(campRev) : "—"}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-l">Total spend</div>
                  <div className="kpi-v">{campSpend ? formatMoney(campSpend) : "—"}</div>
                  {campSpend > 0 && (
                    <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>
                      {formatMoney(campCOGS)} COGS · {formatMoney(campFees)} fees · {formatMoney(campComm)} comm
                    </div>
                  )}
                </div>
                <div className="kpi-card">
                  <div className="kpi-l">ROAS</div>
                  <div className="kpi-v" style={{ color: campRoasNum >= 1 ? "#1FAE5B" : "#E24B4A" }}>{campRoas}</div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>revenue ÷ spend</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-l">ROI</div>
                  <div className="kpi-v" style={{ color: campRoiNum >= 0 ? "#1FAE5B" : "#E24B4A" }}>{campRoi}</div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>net profit ÷ spend</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                <div className="kpi-card">
                  <div className="kpi-l">Posts done</div>
                  <div className="kpi-v" style={{ color: campPosted === campPartners.length && campPartners.length > 0 ? "#1FAE5B" : "#1E1E1E" }}>
                    {campPosted}/{campPartners.length}
                  </div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                    {campPartners.length === 0 ? "0" : Math.round(campPosted / campPartners.length * 100)}% complete
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-l">Total views</div>
                  <div className="kpi-v">{campViews >= 1000 ? (campViews / 1000).toFixed(1) + "K" : campViews || "—"}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-l">Total likes</div>
                  <div className="kpi-v">{campLikes >= 1000 ? (campLikes / 1000).toFixed(1) + "K" : campLikes || "—"}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-l">Avg eng. rate</div>
                  <div className="kpi-v">{avgEng}%</div>
                </div>
              </div>
            </div>

            {/* ── Creator breakdown ── */}
            <div className="cd-section">
              <div className="cd-section-title">Creator breakdown</div>
              {campPartners.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#aaa", fontSize: 12 }}>
                  No partners linked to this campaign yet
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
                        {["Creator", "Deliverables", "Agreed fee", "Likes", "Eng. rate", "Revenue", "ROAS / ROI", "Status"].map((h) => (
                          <th key={h} style={{
                            textAlign: h === "Creator" || h === "Deliverables" ? "left" : "right",
                            padding: "8px 10px", fontSize: 10, color: "#888", fontWeight: 500, whiteSpace: "nowrap",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campPartners.map((p) => {
                        const pSpend  = p.totalSpend
                        const pRev    = p.agreed_rate ?? 0
                        const pRoasN  = pSpend > 0 ? pRev / pSpend : 0
                        const pRoiN   = pSpend > 0 ? (pRev - pSpend) / pSpend * 100 : 0
                        const pRoas   = pSpend > 0 ? pRoasN.toFixed(1) + "x" : "—"
                        const pRoi    = pSpend > 0 ? (pRoiN >= 0 ? "+" : "") + pRoiN.toFixed(1) + "%" : "—"
                        const stStyle = STATUS_STYLES[p.contact_status] ?? STATUS_STYLES.not_contacted
                        const deliverablesList = p._raw?.deliverables
                          ? String(p._raw.deliverables).split(",").map(d => d.trim()).filter(Boolean)
                          : []

                        return (
                          <tr
                            key={p.id}
                            className="dr"
                            style={{ borderBottom: "0.5px solid rgba(0,0,0,0.05)", cursor: "pointer" }}
                            onClick={() => openPartnerSidebar(p)}
                          >
                            <td style={{ padding: "10px", verticalAlign: "top" }}>
                              <div style={{ fontWeight: 500 }}>{p.handle}</div>
                              <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{p.plat} · {p.niche || "—"}</div>
                            </td>
                            <td style={{ padding: "10px", verticalAlign: "top" }}>
                              {deliverablesList.length > 0 ? (
                                deliverablesList.map((d, i) => (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#555", marginBottom: 2 }}>
                                    <span>{p.content_posted ? "✅" : "⏳"}</span>
                                    <span>{d}</span>
                                  </div>
                                ))
                              ) : (
                                <span style={{ fontSize: 11, color: "#ccc" }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right", verticalAlign: "top" }}>
                              {p.agreed_rate
                                ? <span style={{ fontWeight: 600 }}>{formatMoney(p.agreed_rate)}</span>
                                : <span style={{ color: "#ccc", fontSize: 11 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right", verticalAlign: "top", fontSize: 11 }}>
                              {p.likes_count ? p.likes_count >= 1000 ? (p.likes_count / 1000).toFixed(1) + "K" : p.likes_count : "—"}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right", verticalAlign: "top", fontSize: 11 }}>
                              {p.eng ? p.eng + "%" : "—"}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right", verticalAlign: "top" }}>
                              {pRev
                                ? <span style={{ fontWeight: 600, color: "#1FAE5B" }}>{formatMoney(pRev)}</span>
                                : <span style={{ color: "#ccc", fontSize: 11 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right", verticalAlign: "top" }}>
                              {pSpend > 0 ? (
                                <>
                                  <div style={{ fontWeight: 600, color: pRoasN >= 1 ? "#1FAE5B" : "#E24B4A" }}>{pRoas}</div>
                                  <div style={{ fontSize: 10, color: "#888" }}>{pRoi} ROI</div>
                                </>
                              ) : (
                                <span style={{ color: "#ccc", fontSize: 11 }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right", verticalAlign: "top" }}>
                              <span style={{
                                display: "inline-block", fontSize: 10, fontWeight: 500,
                                padding: "2px 8px", borderRadius: 6,
                                background: stStyle.bg, color: stStyle.color, whiteSpace: "nowrap",
                              }}>
                                {p.contact_status?.replace(/_/g, " ") || "—"}
                              </span>
                              {p.content_posted && (
                                <div style={{ fontSize: 10, color: "#1FAE5B", marginTop: 3 }}>✅ Posted</div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>

                    {campPartners.length > 1 && (
                      <tfoot>
                        <tr style={{ borderTop: "1px solid rgba(0,0,0,0.08)", background: "#fafaf9" }}>
                          <td colSpan={2} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600, color: "#555" }}>
                            Totals ({campPartners.length} creators)
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, fontSize: 11 }}>
                            {campRev ? formatMoney(campRev) : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11 }}>
                            {campLikes >= 1000 ? (campLikes / 1000).toFixed(1) + "K" : campLikes || "—"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11 }}>
                            {avgEng}%
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1FAE5B", fontSize: 12 }}>
                            {campRev ? formatMoney(campRev) : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            {campSpend > 0 && (
                              <div style={{ fontWeight: 700, color: campRoasNum >= 1 ? "#1FAE5B" : "#E24B4A", fontSize: 12 }}>
                                {campRoas}
                              </div>
                            )}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════════ */}
      <TierSettingsModal
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
        onSave={handleTierSave}
        brandId={brandId}
      />

      <AddPartnerModal
        isOpen={showAddPartnerModal}
        onClose={() => setShowAddPartnerModal(false)}
        brandId={brandId}
        onAdded={() => {}}
      />

      <NewCampaignModal
        isOpen={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        brandId={brandId}
        partners={partners.map((p) => ({
          id: p.id,
          handle: p.handle,
          plat: p.plat,
          niche: p.niche,
        }))}
        onCreated={async () => {
          try {
            const fresh = await campaignsApi.list(brandId)
            setCampaigns(fresh.map(dbToCampaign))
          } catch { /* non-critical */ }
          setActiveTab(1)
        }}
      />

      {showProfilePanel && selectedPartner && (
        <InfluencerProfileSidebar
          partner={selectedPartner as any}
          campaigns={campaigns as any}
          allPartners={partners as any}
          onClose={async () => {
            setShowProfilePanel(false)
            try {
              const fresh = await partnersApi.get(brandId, selectedPartner.id)
              setPartners((prev) =>
                prev.map((p) => (p.id === selectedPartner.id ? dbToPartner(fresh) : p))
              )
            } catch {
              // non-critical
            }
          }}
        />
      )}

      <style jsx>{`
        .topbar { background: #fff; border-bottom: 0.5px solid rgba(0,0,0,0.08); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
        .topbar-sub { font-size: 11px; color: #888; margin-top: 2px; }
        .topbar-actions { display: flex; gap: 8px; }
        .btn-primary { background: #1FAE5B; color: #fff; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 500; font-family: 'Inter', sans-serif; }
        .btn-primary:hover { background: #0F6B3E; }
        .btn-outline { background: transparent; border: 0.5px solid rgba(0,0,0,0.2); padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 500; color: #555; font-family: 'Inter', sans-serif; }
        .tab-search-row { background: #fff; border-bottom: 0.5px solid rgba(0,0,0,0.08); padding: 0 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .tab-bar { display: flex; }
        .tab { padding: 10px 16px; cursor: pointer; font-size: 12px; font-weight: 500; color: #888; border-bottom: 2px solid transparent; }
        .tab.active { color: #1FAE5B; border-bottom-color: #1FAE5B; }
        .sfg { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
        .sw { position: relative; }
        .sb { font-size: 12px; padding: 6px 10px 6px 28px; border-radius: 8px; border: 0.5px solid rgba(0,0,0,0.15); background: #f7f9f8; width: 200px; font-family: 'Inter', sans-serif; }
        .fw { position: relative; }
        .fp { position: absolute; top: calc(100% + 6px); right: 0; z-index: 200; background: #fff; border: 0.5px solid rgba(0,0,0,0.12); border-radius: 10px; padding: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); width: 360px; }
        .fp-title { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
        .fg { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .fg label { font-size: 11px; color: #888; display: block; margin-bottom: 4px; }
        .fg select { width: 100%; font-size: 12px; padding: 5px 8px; border-radius: 7px; border: 0.5px solid rgba(0,0,0,0.15); background: #f7f9f8; font-family: 'Inter', sans-serif; }
        .fa { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 0.5px solid rgba(0,0,0,0.06); }
        .fc-btn { font-size: 11px; padding: 5px 10px; border-radius: 7px; border: 0.5px solid rgba(0,0,0,0.15); background: transparent; color: #888; cursor: pointer; }
        .fa-btn { font-size: 11px; padding: 5px 12px; border-radius: 7px; border: none; background: #1FAE5B; color: #fff; cursor: pointer; }
        .content { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
        .tw { background: #fff; border: 0.5px solid rgba(0,0,0,0.08); border-radius: 10px; overflow: hidden; overflow-x: auto; }
        .pt { width: 100%; border-collapse: collapse; font-size: 12px; }
        .pt thead { background: #fafaf9; }
        .pt th { padding: 9px 10px; font-weight: 500; font-size: 11px; border-bottom: 0.5px solid rgba(0,0,0,0.08); white-space: nowrap; }
        .pt td { padding: 9px 10px; border-bottom: 0.5px solid rgba(0,0,0,0.05); color: #1E1E1E; vertical-align: middle; white-space: nowrap; }
        .pt tr:last-child td { border-bottom: none; }
        .dr:hover td { background: #f0faf5; }
        .thi { display: flex; align-items: center; gap: 3px; cursor: pointer; }
        .cl { font-size: 11px; color: #888; }
        .sa { font-size: 10px; color: #ccc; }
        .tb { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
        .tg { background: #fff8e1; color: #854F0B; }
        .ts { background: #f0f0f0; color: #444; }
        .tbr { background: #fdf0e8; color: #7a3e1a; }
        .stage-badge { font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 6px; background: #f0f0f0; color: #555; }
        .stage-badge[data-stage="3"] { background: #e6f9ee; color: #0F6B3E; }
        .stage-badge[data-stage="4"] { background: #e6f1fb; color: #185FA5; }
        .stage-badge[data-stage="5"] { background: #e6f9ee; color: #0F6B3E; }
        .status-badge { font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 6px; background: #f0f0f0; color: #555; white-space: nowrap; }
        .s-contacted { background: #fff8e1; color: #854F0B; }
        .s-interested { background: #e6f1fb; color: #185FA5; }
        .s-agreed { background: #e6f9ee; color: #0F6B3E; }
        .abt { font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 0.5px solid rgba(0,0,0,0.15); background: transparent; color: #555; cursor: pointer; }
        .abt.del { border-color: #fca5a5; color: #E24B4A; padding: 3px 8px; }
        .abt.del:hover { background: #fdecea; }
        .pgbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; background: #fafaf9; border-top: 0.5px solid rgba(0,0,0,0.06); }
        .pb { font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 0.5px solid rgba(0,0,0,0.15); background: #fff; color: #555; cursor: pointer; }
        .pb:disabled { color: #ccc; cursor: not-allowed; }
        .pb-active { background: #1FAE5B; color: #fff; border-color: #1FAE5B; }
        .camp-card { background: #fff; border: 0.5px solid rgba(0,0,0,0.08); border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; cursor: pointer; }
        .camp-card:hover { border-color: #1FAE5B; }
        .cc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .cc-name { font-size: 14px; font-weight: 600; }
        .cc-meta { font-size: 11px; color: #888; margin-top: 2px; }
        .cc-stats { display: flex; gap: 20px; margin-top: 8px; flex-wrap: wrap; }
        .csv { font-size: 15px; font-weight: 600; }
        .csl { font-size: 10px; color: #888; }
        .cs { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
        .c-draft { background: #f0f0ee; color: #888; }
        .c-active { background: #e6f9ee; color: #0F6B3E; }
        .c-completed { background: #e6f1fb; color: #185FA5; }
        .c-archived { background: #f0f0ee; color: #999; }
        .cd-section { background: #fff; border: 0.5px solid rgba(0,0,0,0.08); border-radius: 10px; padding: 14px 16px; }
        .cd-section-title { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
        .kpi-card { background: #fff; border: 0.5px solid rgba(0,0,0,0.08); border-radius: 10px; padding: 12px 14px; }
        .kpi-l { font-size: 10px; color: #888; }
        .kpi-v { font-size: 17px; font-weight: 600; color: #1E1E1E; margin-top: 2px; }
        .kpi-v.g { color: #1FAE5B; }
      `}</style>
    </div>
  )
}
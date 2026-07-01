"use client"

import ReactDOM from "react-dom"
import React, {
  useState, useRef, useEffect, useCallback,
  type KeyboardEvent, type ReactNode, type DragEvent,
} from "react"
import {
  IconTrash, IconPlus, IconX, IconExternalLink, IconCheck, IconCalendar,
  IconGripVertical, IconSearch, IconFilter, IconTags, IconMapPin,
  IconChecklist, IconCopy, IconAlertTriangle, IconDownload, IconUpload,
  IconSettings, IconChevronDown, IconLoader2, IconArrowsSort,
} from "@tabler/icons-react"

import type { InfluencerRow, CustomColumn, AnyColDef, CustomColDef, CellAddress, FilterState, ToastNotification, SortOrder } from "./types"
import {
  DEFAULT_NICHES, DEFAULT_LOCATIONS, DEFAULT_GENDERS, DEFAULT_CONTACT_STATUSES,
  OUTREACH_FIELDS, platforms, STATUS_STYLE, STATUS_LABEL, APPROVAL_STYLE,
} from "./constants"
import {
  cleanHandle, getProfileUrl, sortRows, newEmptyRow, getStaticCols,
  handleApprovalChange, isValidUrl, normalizeUrl, formatFollowers,
  exportToCSV, downloadTemplate, importFromCSV,
} from "./utils"
import { useToast } from "./hooks"
import { ProfilePicture, PlatformIcon, StatusBadge, ApprovalBadge, MultiSelectDisplay } from "./ui-atoms"
import { FloatingPopup, DropdownEditor, MultiSelectEditor, DatePicker, PlatformEditor } from "./cell-editors"
import {
  ConfirmationDialog, AddRowsModal, DeclineConfirmationModal,
  ManageOptionsModal, AddColumnModal, FilterPopover,
} from "./modals"
import { ToastContainer } from "./toast"
import ProfileSidebar from "./profile-sidebar"
import { useBrandTaxonomy } from "@/hooks/useBrandTaxonomy"

import { IconArrowDown, IconArrowUp } from "@tabler/icons-react"

/* ═══════════════════════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════════════════════ */
function EmptyState({
  onAddRow,
  onOpenAddRowsModal,
}: {
  onAddRow: () => void
  onOpenAddRowsModal: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Icon */}
      <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <circle cx="10" cy="7" r="4" stroke="#3B6D11" strokeWidth="1.5" />
          <path
            d="M2 21c0-4 3.6-7 8-7"
            stroke="#3B6D11"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M17 14v6M14 17h6"
            stroke="#1FAE5B"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Heading */}
      <p className="text-[15px] font-medium text-gray-900 mb-1.5">
        No influencers yet
      </p>
      <p className="text-[13px] text-gray-500 mb-7 max-w-xs leading-relaxed">
        Add your first influencer manually or import a CSV file to get started.
      </p>

      {/* CTAs */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <button
          onClick={onAddRow}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1FAE5B] text-white rounded-lg text-[13px] font-medium hover:bg-[#189e4f] transition"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add influencer
        </button>
        <button
          onClick={onOpenAddRowsModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-[13px] hover:bg-gray-50 transition"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
            <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
            <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
            <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          Add multiple rows
        </button>
      </div>

      {/* Hints */}
      <div className="flex items-center justify-center gap-5 mt-8 pt-6 border-t border-gray-100 flex-wrap">
        {[
          "Type a handle to auto-fetch profile data",
          "Instagram & TikTok supported",
          "Drag columns to reorder",
        ].map((hint) => (
          <div key={hint} className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1FAE5B] flex-shrink-0" />
            {hint}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SORT TOGGLE  — now used inside FilterPopover via props (see toolbar below)
   ═══════════════════════════════════════════════════════════════════════════════ */
function SortToggle({ sortOrder, onChange }: { sortOrder: SortOrder; onChange: (o: SortOrder) => void }) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg border border-[#0F6B3E]/20 bg-white p-1">
      <button
        onClick={() => onChange("newest")}
        title="Newest first"
        className={`h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
          sortOrder === "newest"
            ? "bg-[#1FAE5B] text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-50 hover:text-[#0F6B3E]"
        }`}
      >
        <IconArrowDown size={14} />
        Newest
      </button>
      <button
        onClick={() => onChange("oldest")}
        title="Oldest first"
        className={`h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
          sortOrder === "oldest"
            ? "bg-[#1FAE5B] text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-50 hover:text-[#0F6B3E]"
        }`}
      >
        <IconArrowUp size={14} />
        Oldest
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN TABLE SHEET
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function TableSheet({
  initialRows = [], initialCustomColumns = [],
  onRowsChange, onDeleteRow, onFetchComplete, onRegisterIdSwap,
  onCustomColumnsChange, onImportRows, readOnly = false, brandId,
  subscriptionStatus, onShowTrialModal,
}: {
  initialRows?: InfluencerRow[]
  initialCustomColumns?: CustomColumn[]
  onRowsChange?: (rows: InfluencerRow[]) => void
  onDeleteRow?: (rowId: string) => Promise<void>
  onFetchComplete?: (row: InfluencerRow) => void
  onRegisterIdSwap?: (fn: (tempId: string, realId: string) => void) => void
  onCustomColumnsChange?: (cols: CustomColumn[]) => void
  onImportRows?: (rows: InfluencerRow[]) => void
  readOnly?: boolean
  brandId?: string
  subscriptionStatus?: { status: string; isExpired: boolean } | null
  onShowTrialModal?: () => void
}) {
  const [rows, setRows] = useState<InfluencerRow[]>(initialRows)
  const [customCols, setCustomCols] = useState<CustomColumn[]>(initialCustomColumns)
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")

  const swapIdRef = useRef<(tempId: string, realId: string) => void>(() => {})
  useEffect(() => {
    const swapFn = (tempId: string, realId: string) => {
      setRows(prev => prev.map(r => r.id === tempId ? { ...r, id: realId } : r))
    }
    swapIdRef.current = swapFn
    onRegisterIdSwap?.(swapFn)
  }, [onRegisterIdSwap])

  const lastInitialKey = useRef("")
  useEffect(() => {
    const key = initialRows.map(r => r.id).join(",")
    if (key !== lastInitialKey.current) { lastInitialKey.current = key; setRows(initialRows) }
  }, [initialRows])
  useEffect(() => { setCustomCols(initialCustomColumns) }, [initialCustomColumns])

  const [activeCell, setActiveCell] = useState<CellAddress | null>(null)
  const [editCell, setEditCell]     = useState<CellAddress | null>(null)
  const [editValue, setEditValue]   = useState("")
  const [popupCell, setPopupCell]   = useState<CellAddress | null>(null)

  const [rowsPerPage, setRowsPerPage] = useState(100)
  const [currentPage, setCurrentPage] = useState(1)

  const [addingCol, setAddingCol]       = useState(false)
  const [colOrder, setColOrder]         = useState<number[] | null>(null)
  const [dragIdx, setDragIdx]           = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx]   = useState<number | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)

  const [searchQuery, setSearchQuery]         = useState("")
  const [showFilterPopover, setShowFilterPopover] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    platform: "all", niche: "all", location: "all", gender: "all",
    approval: "all", dateFrom: "", dateTo: "",
  })

  const [showAddRowsModal, setShowAddRowsModal]   = useState(false)
  const [showDeclineModal, setShowDeclineModal]   = useState(false)
  const [pendingDeclineRowIdx, setPendingDeclineRowIdx] = useState<number | null>(null)
  const [showImportExportMenu, setShowImportExportMenu] = useState(false)
  const [showManageNiches, setShowManageNiches]       = useState(false)
  const [showManageLocations, setShowManageLocations] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: ReactNode;
    onConfirm: () => void; variant: "danger" | "warning" | "info"
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {}, variant: "danger" })

  const [apiErrorModal, setApiErrorModal] = useState<{
    open: boolean
    platform?: string
    handle?: string
    rowId?: string
  }>({ open: false })

  const [selectedRowId, setSelectedRowId]   = useState<string | null>(null)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [sidebarRowId, setSidebarRowId]     = useState<string | null>(null)

  const {
    niches: dbNiches,
    locations: dbLocations,
    addNiche: dbAddNiche,
    removeNiche: dbRemoveNiche,
    addLocation: dbAddLocation,
    removeLocation: dbRemoveLocation,
  } = useBrandTaxonomy(brandId ?? null)

  const [nicheOptions, setNicheOptions] = useState<string[]>(DEFAULT_NICHES)
  const [locationOptions, setLocationOptions] = useState<string[]>(DEFAULT_LOCATIONS)

  useEffect(() => {
    if (dbNiches.length > 0) setNicheOptions(dbNiches.map(n => n.name))
  }, [dbNiches])

  useEffect(() => {
    if (dbLocations.length > 0) setLocationOptions(dbLocations.map(l => l.name))
  }, [dbLocations])

  const [fetchingRows, setFetchingRows]           = useState<Set<string>>(new Set())
  const [duplicateRowIds, setDuplicateRowIds]     = useState<Set<string>>(new Set())
  const [pendingDuplicateInfo, setPendingDuplicateInfo] = useState<{ rowId: string; handle: string; existingName: string } | null>(null)

  const [showBulkStatusMenu, setShowBulkStatusMenu]       = useState(false)
  const [showBulkTransferConfirm, setShowBulkTransferConfirm] = useState(false)
  const bulkStatusRef = useRef<HTMLDivElement>(null)

  const commitGuardRef     = useRef(false)
  const editInputRef       = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  const containerRef       = useRef<HTMLDivElement>(null)
  const tabPendingRef      = useRef(false)
  const filterBtnRef       = useRef<HTMLButtonElement>(null)
  const importExportBtnRef = useRef<HTMLButtonElement>(null)
  const importExportRef    = useRef<HTMLDivElement>(null)
  const fileInputRef       = useRef<HTMLInputElement>(null)

  const { toasts, addToast, dismissToast } = useToast()

  const INSTROOM_API: Record<string, (u: string) => string> = {
    instagram: (u) => `https://api.instroom.io/v2/${u}/instagram`,
    tiktok:    (u) => `https://api.instroom.io/${u}/tiktok`,
  }

  function parseFormattedNumber(val: string | number | undefined): string {
    if (!val || val === "Not Available") return ""
    const s = String(val).toLowerCase().trim()
    if (s.includes("m")) return String(Math.round(parseFloat(s) * 1_000_000))
    if (s.includes("k")) return String(Math.round(parseFloat(s) * 1_000))
    const n = parseFloat(s)
    return isNaN(n) ? "" : String(Math.round(n))
  }

  const fetchInfluencerFromAPI = useCallback(async (handle: string, platform: string): Promise<Partial<InfluencerRow> | null> => {
    const clean = handle.trim().replace(/^@/, "").toLowerCase()
    if (!clean || clean.length < 2) return null
    const endpointFn = INSTROOM_API[platform]
    if (!endpointFn) return null
    try {
      const res = await fetch(endpointFn(clean))
      if (!res.ok) return null
      const json = await res.json()
      const d = json.data || json.user || json
      if (!d || typeof d !== "object") return null
      const followerCount = Number(d.followers || d.follower_count || 0)
      const engRate = parseFloat(String(d.engagement_rate || "0")) || 0
      const profileUrl = platform === "tiktok" ? `https://tiktok.com/@${clean}` : `https://instagram.com/${clean}`
      const email = d.email && d.email !== "Not Available" ? d.email : ""
      const fullName = d.full_name || d.name || ""
      return {
        full_name: fullName, first_name: fullName.split(" ")[0] || "",
        follower_count: String(followerCount), engagement_rate: String(engRate),
        email, contact_info: email, social_link: profileUrl,
        location: d.location || d.country || "",
        niche: d.category || d.business_category || "",
        gender: d.gender || "",
        profile_image_url: d.photo || d.avatar || "",
        avg_likes: parseFormattedNumber(d.avg_likes || d.avg_hearts),
        avg_comments: parseFormattedNumber(d.avg_comments),
        avg_views: parseFormattedNumber(d.avg_video_views || d.avg_views),
      }
    } catch (err) {
      console.error(`API fetch error for ${handle}:`, err)
      setApiErrorModal({ open: true, platform, handle: clean })
      return null
    }
  }, [])

  const getEffectiveGroup = useCallback((cc: CustomColumn) => cc.assignedGroup, [])
  const STATIC_COLS = getStaticCols(nicheOptions, locationOptions)
  const rawCols: AnyColDef[] = [
    ...STATIC_COLS,
    ...customCols.map<CustomColDef>(c => ({
      key: `custom.${c.field_key}`, label: c.field_name,
      group: getEffectiveGroup(c),
      minWidth: c.field_type === "date" ? 110 : c.field_type === "boolean" ? 70 : 100,
      type: c.field_type, options: c.field_options,
      isCustom: true, customId: c.id, fieldKey: c.field_key, assignedGroup: c.assignedGroup,
    })),
  ]
  useEffect(() => {
    setColOrder(prev => (!prev || prev.length !== rawCols.length) ? rawCols.map((_, i) => i) : prev)
  }, [rawCols.length])
  const order   = colOrder && colOrder.length === rawCols.length ? colOrder : rawCols.map((_, i) => i)
  const allCols = order.map(i => rawCols[i])
  const totalCols = allCols.length

  useEffect(() => {
    if (!showImportExportMenu) return
    const h = (e: MouseEvent) => {
      if (importExportRef.current && !importExportRef.current.contains(e.target as Node) &&
          importExportBtnRef.current && !importExportBtnRef.current.contains(e.target as Node))
        setShowImportExportMenu(false)
    }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [showImportExportMenu])

  const filteredRows = (() => {
    const filtered = rows.filter(row => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!(row.handle.toLowerCase().includes(q) || row.full_name.toLowerCase().includes(q) ||
              row.email.toLowerCase().includes(q) || (row.contact_info && row.contact_info.toLowerCase().includes(q)) ||
              row.niche.toLowerCase().includes(q) || row.notes.toLowerCase().includes(q) ||
              (row.first_name && row.first_name.toLowerCase().includes(q)) ||
              (row.location && row.location.toLowerCase().includes(q)))) return false
      }
      if (filters.platform !== "all") {
        const pm: Record<string, string> = { "Instagram": "instagram", "YouTube": "youtube", "TikTok": "tiktok", "X (Twitter)": "twitter" }
        if (pm[filters.platform] !== row.platform) return false
      }
      if (filters.niche !== "all" && row.niche !== filters.niche) return false
      if (filters.location !== "all" && row.location !== filters.location) return false
      if (filters.gender !== "all" && row.gender !== filters.gender) return false
      if (filters.approval !== "all" && row.approval_status !== filters.approval) return false
      if (filters.dateFrom && row.created_at) {
        if (new Date(row.created_at) < new Date(filters.dateFrom + "T00:00:00")) return false
      }
      if (filters.dateTo && row.created_at) {
        if (new Date(row.created_at) > new Date(filters.dateTo + "T23:59:59")) return false
      }
      return true
    })
    return sortRows(filtered, sortOrder)
  })()

  const totalRows  = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage))
  const pageStart  = (currentPage - 1) * rowsPerPage
  const pageEnd    = Math.min(pageStart + rowsPerPage, totalRows)
  const pageRows   = filteredRows.slice(pageStart, pageEnd)
  useEffect(() => {
    const mx = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage))
    if (currentPage > mx) setCurrentPage(mx)
  }, [filteredRows.length, rowsPerPage, currentPage])

  const sidebarRow = rows.find(r => r.id === sidebarRowId) || null

  const handleRowSelect = (id: string, e?: React.MouseEvent) => {
    if (e?.ctrlKey || e?.metaKey) {
      setSelectedRowIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
      setSelectedRowId(id)
    } else if (e?.shiftKey && selectedRowId) {
      const ci = filteredRows.findIndex(r => r.id === selectedRowId)
      const ti = filteredRows.findIndex(r => r.id === id)
      if (ci !== -1 && ti !== -1) {
        const s = Math.min(ci, ti); const e2 = Math.max(ci, ti)
        setSelectedRowIds(new Set(filteredRows.slice(s, e2 + 1).map(r => r.id)))
      }
      setSelectedRowId(id)
    } else { setSelectedRowId(id); setSelectedRowIds(new Set([id])) }
  }

  const allPageSelected = pageRows.length > 0 && pageRows.every(r => selectedRowIds.has(r.id))
  const someSelected    = selectedRowIds.size > 0

  const handleSelectAll = () => {
    if (allPageSelected) {
      setSelectedRowIds(prev => { const n = new Set(prev); pageRows.forEach(r => n.delete(r.id)); return n })
    } else {
      setSelectedRowIds(prev => { const n = new Set(prev); pageRows.forEach(r => n.add(r.id)); return n })
    }
  }

  const handleSelectAllFiltered = () => {
    setSelectedRowIds(new Set(filteredRows.map(r => r.id)))
    setSelectedRowId(filteredRows[0]?.id || null)
  }

  const handleUpdateRow = (r: InfluencerRow) => {
    setRows(prev => { const n = prev.map(x => x.id === r.id ? r : x); onRowsChange?.(n); return n })
  }

  const handleApplyFilters  = (nf: FilterState) => { setFilters(nf); setCurrentPage(1) }
  const handleClearFilters  = () => {
    setFilters({ platform: "all", niche: "all", location: "all", gender: "all", approval: "all", dateFrom: "", dateTo: "" })
    setCurrentPage(1)
  }

  const handleBulkStatusChange = (newStatus: string) => {
    if (!selectedRowIds.size) return
    setRows(prev => {
      const next = prev.map(row => !selectedRowIds.has(row.id) ? row : { ...row, contact_status: newStatus })
      onRowsChange?.(next); return next
    })
    setShowBulkStatusMenu(false)
    addToast("success", `Updated ${selectedRowIds.size} row${selectedRowIds.size !== 1 ? "s" : ""} to "${STATUS_LABEL[newStatus] || newStatus}"`)
  }

  const handleBulkTransferToOutreach = () => {
    if (!selectedRowIds.size) return
    const t = new Date()
    const dateStr = [t.getFullYear(), String(t.getMonth() + 1).padStart(2, "0"), String(t.getDate()).padStart(2, "0")].join("-")
    setRows(prev => {
      const next = prev.map(row => !selectedRowIds.has(row.id) ? row : {
        ...row, approval_status: "Approved" as const,
        transferred_date: row.transferred_date || dateStr,
        contact_status: row.contact_status === "not_contacted" ? "contacted" : row.contact_status,
      })
      onRowsChange?.(next); return next
    })
    setShowBulkTransferConfirm(false)
    addToast("success", `Transferred ${selectedRowIds.size} influencer${selectedRowIds.size !== 1 ? "s" : ""} to outreach`)
    setSelectedRowIds(new Set())
  }

  const saveRowToDatabase = useCallback(async (row: InfluencerRow): Promise<void> => {
    if (!row.handle || !row.platform) return
    const isTempId = row.id.startsWith("temp-")
    const payload = {
      handle:            row.handle,
      platform:          row.platform,
      full_name:         row.full_name || null,
      email:             row.email || null,
      gender:            row.gender || null,
      niche:             row.niche || null,
      location:          row.location || null,
      bio:               row.bio || null,
      profile_image_url: row.profile_image_url || null,
      social_link:       row.social_link || null,
      follower_count:    Number(row.follower_count) || 0,
      engagement_rate:   Number(row.engagement_rate) || 0,
      avg_likes:         Number(row.avg_likes) || 0,
      avg_comments:      Number(row.avg_comments) || 0,
      avg_views:         Number(row.avg_views) || 0,
      ...(brandId ? { brandId } : {}),
    }
    if (isTempId) {
      try {
        const res = await fetch("/api/influencers/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          if (res.status === 409) {
            const existing = await fetch(
              `/api/influencers/find?handle=${encodeURIComponent(row.handle)}&platform=${encodeURIComponent(row.platform)}`
            ).then(r => r.ok ? r.json() : null).catch(() => null)
            if (existing?.id) { swapIdRef.current(row.id, existing.id); onFetchComplete?.({ ...row, id: existing.id }) }
            return
          }
          if (res.status === 403) { addToast("error", err.message || "Influencer limit reached for your plan"); return }
          addToast("error", `Failed to save @${row.handle}: ${err.error || res.statusText}`)
          return
        }
        const created = await res.json()
        swapIdRef.current(row.id, created.id)
        onFetchComplete?.({ ...row, id: created.id })
      } catch (err) {
        console.error("saveRowToDatabase POST error:", err)
        addToast("error", `Network error saving @${row.handle}`)
      }
    } else {
      const { handle, platform, brandId: _b, ...updatePayload } = payload as any
      try {
        const res = await fetch(`/api/influencers/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          console.error(`PUT /api/influencers/${row.id} failed:`, err)
        } else { onFetchComplete?.(row) }
      } catch (err) { console.error("saveRowToDatabase PUT error:", err) }
    }
  }, [brandId, addToast, onFetchComplete])

  const autoFetchInfluencer = useCallback(async (rowId: string, handle: string, platform: string) => {
    const clean = handle.trim().replace(/^@/, "").toLowerCase()
    if (!clean || clean.length < 2) return
    if (platform !== "instagram" && platform !== "tiktok") return

    setRows(prev => {
      const existingRow = prev.find(r => r.id === rowId)
      if (existingRow && Number(existingRow.follower_count) > 0) return prev
      const duplicate = prev.find(r =>
        r.id !== rowId && cleanHandle(r.handle).toLowerCase() === clean && r.platform === platform
      )
      if (duplicate) {
        setPendingDuplicateInfo({ rowId, handle: clean, existingName: duplicate.full_name || duplicate.handle })
        setDuplicateRowIds(p => { const n = new Set(p); n.add(rowId); return n })
        return prev
      }
      setDuplicateRowIds(p => { if (!p.has(rowId)) return p; const n = new Set(p); n.delete(rowId); return n })
      return prev
    })

    setFetchingRows(prev => { const n = new Set(prev); n.add(rowId); return n })

    try {
      const data = await fetchInfluencerFromAPI(handle, platform)
      if (!data) { addToast("error", `${clean} not found on ${platform}`); return }
      let enrichedRow: InfluencerRow | null = null
      setRows(prev => {
        if (data.email) {
          const emailLower = data.email.toLowerCase()
          const emailDuplicate = prev.find(r =>
            r.id !== rowId &&
            ((r.email || "").toLowerCase() === emailLower || (r.contact_info || "").toLowerCase() === emailLower)
          )
          if (emailDuplicate) addToast("warning", `@${clean} shares an email with @${emailDuplicate.handle} — possible duplicate`)
        }
        const next = prev.map(row => {
          if (row.id !== rowId) return row
          const u = { ...row }
          if (!u.full_name && data.full_name)         u.full_name = data.full_name
          if (!u.email && data.email)                 u.email = data.email
          if (!u.contact_info && data.contact_info)   u.contact_info = data.contact_info
          if (!u.social_link && data.social_link)     u.social_link = data.social_link
          if (!u.location && data.location)           u.location = data.location
          if (!u.niche && data.niche)                 u.niche = data.niche
          if (!u.gender && data.gender)               u.gender = data.gender
          if (data.profile_image_url)                 u.profile_image_url = data.profile_image_url
          if (data.first_name)                        u.first_name = data.first_name
          if (data.follower_count && data.follower_count !== "0") u.follower_count = data.follower_count
          if (data.engagement_rate && data.engagement_rate !== "0") u.engagement_rate = data.engagement_rate
          if (data.avg_likes !== undefined)           u.avg_likes = data.avg_likes
          if (data.avg_comments !== undefined)        u.avg_comments = data.avg_comments
          if (data.avg_views !== undefined)           u.avg_views = data.avg_views
          return u
        })
        onRowsChange?.(next)
        enrichedRow = next.find(r => r.id === rowId) ?? null
        return next
      })
      if (enrichedRow) setTimeout(() => saveRowToDatabase(enrichedRow!), 0)
    } catch (err) { console.error("Auto-fetch failed:", err) }
    finally { setFetchingRows(prev => { const n = new Set(prev); n.delete(rowId); return n }) }
  }, [onRowsChange, addToast, saveRowToDatabase, fetchInfluencerFromAPI])

  const addRow = () => {
    const r = newEmptyRow(customCols)
    setRows(prev => { const n = [...prev, r]; onRowsChange?.(n); return n })
    setCurrentPage(sortOrder === "newest" ? 1 : Math.ceil((rows.length + 1) / rowsPerPage))
    setActiveCell({ rowIdx: 0, colIdx: 0 }); containerRef.current?.focus()
  }

  const handleAddMultipleRows = (count: number) => {
    const nr: InfluencerRow[] = []; for (let i = 0; i < count; i++) nr.push(newEmptyRow(customCols))
    setRows(prev => {
      let n: InfluencerRow[]
      if (selectedRowIds.size > 0) {
        const si = filteredRows.map((r, i) => selectedRowIds.has(r.id) ? i : -1).filter(i => i !== -1)
        const li = Math.max(...si); const lid = filteredRows[li].id
        const ii = prev.findIndex(r => r.id === lid) + 1
        n = [...prev.slice(0, ii), ...nr, ...prev.slice(ii)]
      } else { n = [...prev, ...nr] }
      onRowsChange?.(n); return n
    })
    setCurrentPage(Math.ceil((rows.length + count) / rowsPerPage)); containerRef.current?.focus()
  }

  const deleteRow = (id: string) => {
    const r = rows.find(x => x.id === id)
    setConfirmDialog({
      isOpen: true, title: "Delete Row",
      message: <span>Delete <strong>{r?.full_name || r?.handle || "this row"}</strong>?</span>,
      onConfirm: () => {
        setRows(prev => { const n = prev.filter(x => x.id !== id); onRowsChange?.(n); return n })
        if (selectedRowId === id) setSelectedRowId(null)
        if (sidebarRowId === id) setSidebarRowId(null)
        setSelectedRowIds(prev => { const n = new Set(prev); n.delete(id); return n })
        onDeleteRow?.(id)
      }, variant: "danger",
    })
  }

  const deleteSelectedRows = () => {
    if (!selectedRowIds.size) return
    const idsToDelete = new Set(selectedRowIds)
    setConfirmDialog({
      isOpen: true, title: "Delete Selected Rows",
      message: <span>Delete <strong>{selectedRowIds.size} rows</strong>?</span>,
      onConfirm: () => {
        setRows(prev => { const n = prev.filter(r => !idsToDelete.has(r.id)); onRowsChange?.(n); return n })
        setSelectedRowId(null); setSelectedRowIds(new Set())
        if (sidebarRowId && idsToDelete.has(sidebarRowId)) setSidebarRowId(null)
        idsToDelete.forEach(id => onDeleteRow?.(id))
      }, variant: "danger",
    })
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const t = ev.target?.result as string; if (!t) return
      const { rows: imported, niches: importedNiches, locations: importedLocations } = importFromCSV(t, customCols)
      if (!imported.length) { alert("No valid rows found. Make sure your CSV matches the template headers."); return }
      const existingHandleKeys = new Set(rows.map(r => `${cleanHandle(r.handle).toLowerCase()}@${r.platform}`))
      const existingEmails     = new Set(rows.map(r => (r.contact_info || r.email || "").toLowerCase().trim()).filter(Boolean))
      let handleDupeCount = 0, emailDupeCount = 0
      const fresh = imported.filter(row => {
        const hk = `${row.handle.toLowerCase()}@${row.platform}`
        const em = (row.contact_info || row.email || "").toLowerCase().trim()
        if (existingHandleKeys.has(hk)) { handleDupeCount++; return false }
        if (em && existingEmails.has(em)) { emailDupeCount++; return false }
        return true
      })
      const totalSkipped = handleDupeCount + emailDupeCount
      if (!fresh.length) {
        const parts = [
          handleDupeCount && `${handleDupeCount} handle duplicate${handleDupeCount !== 1 ? "s" : ""}`,
          emailDupeCount  && `${emailDupeCount} email duplicate${emailDupeCount !== 1 ? "s" : ""}`,
        ].filter(Boolean).join(", ")
        addToast("warning", `All rows already exist in the table (${parts})`); e.target.value = ""; return
      }
      if (importedNiches.length)    setNicheOptions(prev => [...new Set([...prev, ...importedNiches])])
      if (importedLocations.length) setLocationOptions(prev => [...new Set([...prev, ...importedLocations])])
      setRows(prev => { const n = [...prev, ...fresh]; onRowsChange?.(n); return n })
      setCurrentPage(1)
      onImportRows?.(fresh)
      addToast("success", totalSkipped
        ? `Imported ${fresh.length} influencer${fresh.length !== 1 ? "s" : ""} · ${totalSkipped} skipped (duplicates)`
        : `Imported ${fresh.length} influencer${fresh.length !== 1 ? "s" : ""}`)
    }
    reader.readAsText(f); e.target.value = ""; setShowImportExportMenu(false)
  }

  const onColDragStart = (vi: number, e: DragEvent) => {
    setDragIdx(vi); e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, 40, 18)
  }
  const onColDragOver = (vi: number, e: DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverIdx(vi)
    const tc = allCols[vi]
    if (tc && (tc.group === "Influencer Details" || tc.group === "Approval Details" || tc.group === "Outreach Details"))
      setDragOverGroup(tc.group)
    else setDragOverGroup(null)
  }
  const onColDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const dc = allCols[dragIdx]
      if (dc.isCustom && dragOverGroup &&
          (dragOverGroup === "Influencer Details" || dragOverGroup === "Approval Details" || dragOverGroup === "Outreach Details")) {
        const fk = (dc as CustomColDef).fieldKey
        setCustomCols(prev => { const n = prev.map(c => c.field_key === fk ? { ...c, assignedGroup: dragOverGroup as any } : c); onCustomColumnsChange?.(n); return n })
      }
      setColOrder(prev => {
        const a = [...(prev ?? rawCols.map((_, i) => i))]; const [m] = a.splice(dragIdx, 1)
        a.splice(dragOverIdx!, 0, m); return a
      })
    }
    setDragIdx(null); setDragOverIdx(null); setDragOverGroup(null)
  }

  const getCellValue = useCallback((row: InfluencerRow, key: string): string => {
    if (key.startsWith("custom.")) return row.custom[key.slice(7)] ?? ""
    return String((row as Record<string, unknown>)[key] ?? "")
  }, [])

  const isOutreachField = useCallback((colKey: string): boolean => {
    if (colKey.startsWith("custom.")) {
      const fk = colKey.slice(7); const cc = customCols.find(c => c.field_key === fk)
      return cc?.assignedGroup === "Outreach Details"
    }
    return OUTREACH_FIELDS.has(colKey)
  }, [customCols])

  const handleDeclineConfirm = (reason: string) => {
    if (pendingDeclineRowIdx === null) return
    const ar = filteredRows[pendingDeclineRowIdx]; const ai = rows.findIndex(r => r.id === ar.id); if (ai === -1) return
    setRows(prev => { const n = [...prev]; n[ai] = handleApprovalChange(prev[ai], "Declined", reason); onRowsChange?.(n); return n })
    setShowDeclineModal(false); setPendingDeclineRowIdx(null); containerRef.current?.focus()
  }

  const applyCellValue = useCallback((rowIdx: number, colKey: string, value: string) => {
    const actualRow = filteredRows[rowIdx]; const actualRowIdx = rows.findIndex(r => r.id === actualRow.id); if (actualRowIdx === -1) return
    if (actualRow.approval_status === "Declined" && isOutreachField(colKey)) return
    if (colKey === "approval_status" && value === "Declined") { setPendingDeclineRowIdx(rowIdx); setShowDeclineModal(true); return }
    const currentRow = rows[actualRowIdx]
    let shouldFetch = false, fetchRowId = currentRow.id, fetchHandle = "", fetchPlatform = ""
    let cleanedValue = value
    if (colKey === "handle") cleanedValue = cleanHandle(value)
    if (colKey === "handle" && cleanedValue && cleanedValue.length >= 2) { shouldFetch = true; fetchHandle = cleanedValue; fetchPlatform = currentRow.platform }
    if (colKey === "platform" && currentRow.handle && cleanHandle(currentRow.handle).length >= 2) { shouldFetch = true; fetchHandle = currentRow.handle; fetchPlatform = value }
    setRows(prev => {
      const next = [...prev]; let row = { ...next[actualRowIdx] }
      if (colKey === "approval_status") { row = handleApprovalChange(row, cleanedValue) }
      else if (colKey.startsWith("custom.")) { row.custom = { ...row.custom, [colKey.slice(7)]: cleanedValue } }
      else { (row as Record<string, unknown>)[colKey] = cleanedValue }
      if (colKey === "first_name") {
        const lastName = row.full_name ? row.full_name.split(" ").slice(1).join(" ") : ""
        row.full_name = cleanedValue ? (lastName ? `${cleanedValue} ${lastName}` : cleanedValue) : lastName
      }
      if (colKey === "handle" || colKey === "platform") {
        const nH = colKey === "handle" ? cleanedValue : row.handle
        const nP = colKey === "platform" ? cleanedValue : row.platform
        const oU = getProfileUrl(colKey === "platform" ? prev[actualRowIdx].platform : row.platform, colKey === "handle" ? prev[actualRowIdx].handle : row.handle)
        const fU = getProfileUrl(nP, nH); const cL = row.social_link ?? ""
        if (!cL || cL === oU) row.social_link = fU
        const uk = customCols.filter(c => c.field_type === "url").map(c => c.field_key)
        if (uk.length) { row.custom = { ...row.custom }; uk.forEach(fk => { const c = row.custom[fk] ?? ""; if (!c || c === oU) row.custom[fk] = fU }) }
      }
      if (colKey === "niche" && cleanedValue && !nicheOptions.includes(cleanedValue)) { setNicheOptions(p => [...p, cleanedValue]); dbAddNiche(cleanedValue) }
      if (colKey === "location" && cleanedValue && !locationOptions.includes(cleanedValue)) { setLocationOptions(p => [...p, cleanedValue]); dbAddLocation(cleanedValue) }
      next[actualRowIdx] = row; onRowsChange?.(next); return next
    })
    if (shouldFetch) autoFetchInfluencer(fetchRowId, fetchHandle, fetchPlatform)
  }, [onRowsChange, customCols, filteredRows, rows, isOutreachField, nicheOptions, locationOptions, autoFetchInfluencer])

  const addOptionToCol = useCallback((fk: string, no: string) => {
    setCustomCols(prev => { const n = prev.map(c => c.field_key !== fk ? c : { ...c, field_options: [...(c.field_options ?? []), no] }); onCustomColumnsChange?.(n); return n })
  }, [onCustomColumnsChange])

  const startEdit = useCallback((ri: number, ci: number) => {
    if (readOnly) return
    const col = allCols[ci]; const row = filteredRows[ri]
    if (row.approval_status === "Declined" && isOutreachField(col.key)) return
    if (col.type === "boolean") { applyCellValue(ri, col.key, getCellValue(row, col.key) === "Yes" ? "No" : "Yes"); setActiveCell({ rowIdx: ri, colIdx: ci }); return }
    if (col.key === "platform" || col.key === "niche" || col.key === "location" ||
        col.key === "approval_status" || col.key === "contact_status" || col.key === "gender" ||
        col.type === "dropdown" || col.type === "multi-select" || col.type === "date" || col.type === "select") {
      setActiveCell({ rowIdx: ri, colIdx: ci }); setEditCell(null); setPopupCell({ rowIdx: ri, colIdx: ci }); return
    }
    const rawVal = getCellValue(row, col.key)
    const editVal = col.key === "handle" ? cleanHandle(rawVal) : rawVal
    setActiveCell({ rowIdx: ri, colIdx: ci }); setPopupCell(null); setEditCell({ rowIdx: ri, colIdx: ci }); setEditValue(editVal)
  }, [allCols, getCellValue, readOnly, filteredRows, applyCellValue, isOutreachField])

  const commitEdit = useCallback(() => {
    if (!editCell || commitGuardRef.current) return
    commitGuardRef.current = true
    applyCellValue(editCell.rowIdx, allCols[editCell.colIdx].key, editValue)
    setEditCell(null)
    setTimeout(() => { commitGuardRef.current = false }, 50)
  }, [editCell, editValue, allCols, applyCellValue])

  const cancelEdit = useCallback(() => { setEditCell(null); setPopupCell(null) }, [])

  useEffect(() => {
    if (!editCell) return
    requestAnimationFrame(() => { const el = editInputRef.current; if (!el) return; el.focus(); if (el instanceof HTMLInputElement) el.select() })
  }, [editCell])

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); if (activeCell && activeCell.rowIdx < pageEnd - 1) setActiveCell({ rowIdx: activeCell.rowIdx + 1, colIdx: activeCell.colIdx }); containerRef.current?.focus() }
    else if (e.key === "Escape") { cancelEdit(); containerRef.current?.focus() }
    else if (e.key === "Tab") {
      e.preventDefault(); tabPendingRef.current = true; commitEdit()
      if (activeCell) {
        const nc = e.shiftKey ? Math.max(0, activeCell.colIdx - 1) : Math.min(totalCols - 1, activeCell.colIdx + 1)
        const n = { rowIdx: activeCell.rowIdx, colIdx: nc }; setActiveCell(n)
        setTimeout(() => { startEdit(n.rowIdx, n.colIdx); tabPendingRef.current = false }, 0)
      }
    }
  }
  const handleEditBlur = () => { if (tabPendingRef.current) return; commitEdit() }

  const handleContainerKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editCell || popupCell || !activeCell) return
    const { rowIdx: ri, colIdx: ci } = activeCell
    switch (e.key) {
      case "ArrowUp":    e.preventDefault(); if (ri > pageStart) setActiveCell({ rowIdx: ri - 1, colIdx: ci }); break
      case "ArrowDown":  e.preventDefault(); if (ri < pageEnd - 1) setActiveCell({ rowIdx: ri + 1, colIdx: ci }); break
      case "ArrowLeft":  e.preventDefault(); if (ci > 0) setActiveCell({ rowIdx: ri, colIdx: ci - 1 }); break
      case "ArrowRight": e.preventDefault(); if (ci < totalCols - 1) setActiveCell({ rowIdx: ri, colIdx: ci + 1 }); break
      case "Tab":   e.preventDefault(); setActiveCell({ rowIdx: ri, colIdx: e.shiftKey ? Math.max(0, ci - 1) : Math.min(totalCols - 1, ci + 1) }); break
      case "Enter": case "F2": e.preventDefault(); startEdit(ri, ci); break
      case "Delete": case "Backspace": e.preventDefault(); applyCellValue(ri, allCols[ci].key, ""); break
    }
  }

  const confirmAddCol = (name: string, description: string, type: CustomColumn["field_type"], group: "Influencer Details" | "Approval Details" | "Outreach Details", options: string) => {
    const fk  = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
    const ho  = type === "dropdown" || type === "multi-select"
    const col: CustomColumn = {
      id: crypto.randomUUID(), field_key: fk, field_name: name.trim(), field_type: type,
      field_options: ho ? options.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      assignedGroup: group, description: description.trim() || undefined,
    }
    setCustomCols(prev => { const n = [...prev, col]; onCustomColumnsChange?.(n); return n })
    setRows(prev => prev.map(r => ({
      ...r, custom: {
        ...r.custom,
        [fk]: type === "boolean" ? "No" : type === "url" ? getProfileUrl(r.platform, r.handle) : "",
      },
    })))
    containerRef.current?.focus()
    addToast("success", `Column "${name.trim()}" added`)
  }

  const deleteCustomCol = (fk: string) => {
    setConfirmDialog({
      isOpen: true, title: "Delete Custom Column", message: "Delete this column? All data will be lost.",
      onConfirm: () => {
        setCustomCols(prev => { const n = prev.filter(c => c.field_key !== fk); onCustomColumnsChange?.(n); return n })
        setRows(prev => prev.map(r => { const custom = { ...r.custom }; delete custom[fk]; return { ...r, custom } }))
        setActiveCell(null); setEditCell(null); setPopupCell(null)
      }, variant: "danger",
    })
  }

  const getGroupBgClass = (g: string) => {
    switch (g) {
      case "Influencer Details": return "bg-blue-50 text-blue-700"
      case "Approval Details":   return "bg-purple-50 text-purple-700"
      case "Outreach Details":   return "bg-emerald-50 text-emerald-700"
      default: return "bg-gray-50 text-gray-500 border-dashed"
    }
  }
  const getColHeaderBgClass = (g: string) => {
    switch (g) {
      case "Influencer Details": return "bg-blue-50/60"
      case "Approval Details":   return "bg-purple-50/60"
      case "Outreach Details":   return "bg-emerald-50/60"
      default: return "bg-gray-50/40 border-dashed"
    }
  }

  const groupSpans: { group: string; span: number }[] = []
  allCols.forEach(col => {
    const l = groupSpans[groupSpans.length - 1]
    if (l && l.group === col.group) l.span++; else groupSpans.push({ group: col.group, span: 1 })
  })

  const hasActiveFilters = filters.platform !== "all" || filters.niche !== "all" ||
    filters.location !== "all" || filters.gender !== "all" ||
    filters.approval !== "all" || !!filters.dateFrom || !!filters.dateTo

  // ── Cell renderer (unchanged) ──────────────────────────────────────────────
  const renderCell = (row: InfluencerRow, rowIdx: number, col: AnyColDef, colIdx: number) => {
    const isActive   = activeCell?.rowIdx === rowIdx && activeCell?.colIdx === colIdx
    const isEditing  = editCell?.rowIdx === rowIdx && editCell?.colIdx === colIdx
    const isPopup    = popupCell?.rowIdx === rowIdx && popupCell?.colIdx === colIdx
    const value      = getCellValue(row, col.key)
    const ringCls    = isActive ? "ring-2 ring-inset ring-blue-500 z-[1]" : ""
    const isDuplicate = duplicateRowIds.has(row.id)
    const disabled   = (row.approval_status === "Declined" && isOutreachField(col.key)) || isDuplicate

    if (disabled) return (
      <td key={col.key} className="border border-gray-200 px-1.5 py-1 text-xs bg-gray-100 text-gray-400 cursor-not-allowed" style={{ minWidth: col.minWidth }}>
        {col.key === "contact_status"  ? <StatusBadge value={value} />
          : col.key === "approval_status" ? <ApprovalBadge value={value} />
          : col.key === "handle" ? (
            <div className="flex items-center gap-2">
              <ProfilePicture src={row.profile_image_url} socialLink={row.social_link || getProfileUrl(row.platform, row.handle)} name={row.full_name} handle={row.handle} size={24} />
              <span className="truncate text-gray-400">{cleanHandle(value) || "—"}</span>
            </div>
          ) : col.key === "follower_count" ? <span className="block truncate text-gray-400">{Number(value) ? formatFollowers(Number(value)) : "—"}</span>
            : col.key === "engagement_rate" ? <span className="block truncate text-gray-400">{parseFloat(value) ? `${parseFloat(value)}%` : "—"}</span>
            : <span className="block truncate text-gray-400">{value || "—"}</span>}
      </td>
    )

    if (col.key === "handle") {
      if (isEditing) return (
        <td key={col.key} className={`border border-gray-200 p-0 relative ${ringCls}`} style={{ minWidth: col.minWidth }}>
          <div className="flex items-center gap-2 px-2">
            <ProfilePicture src={row.profile_image_url} socialLink={row.social_link || getProfileUrl(row.platform, row.handle)} name={row.full_name} handle={row.handle} size={24} />
            <input ref={editInputRef as any} type="text" value={editValue} placeholder="username" onChange={e => setEditValue(e.target.value)} onBlur={handleEditBlur} onKeyDown={handleEditKeyDown} onMouseDown={e => e.stopPropagation()} className="flex-1 h-full py-1.5 text-sm outline-none bg-white min-w-0" />
          </div>
        </td>
      )
      const socialLink = row.social_link || getProfileUrl(row.platform, row.handle)
      return (
        <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs cursor-cell select-none relative hover:bg-blue-50/20 ${ringCls}`} style={{ minWidth: col.minWidth }} onClick={() => startEdit(rowIdx, colIdx)} onFocus={() => setActiveCell({ rowIdx, colIdx })}>
          <div className="flex items-center gap-2">
            <ProfilePicture src={row.profile_image_url} socialLink={socialLink} name={row.full_name} handle={row.handle} size={24}
              onExpired={() => {
                setRows(prev => prev.map(r => r.id === row.id ? { ...r, profile_image_url: "" } : r))
                if (row.handle && (row.platform === "instagram" || row.platform === "tiktok") && !Number(row.follower_count))
                  autoFetchInfluencer(row.id, row.handle, row.platform)
              }} />
            <span className="truncate text-sm text-gray-800 font-medium">{cleanHandle(value) || <span className="text-gray-300">Enter username</span>}</span>
          </div>
        </td>
      )
    }

    if (isEditing) {
      if (col.type === "select" && col.options && col.key !== "platform" && col.key !== "niche" && col.key !== "location")
        return <td key={col.key} className={`border border-gray-200 p-0 relative ${ringCls}`} style={{ minWidth: col.minWidth }}><select ref={editInputRef as any} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleEditBlur} onKeyDown={handleEditKeyDown} onMouseDown={e => e.stopPropagation()} className="w-full h-full px-1.5 py-1 text-xs outline-none bg-white appearance-none">{col.options.map(o => <option key={o} value={o}>{o || "—"}</option>)}</select></td>
      if (col.type === "url") {
        const inv = editValue !== "" && !isValidUrl(editValue)
        return <td key={col.key} className={`border border-gray-200 p-0 relative ${ringCls}`} style={{ minWidth: col.minWidth }}><input ref={editInputRef as any} type="text" value={editValue} placeholder="https://…" onChange={e => setEditValue(e.target.value)} onBlur={handleEditBlur} onKeyDown={handleEditKeyDown} onMouseDown={e => e.stopPropagation()} className={`w-full h-full px-1.5 py-1 text-xs outline-none bg-white ${inv ? "text-red-500" : "text-blue-600"}`} />{inv && <div className="absolute -bottom-5 left-1 text-[10px] text-red-400 whitespace-nowrap z-50">Invalid URL</div>}</td>
      }
      return <td key={col.key} className={`border border-gray-200 p-0 relative ${ringCls}`} style={{ minWidth: col.minWidth }}><input ref={editInputRef as any} type={col.type === "number" ? "number" : "text"} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleEditBlur} onKeyDown={handleEditKeyDown} onMouseDown={e => e.stopPropagation()} className="w-full h-full px-1.5 py-1 text-xs outline-none bg-white" /></td>
    }

    if (isPopup) {
      const closeP = () => { setPopupCell(null); containerRef.current?.focus() }
      if (col.key === "platform") return (
        <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}>
          <div className="flex items-center gap-2"><PlatformIcon platform={value} size={14} /><span className="text-sm text-gray-700">{platforms.find(p => p.value === value)?.name || value}</span></div>
          <PlatformEditor value={value} onChange={v => applyCellValue(rowIdx, col.key, v)} onClose={closeP} />
        </td>
      )
      if (col.key === "niche") return <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}>{value ? <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium truncate max-w-full">{value}</span> : <span className="text-gray-300">—</span>}<DropdownEditor value={value} options={nicheOptions} onChange={v => applyCellValue(rowIdx, col.key, v)} onClose={closeP} onAddOption={v => { setNicheOptions(p => [...p, v]); dbAddNiche(v) }} /></td>
      if (col.key === "location") return <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}>{value ? <span className="truncate block text-sm">{value}</span> : <span className="text-gray-300">—</span>}<DropdownEditor value={value} options={locationOptions} onChange={v => applyCellValue(rowIdx, col.key, v)} onClose={closeP} onAddOption={v => { setLocationOptions(p => [...p, v]); dbAddLocation(v) }} /></td>
      if (col.key === "approval_status") return <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}><ApprovalBadge value={value} /><FloatingPopup onClose={closeP}><div className="w-52 max-h-60 overflow-auto py-1">{(["Approved", "Declined", "Pending"] as const).map(o => (<button key={o} onMouseDown={e => e.preventDefault()} onClick={() => { applyCellValue(rowIdx, col.key, o); closeP() }} className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-50 transition ${value === o ? "font-medium bg-gray-50" : "text-gray-700"}`}>{value === o && <IconCheck size={12} className="text-indigo-600 flex-shrink-0" />}<span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${APPROVAL_STYLE[o] ?? ""}`}>{o}</span></button>))}</div></FloatingPopup></td>
      if (col.key === "contact_status") return <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}><StatusBadge value={value} /><FloatingPopup onClose={closeP}><div className="w-52 max-h-60 overflow-auto py-1">{DEFAULT_CONTACT_STATUSES.map(o => (<button key={o.value} onMouseDown={e => e.preventDefault()} onClick={() => { applyCellValue(rowIdx, col.key, o.value); closeP() }} className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-50 transition ${value === o.value ? "font-medium bg-gray-50" : "text-gray-700"}`}>{value === o.value && <IconCheck size={12} className="text-indigo-600 flex-shrink-0" />}<span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[o.value] ?? ""}`}>{o.label}</span></button>))}</div></FloatingPopup></td>
      if (col.key === "gender") return <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}><span className="block truncate">{value || <span className="text-gray-300">—</span>}</span><FloatingPopup onClose={closeP}><div className="w-52 max-h-60 overflow-auto py-1"><button onMouseDown={e => e.preventDefault()} onClick={() => { applyCellValue(rowIdx, col.key, ""); closeP() }} className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition ${!value ? "text-indigo-600 font-medium" : "text-gray-400"}`}>— Non —</button>{DEFAULT_GENDERS.map(g => (<button key={g} onMouseDown={e => e.preventDefault()} onClick={() => { applyCellValue(rowIdx, col.key, g); closeP() }} className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-50 transition ${value === g ? "text-indigo-700 font-medium bg-indigo-50" : "text-gray-700"}`}>{value === g && <IconCheck size={12} className="text-indigo-600 flex-shrink-0" />}{g}</button>))}</div></FloatingPopup></td>
      if (col.type === "dropdown" && col.isCustom) return <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}>{value ? <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium truncate max-w-full">{value}</span> : <span className="text-gray-300">—</span>}<DropdownEditor value={value} options={col.options ?? []} onChange={v => applyCellValue(rowIdx, col.key, v)} onClose={closeP} onAddOption={o => addOptionToCol((col as CustomColDef).fieldKey, o)} /></td>
      if (col.type === "multi-select" && col.isCustom) return <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}><MultiSelectDisplay value={value} /><MultiSelectEditor value={value} options={col.options ?? []} onChange={v => applyCellValue(rowIdx, col.key, v)} onClose={closeP} onAddOption={o => addOptionToCol((col as CustomColDef).fieldKey, o)} /></td>
      if (col.type === "date") {
        const disp = value ? new Date(value + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : ""
        return <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}><div className="flex items-center gap-1.5"><IconCalendar size={12} className="text-blue-500 flex-shrink-0" /><span>{disp || <span className="text-gray-300">Pick a date</span>}</span></div><DatePicker value={value} onChange={v => applyCellValue(rowIdx, col.key, v)} onClose={closeP} /></td>
      }
    }

    const tdCls  = `border border-gray-200 px-1.5 py-1 text-xs cursor-cell select-none relative hover:bg-blue-50/20 ${ringCls}`
    const onClick = () => startEdit(rowIdx, colIdx)
    const onFocus = () => setActiveCell({ rowIdx, colIdx })

    if (col.key === "platform") return (
      <td key={col.key} className={tdCls} style={{ minWidth: col.minWidth }} onClick={onClick} onFocus={onFocus}>
        <div className="flex items-center gap-2"><PlatformIcon platform={value} size={14} /><span className="text-sm text-gray-700">{platforms.find(p => p.value === value)?.name || value}</span></div>
      </td>
    )
    if (col.type === "boolean") { const y = value === "Yes"; return <td key={col.key} className={`${tdCls} cursor-pointer`} style={{ minWidth: col.minWidth }} onClick={onClick} onFocus={onFocus}><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${y ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{y ? "Yes" : "No"}</span></td> }
    if (col.type === "multi-select") return <td key={col.key} className={tdCls} style={{ minWidth: col.minWidth }} onClick={onClick} onFocus={onFocus}><MultiSelectDisplay value={value} /></td>
    if (col.key === "follower_count") return <td key={col.key} className={tdCls} style={{ minWidth: col.minWidth }} onClick={onClick} onFocus={onFocus}><span className="block truncate">{Number(value) ? formatFollowers(Number(value)) : <span className="text-gray-300">—</span>}</span></td>
    if (col.key === "engagement_rate") return <td key={col.key} className={tdCls} style={{ minWidth: col.minWidth }} onClick={onClick} onFocus={onFocus}><span className="block truncate">{parseFloat(value) ? `${parseFloat(value).toFixed(2)}%` : <span className="text-gray-300">—</span>}</span></td>
    if (col.key === "contact_status") return <td key={col.key} className={tdCls} style={{ minWidth: col.minWidth }} onClick={onClick} onFocus={onFocus}><StatusBadge value={value} /></td>
    if (col.key === "approval_status") return <td key={col.key} className={tdCls} style={{ minWidth: col.minWidth }} onClick={onClick} onFocus={onFocus}><ApprovalBadge value={value} /></td>
    if (col.type === "url") return (
      <td key={col.key} className={tdCls} style={{ minWidth: col.minWidth }} onClick={onClick} onFocus={onFocus}>
        {value && isValidUrl(value)
          ? <a href={normalizeUrl(value)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-blue-600 hover:underline truncate"><IconExternalLink size={11} className="flex-shrink-0" /><span className="truncate">{value}</span></a>
          : <span className="block truncate text-gray-400">{value || "—"}</span>}
      </td>
    )
    return <td key={col.key} className={tdCls} style={{ minWidth: col.minWidth }} onClick={onClick} onFocus={onFocus}><span className="block truncate">{value || <span className="text-gray-300">—</span>}</span></td>
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 text-gray-700 text-sm">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(p => ({ ...p, isOpen: false })) }}
        onClose={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} variant={confirmDialog.variant}
      />

      {/* API Error Modal */}
      {apiErrorModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) setApiErrorModal({ open: false }) }}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-1.5 bg-red-100 rounded-full">
                <IconAlertTriangle size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-900">Influencer API unavailable</h2>
                <p className="mt-2 text-sm text-gray-600">
                  We couldn't fetch data for <strong>@{apiErrorModal.handle}</strong>. You may retry or continue adding the influencer manually.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition" onClick={() => setApiErrorModal({ open: false })}>Continue manually</button>
              <button type="button" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                onClick={() => {
                  const { handle, platform, rowId } = apiErrorModal
                  setApiErrorModal({ open: false })
                  if (handle && platform && rowId) autoFetchInfluencer(rowId, handle, platform)
                }}>Retry</button>
            </div>
          </div>
        </div>
      )}

      {pendingDuplicateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) setPendingDuplicateInfo(null) }}>
          <div className="bg-white rounded-xl shadow-xl w-[420px] p-5">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="p-1.5 bg-amber-100 rounded-full flex-shrink-0"><IconAlertTriangle size={18} className="text-amber-600" /></div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Duplicate Influencer</h3>
                <p className="text-xs text-gray-500 mt-0.5"><strong>@{pendingDuplicateInfo.handle}</strong> already exists as <strong>{pendingDuplicateInfo.existingName}</strong>.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                setRows(prev => { const n = prev.filter(r => r.id !== pendingDuplicateInfo.rowId); onRowsChange?.(n); return n })
                setDuplicateRowIds(prev => { const n = new Set(prev); n.delete(pendingDuplicateInfo.rowId); return n })
                setPendingDuplicateInfo(null)
              }} className="flex-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs hover:bg-red-100 transition">Remove duplicate</button>
              <button onClick={() => {
                setDuplicateRowIds(prev => { const n = new Set(prev); n.delete(pendingDuplicateInfo.rowId); return n })
                setPendingDuplicateInfo(null)
              }} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition">Keep anyway</button>
            </div>
          </div>
        </div>
      )}

      {addingCol && <AddColumnModal isOpen={addingCol} onClose={() => setAddingCol(false)} onConfirm={confirmAddCol} customCols={customCols} />}

      {showManageNiches && (
        <ManageOptionsModal isOpen={showManageNiches} title="Manage Niches" options={nicheOptions}
          onAdd={async (name) => { await dbAddNiche(name); setNicheOptions(p => [...p, name]) }}
          onRemove={async (name) => { const match = dbNiches.find(n => n.name === name); if (match) await dbRemoveNiche(match.id); setNicheOptions(p => p.filter(n => n !== name)) }}
          onClose={() => setShowManageNiches(false)} />
      )}

      {showManageLocations && (
        <ManageOptionsModal isOpen={showManageLocations} title="Manage Locations" options={locationOptions}
          onAdd={async (name) => { await dbAddLocation(name); setLocationOptions(p => [...p, name]) }}
          onRemove={async (name) => { const match = dbLocations.find(l => l.name === name); if (match) await dbRemoveLocation(match.id); setLocationOptions(p => p.filter(l => l !== name)) }}
          onClose={() => setShowManageLocations(false)} />
      )}

      {/* ── Toolbar ── */}
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              placeholder="Search influencers…"
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            />
          </div>

          {/* Filters button */}
          <div className="relative">
            <button ref={filterBtnRef} onClick={() => setShowFilterPopover(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg transition ${hasActiveFilters ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              <IconFilter size={13} /> Filters {hasActiveFilters && `(${[filters.platform !== "all", filters.niche !== "all", filters.location !== "all", filters.gender !== "all", filters.approval !== "all", !!filters.dateFrom, !!filters.dateTo].filter(Boolean).length})`}
            </button>
            {showFilterPopover && (
              <FilterPopover
                isOpen={showFilterPopover}
                filters={filters} niches={nicheOptions} locations={locationOptions}
                onApplyFilters={handleApplyFilters} onClearFilters={handleClearFilters}
                onClose={() => setShowFilterPopover(false)} anchorRef={filterBtnRef}
              />
            )}
          </div>

          {/* ── Sort toggle — moved here from its own row ── */}
          <SortToggle sortOrder={sortOrder} onChange={v => { setSortOrder(v); setCurrentPage(1) }} />

          {/* Right-side controls */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={() => setShowManageNiches(true)} className="flex items-center gap-1.5 px-2.5 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition" title="Manage niches"><IconTags size={13} /> Niches</button>
            <button onClick={() => setShowManageLocations(true)} className="flex items-center gap-1.5 px-2.5 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition" title="Manage locations"><IconMapPin size={13} /> Locations</button>

            <div className="relative">
              <button
                ref={importExportBtnRef}
                onClick={() => {
                  if (subscriptionStatus?.status === "trialing") { onShowTrialModal?.(); return }
                  setShowImportExportMenu(v => !v)
                }}
                disabled={subscriptionStatus?.status === "trialing"}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs border rounded-lg transition ${
                  subscriptionStatus?.status === "trialing"
                    ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                title={subscriptionStatus?.status === "trialing" ? "Import and Export are not available during your free trial" : undefined}
              >
                <IconSettings size={13} /> Import / Export
              </button>
              {showImportExportMenu && (
                <div ref={importExportRef} className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-52 py-1">
                  <button onClick={() => { fileInputRef.current?.click(); setShowImportExportMenu(false) }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition text-gray-700"><IconUpload size={13} className="text-blue-500" /> Import from CSV</button>
                  <button onClick={() => { exportToCSV(rows, customCols); setShowImportExportMenu(false) }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition text-gray-700"><IconDownload size={13} className="text-green-500" /> Export to CSV</button>
                  <button onClick={() => { downloadTemplate(customCols); setShowImportExportMenu(false) }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition text-gray-700"><IconDownload size={13} className="text-gray-400" /> Download template</button>
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </div>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {someSelected && !readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex-wrap">
          <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
            <span>{selectedRowIds.size} selected</span>
            {selectedRowIds.size < filteredRows.length && (
              <button onClick={handleSelectAllFiltered} className="text-xs text-blue-600 hover:text-blue-800 underline font-medium transition">Select all {filteredRows.length}</button>
            )}
            <button onClick={() => setSelectedRowIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 transition">✕ Clear</button>
          </div>
          <div className="h-4 w-px bg-blue-200" />
          <button onClick={() => setShowBulkTransferConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            <IconChecklist size={13} /> Transfer to Outreach
          </button>
          <div className="relative" ref={bulkStatusRef}>
            <button onClick={() => setShowBulkStatusMenu(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 transition">
              <IconArrowsSort size={13} /> Change Status <IconChevronDown size={11} />
            </button>
            {showBulkStatusMenu && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-52 py-1">
                <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Set for {selectedRowIds.size} rows</div>
                {DEFAULT_CONTACT_STATUSES.map(s => (
                  <button key={s.value} onClick={() => handleBulkStatusChange(s.value)} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition text-gray-700">
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${s.value === "not_contacted" ? "bg-gray-400" : s.value === "contacted" ? "bg-blue-500" : s.value === "interested" ? "bg-yellow-500" : "bg-green-500"}`} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={deleteSelectedRows} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition">
            <IconTrash size={13} /> Delete {selectedRowIds.size}
          </button>
        </div>
      )}

      {/* Bulk transfer confirm */}
      {showBulkTransferConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) setShowBulkTransferConfirm(false) }}>
          <div className="bg-white rounded-xl shadow-xl w-[400px] p-5">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="p-1.5 bg-green-100 rounded-full flex-shrink-0"><IconChecklist size={18} className="text-green-600" /></div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">Transfer to Outreach</h3>
                <p className="text-xs text-gray-500 mt-0.5">Mark <strong>{selectedRowIds.size} influencer{selectedRowIds.size !== 1 ? "s" : ""}</strong> as Approved and move to outreach — no individual review needed.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-4">
              <p className="text-[10px] text-amber-800">This sets approval to <strong>Approved</strong> and stamps the transferred date for all selected rows.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkTransferConfirm(false)} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleBulkTransferToOutreach} className="flex-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs hover:bg-green-700 transition font-medium">Confirm Transfer</button>
            </div>
          </div>
        </div>
      )}

      <AddRowsModal isOpen={showAddRowsModal} onClose={() => setShowAddRowsModal(false)} onAdd={handleAddMultipleRows} selectedCount={selectedRowIds.size} />

      {sidebarRow && (
        <ProfileSidebar row={sidebarRow} customCols={customCols} onUpdate={handleUpdateRow} onClose={() => setSidebarRowId(null)}
          readOnly={readOnly} niches={nicheOptions} locations={locationOptions}
          onAddNiche={v => { setNicheOptions(p => [...p, v]); dbAddNiche(v) }} onAddLocation={v => { setLocationOptions(p => [...p, v]); dbAddLocation(v) }}
          onToast={addToast} brandId={brandId} />
      )}

      {/* ── Table ── */}
      <div className="w-full min-w-0">
        <div ref={containerRef} tabIndex={0}
          className="instroom-table-wrap overflow-auto border border-gray-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-200"
          onKeyDown={handleContainerKeyDown}
          onMouseDown={e => { const t = e.target as HTMLElement; if (t.closest("input, select, button, [tabindex]") && t !== containerRef.current) return; setTimeout(() => containerRef.current?.focus(), 0) }}>
          <table className="text-sm border-collapse w-full" style={{ tableLayout: "auto" }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th rowSpan={2} className="border border-gray-200 bg-gray-50 w-10 min-w-[2.5rem] text-center">
                  {!readOnly ? (
                    <div className="flex flex-col items-center justify-center gap-0.5 py-0.5">
                      <input type="checkbox" checked={allPageSelected} onChange={handleSelectAll} className="w-3 h-3 rounded accent-blue-600 cursor-pointer" title={allPageSelected ? "Deselect all on page" : "Select all on page"} />
                      <span className="text-[9px] text-gray-400 leading-none">#</span>
                    </div>
                  ) : <span className="text-xs text-gray-400">#</span>}
                </th>
                {groupSpans.map((g, i) => <th key={`${g.group}-${i}`} colSpan={g.span} className={`border border-gray-200 text-center text-xs font-semibold py-1.5 px-3 whitespace-nowrap ${getGroupBgClass(g.group)}`}>{g.group}</th>)}
                {!readOnly && <th rowSpan={2} className="border border-gray-200 bg-gray-50 text-center whitespace-nowrap"><button onClick={() => setAddingCol(true)} className="px-2 py-1 mx-auto flex items-center justify-center gap-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition text-xs whitespace-nowrap"><IconPlus size={12} /><span>Add column</span></button></th>}
                <th rowSpan={2} className="border border-gray-200 bg-gray-50 w-10 min-w-[2.5rem]" />
              </tr>
              <tr>
                {allCols.map((col, vi) => {
                  const isDragging = dragIdx === vi; const isOver = dragOverIdx === vi && dragIdx !== vi
                  return (
                    <th key={col.key} draggable={!readOnly} onDragStart={e => onColDragStart(vi, e)} onDragOver={e => onColDragOver(vi, e)} onDragEnd={onColDragEnd}
                      className={`border border-gray-200 px-2 py-1.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap group/col transition-all ${getColHeaderBgClass(col.group)} ${isDragging ? "opacity-40" : ""} ${isOver ? "border-l-2 !border-l-blue-500" : ""}`}
                      style={{ minWidth: col.minWidth, cursor: readOnly ? "default" : "grab" }}>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          {!readOnly && <IconGripVertical size={10} className="text-gray-300 flex-shrink-0 opacity-0 group-hover/col:opacity-100 transition" />}
                          <span>{col.label}</span>
                        </div>
                        {!readOnly && col.isCustom && <button onClick={() => deleteCustomCol((col as CustomColDef).fieldKey)} className="opacity-0 group-hover/col:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition"><IconX size={12} /></button>}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, li) => {
                const ri = pageStart + li; const isSel = selectedRowIds.has(row.id)
                const isDeclined = row.approval_status === "Declined"
                const isFetching = fetchingRows.has(row.id)
                const isDup = duplicateRowIds.has(row.id)
                return (
                  <tr key={row.id} className={`group cursor-pointer transition-colors ${isSel ? "bg-blue-100" : "hover:bg-gray-50/60"} ${isDeclined ? "bg-red-50/30" : ""} ${isDup ? "bg-amber-50/50 opacity-60" : ""}`}
                    onClick={e => handleRowSelect(row.id, e)} onDoubleClick={() => setSidebarRowId(row.id)}>
                    <td className="border border-gray-100 text-center bg-gray-50/40 select-none py-0.5">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        {isFetching ? <IconLoader2 size={12} className="text-green-600 animate-spin" />
                          : !readOnly ? <input type="checkbox" checked={isSel} onChange={() => handleRowSelect(row.id)} onClick={e => e.stopPropagation()} className="w-3 h-3 rounded accent-blue-600 cursor-pointer" />
                          : null}
                        <span className="text-[9px] text-gray-400 leading-none">{ri + 1}</span>
                      </div>
                    </td>
                    {allCols.map((col, ci) => renderCell(row, ri, col, ci))}
                    {!readOnly && <td className="border border-gray-200 bg-gray-50/40" />}
                    <td className="border border-gray-200 text-center bg-gray-50/40">
                      {!readOnly && <button onClick={e => { e.stopPropagation(); deleteRow(row.id) }} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition"><IconTrash size={12} /></button>}
                    </td>
                  </tr>
                )
              })}

              {/* ── Empty state — shown inside tbody when no rows ── */}
              {totalRows === 0 && !readOnly && (
                <tr>
                  <td colSpan={totalCols + 3} className="p-0 border-0">
                    <EmptyState
                      onAddRow={addRow}
                      onOpenAddRowsModal={() => setShowAddRowsModal(true)}
                    />
                  </td>
                </tr>
              )}

              {/* Read-only empty */}
              {totalRows === 0 && readOnly && (
                <tr>
                  <td colSpan={totalCols + 3} className="py-10 text-center text-sm text-gray-400">
                    No influencers found.
                  </td>
                </tr>
              )}
            </tbody>
            {!readOnly && (
              <tfoot>
                <tr>
                  <td colSpan={totalCols + 3} className="border-t border-gray-200">
                    <div className="flex items-center">
                      <button onClick={addRow} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition"><IconPlus size={12} /> Add row</button>
                      <button onClick={() => setShowAddRowsModal(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition border-l border-gray-200"><IconCopy size={14} /> Add multiple rows</button>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {totalRows > 0 && (
          <div className="flex items-center justify-between gap-4 text-sm text-gray-600 px-1 mt-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Rows per page:</span>
              <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1) }} className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white outline-none">
                <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={9999}>All</option>
              </select>
              {selectedRowIds.size > 0 && <span className="ml-4 text-xs text-blue-600">{selectedRowIds.size} selected</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs">{pageStart + 1}–{pageEnd} of {totalRows}</span>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 border border-gray-200 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50 transition">«</button>
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 border border-gray-200 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50 transition">Prev</button>
                <span className="px-3 py-1 border border-gray-200 rounded-lg text-xs bg-white min-w-[70px] text-center">{currentPage}/{totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 border border-gray-200 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50 transition">Next</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 border border-gray-200 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50 transition">»</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      {!readOnly && (
        <div className="flex items-center gap-4 px-1 flex-wrap">
          {[{ keys: ["Ctrl", "Click"], label: "Multi-select" }, { keys: ["Shift", "Click"], label: "Range select" }, { keys: ["↑", "↓", "←", "→"], label: "Navigate" }, { keys: ["Enter"], label: "Edit" }, { keys: ["Tab"], label: "Next cell" }, { keys: ["Esc"], label: "Cancel" }, { keys: ["Del"], label: "Clear" }, { keys: ["Dbl-click"], label: "View Profile" }].map(({ keys, label }) => (
            <div key={label} className="flex items-center gap-1">
              {keys.map(k => <kbd key={k} className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-500 shadow-sm leading-none">{k}</kbd>)}
              <span className="text-[11px] text-gray-400 ml-0.5">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-2 border-l border-gray-200 pl-3">
            <IconGripVertical size={10} className="text-gray-400" />
            <span className="text-[11px] text-gray-400">Drag custom columns to assign groups</span>
          </div>
        </div>
      )}
    </div>
  )
}
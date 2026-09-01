"use client"

import ReactDOM from "react-dom"
import React, {
  useState, useRef, useEffect, useCallback, useMemo, memo,
  type KeyboardEvent, type ReactNode, type DragEvent,
} from "react"
import {
  IconTrash, IconPlus, IconX, IconExternalLink, IconCheck, IconCalendar,
  IconGripVertical, IconSearch, IconFilter, IconTags, IconMapPin,
  IconCopy, IconAlertTriangle, IconDownload, IconUpload,
  IconSettings, IconLoader2, IconDots, IconDotsVertical,
} from "@tabler/icons-react"

import type { InfluencerRow, CustomColumn, AnyColDef, CustomColDef, CellAddress, FilterState, ToastNotification, BulkApprovalResult } from "./types"
import {
  DEFAULT_NICHES, DEFAULT_LOCATIONS, DEFAULT_GENDERS, DEFAULT_CONTACT_STATUSES,
  OUTREACH_FIELDS, platforms, STATUS_STYLE, APPROVAL_STYLE,
  INSTROOM_API_BASE_URL, INSTROOM_PROFILE_ENDPOINTS, isInstroomApiConfigured,
} from "./constants"
import {
  cleanHandle, getProfileUrl, sortRows, newEmptyRow, getStaticCols,
  handleApprovalChange, isValidUrl, normalizeUrl, formatFollowers,
  exportToCSV, downloadTemplate, importFromCSV,
  normalizeApiUsername, isValidApiUsername, describeLookupFailure, lookupFailureMessage,
  isUsableEmail, normalizeEmail, normalizeContactInfo, isUniqueContact, contactMatchKey,
} from "./utils"
import { useToast } from "./hooks"
import { ProfilePicture, PlatformIcon, StatusBadge, ApprovalBadge, MultiSelectDisplay } from "./ui-atoms"
import { FloatingPopup, DropdownEditor, MultiSelectEditor, DatePicker, PlatformEditor } from "./cell-editors"
import {
  ConfirmationDialog, AddRowsModal, DeclineConfirmationModal,
  ManageOptionsModal, AddColumnModal, FilterPopover,
} from "./modals"
import { MobileRowCards } from "./mobile-row-cards"
import { ToastContainer } from "./toast"
import { DataSyncStatus } from "@/components/data-sync-status"
import ProfileSidebar from "./profile-sidebar"
import { useBrandTaxonomy } from "@/hooks/useBrandTaxonomy"

/* ═══════════════════════════════════════════════════════════════════════════════
   SHEET ROW  —  the render boundary
   ═══════════════════════════════════════════════════════════════════════════════
   Editing one cell used to re-run `renderCell` for EVERY visible row: at the
   default 100 rows per page and ~17 columns that is ~1,700 cell renders per
   keystroke, and an 8-character edit wasted ~13,400 of them.

   This boundary is the whole fix. The row takes only per-row values plus
   callbacks that are stable for the life of the component, so a keystroke
   re-renders the edited row and nothing else.

   `renderCell` is deliberately EXCLUDED from the comparator. It is recreated on
   every parent render (it closes over ~20 pieces of sheet state), so comparing
   it would defeat the memo entirely. What it renders for a given row is decided
   by `cellsKey` below — the row's own active/edit/popup position and the values
   that actually change its output — so the row still repaints whenever anything
   affecting it moves, and never when it does not.
   ═══════════════════════════════════════════════════════════════════════════════ */

type SheetRowProps = {
  row: InfluencerRow
  /** Absolute index in the filtered list, used for the # column and cell coords. */
  rowIdx: number
  isSelected: boolean
  isDeclined: boolean
  isDuplicate: boolean
  isFetching: boolean
  readOnly: boolean
  cols: AnyColDef[]
  /**
   * Everything about the SHEET's state that changes what this row renders, as
   * one string: which of its cells is active, being edited or showing a popup,
   * and the current edit value. Compared instead of the individual pieces so a
   * cell address object identity cannot cause a needless repaint.
   */
  cellsKey: string
  renderCell: (row: InfluencerRow, rowIdx: number, col: AnyColDef, colIdx: number) => React.ReactNode
  onRowClick: (id: string, e: React.MouseEvent) => void
  onRowDoubleClick: (id: string) => void
  onCheckboxToggle: (id: string) => void
  onDeleteRow: (id: string) => void
}

function SheetRowBase({
  row, rowIdx, isSelected, isDeclined, isDuplicate, isFetching, readOnly,
  cols, renderCell, onRowClick, onRowDoubleClick, onCheckboxToggle, onDeleteRow,
}: SheetRowProps) {
  return (
    <tr className={`group cursor-pointer transition-colors ${
      isSelected
        ? "bg-blue-100 ring-1 ring-inset ring-blue-400 relative z-[1]"
        : `hover:bg-gray-50/60 ${isDeclined ? "bg-red-50/30" : ""} ${isDuplicate ? "bg-amber-50/50 opacity-60" : ""}`
    }`}
      onClick={e => onRowClick(row.id, e)} onDoubleClick={() => onRowDoubleClick(row.id)}>
      <td className="border border-gray-100 text-center bg-gray-50/40 select-none py-0.5">
        <div className="flex flex-col items-center justify-center gap-0.5">
          {isFetching ? <IconLoader2 size={12} className="text-green-600 animate-spin" />
            : !readOnly ? <input type="checkbox" checked={isSelected} onChange={() => onCheckboxToggle(row.id)} onClick={e => e.stopPropagation()} className="w-3 h-3 rounded accent-blue-600 cursor-pointer" />
            : null}
          <span className="text-[9px] text-gray-400 leading-none">{rowIdx + 1}</span>
        </div>
      </td>
      {cols.map((col, ci) => renderCell(row, rowIdx, col, ci))}
      {!readOnly && <td className="border border-gray-200 bg-gray-50/40" />}
      <td className="border border-gray-200 text-center bg-gray-50/40">
        {/* Delete only. The "view profile" eye that sat here was a second way in
            to the panel the handle cell's avatar already opens, so the row-end
            actions are just the destructive one now. Nothing else about opening
            the profile changed — setSidebarRowId is still reached from the
            avatar and from the phone row cards. */}
        <div className="flex items-center justify-center gap-0.5">
          {!readOnly && <button onClick={e => { e.stopPropagation(); onDeleteRow(row.id) }} title="Delete row"
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition"><IconTrash size={12} /></button>}
        </div>
      </td>
    </tr>
  )
}

const SheetRow = memo(SheetRowBase, (prev: SheetRowProps, next: SheetRowProps) =>
  // Row data by reference: every edit path produces a NEW row object, so a
  // changed cell always repaints its row and a stale snapshot is impossible.
  prev.row === next.row &&
  prev.rowIdx === next.rowIdx &&
  prev.isSelected === next.isSelected &&
  prev.isDeclined === next.isDeclined &&
  prev.isDuplicate === next.isDuplicate &&
  prev.isFetching === next.isFetching &&
  prev.readOnly === next.readOnly &&
  prev.cols === next.cols &&
  prev.cellsKey === next.cellsKey
  // renderCell and the handlers are excluded on purpose — see the note above.
)

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
   MAIN TABLE SHEET
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function TableSheet({
  initialRows = [], initialCustomColumns = [],
  onRowsChange, onDeleteRow, onFetchComplete, onRegisterIdSwap,
  onCustomColumnsChange, onImportRows, onBulkApprove, readOnly = false, brandId,
  subscriptionStatus, onShowTrialModal, canApproveInfluencers = true, onNotify, onLookupFailed,
  onCreateDraft, onSaveState, onEnrichmentStart, onEnrichmentFailed, onContactHoldChange,
}: {
  initialRows?: InfluencerRow[]
  initialCustomColumns?: CustomColumn[]
  onRowsChange?: (rows: InfluencerRow[]) => void
  onDeleteRow?: (rowId: string) => Promise<void>
  onFetchComplete?: (row: InfluencerRow) => void
  onRegisterIdSwap?: (fn: (tempId: string, realId: string) => void) => void
  /**
   * Persist a blank row as a draft and resolve with its real database id.
   *
   * Called once per added row, in parallel — each add is independent, so a
   * burst of them must not queue behind one another. The row is already on
   * screen with a temp id by the time this runs; the id is swapped in when it
   * resolves, and the row is simply left as-is if it fails.
   */
  onCreateDraft?: (rowId: string) => Promise<string | null>
  /**
   * Brackets a write this component performs itself, so the page's save
   * indicator covers it.
   *
   * The enrichment save goes out from here rather than through the page's PUT
   * queue, so without this the pill stayed silent for the one write the user is
   * most obviously waiting on. "start" then "ok"/"fail", matching the queue's
   * own reporting.
   */
  onSaveState?: (phase: "start" | "ok" | "fail", processing?: string) => void
  /**
   * Reports an enrichment save as it goes out, with whether the row was still a
   * draft at that moment — which is what makes it an ADD rather than an update.
   * The row is reconciled to `is_draft: false` before onFetchComplete runs, so
   * this is the last point at which that is knowable.
   */
  onEnrichmentStart?: (rowId: string, wasDraft: boolean) => void
  /**
   * The enrichment save failed. Reported so a caller that opened a status for
   * it (the add pill) can close it — onFetchComplete never runs on this path.
   */
  onEnrichmentFailed?: (rowId: string) => void
  /**
   * A row has started or finished waiting on a contact-duplicate decision.
   *
   * The page pauses that row's autosave while held, so a duplicated contact is
   * never written before the user has chosen. Nothing else about the row is
   * touched — the handle and every other field stay exactly as entered.
   */
  onContactHoldChange?: (rowId: string, held: boolean) => void
  onCustomColumnsChange?: (cols: CustomColumn[]) => void
  onImportRows?: (rows: InfluencerRow[]) => void
  /** Approves a whole selection in one request; resolves with what the DB stored. */
  onBulkApprove?: (influencerIds: string[]) => Promise<BulkApprovalResult | null>
  readOnly?: boolean
  brandId?: string
  subscriptionStatus?: { status: string; isExpired: boolean; subscription?: { plan?: { name?: string } } | null } | null
  onShowTrialModal?: () => void
  canApproveInfluencers?: boolean
  /**
   * Where this table's notifications should go.
   *
   * When the host page owns a notification design (the Influencer List's green
   * bottom-right toast), pass it here and every message routes there instead of
   * this component's own stacking top-right container — one design, and only
   * the latest message visible. Omitted, the local container is used exactly as
   * before, so any other host keeps its current behaviour.
   */
  onNotify?: (type: ToastNotification["type"], message: string) => void
  /**
   * A lookup for this row ended WITHOUT data — not found, an API error, or the
   * API not configured. The counterpart to onFetchComplete, which reports the
   * success case.
   *
   * The host page needs this because those two outcomes must save differently.
   * A successful lookup is written here, by saveRowToDatabase, with the profile
   * it just fetched. An unsuccessful one leaves a row the API cannot vouch for,
   * so it must NOT be written on its own — but the user is invited to fill it in
   * by hand (the "continue adding the influencer manually" modal), and that
   * hand-entered row does have to save. This is how the page learns the row has
   * become the user's to complete, without polling or a timer.
   */
  onLookupFailed?: (rowId: string) => void
}) {
  // Import/Export are a Solo & Team feature — Basic (the free plan) doesn't
  // include them, regardless of subscription status.
  const isOnBasicPlan = subscriptionStatus?.subscription?.plan?.name === "basic"

  const [rows, setRows] = useState<InfluencerRow[]>(initialRows)
  const [customCols, setCustomCols] = useState<CustomColumn[]>(initialCustomColumns)

  // Mirrors `rows` for callbacks that must read the current table synchronously
  // (autoFetchInfluencer's credit guards) without taking `rows` as a dependency.
  const rowsRef = useRef<InfluencerRow[]>(rows)
  rowsRef.current = rows

  // ── Auto-fetch input gating ─────────────────────────────────────────────────
  // A handle commit and a platform commit are two separate edits, so filling in
  // both fired two provider requests — two credits — for one intent. And the
  // only guard against re-requesting a handle was "does this row already have a
  // follower count", so a handle the provider had nothing for was re-requested
  // on every subsequent commit.
  //
  //   pendingFetchRef   — one debounce timer per row, so the handle edit and the
  //                       platform edit that follows it coalesce into one fetch
  //                       for the final pair.
  //   requestedPairsRef — every platform|handle already requested. A repeat
  //                       commit of the same pair is not a new question, so it
  //                       is not asked again. The Retry button clears its own
  //                       key, since that IS a deliberate re-ask.
  const pendingFetchRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const requestedPairsRef = useRef<Set<string>>(new Set())

  /** How long to wait after the last handle/platform edit before asking the
   *  provider. Long enough to absorb "type handle, then pick platform". */
  const AUTO_FETCH_DEBOUNCE_MS = 600

  const fetchPairKey = (handle: string, platform: string) =>
    `${platform}|${cleanHandle(handle).trim().toLowerCase()}`

  // Nothing should fire after the table unmounts.
  useEffect(() => () => {
    pendingFetchRef.current.forEach(timer => clearTimeout(timer))
    pendingFetchRef.current.clear()
  }, [])

  const swapIdRef = useRef<(tempId: string, realId: string) => void>(() => {})
  useEffect(() => {
    const swapFn = (tempId: string, realId: string) => {
      setRows(prev => prev.map(r => r.id === tempId ? { ...r, id: realId } : r))
      // The row now carries the real id, so the server's copy of it is the same
      // row and no longer needs suppressing.
      creatingDraftIds.current.delete(realId)
    }
    swapIdRef.current = swapFn
    onRegisterIdSwap?.(swapFn)
  }, [onRegisterIdSwap])

  /**
   * Real ids of drafts whose creating POST has landed but whose row on screen
   * may not have been swapped over yet.
   *
   * A background sync can fetch AFTER the draft was written and resolve BEFORE
   * the swap runs. Its payload then carries the real row while local state
   * still holds the temp one, and the merge below would show both for a frame.
   * Holding the id here lets the merge skip the server copy until the swap has
   * happened, so the row is one row throughout.
   */
  const creatingDraftIds = useRef<Set<string>>(new Set())

  /**
   * Rows the user has just deleted, until the server payload agrees they are
   * gone.
   *
   * The merge below re-adds any server row that local state does not have,
   * which is what rescues a freshly created row from a payload fetched before
   * it existed. It cannot tell that case apart from a row that is missing
   * locally because it was just DELETED — so a sync landing between the
   * confirmation and the DELETE resolving put the row straight back, and it
   * took a refresh to clear.
   *
   * Holding the id here makes the merge skip it. Released when the payload no
   * longer lists it (the delete is confirmed and the entry has caught up) or if
   * the delete fails, when the row is restored.
   */
  const deletedIds = useRef<Set<string>>(new Set())

  /** Latest `initialRows`, for reads outside the render that produced them. */
  const initialRowsRef = useRef<InfluencerRow[]>(initialRows)
  initialRowsRef.current = initialRows

  /**
   * Live mirrors of the state the ROW-level handlers read.
   *
   * Those handlers have to keep a stable identity or the memoized row below
   * re-renders on every parent render and the boundary buys nothing. Reading
   * through a ref keeps them stable AND current — a `useCallback` listing these
   * in its deps would get a new identity every time any of them changed, which
   * is the same problem.
   *
   * Assigned in an effect, not during render: writing a ref while rendering is a
   * render-phase side effect. Every consumer runs from an event handler, which
   * is always after the commit.
   */
  const editCellRef = useRef<CellAddress | null>(null)
  const popupCellRef = useRef<CellAddress | null>(null)
  const selectedRowIdRef = useRef<string | null>(null)
  const sidebarRowIdRef = useRef<string | null>(null)

  const lastInitialKey = useRef("")
  useEffect(() => {
    const key = initialRows.map(r => r.id).join(",")
    if (key === lastInitialKey.current) return
    lastInitialKey.current = key
    // MERGE, don't replace.
    //
    // `initialRows` is the shared cache entry — what the server last returned.
    // A blank row the user just added lives only here, in local state, because
    // nothing is written to the database until it has a handle and some
    // details. So a plain `setRows(initialRows)` threw those rows away.
    //
    // And this effect runs precisely when that is most likely: the id set only
    // changes when a row is created or removed server-side, which is exactly
    // what happens when the FIRST of several new rows gets filled in and saved.
    // Adding five rows and typing into one made the other four disappear the
    // moment the save's revalidation came back.
    //
    // Anything the server payload does not contain is therefore carried over,
    // in the order it was added. That covers the blank rows above and a row
    // whose create succeeded but has not yet appeared in a refetched payload.
    // A row genuinely removed here is dropped from local state by the delete
    // path itself, so it is not in `prev` to be carried over.
    // Merged IN PLACE, walking the rows already on screen first.
    //
    // Carrying the rescued rows by appending them put a draft added in the
    // middle of the sheet at the bottom the moment a sync landed, and back
    // where it belonged once the server payload finally included it — a row
    // jumping away and returning, which is the flicker this replaces.
    //
    // So local order and local identity lead: each row on screen keeps its
    // position and its id, taking the server's version of itself where the
    // server has one (that is how an enrichment or a persisted normalisation
    // arrives) and staying exactly as it is where the server does not — a
    // draft whose POST is still in flight, or one created after this payload
    // was fetched. Server rows nobody is showing yet are appended after, which
    // is how a row added in another tab arrives. Matching by id throughout, so
    // a row reconciled this way can never be duplicated.
    setRows(prev => {
      const serverById = new Map(initialRows.map(r => [r.id, r]))
      const seen = new Set<string>()
      const merged = prev.map(local => {
        seen.add(local.id)
        return serverById.get(local.id) ?? local
      })
      const added = initialRows.filter(r =>
        !seen.has(r.id) &&
        !creatingDraftIds.current.has(r.id) &&
        // Deleted by the user; do not resurrect it from a payload that predates
        // the delete.
        !deletedIds.current.has(r.id)
      )
      // A tombstone whose row is gone from the payload has done its job — the
      // server and the sheet agree, so stop tracking it.
      if (deletedIds.current.size) {
        const serverIds = new Set(initialRows.map(r => r.id))
        deletedIds.current.forEach(id => { if (!serverIds.has(id)) deletedIds.current.delete(id) })
      }
      return added.length ? [...merged, ...added] : merged
    })
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

  // `searchInput` updates immediately so the text box feels responsive;
  // `searchQuery` (used by the filteredRows memo) is debounced so typing
  // doesn't trigger a full re-filter+sort pass on every keystroke.
  const [searchInput, setSearchInput]         = useState("")
  const [searchQuery, setSearchQuery]         = useState("")
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 200)
    return () => clearTimeout(t)
  }, [searchInput])
  const [showFilterPopover, setShowFilterPopover] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    platform: "all", niche: "all", location: "all", gender: "all",
    approval: "all", dateFrom: "", dateTo: "", sortOrder: "newest",
  })

  const [showAddRowsModal, setShowAddRowsModal]   = useState(false)
  const [showDeclineModal, setShowDeclineModal]   = useState(false)
  const [pendingDeclineRowIdx, setPendingDeclineRowIdx] = useState<number | null>(null)
  const [showImportExportMenu, setShowImportExportMenu]           = useState(false)
  const [showSettingsMenu, setShowSettingsMenu]       = useState(false)
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
    /** The real failure, shown verbatim so a genuine API error isn't hidden. */
    reason?: string
  }>({ open: false })

  const [selectedRowId, setSelectedRowId]   = useState<string | null>(null)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [sidebarRowId, setSidebarRowId]     = useState<string | null>(null)

  // Mirrors for the stable row handlers — see the refs above.
  useEffect(() => { editCellRef.current = editCell }, [editCell])
  useEffect(() => { popupCellRef.current = popupCell }, [popupCell])
  useEffect(() => { selectedRowIdRef.current = selectedRowId }, [selectedRowId])
  useEffect(() => { sidebarRowIdRef.current = sidebarRowId }, [sidebarRowId])
  /** Live mirror of `filteredRows`, for the stable Shift-click range handler. */
  const filteredRowsRef = useRef<InfluencerRow[]>([])
  /**
   * Pending "open the profile" from a click on the handle name.
   *
   * Same 200ms split `handleRowClick` uses: a single click on the name opens
   * the profile panel, a double click on it edits the handle instead, and the
   * timer is what lets the second click cancel the first one's intent rather
   * than the panel flashing open and shut.
   */
  const nameClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (nameClickTimerRef.current) clearTimeout(nameClickTimerRef.current) }, [])

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
  const [pendingDuplicateInfo, setPendingDuplicateInfo] = useState<{
    rowId: string
    handle: string
    existingName: string
    /**
     * Which identity matched.
     *
     * "handle" is the real duplicate — the same handle+platform already in the
     * sheet. "contact" is a shared email on a DIFFERENT handle/platform, which
     * is legitimate (an agency address, one creator on two platforms) and must
     * be the user's call rather than an automatic block.
     */
    reason?: "handle" | "contact"
    /** The influencers whose contact info matched, for the contact case. */
    matches?: { handle: string; platform: string; name: string }[]
  } | null>(null)

  const [openRowMenuId, setOpenRowMenuId]                 = useState<string | null>(null)
  const [showBulkTransferConfirm, setShowBulkTransferConfirm] = useState(false)
  // Guards against a second submit while the bulk write is in flight.
  const [bulkApproving, setBulkApproving] = useState(false)

  const commitGuardRef     = useRef(false)
  const editInputRef       = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  const containerRef       = useRef<HTMLDivElement>(null)
  const tabPendingRef      = useRef(false)
  const filterBtnRef       = useRef<HTMLButtonElement>(null)
  const importExportBtnRef       = useRef<HTMLButtonElement>(null)
  const importExportRef      = useRef<HTMLDivElement>(null)
  const settingsBtnRef     = useRef<HTMLButtonElement>(null)
  const settingsMenuRef    = useRef<HTMLDivElement>(null)
  const fileInputRef       = useRef<HTMLInputElement>(null)

  const { toasts, addToast: addLocalToast, dismissToast } = useToast()

  // Single entry point for every message this table raises, so the ~15 existing
  // addToast call sites and their wording stay exactly as they are.
  const addToast = useCallback((type: ToastNotification["type"], message: string) => {
    if (onNotify) { onNotify(type, message); return }
    addLocalToast(type, message)
  }, [onNotify, addLocalToast])

  // Documented profile-lookup endpoints, defined once in constants.ts.
  const INSTROOM_API = INSTROOM_PROFILE_ENDPOINTS

  function parseFormattedNumber(val: string | number | undefined): string {
    if (!val || val === "Not Available") return ""
    const s = String(val).toLowerCase().trim()
    if (s.includes("m")) return String(Math.round(parseFloat(s) * 1_000_000))
    if (s.includes("k")) return String(Math.round(parseFloat(s) * 1_000))
    const n = parseFloat(s)
    return isNaN(n) ? "" : String(Math.round(n))
  }

  const fetchInfluencerFromAPI = useCallback(async (handle: string, platform: string): Promise<Partial<InfluencerRow> | null> => {
    // Leading '@' removed and the value reduced to the characters the API
    // accepts, so a pasted URL or stray character can't become a bogus path.
    const clean = normalizeApiUsername(handle)
    if (!isValidApiUsername(clean)) return null
    const endpointFn = INSTROOM_API[platform]
    if (!endpointFn) return null

    // Fail fast on missing configuration instead of firing a request that cannot
    // succeed. Without this, an unset INSTROOM_API_BASE_URL produced a request to
    // a non-resolvable host and a `TypeError: Failed to fetch` on every handle
    // edit. Reported through the same modal — Retry and manual-add both still
    // work — but it names configuration as the cause rather than implying a
    // network fault or a bad username.
    if (!isInstroomApiConfigured()) {
      console.error(
        "Influencer API is not configured: INSTROOM_API_BASE_URL is unset or blank, so no lookup " +
          "request was made. Set it in .env to the deployed API's public URL and restart the dev " +
          "server — it is inlined into the client bundle at build time via next.config.ts."
      )
      setApiErrorModal({
        open: true,
        platform,
        handle: clean,
        // A CONFIRMED service-side problem — no request could even be made — so
        // unlike a private or unavailable profile this one may say so. The env
        // var name stays in the console error above, not here: it is for
        // whoever deploys the app, not for the person adding an influencer.
        reason:
          "Profile lookup isn't available right now, so no data could be fetched. " +
          "You can still add this influencer manually.",
      })
      return null
    }

    const requestUrl = endpointFn(clean)
    try {
      const res = await fetch(requestUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      })

      // A non-2xx response used to `return null`, which the caller reports as
      // "<handle> not found on <platform>". That is only true for 404: a 400,
      // 429, 500 or 502 says nothing about whether the influencer exists, and
      // calling those "not found" told the user their valid username was wrong.
      if (!res.ok) {
        // The body is read BEFORE classifying: the API wraps upstream 403/404/429
        // in a 502 and names the real cause there, so the status alone cannot
        // tell "username doesn't exist" from "profile is private" from "the API
        // is down". Logged as a plain string so a handled failure isn't promoted
        // to an uncaught error by the dev overlay.
        const detail = await res.text().catch(() => "")
        const failure = describeLookupFailure(res.status, platform, detail)
        console.warn(
          `Influencer API ${res.status} ${res.statusText} for @${clean} on ${platform}` +
            ` (${requestUrl}): ${detail.slice(0, 300)}`
        )

        // Genuine not-found — either a direct 404 or an upstream 404 wrapped in a
        // 502 — keeps its existing behaviour: the caller shows the "not found"
        // toast, which is correct, and the auto-fetch flow continues normally.
        if (failure.notFound) return null

        // The classified cause and the technical detail go to the CONSOLE; the
        // modal gets the one neutral line. A private or restricted profile is an
        // ordinary fetch limitation, not an outage, so nothing here tells the
        // user an API is down — and no HTTP code or provider name is shown.
        console.warn(
          `Influencer lookup failed for @${clean} on ${platform} [cause=${failure.cause}]: ${failure.reason}`
        )
        setApiErrorModal({
          open: true,
          platform,
          handle: clean,
          reason: lookupFailureMessage(clean),
        })
        return null
      }

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
      // `TypeError: Failed to fetch`. The browser refuses to say which of DNS
      // failure, TLS failure, refused connection, timeout or a blocked
      // cross-origin response occurred, so the message names them rather than
      // implying the username is at fault. The request URL is logged because it
      // is the one piece that makes a host/base-URL mistake identifiable.
      //
      // Logged as a STRING, not as the Error object: this failure is handled (the
      // modal below owns it), but passing the raw Error to console.error makes
      // Next's dev overlay present a caught network error as an uncaught
      // "Console TypeError" with a stack into this function. The cause is still
      // reported in full — nothing is swallowed.
      const cause = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      console.error(
        `Influencer API request failed for @${clean} on ${platform} — ${requestUrl} — ${cause}. ` +
          `The request never completed, so the API was not reached (DNS, network, TLS or CORS).`
      )
      setApiErrorModal({
        open: true,
        platform,
        handle: clean,
        reason:
          `The request to ${INSTROOM_API_BASE_URL} never completed, so the API was not reached ` +
          `(DNS, network, TLS or CORS). This is not a problem with the username.`,
      })
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
  // Memoized: the memo boundary below compares `cols` by reference, and a fresh
  // `.map()` on every render would make that comparison always false — the row
  // would repaint on every keystroke and the boundary would buy nothing.
  // Recomputed only when the columns or their order actually change.
  const allCols = useMemo(
    () => order.map(i => rawCols[i]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colOrder, customCols, nicheOptions, locationOptions]
  )
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

  useEffect(() => {
    if (!showSettingsMenu) return
    const h = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node) &&
          settingsBtnRef.current && !settingsBtnRef.current.contains(e.target as Node))
        setShowSettingsMenu(false)
    }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [showSettingsMenu])

  useEffect(() => {
    if (!openRowMenuId) return
    const h = () => setOpenRowMenuId(null)
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [openRowMenuId])

  // Memoized so this O(n log n) filter+sort pass only recomputes when rows,
  // the (debounced) search query, filters, or sort order actually change —
  // not on every unrelated re-render (active cell, editing, popups, etc).
  const filteredRows = useMemo(() => {
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
    return sortRows(filtered, filters.sortOrder)
  }, [rows, searchQuery, filters])

  // Keeps the mirror the stable selection handler reads in step. An effect, not
  // an assignment during render — see the mirrors above.
  useEffect(() => { filteredRowsRef.current = filteredRows }, [filteredRows])

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

  // Row click is delayed briefly so a double-click can cancel it — otherwise
  // the first click of a double-click would collapse an existing multi-select
  // before onDoubleClick even fires, destroying the selection just to view a
  // profile. Modifier-key clicks (ctrl/shift multi-select) run immediately —
  // those are deliberate gestures, never the start of a double-click.
  const rowClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current) }, [])

  /**
   * Set synchronously by `startEdit`, read by `handleRowClick` in the same click.
   *
   * A single click on a cell both starts an edit AND bubbles to the row, which
   * is what checked the row every time someone began typing. Reading `editCell`
   * in the row handler cannot catch it: `startEdit` has only QUEUED that state,
   * so the handler still sees null on this click. A ref updates immediately, so
   * the row handler can tell "this click was meant for a cell" from "this click
   * was meant for the row".
   */
  const editIntentRef = useRef(false)

  // Stable so the memoized row is not invalidated on every parent render. The
  // state it needs is read through the live mirrors above, so it cannot go
  // stale — the logic is byte-for-byte what it was.
  const handleRowClick = useCallback((id: string, e: React.MouseEvent) => {
    // This click opened a cell editor (or a cell popup). Selecting the row was
    // not what the user asked for.
    if (editIntentRef.current) { editIntentRef.current = false; return }
    // An editor is already open — a click anywhere in the row while typing must
    // not change what is selected.
    if (editCellRef.current || popupCellRef.current) return
    // Or the click came from a control inside a cell: the editor's own input,
    // Save, Cancel. Same test the table wrapper's onMouseDown already uses.
    if ((e.target as HTMLElement).closest("input, select, textarea, button, [tabindex]")) return

    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      handleRowSelect(id, e)
      return
    }
    if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current)
    rowClickTimerRef.current = setTimeout(() => { handleRowSelect(id, e); rowClickTimerRef.current = null }, 200)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRowDoubleClick = (id: string) => {
    // Always cancel the pending single-click selection, even when the profile is
    // not going to open — otherwise a double-click that lands on a cell still
    // selects the row 200ms later.
    if (rowClickTimerRef.current) { clearTimeout(rowClickTimerRef.current); rowClickTimerRef.current = null }
    // A double-click that opened an editor is an edit, not a request to open the
    // profile panel.
    if (editIntentRef.current || editCell || popupCell) { editIntentRef.current = false; return }
    // A row with no handle yet is a blank row the user has just added. There is
    // no influencer to show, so the panel stays shut and the row is theirs to
    // fill in — the same rule the handle cell's name applies.
    if (!cleanHandle(rowsRef.current.find(r => r.id === id)?.handle ?? "")) return
    setSidebarRowId(id)
  }

  // Stable, so the memoized row keeps its identity. `selectedRowId` and
  // `filteredRows` are read through their live mirrors rather than captured, so
  // Ctrl-click toggling and Shift-click range selection behave exactly as before.
  const handleRowSelect = useCallback((id: string, e?: React.MouseEvent) => {
    const currentSelectedId = selectedRowIdRef.current
    // Falls back to the unfiltered mirror on the very first interaction, before
    // the effect that fills the filtered one has run, so a range select always
    // has rows to work with.
    const currentFiltered = filteredRowsRef.current.length ? filteredRowsRef.current : rowsRef.current
    if (e?.ctrlKey || e?.metaKey) {
      setSelectedRowIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
      setSelectedRowId(id)
    } else if (e?.shiftKey && currentSelectedId) {
      const ci = currentFiltered.findIndex(r => r.id === currentSelectedId)
      const ti = currentFiltered.findIndex(r => r.id === id)
      if (ci !== -1 && ti !== -1) {
        const s = Math.min(ci, ti); const e2 = Math.max(ci, ti)
        setSelectedRowIds(new Set(currentFiltered.slice(s, e2 + 1).map(r => r.id)))
      }
      setSelectedRowId(id)
    } else { setSelectedRowId(id); setSelectedRowIds(new Set([id])) }
  }, [])

  // Checkbox click always toggles that row into/out of the current selection —
  // no modifier key needed, since ticking a checkbox is already an explicit
  // multi-select gesture (unlike clicking the row itself, which selects only it).
  // Stable: setters only. Behaviour unchanged.
  const handleCheckboxToggle = useCallback((id: string) => {
    setSelectedRowIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setSelectedRowId(id)
  }, [])

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
    setFilters({ platform: "all", niche: "all", location: "all", gender: "all", approval: "all", dateFrom: "", dateTo: "", sortOrder: "newest" })
    setCurrentPage(1)
  }

  // One request for the whole selection, applied by the DB in a transaction, and
  // the rows are then set from what the DB returned — not from what we guessed.
  // Deliberately does NOT route through onRowsChange: that path debounces one
  // PUT per row, which is what made a large selection slow and lossy.
  const handleBulkTransferToOutreach = async () => {
    if (!selectedRowIds.size || bulkApproving) return
    // Drafts are excluded here, not just server-side. A draft is a blank row
    // with no influencer to approve, and the bulk route rightly refuses it —
    // but sending it meant the route returned it under `failed`, so a selection
    // containing drafts always reported a partial failure and re-selected them,
    // which read as "only some rows were approved".
    const ids = rows
      .filter(r => selectedRowIds.has(r.id) && !r.id.startsWith("temp-") && !r.is_draft)
      .map(r => r.id)
    if (!ids.length) { setShowBulkTransferConfirm(false); return }

    setBulkApproving(true)
    try {
      const result = await onBulkApprove?.(ids)
      if (!result) {
        addToast("error", "Could not transfer to outreach — please try again")
        return
      }
      const byId = new Map(result.updated.map(u => [u.influencer_id, u]))
      setRows(prev => prev.map(row => {
        const saved = byId.get(row.id)
        if (!saved) return row
        return {
          ...row,
          approval_status: (saved.approval_status ?? "Pending") as "Approved" | "Declined" | "Pending",
          transferred_date: saved.transferred_date
            ? new Date(saved.transferred_date).toISOString().split("T")[0]
            : "",
          contact_status: saved.contact_status ?? row.contact_status,
        }
      }))
      setShowBulkTransferConfirm(false)
      if (result.failed.length) {
        addToast("error", `${result.updated.length} moved to Approved, ${result.failed.length} failed — try refreshing`)
        setSelectedRowIds(new Set(result.failed))
      } else {
        addToast("success", `${result.updated.length} influencer${result.updated.length !== 1 ? "s" : ""} moved to Approved`)
        setSelectedRowIds(new Set())
      }
    } finally {
      setBulkApproving(false)
    }
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
          // 403 is the plan limit — the route writes that line for users, so it
          // is shown as-is; anything unexpected falls back to a safe default
          // rather than whatever string happened to be in the body.
          if (res.status === 403) {
            const limitMsg = typeof err.message === "string" ? err.message : ""
            addToast("error", limitMsg || "Influencer limit reached for your plan")
            return
          }
          // The technical detail goes to the console, never to the toast:
          // `res.statusText` is raw HTTP ("Internal Server Error") and
          // `err.error` can carry driver text. The user gets something they can
          // act on instead. The row and everything typed into it are untouched,
          // so a retry is just another edit.
          console.error(`POST /api/influencers/create failed for @${row.handle}:`, res.status, err)
          addToast("error", `Couldn't add @${row.handle}. Please check the handle and try again.`)
          return
        }
        const created = await res.json()
        swapIdRef.current(row.id, created.id)
        onFetchComplete?.({ ...row, id: created.id })
      } catch (err) {
        console.error("saveRowToDatabase POST error:", err)
        addToast("error", `Network error saving @${row.handle}`)
      }
    } else if (row.is_draft && brandId) {
      onEnrichmentStart?.(row.id, true)
      onSaveState?.("start", "Updating profile…")
      // A draft that the lookup has just enriched. It is already a database
      // row, so this PROMOTES it in place — same id, same position, everything
      // already typed into it kept — instead of creating a second row. The
      // brand-scoped route is the one that accepts handle/platform for a draft
      // and flips is_draft; /api/influencers/[id] does not.
      try {
        const res = await fetch(`/api/brand/${brandId}/influencers/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          onSaveState?.("fail")
          onEnrichmentFailed?.(row.id)
          if (res.status === 409) {
            // A real duplicate WITHIN this brand — the only 409 the route sends
            // now. A global match is no longer an error: it comes back OK as
            // LINKED_EXISTING and is handled below. The typed handle is left on
            // screen so the user can correct it; nothing is nulled.
            addToast("error", err.error || `@${row.handle} is already in this list`)
            return
          }
          console.error(`PUT draft-promote failed for @${row.handle}:`, res.status, err)
          addToast("error", `Couldn't save @${row.handle}. Your changes are still here — please try again.`)
          return
        }
        // Reconcile from what the DATABASE stored.
        //
        // The route mirrors an expiring Instagram/TikTok avatar into Cloudinary
        // and returns the permanent URL; the row still held the CDN one. Left
        // alone, the sheet kept showing a URL that expires — and, because the
        // row also still said `is_draft: true`, the next save re-sent that same
        // CDN URL instead of the stored one. That is why the avatar came back
        // blank after a refresh.
        const saved = (await res.json().catch(() => ({}))) as {
          profile_image_url?: string | null
          handle?: string | null
          code?: string
          id?: string
        }

        // The influencer already existed globally and has been LINKED to this
        // brand, with this draft's membership moved onto it. The row now IS that
        // record, so it takes its id and re-enters the normal flow — which
        // fetches and populates the reused influencer's stored data. No
        // duplicate global record, no error, and the handle is untouched.
        if (saved.code === "LINKED_EXISTING" && saved.id) {
          swapIdRef.current(row.id, saved.id)
          onSaveState?.("ok")
          onFetchComplete?.({ ...row, id: saved.id, is_draft: false })
          return
        }
        setRows(prev => prev.map(r => r.id === row.id ? {
          ...r,
          // No longer a draft — it has a handle and a platform now, so later
          // saves take the ordinary update path.
          is_draft: false,
          ...(saved.profile_image_url !== undefined
            ? { profile_image_url: saved.profile_image_url ?? "" }
            : {}),
        } : r))
        // Reported OK BEFORE onFetchComplete, so the pill closes and the page's
        // single "details updated" notice is the last thing the user sees.
        onSaveState?.("ok")
        onFetchComplete?.({
          ...row,
          is_draft: false,
          ...(saved.profile_image_url !== undefined
            ? { profile_image_url: saved.profile_image_url ?? "" }
            : {}),
        })
      } catch (err) {
        onSaveState?.("fail")
        onEnrichmentFailed?.(row.id)
        console.error("saveRowToDatabase draft-promote error:", err)
        addToast("error", `Network error saving @${row.handle}`)
      }
    } else {
      const { handle, platform, brandId: _b, ...updatePayload } = payload as any
      onSaveState?.("start", "Updating profile…")
      try {
        const res = await fetch(`/api/influencers/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        })
        if (!res.ok) {
          onSaveState?.("fail")
          const err = await res.json().catch(() => ({}))
          console.error(`PUT /api/influencers/${row.id} failed:`, err)
          // This page passes no onSaveState, so without a toast the failed save
          // was invisible: the fetched profile sat on screen looking saved.
          // 503 is the pool being momentarily empty — nothing typed was lost.
          addToast(
            "error",
            res.status === 503
              ? "The server is busy right now. Your changes are safe. Please wait a moment and try again."
              : `Couldn't save @${row.handle}. Please try again.`
          )
        } else {
          onSaveState?.("ok")
          onFetchComplete?.(row)
        }
      } catch (err) {
        onSaveState?.("fail")
        console.error("saveRowToDatabase PUT error:", err)
      }
    }
  }, [brandId, addToast, onFetchComplete, onSaveState, onEnrichmentStart, onEnrichmentFailed])

  /**
   * Does this contact detail already belong to another row? If so, ask.
   *
   * Deliberately INDEPENDENT of the handle/platform identity check:
   *
   *   * it runs even when handle+platform is unique, because that is exactly
   *     the interesting case — a different account sharing an address;
   *   * a match never blocks the add. Multiple handles legitimately share one
   *     inbox (an agency, a manager, one creator on two platforms), so a shared
   *     address is not evidence that two accounts are the same person;
   *   * the address is never folded into the identity query. Identity is
   *     handle+platform and nothing else.
   *
   * Returns true when a modal was raised, so the caller knows the user has been
   * asked. Nothing is written or cleared here either way — the row keeps its
   * handle and everything typed into it.
   */
  /**
   * Rows waiting on a contact-duplicate decision.
   *
   * A ref, not state, because the page's autosave reads it synchronously the
   * moment a row changes — a state read would be a render behind and the save
   * would already have gone out. `onContactHoldChange` mirrors it to the page.
   *
   * While a row is in here its contact is NOT persisted: the save is paused, not
   * cancelled, so everything already typed stays on screen and the row resumes
   * saving as soon as the user chooses.
   */
  const contactHoldRef = useRef<Set<string>>(new Set())

  const setContactHold = useCallback((rowId: string, held: boolean) => {
    if (held) contactHoldRef.current.add(rowId)
    else contactHoldRef.current.delete(rowId)
    onContactHoldChange?.(rowId, held)
  }, [onContactHoldChange])

  const checkContactDuplicate = useCallback((rowId: string, contact: string): boolean => {
    const incoming = normalizeEmail(contact) || normalizeContactInfo(contact)
    if (!incoming) return false
    // A DM / social handle is not an identity, so it is never a duplicate.
    //
    // `contact_info` is fed by the importer's "email address/handlename"
    // column, so a messaging handle lands in it routinely — and one brand inbox
    // messages many creators, a manager runs several accounts, and the same
    // handle can belong to different people on different platforms. Flagging
    // those interrupted the user for something that was never a conflict.
    // Email and phone still identify one person and are still checked.
    if (!isUniqueContact(incoming)) return false
    // Already waiting on a decision for this row — one modal, not one per
    // keystroke. Rapid typing therefore cannot stack modals or slip a save past
    // the one already open.
    if (contactHoldRef.current.has(rowId)) return true
    // Compared on the match KEY, not the display string: a phone number is the
    // same line however it is punctuated, so "+63 917 123 4567" and
    // "+639171234567" have to land on the same key. Emails still compare as
    // their lowercase selves.
    const needle = contactMatchKey(incoming)
    if (!needle) return false

    // Both sides are filtered: a stored DM handle is not a duplicate of anything
    // either, so it can never be the row a modal points at. `contactMatchKey`
    // returns "" for those, and "" never matches a non-empty needle.
    const matches = rowsRef.current.filter(r =>
      r.id !== rowId &&
      (contactMatchKey(r.email) === needle ||
       contactMatchKey(r.contact_info) === needle)
    )
    if (!matches.length) return false

    const row = rowsRef.current.find(r => r.id === rowId)
    // Held BEFORE the modal opens, so the save that would otherwise be armed by
    // this very edit is paused rather than racing the user's decision.
    setContactHold(rowId, true)
    setPendingDuplicateInfo({
      rowId,
      handle: cleanHandle(row?.handle ?? ""),
      existingName: matches[0].full_name || cleanHandle(matches[0].handle),
      reason: "contact",
      matches: matches.map(r => ({
        handle: cleanHandle(r.handle),
        platform: r.platform,
        name: r.full_name || cleanHandle(r.handle),
      })),
    })
    return true
  }, [setContactHold])

  /**
   * Clear a row's fetching spinner.
   *
   * scheduleAutoFetch turns the spinner on when a row is QUEUED, so the three
   * guards below — already requested, already enriched, duplicate — must turn it
   * off again: they return before the try/finally that normally clears it, and a
   * queued row would otherwise spin forever.
   */
  const clearFetching = useCallback((rowId: string) => {
    setFetchingRows(prev => { if (!prev.has(rowId)) return prev; const n = new Set(prev); n.delete(rowId); return n })
  }, [])

  const autoFetchInfluencer = useCallback(async (rowId: string, handle: string, platform: string) => {
    const clean = handle.trim().replace(/^@/, "").toLowerCase()
    if (!clean || clean.length < 2) return
    if (platform !== "instagram" && platform !== "tiktok") return

    // This exact pair is asked at most once. Marked as requested at the actual
    // call site below, not here: the duplicate and already-enriched branches in
    // between never reach the provider, and marking them would stop the
    // duplicate warning from reappearing on a later commit — which it did
    // before this change.
    const pairKey = `${platform}|${clean}`
    if (requestedPairsRef.current.has(pairKey)) { clearFetching(rowId); return }

    // ── Credit guards ────────────────────────────────────────────────────────
    // These two checks used to live inside a setRows updater, which React runs
    // during the next render — long after the lines below had already fired the
    // request. So `return prev` only skipped the state update, never the fetch:
    // rows that arrived with full details (a CSV import, or an influencer added
    // from Discovery) were re-fetched from the provider and spent a credit each
    // time, and so were rows flagged as duplicates. Reading the mirrored rows
    // lets the function actually return before spending anything.
    const currentRows = rowsRef.current
    const existingRow = currentRows.find(r => r.id === rowId)

    // Already-known details are treated as fetched: imported and
    // already-enriched rows stay editable and approvable, they are just not
    // re-requested. A row genuinely missing its numbers still fetches.
    if (existingRow && Number(existingRow.follower_count) > 0) { clearFetching(rowId); return }

    const duplicate = currentRows.find(r =>
      r.id !== rowId && cleanHandle(r.handle).toLowerCase() === clean && r.platform === platform
    )
    if (duplicate) {
      setPendingDuplicateInfo({ rowId, handle: clean, existingName: duplicate.full_name || duplicate.handle })
      setDuplicateRowIds(p => { const n = new Set(p); n.add(rowId); return n })
      clearFetching(rowId)
      return
    }
    setDuplicateRowIds(p => { if (!p.has(rowId)) return p; const n = new Set(p); n.delete(rowId); return n })

    setFetchingRows(prev => { const n = new Set(prev); n.add(rowId); return n })

    try {
      // Recorded immediately before the request, so a pair the provider had
      // nothing for is not asked again either — that was a credit per commit.
      requestedPairsRef.current.add(pairKey)
      const data = await fetchInfluencerFromAPI(handle, platform)
      // Nothing came back: not found, an API error, or no API host configured
      // (fetchInfluencerFromAPI has already raised the modal or the toast for
      // each). Hand the row to the page as manually-completable — see
      // onLookupFailed. Nothing is saved by this; the row is written only once
      // the user actually edits it.
      if (!data) {
        addToast("error", `${clean} not found on ${platform}`)
        onLookupFailed?.(rowId)
        return
      }
      // ── Merge OUTSIDE the state updater ──────────────────────────────────
      // All of this used to run inside `setRows(prev => …)`, which React
      // invokes while rendering. Three things there were state updates
      // belonging to other components — the duplicate-email `addToast`, the
      // `onRowsChange` handed to the parent page, and the `enrichedRow`
      // assignment feeding the save — so React raised "Cannot update a
      // component while rendering a different component", and in Strict Mode
      // the updater could run twice and toast twice.
      //
      // The rows mirror is already the established way round this here (see the
      // credit guards above): this is an async callback, not render, so it can
      // read the current rows, build the next ones, and then do each of those
      // three things as an ordinary post-render call.
      const prev = rowsRef.current
      const incomingEmail = normalizeEmail(data.email)
      const incomingContact = normalizeContactInfo(data.contact_info)

      // The contact check is a SEPARATE concern, run through the shared
      // `checkContactDuplicate` below so a fetched address and a typed one are
      // judged the same way. It is raised after the merge has been applied, so
      // the modal describes the row as it now stands.

      const next = prev.map(row => {
        if (row.id !== rowId) return row
        const u = { ...row }
        if (!u.full_name && data.full_name)         u.full_name = data.full_name
        // A real address already on the row is never replaced, and the
        // provider's stand-in is never written: `incomingEmail` is empty
        // unless there is something usable to store.
        if (!isUsableEmail(u.email) && incomingEmail)             u.email = incomingEmail
        if (!normalizeContactInfo(u.contact_info) && incomingContact) u.contact_info = incomingContact
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

      setRows(next)
      // `onRowsChange` is deliberately NOT called with the enriched row.
      //
      // It arms the page's typed-field autosave, and the enrichment already
      // saves this row itself on the next line — so one lookup produced two
      // writes of the same payload, and the indicator ran
      // "Saving changes… → Details updated → Saving changes…". The enrichment
      // owns its save; the page is told once, by onFetchComplete, when that
      // save has actually landed.
      //
      // Local state is still updated above, so the row shows its fetched
      // details immediately — nothing waits on the write.
      // Asked, never decided — see checkContactDuplicate. Returns true when a
      // modal was raised, which HOLDS this row.
      const heldForContact = checkContactDuplicate(rowId, incomingEmail || incomingContact)

      const enrichedRow = next.find(r => r.id === rowId) ?? null
      // The write is skipped while the row is held: a FETCHED duplicate contact
      // must wait for the same decision a typed one does, or the enrichment
      // would persist it before the user ever saw the modal. The fetched values
      // are already on screen (setRows above), and the save resumes when the
      // user chooses — the modal's own handler re-emits the row.
      //
      // No timer otherwise: the fetch has resolved, so this is the moment to
      // write. The setTimeout(…, 0) it replaces existed only to escape the state
      // updater this code no longer runs inside.
      if (enrichedRow && !heldForContact) void saveRowToDatabase(enrichedRow)
    } catch (err) { console.error("Auto-fetch failed:", err) }
    finally { setFetchingRows(prev => { const n = new Set(prev); n.delete(rowId); return n }) }
    // onRowsChange is intentionally absent: the enriched row is no longer
    // handed to it — see the note above the save.
  }, [addToast, saveRowToDatabase, fetchInfluencerFromAPI, onLookupFailed, checkContactDuplicate, clearFetching])

  const addRow = () => {
    const r = newEmptyRow(customCols)
    // Rendered immediately with its temp id — nothing waits on the network.
    setRows(prev => { const n = [...prev, r]; onRowsChange?.(n); return n })
    setCurrentPage(filters.sortOrder === "newest" ? 1 : Math.ceil((rows.length + 1) / rowsPerPage))
    setActiveCell({ rowIdx: 0, colIdx: 0 }); containerRef.current?.focus()
    // …and persisted as a draft in the background, so it is still here after a
    // refresh. Fire-and-forget on purpose: the swap happens when it lands, and
    // a failure leaves the row exactly where it is rather than removing it.
    void onCreateDraft?.(r.id).then(realId => {
      // Registered the instant the write is confirmed, so a sync already in
      // flight cannot briefly render the server's copy next to this row.
      if (realId) creatingDraftIds.current.add(realId)
    })
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
    // One draft per row, all started together — rapid additions must not
    // serialise behind each other. Each resolves into its own row by id.
    nr.forEach(r => {
      void onCreateDraft?.(r.id).then(realId => {
        if (realId) creatingDraftIds.current.add(realId)
      })
    })
  }

  /**
   * Did the delete stick?
   *
   * The page restores a failed delete by putting the row back into the shared
   * cache entry, so the row reappearing in `initialRows` is exactly the signal
   * that the delete did NOT succeed and the tombstone must be lifted.
   */
  const deletedRowStillGone = (id: string) => !initialRowsRef.current.some(r => r.id === id)

  /**
   * Let go of everything the duplicate-contact modal is holding for a row that
   * is going away.
   *
   * The hold is what blocks the row from saving while the user decides, so it
   * has to be released here: if the delete later FAILS and the page restores the
   * row under the same id, a hold left behind would block that row's saves for
   * good, with no modal left on screen to explain why. The modal state is
   * cleared for the same reason it points at a row that no longer exists.
   */
  const releaseContactHold = (matches: (rowId: string) => boolean) => {
    // Snapshot first: setContactHold mutates the ref, and the updater below must
    // stay a pure function of prev — React may run it more than once.
    Array.from(contactHoldRef.current).forEach(rowId => {
      if (matches(rowId)) setContactHold(rowId, false)
    })
    setPendingDuplicateInfo(prev => (prev && matches(prev.rowId) ? null : prev))
  }

  const deleteRow = (id: string) => {
    const r = rows.find(x => x.id === id)
    setConfirmDialog({
      isOpen: true, title: "Delete Row",
      message: <span>Delete <strong>{r?.full_name || r?.handle || "this row"}</strong>?</span>,
      onConfirm: () => {
        deletedIds.current.add(id)
        setRows(prev => { const n = prev.filter(x => x.id !== id); onRowsChange?.(n); return n })
        if (selectedRowId === id) setSelectedRowId(null)
        if (sidebarRowId === id) setSidebarRowId(null)
        setSelectedRowIds(prev => { const n = new Set(prev); n.delete(id); return n })
        releaseContactHold(rowId => rowId === id)
        // The page restores the row itself on failure; lifting the tombstone
        // here is what lets the merge show it again.
        void Promise.resolve(onDeleteRow?.(id)).catch(() => {}).finally(() => {
          if (!deletedRowStillGone(id)) deletedIds.current.delete(id)
        })
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
        idsToDelete.forEach(id => deletedIds.current.add(id))
        setRows(prev => { const n = prev.filter(r => !idsToDelete.has(r.id)); onRowsChange?.(n); return n })
        setSelectedRowId(null); setSelectedRowIds(new Set())
        if (sidebarRowId && idsToDelete.has(sidebarRowId)) setSidebarRowId(null)
        releaseContactHold(rowId => idsToDelete.has(rowId))
        idsToDelete.forEach(id => {
          void Promise.resolve(onDeleteRow?.(id)).catch(() => {}).finally(() => {
            if (!deletedRowStillGone(id)) deletedIds.current.delete(id)
          })
        })
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

  /**
   * Queue an auto-fetch for a row once its handle/platform edits settle.
   *
   * Editing the handle and then the platform are two commits; without this each
   * one fired its own request. The timer is per row and is reset by the later
   * edit, so the provider is asked once, for the pair the user actually ended
   * up with. A pair already requested is dropped here as well, so the timer is
   * not even armed for a repeat.
   */
  /**
   * Enrichment lookups in flight, and the rows waiting for a slot.
   *
   * Adding or pasting several handles armed one timer per row at the same
   * delay, so every lookup fired at once — a burst straight at the provider,
   * and then a burst of creates behind it. The provider answers a burst with
   * 502s that wrap its own rate limiting, which read as "not found" and left
   * good rows looking unresolvable.
   *
   * Two at a time, matching the limit the Pipeline and Post Tracker bulk moves
   * already use. Not a delay: a slot is taken the moment one frees, so a single
   * add is exactly as fast as before and a burst is merely ordered.
   */
  const fetchSlotsInUse = useRef(0)
  const fetchQueue = useRef<Array<() => void>>([])
  const MAX_CONCURRENT_FETCHES = 2

  const runQueuedFetch = useCallback(() => {
    while (fetchSlotsInUse.current < MAX_CONCURRENT_FETCHES && fetchQueue.current.length > 0) {
      const next = fetchQueue.current.shift()!
      fetchSlotsInUse.current += 1
      next()
    }
  }, [])

  /** Release a slot and start whatever is waiting. */
  const releaseFetchSlot = useCallback(() => {
    fetchSlotsInUse.current = Math.max(0, fetchSlotsInUse.current - 1)
    runQueuedFetch()
  }, [runQueuedFetch])

  const scheduleAutoFetch = useCallback((rowId: string, handle: string, platform: string) => {
    // Both halves must be present and the handle usable before anything is
    // scheduled — this is what keeps a half-filled row from asking.
    const clean = cleanHandle(handle).trim().toLowerCase()
    if (!clean || clean.length < 2) return
    if (platform !== "instagram" && platform !== "tiktok") return
    if (requestedPairsRef.current.has(fetchPairKey(handle, platform))) return

    const existing = pendingFetchRef.current.get(rowId)
    if (existing) clearTimeout(existing)

    pendingFetchRef.current.set(rowId, setTimeout(() => {
      pendingFetchRef.current.delete(rowId)
      // Re-read the row at fire time rather than trusting the values captured
      // when the timer was armed: the user may have corrected either field
      // during the wait, and the stale pair would spend a credit on a handle
      // that is no longer in the cell.
      const row = rowsRef.current.find(r => r.id === rowId)
      if (!row) return
      const latestHandle = cleanHandle(row.handle)
      const latestPlatform = row.platform
      if (!latestHandle || latestHandle.trim().length < 2) return
      if (latestPlatform !== "instagram" && latestPlatform !== "tiktok") return
      // The row shows its spinner as soon as it is QUEUED, not when its slot
      // frees. Lookups run two at a time, so with several rapid additions rows
      // 3+ sat with no indicator at all while they waited — they looked idle
      // when they were in fact pending. Set here, and cleared by
      // autoFetchInfluencer's own `finally`, which every path reaches.
      setFetchingRows(prev => prev.has(rowId) ? prev : new Set(prev).add(rowId))

      // Through the gate: runs now if a slot is free, otherwise waits for one.
      // The slot is released in autoFetchInfluencer's `finally`, so a lookup
      // that fails or throws frees it exactly like one that succeeds — a single
      // bad handle can never stall the rows behind it.
      fetchQueue.current.push(() => {
        void autoFetchInfluencer(rowId, latestHandle, latestPlatform).finally(releaseFetchSlot)
      })
      runQueuedFetch()
    }, AUTO_FETCH_DEBOUNCE_MS))
  }, [autoFetchInfluencer, runQueuedFetch, releaseFetchSlot])

  const applyCellValue = useCallback((rowIdx: number, colKey: string, value: string) => {
    const actualRow = filteredRows[rowIdx]; const actualRowIdx = rows.findIndex(r => r.id === actualRow.id); if (actualRowIdx === -1) return
    if (colKey === "approval_status" && !canApproveInfluencers) return
    if (actualRow.approval_status === "Declined" && isOutreachField(colKey)) return
    if (colKey === "approval_status" && value === "Declined") { setPendingDeclineRowIdx(rowIdx); setShowDeclineModal(true); return }
    const currentRow = rows[actualRowIdx]
    let shouldFetch = false, fetchRowId = currentRow.id, fetchHandle = "", fetchPlatform = ""
    let cleanedValue = value
    if (colKey === "handle") cleanedValue = cleanHandle(value)
    if (colKey === "handle" && cleanedValue && cleanedValue.length >= 2) { shouldFetch = true; fetchHandle = cleanedValue; fetchPlatform = currentRow.platform }
    if (colKey === "platform" && currentRow.handle && cleanHandle(currentRow.handle).length >= 2) { shouldFetch = true; fetchHandle = currentRow.handle; fetchPlatform = value }
    // Auto-add a newly typed niche/location — kept OUTSIDE the setRows updater below,
    // since React can invoke a state updater more than once (e.g. Strict Mode in dev),
    // which was firing this POST twice for the same value and tripping the DB unique constraint.
    if (colKey === "niche" && cleanedValue && !nicheOptions.includes(cleanedValue)) { setNicheOptions(p => [...p, cleanedValue]); dbAddNiche(cleanedValue) }
    if (colKey === "location" && cleanedValue && !locationOptions.includes(cleanedValue)) { setLocationOptions(p => [...p, cleanedValue]); dbAddLocation(cleanedValue) }
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
      next[actualRowIdx] = row; onRowsChange?.(next); return next
    })
    if (shouldFetch) scheduleAutoFetch(fetchRowId, fetchHandle, fetchPlatform)

    // A contact detail typed by hand gets the same independent check a fetched
    // one does. Previously this lived only inside the enrichment, so it ran only
    // when an Instagram/TikTok lookup SUCCEEDED — a manually entered email, or
    // any address on a YouTube/X row, was never checked at all.
    //
    // Deferred a tick so it reads the row as just updated rather than the one
    // captured before this edit, and so it cannot set state inside the updater
    // above.
    if (colKey === "email" || colKey === "contact_info") {
      const typed = cleanedValue
      if (typed) setTimeout(() => checkContactDuplicate(currentRow.id, typed), 0)
    }
  }, [onRowsChange, customCols, filteredRows, rows, isOutreachField, nicheOptions, locationOptions, scheduleAutoFetch, canApproveInfluencers, checkContactDuplicate])

  const addOptionToCol = useCallback((fk: string, no: string) => {
    setCustomCols(prev => { const n = prev.map(c => c.field_key !== fk ? c : { ...c, field_options: [...(c.field_options ?? []), no] }); onCustomColumnsChange?.(n); return n })
  }, [onCustomColumnsChange])

  const startEdit = useCallback((ri: number, ci: number) => {
    if (readOnly) return
    const col = allCols[ci]; const row = filteredRows[ri]
    if (col.key === "approval_status" && !canApproveInfluencers) return
    if (row.approval_status === "Declined" && isOutreachField(col.key)) return
    // Past every refusal, so this click IS an edit. Flagged before any branch
    // below returns, and consumed by handleRowClick as the click bubbles.
    editIntentRef.current = true
    if (col.type === "boolean") { applyCellValue(ri, col.key, getCellValue(row, col.key) === "Yes" ? "No" : "Yes"); setActiveCell({ rowIdx: ri, colIdx: ci }); return }
    if (col.key === "platform" || col.key === "niche" || col.key === "location" ||
        col.key === "approval_status" || col.key === "contact_status" || col.key === "gender" ||
        col.type === "dropdown" || col.type === "multi-select" || col.type === "date" || col.type === "select") {
      setActiveCell({ rowIdx: ri, colIdx: ci }); setEditCell(null); setPopupCell({ rowIdx: ri, colIdx: ci }); return
    }
    const rawVal = getCellValue(row, col.key)
    const editVal = col.key === "handle" ? cleanHandle(rawVal) : rawVal
    setActiveCell({ rowIdx: ri, colIdx: ci }); setPopupCell(null); setEditCell({ rowIdx: ri, colIdx: ci }); setEditValue(editVal)
  }, [allCols, getCellValue, readOnly, filteredRows, applyCellValue, isOutreachField, canApproveInfluencers])

  const commitEdit = useCallback(() => {
    if (!editCell || commitGuardRef.current) return
    commitGuardRef.current = true
    applyCellValue(editCell.rowIdx, allCols[editCell.colIdx].key, editValue)
    setEditCell(null)
    setTimeout(() => { commitGuardRef.current = false }, 50)
  }, [editCell, editValue, allCols, applyCellValue])

  /**
   * Spreadsheet-style paste into the handle editor.
   *
   * Copying a column of usernames out of Sheets or Excel puts one value per
   * line on the clipboard. Pasted into a single cell that used to land as one
   * long run-together string, so the only way in was to add a row and type each
   * handle by hand.
   *
   * A paste with no line break is left entirely alone — that is the ordinary
   * single-handle paste and the browser still handles it. A multi-line paste
   * fills THIS row with the first handle through the normal edit path
   * (applyCellValue), which is what arms the existing lookup, the duplicate
   * check and the page's autosave gate, and appends one row per remaining
   * handle right below it, each armed the same way. Nothing is written to the
   * database here: an appended row is a temporary row like any other and is
   * only created once its lookup succeeds or the user fills in details.
   */
  const handleHandlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>, rowIdx: number) => {
    const text = e.clipboardData.getData("text/plain")
    // No line break — one value into one cell. Untouched.
    if (!/\r|\n/.test(text.trim())) return

    const handles = text
      .split(/\r?\n/)
      // A multi-column copy still fills the handle column: take the first
      // field, and drop the quoting a spreadsheet adds around a value.
      .map((line) => cleanHandle(line.split("\t")[0].trim().replace(/^"|"$/g, "")))
      .filter(Boolean)
    if (!handles.length) return

    e.preventDefault()

    const target = filteredRows[rowIdx]
    if (!target) return
    const platform = target.platform

    // The same duplicate protection a typed handle gets, applied before any row
    // exists: a handle already in the table for this platform, or repeated
    // within the paste itself, does not get one.
    const seen = new Set(
      rowsRef.current
        .filter((r) => r.id !== target.id)
        .map((r) => `${cleanHandle(r.handle).toLowerCase()}|${r.platform}`)
    )
    const unique: string[] = []
    for (const h of handles) {
      const key = `${h.toLowerCase()}|${platform}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(h)
    }
    const skipped = handles.length - unique.length

    // Closed before anything is applied, so the editor's blur cannot commit the
    // pre-paste value over what this writes (commitEdit no-ops without it).
    setEditCell(null)

    if (!unique.length) {
      addToast("warning", "Already in the list — nothing pasted")
      return
    }

    const [first, ...rest] = unique
    applyCellValue(rowIdx, "handle", first)

    if (rest.length) {
      // Deferred one tick so the commit above has landed: the rows mirror is
      // then current, which is what lets the insert be built and handed to the
      // parent outside any state updater rather than during a render.
      setTimeout(() => {
        const prev = rowsRef.current
        const at = prev.findIndex((r) => r.id === target.id)
        const insertAt = at === -1 ? prev.length : at + 1
        const urlCols = customCols.filter((c) => c.field_type === "url").map((c) => c.field_key)
        const created = rest.map((h) => {
          const row = newEmptyRow(customCols)
          row.handle = h
          row.platform = platform
          const profileUrl = getProfileUrl(platform, h)
          row.social_link = profileUrl
          urlCols.forEach((fk) => { row.custom[fk] = profileUrl })
          return row
        })
        const next = [...prev.slice(0, insertAt), ...created, ...prev.slice(insertAt)]
        setRows(next)
        onRowsChange?.(next)
        // Each new row enters the existing enrichment flow, with its existing
        // per-row debounce and already-requested guard.
        created.forEach((r) => scheduleAutoFetch(r.id, r.handle, r.platform))
      }, 0)
    }

    addToast(
      "success",
      `${unique.length} handle${unique.length === 1 ? "" : "s"} pasted${skipped ? ` · ${skipped} already in the list` : ""}`
    )
  }, [filteredRows, applyCellValue, customCols, onRowsChange, scheduleAutoFetch, addToast])

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
      || (col.key === "approval_status" && !canApproveInfluencers)

    if (disabled) return (
      <td key={col.key} className="border border-gray-200 px-1.5 py-1 text-xs bg-gray-100 text-gray-400 cursor-not-allowed" style={{ minWidth: col.minWidth }}
        title={col.key === "approval_status" && !canApproveInfluencers ? "Only Owners and Managers can approve or decline influencers" : undefined}>
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
        // The thin editing box lives on the INNER wrapper, never on the <td>.
        //
        // Two earlier attempts on the cell itself came out clipped, for two
        // different reasons: `ring-2 ring-inset` painted inside the cell's own
        // grey border, leaving two lines; and a 2px border on a border-collapse
        // table has its edges merged with the neighbouring cells, so it never
        // closed. A 1px border on a plain block inside the cell takes part in
        // neither — it is always a complete rectangle. `ringCls` is not used
        // either: it is `ring-blue-500`, and this state is neutral.
        //
        // The box FILLS the cell (p-0 on the <td>, h-full on the wrapper) and is
        // the brand green, matching the text editor below — the whole cell is
        // the editor, so there is no small inset box to aim at.
        //
        // The click handlers stop here: the <tr> carries onClick (row select)
        // and onDoubleClick (open profile), and both fired while typing in or
        // double-clicking this cell. Clicking anywhere in the cell focuses the
        // input, so the whole cell is the editor, not just the text box.
        <td
          key={col.key}
          className="border border-gray-200 p-0 relative"
          style={{ minWidth: col.minWidth }}
          onClick={e => { e.stopPropagation(); editInputRef.current?.focus() }}
          onDoubleClick={e => e.stopPropagation()}
        >
          <div className="flex h-full w-full items-center gap-1.5 border-2 border-[#1FAE5B] bg-white px-1.5 py-1">
            <ProfilePicture src={row.profile_image_url} socialLink={row.social_link || getProfileUrl(row.platform, row.handle)} name={row.full_name} handle={row.handle} size={24} />
            <input ref={editInputRef as any} type="text" value={editValue} placeholder="username" onChange={e => setEditValue(e.target.value)} onBlur={handleEditBlur} onKeyDown={handleEditKeyDown} onPaste={e => handleHandlePaste(e, rowIdx)} onMouseDown={e => e.stopPropagation()} className="flex-1 min-w-0 text-sm text-[#1E1E1E] caret-[#1FAE5B] outline-none focus:outline-none focus:ring-0 border-0 bg-transparent" />
            {/* The Save / Cancel icon buttons that sat here are gone. Committing
                and cancelling are unchanged and still fully reachable: the input
                commits on blur and on Enter/Tab (handleEditBlur /
                handleEditKeyDown) and cancels on Escape. */}
          </div>
        </td>
      )
      const socialLink = row.social_link || getProfileUrl(row.platform, row.handle)
      return (
        // A single click opens the editor — this is the column people type and
        // paste into, and requiring a double-click there was a step with no
        // purpose. Double-click still opens it too, so nothing that worked
        // before stopped working. Both stop here so the row's own onClick
        // (select — the blue row highlight) and onDoubleClick (open profile) do
        // not also fire: a double-click on this cell used to do all three at
        // once. The avatar's own onClick stops propagation before this, so
        // clicking it still opens the profile rather than the editor.
        //
        // `select-none` stays, so the click does not leave the handle text
        // highlighted behind the editor that replaces it.
        <td
          key={col.key}
          className={`group border border-gray-200 px-1.5 py-1 text-xs cursor-cell select-none relative hover:bg-gray-50 ${ringCls}`}
          style={{ minWidth: col.minWidth }}
          onClick={e => { e.stopPropagation(); startEdit(rowIdx, colIdx) }}
          onDoubleClick={e => { e.stopPropagation(); startEdit(rowIdx, colIdx) }}
          onFocus={() => setActiveCell({ rowIdx, colIdx })}
          title="Click the name to view the profile · click the cell to edit"
        >
          <div className="flex items-center gap-2">
            <div
              className="rounded-full cursor-pointer flex-shrink-0"
              onClick={e => { e.stopPropagation(); if (cleanHandle(row.handle)) setSidebarRowId(row.id) }}
              title="Click to view profile"
            >
              <ProfilePicture src={row.profile_image_url} socialLink={socialLink} name={row.full_name} handle={row.handle} size={24}
                onExpired={() => {
                  setRows(prev => prev.map(r => r.id === row.id ? { ...r, profile_image_url: "" } : r))
                  if (row.handle && (row.platform === "instagram" || row.platform === "tiktok") && !Number(row.follower_count)) {
                    requestedPairsRef.current.delete(fetchPairKey(row.handle, row.platform))
                    autoFetchInfluencer(row.id, row.handle, row.platform)
                  }
                }} />
            </div>
            {/* min-w-0 is what lets `truncate` actually shrink this item: a flex
                child's min-width defaults to its content, so without it the
                handle refuses to compress and pushes the sibling below out of
                the cell instead. The editing branch's input already carries it
                for the same reason. */}
            {/* The name IS the way into the profile panel — the one obvious
                target in the row, and the same `setSidebarRowId` flow the phone
                row cards use. The avatar beside it is left exactly as it was:
                where a row has a social_link, ProfilePicture renders it as a
                link out to Instagram/TikTok, and that is not changed here.
                A double click edits the handle instead, so the cell stays
                editable from its own text.
                
                A row with NO handle yet is the "Enter username" placeholder of
                a blank row just added — there is no influencer to show a
                profile for, so it stays plain text and the cell's own click
                opens the editor, which is what the user needs next. */}
            {cleanHandle(value) ? (
              <span
                role="button"
                tabIndex={-1}
                onClick={e => {
                  e.stopPropagation()
                  if (nameClickTimerRef.current) clearTimeout(nameClickTimerRef.current)
                  nameClickTimerRef.current = setTimeout(() => {
                    nameClickTimerRef.current = null
                    setSidebarRowId(row.id)
                  }, 200)
                }}
                onDoubleClick={e => {
                  e.stopPropagation()
                  if (nameClickTimerRef.current) { clearTimeout(nameClickTimerRef.current); nameClickTimerRef.current = null }
                  startEdit(rowIdx, colIdx)
                }}
                title="Click to view profile · double-click to edit"
                className="min-w-0 truncate text-sm text-gray-800 font-medium cursor-pointer hover:text-[#0F6B3E] hover:underline underline-offset-2"
              >
                {cleanHandle(value)}
              </span>
            ) : (
              <span className="min-w-0 truncate text-sm text-gray-300">Enter username</span>
            )}
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
      // The plain text / number editor — Followers, Engagement Rate, First Name,
      // Contact Info, Notes and any custom text or number column all land here.
      //
      // No `ringCls`: it is `ring-2 ring-inset ring-blue-500`, the blue box that
      // appeared around the cell on typing. Same reasoning as the Handle cell —
      // the input and its caret already show the cell is being edited, and on a
      // border-collapse table an inset ring never closes cleanly against the
      // neighbouring cells anyway. The cell keeps the SAME border as every other
      // cell, and the input's px-1.5 py-1 matches the non-editing padding so the
      // row does not shift when the editor opens.
      //
      // This is one editor, so it is one change: giving those four columns a
      // different treatment from the others sharing this exact code path would
      // reintroduce the inconsistency.
      // The box is the input's OWN border — an input's border is never subject
      // to border-collapse, so it cannot come out clipped the way a ring or a
      // heavier cell border did. It now FILLS the cell (p-0 on the td, w-full
      // h-full on the input) instead of sitting as a small inset box, so the
      // whole cell reads as the editor, and it is the brand green rather than
      // near-black. px-1.5 py-1 matches the non-editing padding, so the row
      // does not shift when the editor opens.
      return <td key={col.key} className="border border-gray-200 p-0 relative" style={{ minWidth: col.minWidth }}><input ref={editInputRef as any} type={col.type === "number" ? "number" : "text"} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleEditBlur} onKeyDown={handleEditKeyDown} onMouseDown={e => e.stopPropagation()} className="w-full h-full border-2 border-[#1FAE5B] px-1.5 py-1 text-xs text-[#1E1E1E] caret-[#1FAE5B] outline-none focus:outline-none focus:ring-0 bg-white" /></td>
    }

    if (isPopup) {
      const closeP = () => { setPopupCell(null); containerRef.current?.focus() }
      if (col.key === "platform") return (
        <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}>
          <div className="flex items-center gap-2"><PlatformIcon platform={value} size={16} /></div>
          <PlatformEditor value={value} onChange={v => applyCellValue(rowIdx, col.key, v)} onClose={closeP} />
        </td>
      )
      {/* onAddOption is a no-op: DropdownEditor.addNew() calls onAddOption then onChange back-to-back,
          and applyCellValue's onChange handler already registers brand-new niche/location values —
          giving onAddOption its own dbAdd call here double-fired the create request. */}
      if (col.key === "niche") return <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}>{value ? <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium truncate max-w-full">{value}</span> : <span className="text-gray-300">—</span>}<DropdownEditor value={value} options={nicheOptions} onChange={v => applyCellValue(rowIdx, col.key, v)} onClose={closeP} onAddOption={() => {}} /></td>
      if (col.key === "location") return <td key={col.key} className={`border border-gray-200 px-1.5 py-1 text-xs relative ${ringCls}`} style={{ minWidth: col.minWidth }}>{value ? <span className="truncate block text-sm">{value}</span> : <span className="text-gray-300">—</span>}<DropdownEditor value={value} options={locationOptions} onChange={v => applyCellValue(rowIdx, col.key, v)} onClose={closeP} onAddOption={() => {}} /></td>
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
        <div className="flex items-center justify-center"><PlatformIcon platform={value} size={18} /></div>
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
    <div className="flex flex-col gap-4 text-gray-700 text-sm">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(p => ({ ...p, isOpen: false })) }}
        onClose={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} variant={confirmDialog.variant}
      />

      {/* API Error Modal */}
      {apiErrorModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) setApiErrorModal({ open: false }) }}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg relative">
            <button type="button" aria-label="Cancel and delete row" title="Cancel and delete row"
              className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
              onClick={() => {
                const { rowId } = apiErrorModal
                setApiErrorModal({ open: false })
                if (rowId) deleteRow(rowId)
              }}>
              <IconX size={16} />
            </button>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-1.5 bg-red-100 rounded-full">
                <IconAlertTriangle size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                {/* Neutral heading and body.
                    "Influencer API unavailable" was wrong for most of the cases
                    that land here — a private account, a restricted or removed
                    profile, or a momentary hiccup are not outages, and blaming
                    the API sent users chasing a problem that was not theirs and
                    was not ours. The classified cause is in the console for us;
                    the user gets the two things they can act on, which the
                    buttons below provide. */}
                <h2 className="text-base font-semibold text-gray-900">Couldn&apos;t fetch this profile</h2>
                <p className="mt-2 text-sm text-gray-600">
                  {apiErrorModal.reason
                    ?? `We couldn't fetch data for @${apiErrorModal.handle ?? ""}. The profile may be private, unavailable, or temporarily unable to be accessed. You can retry or continue adding the influencer manually.`}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition" onClick={() => setApiErrorModal({ open: false })}>Continue manually</button>
              <button type="button" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                onClick={() => {
                  const { handle, platform, rowId } = apiErrorModal
                  setApiErrorModal({ open: false })
                  if (handle && platform && rowId) {
                    // Deliberate re-ask: drop the "already requested" key so the
                    // guard in autoFetchInfluencer lets this one through.
                    requestedPairsRef.current.delete(fetchPairKey(handle, platform))
                    autoFetchInfluencer(rowId, handle, platform)
                  }
                }}>Retry</button>
            </div>
          </div>
        </div>
      )}

      {pendingDuplicateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => {
          if (e.target !== e.currentTarget) return
          // Dismissed without choosing. The hold is lifted so the row is not
          // stuck unsaveable, but the row is NOT re-emitted — so the unresolved
          // duplicated contact is not persisted by this dismissal. The row stays
          // exactly as typed and editable; changing the contact, or triggering
          // the check again, is what moves it forward.
          if (pendingDuplicateInfo.reason === "contact") setContactHold(pendingDuplicateInfo.rowId, false)
          setPendingDuplicateInfo(null)
        }}>
          <div className="bg-white rounded-xl shadow-xl w-[420px] max-w-[90vw] p-5">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="p-1.5 bg-amber-100 rounded-full flex-shrink-0"><IconAlertTriangle size={18} className="text-amber-600" /></div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {pendingDuplicateInfo.reason === "contact" ? "Contact info already in use" : "Duplicate Influencer"}
                </h3>
                {pendingDuplicateInfo.reason === "contact" ? (
                  <>
                    {/* Plain language: no "handle", no "platform", no "shares
                        contact info". It says what happened, that it may be
                        deliberate, and what the two buttons below will do. The
                        list of matches stays so the user can recognise who the
                        contact already belongs to. */}
                    <p className="text-xs text-gray-500 mt-0.5">
                      This contact information is already being used by another creator.
                      If this is a different person, you can keep the creator and use the
                      contact info anyway.
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {(pendingDuplicateInfo.matches?.length ?? 0) === 1
                        ? "Already used by:"
                        : "Already used by these creators:"}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {pendingDuplicateInfo.matches?.map(m => (
                        <li key={`${m.handle}@${m.platform}`} className="text-xs text-gray-600">
                          {/* Name first — that is what a person recognises. The
                              @name and network stay as the smaller detail. */}
                          • <strong>{m.name || `@${m.handle}`}</strong>
                          {m.name && m.handle ? ` (@${m.handle})` : ""}
                          {m.platform ? ` on ${platforms.find(pl => pl.value === m.platform)?.name ?? m.platform}` : ""}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5"><strong>@{pendingDuplicateInfo.handle}</strong> already exists as <strong>{pendingDuplicateInfo.existingName}</strong>.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                const { rowId, reason } = pendingDuplicateInfo
                if (reason === "contact") {
                  // Clear the shared CONTACT and carry on — the influencer is
                  // still being added. The row and the handle are untouched;
                  // only the duplicated address is dropped, and it is dropped to
                  // empty, which the API stores as null.
                  //
                  // The hold is released FIRST so the onRowsChange below is the
                  // save that finally goes out, now carrying an empty contact.
                  setContactHold(rowId, false)
                  setRows(prev => {
                    const n = prev.map(r => r.id === rowId ? { ...r, email: "", contact_info: "" } : r)
                    onRowsChange?.(n)
                    // Finish the write the enrichment skipped while held. A
                    // draft never reaches the page's autosave (it waits on its
                    // lookup), so re-emitting the row is not enough on its own.
                    const resumed = n.find(r => r.id === rowId)
                    if (resumed) void saveRowToDatabase(resumed)
                    return n
                  })
                } else {
                  // A handle+platform duplicate: the row itself is the
                  // duplicate, so removing it is the fix.
                  setRows(prev => { const n = prev.filter(r => r.id !== rowId); onRowsChange?.(n); return n })
                }
                setDuplicateRowIds(prev => { const n = new Set(prev); n.delete(rowId); return n })
                setPendingDuplicateInfo(null)
              }} className="flex-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs hover:bg-red-100 transition">
                {pendingDuplicateInfo.reason === "contact" ? "Remove contact info" : "Remove duplicate"}
              </button>
              <button onClick={() => {
                const { rowId, reason } = pendingDuplicateInfo
                if (reason === "contact") {
                  // Keep the shared contact deliberately. Releasing the hold and
                  // re-emitting the row lets the paused save proceed with the
                  // duplicated address intact; saveRowToDatabase covers the row
                  // the enrichment was mid-way through, which the page's
                  // autosave does not reach on its own.
                  setContactHold(rowId, false)
                  setRows(prev => {
                    onRowsChange?.(prev)
                    const resumed = prev.find(r => r.id === rowId)
                    if (resumed) void saveRowToDatabase(resumed)
                    return prev
                  })
                }
                setDuplicateRowIds(prev => { const n = new Set(prev); n.delete(rowId); return n })
                setPendingDuplicateInfo(null)
              }} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition">
                {pendingDuplicateInfo.reason === "contact" ? "Keep it anyway" : "Keep anyway"}
              </button>
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
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text" value={searchInput} onChange={e => { setSearchInput(e.target.value); setCurrentPage(1) }}
              placeholder="Search influencer..."
              data-tour="table-search"
              className="w-full pl-9 pr-3 h-9 border border-[#0F6B3E]/20 rounded-lg outline-none focus:ring-2 focus:ring-[#1FAE5B] text-sm bg-white"
            />
          </div>

          {/* Filters button */}
          <div className="relative">
            <button ref={filterBtnRef} onClick={() => setShowFilterPopover(v => !v)}
              data-tour="table-filters"
              className={`h-9 px-3 rounded-lg text-sm flex items-center gap-1.5 border transition-colors ${hasActiveFilters ? "bg-[#1FAE5B] text-white border-[#1FAE5B]" : "border-[#0F6B3E]/20 text-gray-600 hover:border-[#0F6B3E]/40"}`}>
              <IconFilter size={15} /> Filters
              {hasActiveFilters && (
                <span className="text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center bg-white/20 text-white">
                  {[filters.platform !== "all", filters.niche !== "all", filters.location !== "all", filters.gender !== "all", filters.approval !== "all", !!filters.dateFrom, !!filters.dateTo].filter(Boolean).length}
                </span>
              )}
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

          {/* Count — same slot and wording as the Post Tracker's. */}
          <span className="text-sm text-gray-500 whitespace-nowrap ml-1">
            {filteredRows.length} of {rows.length} influencer{rows.length !== 1 ? "s" : ""}
          </span>

          {/* Real freshness, from the shared cache entry this view renders
              from — same component and placement on every board. */}
          <DataSyncStatus cacheKey={brandId ? `/api/brand/${brandId}/influencers` : null} />

          {/* Right-side controls */}
          <div className="flex items-center gap-2 ml-auto">
            {!readOnly && (
              <button onClick={addRow} data-tour="table-add-influencer" className="h-9 px-3 flex items-center gap-1.5 text-sm font-medium border border-[#0F6B3E]/20 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 hover:border-[#0F6B3E]/40 transition-colors" title="Add a new influencer"><IconPlus size={15} /> Add Influencer</button>
            )}

            <div className="relative">
              <button
                ref={importExportBtnRef}
                data-tour="table-import-export"
                onClick={() => {
                  if (isOnBasicPlan) { onShowTrialModal?.(); return }
                  setShowImportExportMenu(v => !v)
                }}
                disabled={subscriptionStatus?.status === "trialing"}
                className={`h-9 px-3 flex items-center gap-1.5 text-sm border rounded-lg transition-colors ${
                  subscriptionStatus?.status === "trialing"
                    ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50"
                    : "border-[#0F6B3E]/20 text-gray-600 hover:border-[#0F6B3E]/40"
                }`}
                title={isOnBasicPlan ? "Import and Export are not available on the Basic plan" : undefined}
              >
                <IconSettings size={15} /> Import / Export
              </button>
              {showImportExportMenu && (
                <div ref={importExportRef} className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-52 py-1">
                  <button onClick={() => { fileInputRef.current?.click(); setShowImportExportMenu(false) }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition text-gray-700"><IconUpload size={13} className="text-blue-500" /> Import from CSV</button>
                  <button onClick={() => { exportToCSV(rows, customCols); setShowImportExportMenu(false) }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition text-gray-700"><IconDownload size={13} className="text-green-500" /> Export to CSV</button>
                  <button onClick={() => { downloadTemplate(customCols); setShowImportExportMenu(false) }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition text-gray-700"><IconDownload size={13} className="text-gray-400" /> Download template</button>
                </div>
              )}
            </div>

            <div className="relative">
              <button ref={settingsBtnRef} onClick={() => setShowSettingsMenu(v => !v)} className="h-9 px-3 flex items-center border border-[#0F6B3E]/20 rounded-lg text-gray-600 hover:border-[#0F6B3E]/40 transition-colors" title="Settings" aria-label="Settings"><IconDotsVertical size={15} /></button>
              {showSettingsMenu && (
                <div ref={settingsMenuRef} className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-52 py-1">
                  <button onClick={() => { setShowManageNiches(true); setShowSettingsMenu(false) }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition text-gray-700"><IconTags size={13} className="text-gray-400" /> Add Niche</button>
                  <button onClick={() => { setShowManageLocations(true); setShowSettingsMenu(false) }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition text-gray-700"><IconMapPin size={13} className="text-gray-400" /> Add Location</button>
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
          {/* Same flow as before (onBulkApprove sets approval to Approved and
              stamps the transferred date) — only the wording changed, so the
              button now says what it does. */}
          <button onClick={() => setShowBulkTransferConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            <IconCheck size={13} /> Approved
          </button>
          <button onClick={deleteSelectedRows} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition">
            <IconTrash size={13} /> Delete {selectedRowIds.size}
          </button>
        </div>
      )}

      {/* Bulk transfer confirm */}
      {showBulkTransferConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) setShowBulkTransferConfirm(false) }}>
          <div className="bg-white rounded-xl shadow-xl w-[400px] max-w-[90vw] p-5">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="p-1.5 bg-green-100 rounded-full flex-shrink-0"><IconCheck size={18} className="text-green-600" /></div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">Approve influencers</h3>
                <p className="text-xs text-gray-500 mt-0.5">Mark <strong>{selectedRowIds.size} influencer{selectedRowIds.size !== 1 ? "s" : ""}</strong> as Approved — no individual review needed.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkTransferConfirm(false)} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleBulkTransferToOutreach} disabled={bulkApproving} className="flex-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs hover:bg-green-700 transition font-medium disabled:opacity-60 disabled:cursor-not-allowed">{bulkApproving ? "Approving…" : "Confirm"}</button>
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
        {/* ── Phone layout: same rows, card list. The spreadsheet grid below
            takes over from md up. The table's own empty state and "add row"
            footer live inside <tbody>/<tfoot>, so both need phone equivalents
            here or they'd vanish under md. ── */}
        {totalRows === 0 && (
          <div className="md:hidden rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-700">No influencers yet</p>
            <p className="mt-1 text-[13px] text-gray-500">
              {readOnly ? "Nothing to show here." : "Add your first influencer to get started."}
            </p>
            {!readOnly && (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={addRow}
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#1FAE5B] text-sm font-medium text-white transition-colors active:bg-[#178a48]"
                >
                  <IconPlus size={16} /> Add influencer
                </button>
                <button
                  onClick={() => setShowAddRowsModal(true)}
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 transition-colors active:bg-gray-50"
                >
                  <IconCopy size={16} /> Add multiple
                </button>
              </div>
            )}
          </div>
        )}

        {totalRows > 0 && (
          <MobileRowCards
            rows={pageRows}
            selectedRowIds={selectedRowIds}
            fetchingRows={fetchingRows}
            duplicateRowIds={duplicateRowIds}
            readOnly={readOnly}
            onToggleSelect={handleCheckboxToggle}
            onOpenProfile={setSidebarRowId}
            onDelete={deleteRow}
          />
        )}

        {/* Phone equivalent of the table's <tfoot> add-row bar */}
        {totalRows > 0 && !readOnly && (
          <div className="md:hidden mt-2.5 flex gap-2">
            <button
              onClick={addRow}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-[13px] font-medium text-gray-700 shadow-sm transition-colors active:bg-gray-50"
            >
              <IconPlus size={15} /> Add row
            </button>
            <button
              onClick={() => setShowAddRowsModal(true)}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-[13px] font-medium text-gray-700 shadow-sm transition-colors active:bg-gray-50"
            >
              <IconCopy size={15} /> Add multiple
            </button>
          </div>
        )}

        <div ref={containerRef} tabIndex={0}
          className="instroom-table-wrap hidden md:block overflow-auto border border-gray-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-200"
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
                const ri = pageStart + li
                // Everything about the SHEET's cell state that changes what THIS
                // row renders, collapsed to one comparable string: which of its
                // own cells is active / being edited / showing a popup, and the
                // live edit value. A row whose cells are untouched produces the
                // same key on every keystroke elsewhere and does not repaint.
                //
                // The edit value is included so the controlled input stays
                // exactly that — the edited row repaints on every character, and
                // no stale snapshot is possible.
                const cellsKey = [
                  activeCell?.rowIdx === ri ? activeCell.colIdx : -1,
                  editCell?.rowIdx === ri ? editCell.colIdx : -1,
                  popupCell?.rowIdx === ri ? popupCell.colIdx : -1,
                  editCell?.rowIdx === ri ? editValue : "",
                ].join("|")
                return (
                  <SheetRow
                    key={row.id}
                    row={row}
                    rowIdx={ri}
                    isSelected={selectedRowIds.has(row.id)}
                    isDeclined={row.approval_status === "Declined"}
                    isDuplicate={duplicateRowIds.has(row.id)}
                    isFetching={fetchingRows.has(row.id)}
                    readOnly={readOnly}
                    cols={allCols}
                    cellsKey={cellsKey}
                    renderCell={renderCell}
                    onRowClick={handleRowClick}
                    onRowDoubleClick={handleRowDoubleClick}
                    onCheckboxToggle={handleCheckboxToggle}
                    onDeleteRow={deleteRow}
                  />
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
"use client"
// table-sheet/modals.tsx
// All modal dialogs: Confirm, AddRows, Decline, ManageOptions, AddColumn, FilterPopover

import React, { useState, useEffect, useRef, type ReactNode } from "react"
import { IconX, IconAlertTriangle, IconAlertCircle, IconCheck, IconPlus, IconEdit, IconTrash, IconBulb } from "@tabler/icons-react"
import { DEFAULT_PLATFORMS, DEFAULT_GENDERS, FIELD_TYPE_INFO } from "./constants"
import type { CustomColumn, FilterState } from "./types"

// ── ConfirmationDialog ────────────────────────────────────────────────────────

export function ConfirmationDialog({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", variant = "danger" }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: ReactNode; confirmText?: string; cancelText?: string;
  variant?: "danger" | "warning" | "info"
}) {
  const vs = {
    danger:  { icon: IconAlertTriangle, iconBg: "bg-red-100",    iconColor: "text-red-600",    buttonBg: "bg-red-600 hover:bg-red-700" },
    warning: { icon: IconAlertCircle,   iconBg: "bg-amber-100",  iconColor: "text-amber-600",  buttonBg: "bg-amber-600 hover:bg-amber-700" },
    info:    { icon: IconAlertCircle,   iconBg: "bg-blue-100",   iconColor: "text-blue-600",   buttonBg: "bg-blue-600 hover:bg-blue-700" },
  }
  const s = vs[variant]; const IC = s.icon
  useEffect(() => {
    if (isOpen) {
      const h = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose() }
      document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h)
    }
  }, [isOpen, onClose])
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-[420px] p-5">
        <div className="flex items-start gap-2.5 mb-3">
          <div className={`p-2 ${s.iconBg} rounded-full flex-shrink-0`}><IC size={24} className={s.iconColor} /></div>
          <div className="flex-1"><h3 className="text-base font-semibold text-gray-900">{title}</h3><div className="text-sm text-gray-500 mt-1">{message}</div></div>
        </div>
        <div className="flex gap-3 mt-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">{cancelText}</button>
          <button onClick={() => { onConfirm(); onClose() }} className={`flex-1 px-4 py-2 rounded-lg text-white text-sm transition ${s.buttonBg}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}

// ── AddRowsModal ──────────────────────────────────────────────────────────────

export function AddRowsModal({
  isOpen, onClose, onAdd, selectedCount,
}: {
  isOpen: boolean
  onClose: () => void
  onAdd: (count: number, position: "end" | "after-selection") => void  // ✅ pass position
  selectedCount: number
}) {
  const [count, setCount] = useState(5)
  const [insertPosition, setInsertPosition] = useState<"end" | "after-selection">(
    selectedCount > 0 ? "after-selection" : "end"
  )

  // Reset position when modal opens
  useEffect(() => {
    if (isOpen) {
      setInsertPosition(selectedCount > 0 ? "after-selection" : "end")
    }
  }, [isOpen, selectedCount])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-[380px] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Add Multiple Rows</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition rounded">
            <IconX size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Count */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Number of rows</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCount(c => Math.max(1, c - 1))}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition font-medium text-base leading-none"
              >−</button>
              <input
                type="number" min="1" max="500" value={count}
                onChange={e => setCount(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-center text-sm"
              />
              <button
                onClick={() => setCount(c => Math.min(500, c + 1))}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition font-medium text-base leading-none"
              >+</button>
              <span className="text-sm text-gray-500">rows</span>
            </div>
          </div>

          {/* Insert position */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Insert position</label>
            <div className="flex gap-2">
              <button
                onClick={() => setInsertPosition("end")}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition ${
                  insertPosition === "end"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                At the end
              </button>
              <button
                onClick={() => { if (selectedCount > 0) setInsertPosition("after-selection") }}
                disabled={selectedCount === 0}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition ${
                  insertPosition === "after-selection"
                    ? "bg-blue-600 text-white border-blue-600"
                    : selectedCount === 0
                    ? "border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                After selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => { onAdd(count, insertPosition); onClose() }}  // ✅ pass position
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition font-medium"
          >
            Add {count} Row{count !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  )
}
// ── DeclineConfirmationModal ──────────────────────────────────────────────────

export function DeclineConfirmationModal({ isOpen, onClose, onConfirm, influencerName }: {
  isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void; influencerName: string
}) {
  const [declineReason, setDeclineReason] = useState("")
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (isOpen) { setDeclineReason(""); setError(""); setTimeout(() => inputRef.current?.focus(), 100) } }, [isOpen])
  if (!isOpen) return null
  const handleConfirm = () => {
    if (!declineReason.trim()) { setError("Please provide a reason"); return }
    onConfirm(declineReason.trim()); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-[420px] p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 bg-red-100 rounded-full"><IconAlertTriangle size={20} className="text-red-600" /></div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Decline Influencer</h3>
            <p className="text-sm text-gray-500">Declining <span className="font-medium text-gray-700">{influencerName}</span></p>
          </div>
        </div>
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Reason <span className="text-red-500">*</span></label>
            <textarea ref={inputRef} value={declineReason} onChange={e => { setDeclineReason(e.target.value); setError("") }}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleConfirm() }; if (e.key === "Escape") onClose() }}
              placeholder="e.g., Budget constraints…" rows={4}
              className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-red-400 outline-none resize-none ${error ? "border-red-300 bg-red-50" : "border-gray-200"}`} />
            {error && <p className="text-xs text-red-500 mt-1"><IconAlertCircle size={12} /> {error}</p>}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800"><strong>Note:</strong> Declining disables outreach fields and clears outreach data.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-3">
          <button onClick={() => { onConfirm(""); onClose() }} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition">Skip</button>
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleConfirm} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition">Confirm Decline</button>
        </div>
      </div>
    </div>
  )
}

// ── ManageOptionsModal ────────────────────────────────────────────────────────

export function ManageOptionsModal({ isOpen, onClose, title, options, onAdd, onRemove }: {
  isOpen: boolean; onClose: () => void; title: string; options: string[]
  onAdd: (name: string) => Promise<void>
  onRemove: (name: string) => Promise<void>
}) {
  const [lo, setLo] = useState<string[]>(options)
  const [no, setNo] = useState("")
  const [ei, setEi] = useState<number | null>(null)
  const [ev, setEv] = useState("")
  const [busy, setBusy] = useState(false)
  const ir = useRef<HTMLInputElement>(null)

  useEffect(() => { if (isOpen) { setLo([...options]); setNo(""); setEi(null) } }, [isOpen, options])
  if (!isOpen) return null

  const add = async () => {
    const v = no.trim()
    if (!v || lo.includes(v)) return
    setBusy(true)
    await onAdd(v)
    setLo(p => [...p, v])
    setNo("")
    setBusy(false)
    ir.current?.focus()
  }

  const remove = async (name: string, idx: number) => {
    setLo(p => p.filter((_, i) => i !== idx))
    await onRemove(name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-[380px] p-5 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><IconX size={20} /></button>
        </div>
        <div className="flex gap-1.5 mb-3">
          <input ref={ir} type="text" value={no} onChange={e => setNo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add() }}
            placeholder={`Add new ${title.toLowerCase()}…`}
            className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-400 outline-none" />
          <button onClick={add} disabled={!no.trim() || busy} className="px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition"><IconPlus size={12} /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {lo.map((opt, idx) => (
            <div key={opt} className="flex items-center gap-2 group px-2 py-1.5 rounded-lg hover:bg-gray-50">
              {ei === idx ? (
                <>
                  <input type="text" value={ev} onChange={e => setEv(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { const v = ev.trim(); if (v) setLo(p => p.map((o, i) => i === ei ? v : o)); setEi(null) }; if (e.key === "Escape") setEi(null) }}
                    className="flex-1 px-2 py-1 text-sm border border-green-300 rounded outline-none" autoFocus />
                  <button onClick={() => { const v = ev.trim(); if (v) setLo(p => p.map((o, i) => i === ei ? v : o)); setEi(null) }} className="p-1 text-green-600"><IconCheck size={12} /></button>
                  <button onClick={() => setEi(null)} className="p-1 text-gray-400"><IconX size={12} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-700">{opt}</span>
                  <button onClick={() => { setEi(idx); setEv(lo[idx]) }} className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100"><IconEdit size={12} /></button>
                  <button onClick={() => remove(opt, idx)} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"><IconTrash size={12} /></button>
                </>
              )}
            </div>
          ))}
          {lo.length === 0 && <p className="text-center text-sm text-gray-400 py-4">No options yet</p>}
        </div>
        <div className="flex gap-3 mt-3 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition">Done</button>
        </div>
      </div>
    </div>
  )
}

// ── AddColumnModal ────────────────────────────────────────────────────────────

export function AddColumnModal({ isOpen, onClose, onConfirm, customCols }: {
  isOpen: boolean; onClose: () => void;
  onConfirm: (name: string, description: string, type: CustomColumn["field_type"], group: "Influencer Details" | "Approval Details" | "Outreach Details", options: string) => void;
  customCols: CustomColumn[]
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<CustomColumn["field_type"]>("text")
  const [group, setGroup] = useState<"Influencer Details" | "Approval Details" | "Outreach Details">("Influencer Details")
  const [options, setOptions] = useState("")
  const [showTips, setShowTips] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) { setName(""); setDescription(""); setType("text"); setGroup("Influencer Details"); setOptions(""); setShowTips(false); setTimeout(() => inputRef.current?.focus(), 100) }
  }, [isOpen])
  if (!isOpen) return null

  const isDuplicate = customCols.some(c => c.field_name.toLowerCase() === name.trim().toLowerCase())
  const fieldKey = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  const typeInfo = FIELD_TYPE_INFO[type]
  const needsOptions = type === "dropdown" || type === "multi-select"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-[620px] max-h-[90vh] overflow-y-auto">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Add Custom Column</h3>
              <p className="text-xs text-gray-400 mt-1">Extend your table with custom data fields</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"><IconX size={20} /></button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Column Name <span className="text-red-400">*</span></label>
            <input ref={inputRef} type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Escape") onClose() }}
              placeholder="e.g., Content Type, Contract Status"
              className={`w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:ring-2 transition ${isDuplicate ? "border-red-300 focus:ring-red-300 bg-red-50" : "border-gray-200 focus:ring-blue-400"}`} />
            {isDuplicate && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><IconAlertCircle size={12} /> A column with this name already exists</p>}
            {name.trim() && !isDuplicate && <p className="text-xs text-gray-400 mt-1">Field key: <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">{fieldKey}</code></p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Briefly describe what this column tracks" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 transition" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Field Type</label>
            <select value={type} onChange={e => setType(e.target.value as CustomColumn["field_type"])} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 transition bg-white">
              <option value="text">Text</option><option value="number">Number</option>
              <option value="dropdown">Dropdown</option><option value="multi-select">Multi-select</option>
              <option value="date">Date</option><option value="boolean">Yes / No</option><option value="url">URL</option>
            </select>
            {typeInfo && (
              <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <p className="text-xs text-gray-600">{typeInfo.description}</p>
                <p className="text-xs text-gray-400 mt-1 italic">{typeInfo.example}</p>
              </div>
            )}
          </div>
          {needsOptions && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Options <span className="text-red-400">*</span></label>
              <input type="text" value={options} onChange={e => setOptions(e.target.value)} placeholder="Option A, Option B, Option C" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 transition" />
              <p className="text-xs text-gray-400 mt-1">Separate each option with a comma.</p>
              {options.trim() && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {options.split(",").map(o => o.trim()).filter(Boolean).map(o => (
                    <span key={o} className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">{o}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Section</label>
            <div className="space-y-2">
              {([
                { value: "Influencer Details", description: "Profile info, demographics, social metrics" },
                { value: "Approval Details",   description: "Review status, notes, decision tracking" },
              ] as const).map(opt => (
                <label key={opt.value} className={`flex items-start gap-3 px-3 py-3 rounded-lg border cursor-pointer transition ${group === opt.value ? "border-blue-400 bg-blue-50/50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                  <input type="radio" name="column-group" value={opt.value} checked={group === opt.value} onChange={() => setGroup(opt.value)} className="mt-0.5 w-4 h-4 text-blue-600" />
                  <div><span className="text-xs font-medium text-gray-700">{opt.value}</span><p className="text-xs text-gray-400 mt-0.5">{opt.description}</p></div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <button onClick={() => setShowTips(!showTips)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition font-medium">
              <IconBulb size={14} />{showTips ? "Hide tips" : "How do custom columns work?"}
            </button>
            {showTips && (
              <div className="mt-2.5 bg-blue-50 border border-blue-100 rounded-lg p-3.5 space-y-2">
                <p className="text-xs text-blue-800"><strong>Adding data:</strong> Click any cell in your new column to start typing or selecting.</p>
                <p className="text-xs text-blue-800"><strong>Drag to reorder:</strong> Grab the column header and drag it to reposition.</p>
                <p className="text-xs text-blue-800"><strong>Export:</strong> Custom columns are included in CSV export.</p>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition font-medium">Cancel</button>
          <button onClick={() => { onConfirm(name, description, type, group, options); onClose() }}
            disabled={!name.trim() || isDuplicate || (needsOptions && !options.trim())}
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium">
            Add Column
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FilterPopover ─────────────────────────────────────────────────────────────

export function FilterPopover({ isOpen, onClose, filters, onApplyFilters, onClearFilters, niches, locations, anchorRef }: {
  isOpen: boolean; onClose: () => void; filters: FilterState;
  onApplyFilters: (f: FilterState) => void; onClearFilters: () => void;
  niches: string[]; locations: string[];
  anchorRef: React.RefObject<HTMLButtonElement | null>
}) {
  const [lf, setLf] = useState<FilterState>(filters)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (isOpen) setLf(filters) }, [isOpen, filters])
  useEffect(() => {
    if (!isOpen) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [isOpen, onClose, anchorRef])
  if (!isOpen) return null
  const selCls = "w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-400"
  const inputCls = "w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
  return (
    <div ref={ref} className="absolute top-full right-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-[400px]" onClick={e => e.stopPropagation()}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filters</h4>
        <button onClick={() => { setLf({ platform:"all",niche:"all",location:"all",gender:"all",approval:"all",dateFrom:"",dateTo:"" }); onClearFilters() }} className="text-[10px] text-gray-400 hover:text-gray-600 transition">Clear all</button>
      </div>
      <div className="px-4 pb-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Platform</label><select value={lf.platform} onChange={e => setLf(p => ({ ...p, platform: e.target.value }))} className={selCls}><option value="all">All</option>{DEFAULT_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          <div><label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Niche</label><select value={lf.niche} onChange={e => setLf(p => ({ ...p, niche: e.target.value }))} className={selCls}><option value="all">All</option>{niches.map(n => <option key={n} value={n}>{n}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Location</label><select value={lf.location} onChange={e => setLf(p => ({ ...p, location: e.target.value }))} className={selCls}><option value="all">All</option>{locations.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
          <div><label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Gender</label><select value={lf.gender} onChange={e => setLf(p => ({ ...p, gender: e.target.value }))} className={selCls}><option value="all">All</option>{DEFAULT_GENDERS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
        </div>
        <div><label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Approval Status</label><select value={lf.approval} onChange={e => setLf(p => ({ ...p, approval: e.target.value }))} className={selCls}><option value="all">All</option><option value="Approved">Approved</option><option value="Declined">Declined</option><option value="Pending">Pending</option></select></div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Date Added</label>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-[10px] text-gray-400 mb-0.5">From</label><input type="date" value={lf.dateFrom} onChange={e => setLf(p => ({ ...p, dateFrom: e.target.value }))} className={inputCls} /></div>
            <div><label className="block text-[10px] text-gray-400 mb-0.5">To</label><input type="date" value={lf.dateTo} onChange={e => setLf(p => ({ ...p, dateTo: e.target.value }))} className={inputCls} /></div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100">
        <button onClick={() => { onApplyFilters(lf); onClose() }} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">Apply</button>
      </div>
    </div>
  )
}
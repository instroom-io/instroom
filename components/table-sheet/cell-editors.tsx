"use client"
// table-sheet/cell-editors.tsx
// FloatingPopup + all inline cell editor components

import React, { useState, useEffect, useRef, type ReactNode } from "react"
import ReactDOM from "react-dom"
import { IconCheck, IconPlus, IconX, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { platforms } from "./constants"

// ── FloatingPopup ─────────────────────────────────────────────────────────────

export function FloatingPopup({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = React.useState<React.CSSProperties>({ position: "fixed", top: -9999, left: -9999, zIndex: 9999, opacity: 0 })
  const [mounted, setMounted] = React.useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const anchor = triggerRef.current?.closest("td") ?? triggerRef.current?.parentElement
    if (!anchor || !popupRef.current) return
    const rect = anchor.getBoundingClientRect()
    const popupH = popupRef.current.offsetHeight || 300
    const popupW = popupRef.current.offsetWidth || 220
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= popupH + 8 ? rect.bottom + 2 : rect.top - popupH - 2
    const left = Math.min(rect.left, window.innerWidth - popupW - 8)
    setStyle({ position: "fixed", top: Math.max(8, top), left: Math.max(8, left), zIndex: 9999, opacity: 1 })
    popupRef.current?.focus()
  }, [mounted])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) onClose()
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [onClose])

  const popup = (
    <div ref={popupRef} tabIndex={0} style={style}
      onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose() } }}
      onMouseDown={e => e.stopPropagation()}
      className="bg-white border border-gray-200 rounded-lg shadow-xl">
      {children}
    </div>
  )

  return (
    <>
      <span ref={triggerRef} style={{ display: "none" }} />
      {mounted && typeof document !== "undefined"
        ? ReactDOM.createPortal(popup, document.body)
        : null}
    </>
  )
}

// ── DropdownEditor ────────────────────────────────────────────────────────────

export function DropdownEditor({ value, options, onChange, onClose, onAddOption }: {
  value: string; options: string[]; onChange: (v: string) => void; onClose: () => void; onAddOption?: (v: string) => void
}) {
  const [newOpt, setNewOpt] = useState("")
  const addNew = () => {
    const v = newOpt.trim()
    if (!v || options.includes(v)) return
    onAddOption?.(v); onChange(v); setNewOpt(""); onClose()
  }
  return (
    <FloatingPopup onClose={onClose}>
      <div className="w-52 max-h-60 overflow-auto py-1">
        <button onMouseDown={e => e.preventDefault()} onClick={() => { onChange(""); onClose() }}
          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition ${!value ? "text-indigo-600 font-medium" : "text-gray-400"}`}>
          — None —
        </button>
        {options.map(o => (
          <button key={o} onMouseDown={e => e.preventDefault()} onClick={() => { onChange(o); onClose() }}
            className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition ${value === o ? "text-indigo-700 font-medium bg-indigo-50" : "text-gray-700"}`}>
            {value === o && <IconCheck size={12} className="text-indigo-600 flex-shrink-0" />}{o}
          </button>
        ))}
      </div>
      {onAddOption && (
        <div className="border-t border-gray-100 px-2 py-2">
          <div className="flex gap-1">
            <input type="text" value={newOpt} placeholder="Add new…" onChange={e => setNewOpt(e.target.value)}
              onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") addNew() }}
              onMouseDown={e => e.stopPropagation()}
              className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded outline-none focus:ring-1 ring-indigo-400 min-w-0" />
            <button onClick={addNew} disabled={!newOpt.trim()}
              className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40 transition">
              <IconPlus size={12} />
            </button>
          </div>
        </div>
      )}
    </FloatingPopup>
  )
}

// ── MultiSelectEditor ─────────────────────────────────────────────────────────

export function MultiSelectEditor({ value, options, onChange, onClose, onAddOption }: {
  value: string; options: string[]; onChange: (v: string) => void; onClose: () => void; onAddOption: (v: string) => void
}) {
  const selected = value ? value.split(",").map(s => s.trim()).filter(Boolean) : []
  const [newOpt, setNewOpt] = useState("")
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]
    onChange(next.join(","))
  }
  const addNew = () => {
    const v = newOpt.trim()
    if (!v || options.includes(v)) return
    onAddOption(v); onChange([...selected, v].join(",")); setNewOpt("")
  }
  return (
    <FloatingPopup onClose={onClose}>
      <div className="w-56 max-h-52 overflow-auto py-1">
        {options.map(opt => {
          const isOn = selected.includes(opt)
          return (
            <button key={opt} onMouseDown={e => e.preventDefault()} onClick={() => toggle(opt)}
              className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition ${isOn ? "text-purple-700 font-medium" : "text-gray-700"}`}>
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isOn ? "bg-purple-600 border-purple-600" : "border-gray-300"}`}>
                {isOn && <IconCheck size={12} className="text-white" />}
              </span>{opt}
            </button>
          )
        })}
        {!options.length && <div className="px-3 py-2 text-xs text-gray-400">No options yet</div>}
      </div>
      <div className="border-t border-gray-100 px-2 py-2">
        <div className="flex gap-1">
          <input type="text" value={newOpt} placeholder="Add new…" onChange={e => setNewOpt(e.target.value)}
            onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") addNew() }}
            onMouseDown={e => e.stopPropagation()}
            className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded outline-none focus:ring-1 ring-purple-400 min-w-0" />
          <button onClick={addNew} disabled={!newOpt.trim()}
            className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-40 transition">
            <IconPlus size={12} />
          </button>
        </div>
      </div>
    </FloatingPopup>
  )
}

// ── DatePicker ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"]

export function DatePicker({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const init = value ? new Date(value + "T00:00:00") : new Date()
  const [viewYear, setViewYear] = useState(init.getFullYear())
  const [viewMonth, setViewMonth] = useState(init.getMonth())
  const today = new Date()
  const todayStr = [today.getFullYear(), String(today.getMonth()+1).padStart(2,"0"), String(today.getDate()).padStart(2,"0")].join("-")
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate()
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
  type DayCell = { day: number; current: boolean; dateStr: string }
  const cells: DayCell[] = []
  for (let i=0;i<firstDow;i++) { const d=prevMonthDays-firstDow+1+i; const m=viewMonth===0?12:viewMonth; const y=viewMonth===0?viewYear-1:viewYear; cells.push({day:d,current:false,dateStr:`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`}) }
  for (let d=1;d<=daysInMonth;d++) { cells.push({day:d,current:true,dateStr:`${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`}) }
  while (cells.length<42) { const d=cells.length-firstDow-daysInMonth+1; const m=viewMonth===11?1:viewMonth+2; const y=viewMonth===11?viewYear+1:viewYear; cells.push({day:d,current:false,dateStr:`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`}) }
  const prevMo = () => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)}else{setViewMonth(m=>m-1)} }
  const nextMo = () => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)}else{setViewMonth(m=>m+1)} }
  const pick = (s: string) => { onChange(s); onClose() }
  return (
    <FloatingPopup onClose={onClose}>
      <div className="w-[280px] p-3 select-none">
        <div className="flex items-center justify-between mb-3">
          <button onMouseDown={e=>e.preventDefault()} onClick={prevMo} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition"><IconChevronLeft size={14}/></button>
          <span className="text-sm font-semibold text-gray-800">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onMouseDown={e=>e.preventDefault()} onClick={nextMo} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition"><IconChevronRight size={14}/></button>
        </div>
        <div className="grid grid-cols-7 mb-1">{DAY_NAMES.map(d=><div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {cells.map((c,i)=>{
            const isSelected=c.dateStr===value; const isToday=c.dateStr===todayStr
            return <button key={i} onMouseDown={e=>e.preventDefault()} onClick={()=>pick(c.dateStr)} className={`w-[32px] h-[32px] mx-auto rounded-lg text-xs flex items-center justify-center transition-colors ${!c.current?"text-gray-300 hover:bg-gray-50":"text-gray-700 hover:bg-blue-50"} ${isSelected?"!bg-blue-600 !text-white font-bold hover:!bg-blue-700":""} ${isToday&&!isSelected?"ring-1 ring-inset ring-blue-400 font-semibold text-blue-600":""}`}>{c.day}</button>
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
          <button onMouseDown={e=>e.preventDefault()} onClick={()=>pick(todayStr)} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">Today</button>
          <button onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange("");onClose()}} className="text-xs text-gray-400 hover:text-red-500 transition">Clear</button>
        </div>
      </div>
    </FloatingPopup>
  )
}

// ── PlatformEditor ────────────────────────────────────────────────────────────

export function PlatformEditor({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  return (
    <FloatingPopup onClose={onClose}>
      <div className="w-52 max-h-60 overflow-auto py-1">
        {platforms.map(plat => {
          const sel = value === plat.value
          return (
            <button key={plat.value} onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange(plat.value);onClose()}}
              className={`flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition ${sel ? "text-blue-700 font-medium bg-blue-50" : "text-gray-700"}`}>
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                {React.cloneElement(plat.icon as React.ReactElement, { className: "w-5 h-5", style: { width: 20, height: 20 } } as any)}
              </span>
              <span>{plat.name}</span>
              {sel && <IconCheck size={12} className="text-blue-600 ml-auto flex-shrink-0" />}
            </button>
          )
        })}
      </div>
    </FloatingPopup>
  )
}
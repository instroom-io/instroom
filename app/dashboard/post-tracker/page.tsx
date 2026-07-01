// app/dashboard/post-tracker/page.tsx
// UI consistent with pipeline kanban:
// - Same column header style (colored bg, title, count badge, ⓘ info tooltip)
// - Description text removed from below header — moved into tooltip
// - Same card style (name, handle, platform, location, followers, eng)
// - Stage action buttons on cards (→ Next Stage arrows)
// - Profile drawer shows current stage with ability to change it

"use client"

import { useState, useCallback, Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  DndContext, DragOverlay, closestCorners, PointerSensor,
  useSensor, useSensors, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core"
import { useDroppable } from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import {
  IconPlus, IconSearch, IconX, IconChevronDown, IconChevronUp,
  IconLoader2, IconLayoutKanban, IconList, IconFilter, IconLocation,
  IconLayoutList, IconCheck, IconFileText, IconSend, IconPhoto,
  IconLink, IconCurrencyDollar, IconArrowRight,
} from "@tabler/icons-react"
import {
  useClosedData, type ClosedInfluencer, type ClosedColumn,
  type PaidCollabData, type CollabDeliverable,
} from "@/hooks/useClosedData"
import { SubscriptionGate } from "@/components/ui/subscription-gate"

// ─── Constants ────────────────────────────────────────────────────────────────
const NICHES    = ["Beauty","Fitness","Lifestyle","Food","Tech","Fashion","Travel"]
const LOCATIONS = ["Philippines","Singapore","United States","Australia","United Kingdom","Malaysia","Indonesia","Thailand","Vietnam"]

const COLUMNS: { key: ClosedColumn; title: string; color: string; description: string; move?: string; terminal?: boolean }[] = [
  {
    key:   "For Order Creation",
    title: "For Order Creation",
    color: "bg-[#1FAE5B]",
    description: "Order has not been placed yet. The influencer's deal is agreed and shipping address is confirmed — ready for fulfilment.",
    move: "Move to In-Transit once the order has been shipped.",
  },
  {
    key:   "In-Transit",
    title: "In-Transit",
    color: "bg-yellow-500",
    description: "Order shipped and tracking number obtained. Waiting for the product to arrive at the influencer's address.",
    move: "Move to Delivered once the influencer confirms receipt.",
  },
  {
    key:   "Delivered",
    title: "Delivered",
    color: "bg-cyan-500",
    description: "Product delivered. The influencer has the product and content creation is underway.",
    move: "Move to Posted once the content goes live.",
  },
  {
    key:      "Posted",
    title:    "Posted",
    color:    "bg-[#0F6B3E]",
    description: "Content is live. Track engagement metrics, download content, and log the post link.",
    terminal: true,
  },
  {
    key:      "No post",
    title:    "No post",
    color:    "bg-red-400",
    description: "No content was published. Product was sent but the influencer did not post. Flag for follow-up or mark as a loss.",
    terminal: true,
  },
]

// Forward flow
const NEXT_STAGE: Record<ClosedColumn, ClosedColumn | null> = {
  "For Order Creation": "In-Transit",
  "In-Transit":         "Delivered",
  "Delivered":          "Posted",
  "Posted":             null,
  "No post":            null,
}

const CAMPAIGN_TYPES = [
  { value: "gifting",        label: "Gifting",          color: "bg-purple-100 text-purple-700"   },
  { value: "paid",           label: "Paid",             color: "bg-emerald-100 text-emerald-700" },
  { value: "affiliate",      label: "Affiliate",        color: "bg-blue-100 text-blue-700"       },
  { value: "paid_gifting",   label: "Paid + Gifting",   color: "bg-teal-100 text-teal-700"       },
  { value: "paid_affiliate", label: "Paid + Affiliate", color: "bg-indigo-100 text-indigo-700"   },
]

const STATUS_CLASS: Record<string, string> = {
  pending:            "bg-gray-100 text-gray-500 border-gray-200",
  submitted:          "bg-blue-50 text-blue-700 border-blue-200",
  revision_requested: "bg-amber-50 text-amber-700 border-amber-300",
  approved:           "bg-green-50 text-green-700 border-green-300",
  not_started:        "bg-gray-100 text-gray-400 border-gray-200",
  draft:              "bg-gray-100 text-gray-500 border-gray-200",
  sent:               "bg-blue-50 text-blue-700 border-blue-200",
  signed:             "bg-green-50 text-green-700 border-green-300",
  live:               "bg-green-50 text-green-700 border-green-300",
  paid:               "bg-green-50 text-green-700 border-green-300",
  due:                "bg-amber-50 text-amber-700 border-amber-300",
  unpaid:             "bg-red-50 text-red-700 border-red-200",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isPaidType(type: string | null) {
  return type === "paid" || type === "paid_gifting" || type === "paid_affiliate"
}
function defaultPaidCollab(agreedRate: number | null): PaidCollabData {
  return { contractEnabled: false, contractStatus: "not_started", contractLink: "", scriptEnabled: true, postStatus: "pending", deliverables: [], agreedRate: agreedRate ?? 0, payStructure: "5050", milestoneStatuses: ["due","due"], milestoneProofLinks: [] }
}
function getAvatarColor(name: string) {
  const colors = ["bg-pink-500","bg-purple-500","bg-indigo-500","bg-blue-500","bg-cyan-500","bg-teal-500","bg-green-500","bg-yellow-500","bg-orange-500","bg-red-500","bg-rose-500"]
  return colors[name.charCodeAt(0) % colors.length]
}
function CampaignBadge({ type }: { type: string | null }) {
  const found = CAMPAIGN_TYPES.find(t => t.value === type)
  if (!found) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Gifting</span>
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${found.color}`}>{found.label}</span>
}
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${on?"bg-[#1FAE5B]":"bg-gray-300"}`}
      onClick={e=>{e.stopPropagation();onToggle()}}>
      <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${on?"translate-x-4":""}`}/>
    </div>
  )
}

// ─── Column Info Tooltip — identical pattern to pipeline ──────────────────────
function ColumnInfoTooltip({ colKey, variant }: { colKey: ClosedColumn; variant: "dark" | "light" }) {
  const col = COLUMNS.find(c => c.key === colKey)
  if (!col) return null

  const borderColor = variant === "dark" ? "border-white/60" : "border-red-400/60"
  const textColor   = variant === "dark" ? "text-white"      : "text-red-700"

  return (
    <div className="relative group/info flex-shrink-0">
      <span
        className={`text-[10px] font-medium border ${borderColor} ${textColor} rounded-full w-4 h-4 flex items-center justify-center opacity-70 cursor-default select-none hover:opacity-100 transition-opacity`}
      >
        i
      </span>
      <div className="absolute top-full right-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-700 leading-relaxed z-[60] hidden group-hover/info:block shadow-lg pointer-events-none">
        <p className="font-semibold text-gray-900 mb-1 text-[11px]">{col.title}</p>
        <p className="text-gray-600">{col.description}</p>
        {col.move && (
          <p className="mt-1.5 text-gray-400 border-t border-gray-100 pt-1.5">
            <span className="font-medium text-gray-500">Next → </span>{col.move}
          </p>
        )}
        {col.terminal && (
          <p className="mt-1.5 text-[10px] font-medium text-red-500 border-t border-gray-100 pt-1.5 uppercase tracking-wide">
            Terminal — cannot be moved
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Post Tracker Card — consistent with pipeline card ────────────────────────
function PostTrackerCard({ inf, onOpen, onMove }: {
  inf: ClosedInfluencer
  onOpen: (inf: ClosedInfluencer) => void
  onMove: (id: string, col: ClosedColumn) => void
}) {
  const nextStage  = NEXT_STAGE[inf.closedStatus]
  const isExit     = inf.closedStatus === "No post"
  const isTerminal = inf.closedStatus === "Posted" || isExit

  return (
    <div className={`bg-white border rounded-lg p-3 hover:shadow-md transition-shadow ${
      isExit ? "border-red-100 bg-red-50/30" : "border-gray-200"
    }`}>
      {/* Clickable body — same layout as pipeline card */}
      <div className="cursor-pointer" onClick={() => onOpen(inf)}>
        {/* Name + handle */}
        <div className="flex flex-col text-sm mb-2">
          <span className="font-medium text-gray-900">{inf.influencer}</span>
          <span className="text-xs text-gray-500">@{inf.handle}</span>
        </div>

        {/* Platform + location */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
          <span>{inf.platform || "Instagram"}</span>
          <span>•</span>
          <span className="flex items-center gap-0.5">
            <IconLocation size={11} />{inf.location || "—"}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{inf.followers} followers</span>
          <span>{inf.engagementRate || "—"}% eng</span>
        </div>

        {/* Campaign badge */}
        <div className="mt-2">
          <CampaignBadge type={inf.campaignType} />
        </div>

        {/* Status pills */}
        {inf.closedStatus === "Delivered" && !inf.postedAt && (
          <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 rounded-full px-2.5 py-1 inline-block font-medium">
            ⚠️ Awaiting content
          </div>
        )}
        {inf.closedStatus === "Posted" && inf.postUrl && (
          <div className="mt-2 text-[10px] text-green-600 bg-green-50 rounded-full px-2.5 py-1 inline-flex items-center gap-1 font-medium">
            <IconLink size={10}/> Content live
          </div>
        )}
        {isExit && (
          <div className="mt-2 text-[10px] text-red-500 bg-red-50 rounded-full px-2.5 py-1 inline-block font-medium">
            ✕ No content published
          </div>
        )}
      </div>

      {/* Stage action buttons — same pattern as pipeline cards */}
      {!isTerminal && (
        <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100 flex-wrap">
          {nextStage && (
            <button
              onClick={e => { e.stopPropagation(); onMove(inf.id, nextStage) }}
              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition flex items-center gap-1"
            >
              <IconArrowRight size={11}/> {nextStage}
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onMove(inf.id, "No post") }}
            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition"
          >
            ✕ No post
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Droppable / Draggable ────────────────────────────────────────────────────
function DroppableColumn({ id, children, isExit }: { id: string; children: React.ReactNode; isExit?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef}
      className={`flex flex-col gap-3 transition-all rounded-lg ${
        isOver ? (isExit ? "bg-red-50" : "bg-gray-50") : ""
      }`}>
      {children}
    </div>
  )
}
function DraggableCard({ id, children, onClick }: { id: string; children: React.ReactNode; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
  return (
    <div ref={setNodeRef} style={style}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
      onClick={onClick} {...listeners} {...attributes}>
      {children}
    </div>
  )
}

// ─── Step Card (Paid Collab) ──────────────────────────────────────────────────
function StepCard({ title, optional, expanded, onToggle, done, badge, rightExtra, children }: {
  title: string; optional?: boolean; expanded: boolean; onToggle?: () => void
  done: boolean; badge?: React.ReactNode; rightExtra?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${done ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-white"}`}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50 transition" onClick={onToggle}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`}>
          {done ? <IconCheck size={12}/> : <span className="text-[10px]">●</span>}
        </div>
        <div className="flex-1">
          <span className="text-[13px] font-semibold text-gray-700">{title}</span>
          {optional && <span className="text-[11px] text-gray-400 font-normal ml-1.5">optional</span>}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>{badge}{rightExtra}</div>
        {expanded ? <IconChevronUp size={14} className="text-gray-400 flex-shrink-0"/> : <IconChevronDown size={14} className="text-gray-400 flex-shrink-0"/>}
      </button>
      {expanded && <div className="border-t border-gray-100 p-4 bg-gray-50/30">{children}</div>}
    </div>
  )
}

// ─── Paid Collab Panel ────────────────────────────────────────────────────────
function PaidCollabPanel({ data, onChange }: { data: PaidCollabData; onChange: (d: PaidCollabData) => void }) {
  const [scriptNotes,  setScriptNotes]  = useState<Record<number,string>>({})
  const [contentNotes, setContentNotes] = useState<Record<number,string>>({})
  const [setupOpen,    setSetupOpen]    = useState(true)
  const [expandedStep, setExpandedStep] = useState<string|null>("script")
  const [toastMsg,     setToastMsg]     = useState("")

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(()=>setToastMsg(""),2600) }
  const upd  = (patch: Partial<PaidCollabData>) => onChange({...data,...patch})
  const updD = (id: number, patch: Partial<CollabDeliverable>) => upd({deliverables:data.deliverables.map(d=>d.id===id?{...d,...patch}:d)})
  const toggleStep = (key: string) => setExpandedStep(p=>p===key?null:key)

  const addDeliverable    = () => { const id=Date.now(); upd({deliverables:[...data.deliverables,{id,name:"",scriptStatus:"pending",scriptLink:"",scriptRevs:[],contentStatus:"pending",contentLink:"",contentRevs:[]}]}) }
  const removeDeliverable = (id: number) => upd({deliverables:data.deliverables.filter(d=>d.id!==id)})
  const approveScript  = (id: number) => { updD(id,{scriptStatus:"approved"}); toast("Script approved ✓") }
  const approveContent = (id: number) => { updD(id,{contentStatus:"approved"}); toast("Content approved ✓") }
  const sendScriptRev  = (id: number) => { const notes=scriptNotes[id]?.trim(); if(!notes){toast("Add revision notes first");return}; const d=data.deliverables.find(x=>x.id===id)!; const num=d.scriptRevs.length+1; const date=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); updD(id,{scriptRevs:[...d.scriptRevs,{num,date,notes}],scriptStatus:"revision_requested"}); setScriptNotes(p=>({...p,[id]:""})); toast(`Revision #${num} sent`) }
  const sendContentRev = (id: number) => { const notes=contentNotes[id]?.trim(); if(!notes){toast("Add revision notes first");return}; const d=data.deliverables.find(x=>x.id===id)!; const num=d.contentRevs.length+1; const date=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); updD(id,{contentRevs:[...d.contentRevs,{num,date,notes}],contentStatus:"revision_requested"}); setContentNotes(p=>({...p,[id]:""})); toast(`Revision #${num} sent`) }

  const steps: boolean[] = []
  if (data.contractEnabled) steps.push(data.contractStatus==="signed")
  if (data.scriptEnabled)   steps.push(data.deliverables.length>0 && data.deliverables.every(d=>d.scriptStatus==="approved"))
  steps.push(data.deliverables.length>0 && data.deliverables.every(d=>d.contentStatus==="approved"))
  steps.push(data.postStatus==="live")
  const doneCnt = steps.filter(Boolean).length
  const pct = steps.length>0 ? Math.round(doneCnt/steps.length*100) : 0
  const r = data.agreedRate
  const milestoneAmounts: number[] = data.payStructure==="upfront"?[r]:data.payStructure==="5050"?[r/2,r/2]:data.payStructure==="after"?[r]:[Math.round(r*0.4),Math.round(r*0.4),r-Math.round(r*0.4)*2]
  const milestoneLabels: string[] = data.payStructure==="upfront"?["100% upfront — before shoot"]:data.payStructure==="5050"?["50% upfront — before shoot","50% — after post goes live"]:data.payStructure==="after"?["100% — after all deliverables"]:["Payment 1 — upfront","Payment 2 — after content approved","Payment 3 — after post goes live"]
  const paidTotal      = (data.milestoneStatuses||[]).reduce((acc,s,i)=>s==="paid"?acc+(milestoneAmounts[i]||0):acc,0)
  const scriptAllDone  = data.deliverables.length>0 && data.deliverables.every(d=>d.scriptStatus==="approved")
  const contentAllDone = data.deliverables.length>0 && data.deliverables.every(d=>d.contentStatus==="approved")

  return (
    <div className="flex flex-col gap-0 text-sm">
      <div className="mb-5">
        <div className="flex justify-between mb-1.5"><span className="text-[11px] font-medium text-gray-600">Collaboration progress</span><span className="text-[11px] font-semibold text-[#1FAE5B]">{pct}%</span></div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-2 bg-[#1FAE5B] rounded-full transition-all duration-500" style={{width:`${pct}%`}}/></div>
        <p className="text-[10px] text-gray-400 mt-1.5">{doneCnt} of {steps.length} steps complete</p>
      </div>

      <div className="border border-gray-200 rounded-xl bg-white mb-3 overflow-hidden">
        <button onClick={()=>setSetupOpen(p=>!p)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50">
          <div className="flex-1"><p className="text-[12px] font-semibold text-gray-700 flex items-center gap-2"><IconFileText size={14} className="text-gray-400"/>Step 1 — Define deliverables</p><p className="text-[11px] text-gray-400 mt-0.5">{data.deliverables.length===0?"No deliverables added yet":`${data.deliverables.length} deliverable(s) configured`}</p></div>
          <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}><label className="text-[11px] text-gray-500">Count</label><select className="text-[12px] py-1 px-2 rounded-lg border border-gray-200 bg-white outline-none" value={data.deliverables.length} onChange={e=>{const n=parseInt(e.target.value);let arr=[...data.deliverables];if(n>arr.length){while(arr.length<n)arr.push({id:Date.now()+arr.length,name:"",scriptStatus:"pending",scriptLink:"",scriptRevs:[],contentStatus:"pending",contentLink:"",contentRevs:[]})}else{arr=arr.slice(0,n)};upd({deliverables:arr})}}>{[0,1,2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n===0?"Select…":n}</option>)}</select></div>
          {setupOpen?<IconChevronUp size={16} className="text-gray-400 flex-shrink-0"/>:<IconChevronDown size={16} className="text-gray-400 flex-shrink-0"/>}
        </button>
        {setupOpen&&<div className="px-4 pb-3 pt-2 flex flex-col gap-2 border-t border-gray-100">{data.deliverables.map((d,i)=><div key={d.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2"><span className="text-[11px] font-semibold text-gray-400 min-w-[20px]">{i+1}</span><input className="flex-1 text-[12px] text-gray-700 border-none outline-none bg-transparent placeholder-gray-300" value={d.name} placeholder="e.g. 1x IG Reel, 3x Stories…" onChange={e=>updD(d.id,{name:e.target.value})}/><button onClick={()=>removeDeliverable(d.id)} className="text-[11px] px-2 py-0.5 rounded border border-red-200 bg-white text-red-600 hover:bg-red-50 transition">✕</button></div>)}<button onClick={addDeliverable} className="flex items-center justify-center gap-2 text-[12px] px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-white text-gray-500 hover:border-[#1FAE5B] hover:text-[#1FAE5B] transition w-full"><IconPlus size={12}/> Add deliverable</button></div>}
      </div>

      <div className="flex flex-col gap-2 mb-5">
        <StepCard title="Contract" optional expanded={expandedStep==="contract"} onToggle={()=>toggleStep("contract")} done={data.contractEnabled&&data.contractStatus==="signed"}
          badge={data.contractEnabled?<span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_CLASS[data.contractStatus]||STATUS_CLASS.pending}`}>{data.contractStatus.replace("_"," ")}</span>:<span className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-gray-100 text-gray-400 border-gray-200">Off</span>}
          rightExtra={<Toggle on={data.contractEnabled} onToggle={()=>upd({contractEnabled:!data.contractEnabled})}/>}>
          {!data.contractEnabled?<p className="text-[12px] text-gray-400">Toggle on to add a contract.</p>:<div className="flex flex-col gap-3"><div className="flex gap-2"><input className="flex-1 text-[12px] px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:border-[#1FAE5B]" placeholder="Paste contract link…" value={data.contractLink} onChange={e=>upd({contractLink:e.target.value})}/>{data.contractLink&&<a href={data.contractLink} target="_blank" rel="noopener noreferrer" className="text-[12px] px-3 py-2 rounded-lg bg-[#1FAE5B] text-white font-medium">Open</a>}</div>{data.contractLink&&<select className={`text-[11px] px-3 py-1.5 rounded-lg border font-medium outline-none w-fit ${STATUS_CLASS[data.contractStatus]||STATUS_CLASS.not_started}`} value={data.contractStatus} onChange={e=>upd({contractStatus:e.target.value})}><option value="not_started">Not started</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="signed">Signed</option></select>}</div>}
        </StepCard>

        <StepCard title="Script review" optional expanded={expandedStep==="script"} onToggle={()=>toggleStep("script")} done={data.scriptEnabled&&scriptAllDone}
          badge={!data.scriptEnabled?<span className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-gray-100 text-gray-400 border-gray-200">Off</span>:<span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${scriptAllDone?STATUS_CLASS.approved:STATUS_CLASS.submitted}`}>{data.deliverables.length===0?"—":scriptAllDone?"All approved":`${data.deliverables.filter(d=>d.scriptStatus==="approved").length}/${data.deliverables.length} approved`}</span>}
          rightExtra={<Toggle on={data.scriptEnabled} onToggle={()=>upd({scriptEnabled:!data.scriptEnabled})}/>}>
          {!data.scriptEnabled?<p className="text-[12px] text-gray-400">Toggle on to enable script review.</p>:data.deliverables.length===0?<p className="text-[12px] text-gray-400">Add deliverables first.</p>:<div className="flex flex-col gap-3">{data.deliverables.map((d,i)=>{const done=d.scriptStatus==="approved";return(<div key={d.id} className={`border rounded-lg overflow-hidden ${done?"border-green-200 bg-green-50/40":"border-gray-200 bg-white"}`}><div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50"><span className="text-[12px] font-semibold text-gray-700">{i+1}. {d.name||`Deliverable ${i+1}`}</span><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[d.scriptStatus]||STATUS_CLASS.pending}`}>{d.scriptStatus.replace("_"," ")}</span></div><div className="p-3 flex flex-col gap-2"><div className="flex gap-2"><input className="flex-1 text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-[#1FAE5B]" placeholder="Paste script link…" value={d.scriptLink} onChange={e=>updD(d.id,{scriptLink:e.target.value})}/>{d.scriptLink&&<a href={d.scriptLink} target="_blank" rel="noopener noreferrer" className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#1FAE5B] text-white font-medium">View</a>}</div>{d.scriptRevs.map(r=><div key={r.num} className="bg-amber-50 border border-amber-200 rounded-lg p-2"><p className="text-[10px] text-gray-500 font-medium">Revision #{r.num} · {r.date}</p><p className="text-[11px] text-gray-600 mt-0.5">{r.notes}</p></div>)}{!done&&d.scriptLink&&<><textarea className="w-full text-[12px] px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-amber-400 resize-none min-h-[60px] font-sans" placeholder="Revision notes…" value={scriptNotes[d.id]||""} onChange={e=>setScriptNotes(p=>({...p,[d.id]:e.target.value}))}/><div className="flex gap-2 flex-wrap"><button onClick={()=>sendScriptRev(d.id)} className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition flex items-center gap-1"><IconSend size={12}/> Request revision</button><button onClick={()=>approveScript(d.id)} className="text-[11px] px-3 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition flex items-center gap-1"><IconCheck size={12}/> Approve script</button></div></>}</div></div>)})}</div>}
        </StepCard>

        <StepCard title="Content review" expanded={expandedStep==="content"} onToggle={()=>toggleStep("content")} done={contentAllDone}
          badge={<span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${contentAllDone?STATUS_CLASS.approved:STATUS_CLASS.submitted}`}>{data.deliverables.length===0?"—":contentAllDone?"All approved":`${data.deliverables.filter(d=>d.contentStatus==="approved").length}/${data.deliverables.length} approved`}</span>}>
          {data.deliverables.length===0?<p className="text-[12px] text-gray-400">Add deliverables first.</p>:<div className="flex flex-col gap-3">{data.deliverables.map((d,i)=>{const scriptOk=!data.scriptEnabled||d.scriptStatus==="approved";const done=d.contentStatus==="approved";const locked=!scriptOk;return(<div key={d.id} className={`border rounded-lg overflow-hidden ${done?"border-green-200 bg-green-50/40":"border-gray-200 bg-white"} ${locked?"opacity-60":""}`}><div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50"><span className="text-[12px] font-semibold text-gray-700">{i+1}. {d.name||`Deliverable ${i+1}`}</span><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[d.contentStatus]||STATUS_CLASS.pending}`}>{d.contentStatus.replace("_"," ")}</span></div><div className={`p-3 flex flex-col gap-2 ${locked?"pointer-events-none":""}`}>{locked&&<p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg">⚠️ Approve the script first</p>}<div className="flex gap-2"><input className="flex-1 text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-[#1FAE5B]" placeholder="Paste content link…" value={d.contentLink} onChange={e=>updD(d.id,{contentLink:e.target.value})}/>{d.contentLink&&<a href={d.contentLink} target="_blank" rel="noopener noreferrer" className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#1FAE5B] text-white font-medium">View</a>}</div>{d.contentRevs.map(r=><div key={r.num} className="bg-amber-50 border border-amber-200 rounded-lg p-2"><p className="text-[10px] text-gray-500 font-medium">Revision #{r.num} · {r.date}</p><p className="text-[11px] text-gray-600 mt-0.5">{r.notes}</p></div>)}{!done&&!locked&&d.contentLink&&<><textarea className="w-full text-[12px] px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-amber-400 resize-none min-h-[60px] font-sans" placeholder="Revision notes…" value={contentNotes[d.id]||""} onChange={e=>setContentNotes(p=>({...p,[d.id]:e.target.value}))}/><div className="flex gap-2 flex-wrap"><button onClick={()=>sendContentRev(d.id)} className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition flex items-center gap-1"><IconSend size={12}/> Request revision</button><button onClick={()=>approveContent(d.id)} className="text-[11px] px-3 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition flex items-center gap-1"><IconCheck size={12}/> Approve content</button></div></>}</div></div>)})}</div>}
        </StepCard>

        <StepCard title="Live post links" expanded={expandedStep==="post"} onToggle={()=>toggleStep("post")} done={data.postStatus==="live"}
          badge={<select className={`text-[11px] px-2 py-0.5 rounded-full border font-medium outline-none ${STATUS_CLASS[data.postStatus]||STATUS_CLASS.pending}`} value={data.postStatus} onClick={e=>e.stopPropagation()} onChange={e=>upd({postStatus:e.target.value})}><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="live">All live</option></select>}>
          {data.deliverables.length===0?<p className="text-[12px] text-gray-400">Add deliverables first.</p>:<div className="flex flex-col gap-3">{data.deliverables.map((d,i)=><div key={d.id} className="border border-gray-200 rounded-lg p-3 bg-white"><p className="text-[11px] font-semibold text-gray-600 mb-2">{i+1}. {d.name||`Deliverable ${i+1}`}</p><div className="flex gap-2 mb-2"><input className="flex-1 text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-[#1FAE5B]" placeholder="Paste live post URL…"/><button className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#1FAE5B] text-white font-medium">Preview</button></div><div className="flex items-center gap-2"><label className="text-[11px] text-gray-400">Date posted</label><input type="date" className="text-[12px] px-2 py-1 rounded-lg border border-gray-200 outline-none"/></div></div>)}</div>}
        </StepCard>
      </div>

      {/* Payment */}
      <div className="border-t border-gray-100 pt-4 mt-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><IconCurrencyDollar size={12}/> Payment</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex flex-col gap-1"><label className="text-[11px] text-gray-500">Agreed rate ($)</label><input type="number" className="text-[13px] font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-[#1FAE5B]" value={data.agreedRate} onChange={e=>upd({agreedRate:parseFloat(e.target.value)||0})}/></div>
          <div className="flex flex-col gap-1"><label className="text-[11px] text-gray-500">Payment structure</label><select className="text-[12px] px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none" value={data.payStructure} onChange={e=>upd({payStructure:e.target.value as PaidCollabData["payStructure"],milestoneStatuses:["due","due","due"]})}><option value="upfront">100% upfront</option><option value="5050">50% / 50%</option><option value="after">After all deliverables</option><option value="custom">Custom milestones</option></select></div>
        </div>
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200"><span className="text-[12px] font-semibold text-gray-700">Payment milestones</span><span className="text-[11px] text-gray-500">Total: <strong>${r.toLocaleString()}</strong></span></div>
          {milestoneLabels.map((label,idx)=>{const st=(data.milestoneStatuses||[])[idx]||"due";const proof=(data.milestoneProofLinks||[])[idx]||"";return(<div key={idx} className="border-b border-gray-100 last:border-0"><div className="flex items-center gap-3 px-4 py-3 flex-wrap"><div className={`w-2 h-2 rounded-full flex-shrink-0 ${st==="paid"?"bg-[#1FAE5B]":st==="due"?"bg-amber-400":"bg-gray-300"}`}/><div className="flex-1 text-[12px] text-gray-600 min-w-[140px]">{label}</div><span className="text-[13px] font-semibold text-gray-800">${(milestoneAmounts[idx]||0).toLocaleString()}</span><select className={`text-[11px] px-2 py-1 rounded-lg border font-medium outline-none ${STATUS_CLASS[st]||STATUS_CLASS.pending}`} value={st} onChange={e=>{if(e.target.value==="paid"&&!proof){toast("Attach proof of payment first");return};const ms=[...(data.milestoneStatuses||[])];ms[idx]=e.target.value;upd({milestoneStatuses:ms})}}><option value="unpaid">Unpaid</option><option value="due">Due</option><option value="paid">Paid</option></select></div><div className="px-4 pb-3 flex flex-col gap-1.5"><label className="text-[10px] text-gray-400 font-medium">Proof of payment</label><input className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-[#1FAE5B] w-full" placeholder="Paste link…" value={proof} onChange={e=>{const pl=[...(data.milestoneProofLinks||[])];pl[idx]=e.target.value;upd({milestoneProofLinks:pl})}}/></div></div>)})}
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-green-50 border border-green-200 rounded-xl"><span className="text-[12px] text-gray-600">Total paid to creator</span><span className="text-[15px] font-bold text-[#1FAE5B]">${paidTotal.toLocaleString()} of ${r.toLocaleString()}</span></div>
      </div>
      {toastMsg&&<div className="fixed bottom-6 right-6 bg-gray-900 text-white text-[13px] px-4 py-2.5 rounded-xl shadow-lg z-[600]">{toastMsg}</div>}
    </div>
  )
}

// ─── Profile Drawer ───────────────────────────────────────────────────────────
function ProfileDrawer({ inf, onClose, onColumnChange, onPaidCollabSave, onCampaignTypeChange }: {
  inf: ClosedInfluencer; onClose: () => void
  onColumnChange: (id: string, col: ClosedColumn) => Promise<boolean>
  onPaidCollabSave: (id: string, d: PaidCollabData) => Promise<boolean>
  onCampaignTypeChange: (id: string, type: string) => Promise<boolean>
}) {
  const [tab, setTab]           = useState(0)
  const [saving, setSaving]     = useState(false)
  const [drawerToast, setDT]    = useState("")
  const showToast = (msg: string) => { setDT(msg); setTimeout(()=>setDT(""),2600) }
  const campaignType = inf.campaignType ?? "gifting"
  const isPaid = isPaidType(campaignType)
  const [paidCollab, setPaidCollab] = useState<PaidCollabData>(inf.paidCollabData ?? defaultPaidCollab(inf.agreedRate))
  const tabs = ["Overview","Order","Content","Analytics",...(isPaid?["💰 Paid Collab"]:[])]

  const handleSave = async () => {
    setSaving(true)
    try { if(isPaid) await onPaidCollabSave(inf.id,paidCollab); showToast("Changes saved ✓") }
    catch { showToast("Error saving changes") }
    finally { setSaving(false) }
  }

  const stageOrder: ClosedColumn[] = ["For Order Creation","In-Transit","Delivered","Posted"]
  const currentIdx = stageOrder.indexOf(inf.closedStatus)

  return (
    <>
      <div className="fixed inset-0 z-[400]" onClick={onClose}/>
      <div className="fixed top-0 right-0 w-[560px] max-w-full h-full bg-white shadow-2xl z-[500] flex flex-col font-sans overflow-hidden animate-in slide-in-from-right duration-300">
        <div className="px-6 pt-5 pb-0 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {inf.profileImageUrl?<img src={inf.profileImageUrl} alt={inf.influencer} className="w-12 h-12 rounded-full object-cover ring-2 ring-green-100"/>:<div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1FAE5B] to-[#0F6B3E] flex items-center justify-center text-white font-bold text-lg ring-2 ring-green-100">{inf.influencer.charAt(0).toUpperCase()}</div>}
              <div><p className="text-[16px] font-bold text-gray-900">{inf.influencer}</p><p className="text-[12px] text-gray-400">@{inf.handle}</p></div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition"><IconX size={16}/></button>
          </div>
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Post Tracker Stage</p>
            {inf.closedStatus === "No post" ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"/>
                <span className="text-[12px] font-semibold text-red-600">No post — exited</span>
                <button onClick={async()=>{const ok=await onColumnChange(inf.id,"For Order Creation");if(ok)showToast("Moved back to For Order Creation")}} className="ml-auto text-[11px] px-2 py-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">↩ Restore</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {stageOrder.map((stage, idx) => {
                  const isActive = stage === inf.closedStatus
                  const isPast   = idx < currentIdx
                  const colData  = COLUMNS.find(c => c.key === stage)!
                  return (
                    <div key={stage} className="flex items-center flex-1">
                      <button
                        onClick={async () => { if (isActive) return; const ok = await onColumnChange(inf.id, stage); if (ok) showToast(`Moved to ${stage}`) }}
                        className={`flex-1 text-center py-1.5 px-1 rounded-lg text-[10px] font-semibold transition-all border ${
                          isActive ? `${colData.color} text-white border-transparent shadow-sm` :
                          isPast   ? "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200" :
                                     "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100"
                        }`}
                      >
                        {stage === "For Order Creation" ? "Order" : stage}
                      </button>
                      {idx < stageOrder.length - 1 && (
                        <IconArrowRight size={10} className={`mx-0.5 flex-shrink-0 ${isPast||isActive?"text-gray-400":"text-gray-200"}`}/>
                      )}
                    </div>
                  )
                })}
                <button onClick={async()=>{const ok=await onColumnChange(inf.id,"No post");if(ok)showToast("Marked as No post")}}
                  className="ml-2 text-[10px] px-2 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition font-semibold flex-shrink-0">
                  ✕ No post
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <CampaignBadge type={campaignType}/>
            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{inf.platform}</span>
            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{inf.niche}</span>
            <select className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-600 font-medium outline-none cursor-pointer ml-auto"
              value={campaignType} onChange={async e=>{await onCampaignTypeChange(inf.id,e.target.value);if(!isPaidType(e.target.value)&&tab===4)setTab(0);showToast("Campaign type updated")}}>
              {CAMPAIGN_TYPES.map(ct=><option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {tabs.map((t,idx)=><button key={idx} onClick={()=>setTab(idx)} className={`text-[12px] font-semibold px-4 py-2.5 whitespace-nowrap border-b-2 transition-colors ${tab===idx?"text-[#1FAE5B] border-[#1FAE5B]":"text-gray-400 border-transparent hover:text-gray-600"}`}>{t}</button>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 bg-gray-50/30">
          {tab===0&&<div className="flex flex-col gap-4"><div className="grid grid-cols-4 gap-2 bg-white rounded-xl p-4 border border-gray-100 shadow-sm">{[{label:"Followers",val:inf.followers,color:"text-gray-900"},{label:"Eng Rate",val:inf.engagementRate||"—",color:"text-blue-600"},{label:"Platform",val:inf.platform||"Instagram",color:"text-gray-900"},{label:"Rate",val:inf.agreedRate?`$${inf.agreedRate.toLocaleString()}`:"—",color:"text-[#1FAE5B]"}].map(s=><div key={s.label} className="text-center"><p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</p><p className={`text-[14px] font-bold mt-1 ${s.color}`}>{s.val}</p></div>)}</div><div className="grid grid-cols-2 gap-3">{[{label:"Niche",val:inf.niche||"—"},{label:"Location",val:inf.location||"—"},{label:"Email",val:inf.email||"—"},{label:"Campaign",val:inf.campaignName||"—"}].map(f=><div key={f.label} className="bg-white rounded-lg p-3 border border-gray-100"><span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{f.label}</span><p className="text-[13px] font-medium text-gray-700 mt-1">{f.val}</p></div>)}</div>{inf.notes&&<div className="bg-white rounded-lg p-3 border border-gray-100"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p><p className="text-[12px] text-gray-600">{inf.notes}</p></div>}</div>}
          {tab===1&&<div className="flex flex-col gap-4"><div className="bg-white rounded-xl p-4 border border-gray-100"><p className="text-[11px] font-semibold text-gray-700 mb-3 flex items-center gap-2"><IconFileText size={14} className="text-gray-400"/>Order Details</p><div className="space-y-3">{[{label:"Order Status",val:inf.orderStatus||"Not placed"},{label:"Shipped At",val:inf.shippedAt?new Date(inf.shippedAt).toLocaleDateString():"—"},{label:"Delivered At",val:inf.deliveredAt?new Date(inf.deliveredAt).toLocaleDateString():"—"},{label:"Tracking #",val:inf.trackingNumber||"—"}].map(f=><div key={f.label} className="flex justify-between items-center py-1 border-b border-gray-50"><span className="text-[11px] text-gray-500">{f.label}</span><span className="text-[12px] font-medium text-gray-700">{f.val}</span></div>)}</div></div></div>}
          {tab===2&&<div className="bg-white rounded-xl p-4 border border-gray-100"><p className="text-[11px] font-semibold text-gray-700 mb-3 flex items-center gap-2"><IconPhoto size={14} className="text-gray-400"/>Content Status</p><div className="space-y-3"><div className="flex justify-between items-center py-2 border-b border-gray-50"><span className="text-[11px] text-gray-500">Script</span><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${inf.scriptStatus==="approved"?"bg-green-100 text-green-700":"bg-amber-100 text-amber-700"}`}>{inf.scriptStatus||"Not started"}</span></div><div className="flex justify-between items-center py-2 border-b border-gray-50"><span className="text-[11px] text-gray-500">Content</span><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${inf.contentStatus==="approved"?"bg-green-100 text-green-700":"bg-amber-100 text-amber-700"}`}>{inf.contentStatus||"Not started"}</span></div>{inf.postUrl&&<div className="mt-2"><p className="text-[10px] text-gray-400 mb-1">Live post</p><a href={inf.postUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#1FAE5B] font-medium break-all hover:underline">{inf.postUrl}</a></div>}</div></div>}
          {tab===3&&<div className="grid grid-cols-2 gap-3">{[{label:"Followers",val:inf.followers},{label:"Engagement Rate",val:inf.engagementRate||"—"},{label:"Agreed Rate",val:inf.agreedRate?`$${inf.agreedRate.toLocaleString()}`:"—"},{label:"Likes",val:inf.likesCount?.toLocaleString()||"—"},{label:"Comments",val:inf.commentsCount?.toLocaleString()||"—"},{label:"Internal Rating",val:inf.internalRating?`${inf.internalRating}/5`:"—"}].map(f=><div key={f.label} className="bg-white rounded-lg p-3 border border-gray-100"><p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{f.label}</p><p className="text-[14px] font-bold text-gray-800 mt-1">{f.val}</p></div>)}</div>}
          {tab===4&&isPaid&&<PaidCollabPanel data={paidCollab} onChange={setPaidCollab}/>}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 bg-white flex justify-end gap-2 sticky bottom-0">
          <button onClick={onClose} className="text-[13px] px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="text-[13px] font-semibold px-4 py-2 rounded-lg bg-[#1FAE5B] text-white hover:bg-[#0f6b3e] transition disabled:opacity-60 flex items-center gap-2">{saving&&<IconLoader2 size={14} className="animate-spin"/>}Save Changes</button>
        </div>
        {drawerToast&&<div className="absolute bottom-20 right-5 bg-gray-900 text-white text-[13px] px-4 py-2 rounded-xl shadow-lg z-[600]">{drawerToast}</div>}
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClosedPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><IconLoader2 size={32} className="animate-spin text-[#1FAE5B]"/></div>}>
      <PostTrackerContent />
    </Suspense>
  )
}

function PostTrackerContent() {
  const session = useSession()
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId") ?? undefined
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("inactive")

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const response = await fetch("/api/subscription/status")
        const data = await response.json()
        setSubscriptionStatus(data.status || "inactive")
        setIsSubscribed((data.status === "active" || data.status === "trialing") && !data.isExpired)
      } catch (error) {
        console.error("Failed to check subscription:", error)
        setSubscriptionStatus("inactive")
        setIsSubscribed(false)
      }
    }

    if (session.status === "authenticated") {
      checkSubscription()
    }
  }, [session.status])

  const { data, isLoading, error, updateColumn, updatePaidCollab, updateCampaignType, refetch } = useClosedData(brandId)

  const [view,                 setView]                 = useState<"Board"|"list">("Board")
  const [search,               setSearch]               = useState("")
  const [activeId,             setActiveId]             = useState<string|null>(null)
  const [selectedInf,          setSelectedInf]          = useState<ClosedInfluencer|null>(null)
  const [toastMsg,             setToastMsg]             = useState<string|null>(null)
  const [showFilterPanel,      setShowFilterPanel]      = useState(false)
  const [filters,              setFilters]              = useState({influencer:"",handle:"",location:"all",niche:"all"})
  const [selectedColumnStatus, setSelectedColumnStatus] = useState<ClosedColumn|null>(null)
  const [sortOrder,            setSortOrder]            = useState<"newest"|"oldest">("newest")

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(()=>setToastMsg(null),3000) }
  const sensors   = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:5}}))

  const handleMove = useCallback(async (id: string, col: ClosedColumn) => {
    const inf = data.find(d=>d.id===id)
    const ok  = await updateColumn(id, col)
    if (ok) {
      showToast(`${inf?.influencer} moved to ${col}`)
      setSelectedInf(p => p?.id===id ? {...p, closedStatus: col} : p)
    } else {
      showToast("Failed to move")
    }
    return ok
  }, [data, updateColumn])

  let filteredData = data.filter(inf =>
    inf.influencer.toLowerCase().includes(search.toLowerCase()) ||
    inf.handle.toLowerCase().includes(search.toLowerCase())
  )
  if (selectedColumnStatus)     filteredData = filteredData.filter(inf=>inf.closedStatus===selectedColumnStatus)
  if (filters.influencer)       filteredData = filteredData.filter(inf=>inf.influencer.toLowerCase().includes(filters.influencer.toLowerCase()))
  if (filters.handle)           filteredData = filteredData.filter(inf=>inf.handle.toLowerCase().includes(filters.handle.toLowerCase()))
  if (filters.location!=="all") filteredData = filteredData.filter(inf=>inf.location===filters.location)
  if (filters.niche!=="all")    filteredData = filteredData.filter(inf=>inf.niche===filters.niche)
  filteredData = [...filteredData].sort((a,b)=>{
    const da = new Date(a.createdAt ?? 0).getTime()
    const db = new Date(b.createdAt ?? 0).getTime()
    return sortOrder === "newest" ? db - da : da - db
  })

  const hasActiveFilters   = filters.influencer!==""||filters.handle!==""||filters.location!=="all"||filters.niche!=="all"||search!==""||selectedColumnStatus!==null
  const activeInf          = activeId ? data.find(d=>d.id===activeId) : null
  const selectedColumnInfo = selectedColumnStatus ? COLUMNS.find(col=>col.key===selectedColumnStatus) : null
  const getItemsByColumn   = (columnKey: ClosedColumn) => filteredData.filter(item=>item.closedStatus===columnKey)

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string)
  const handleDragEnd   = async (event: DragEndEvent) => {
    const {active,over} = event
    setActiveId(null)
    if (!over) return
    const id     = active.id as string
    const newCol = over.id as ClosedColumn
    const inf    = data.find(d=>d.id===id)
    if (!inf||inf.closedStatus===newCol) return
    await handleMove(id, newCol)
  }

  const handleCampaignTypeChange = useCallback(async (id: string, type: string): Promise<boolean> => {
    const ok = await updateCampaignType(id, type)
    if (ok) { setSelectedInf(p=>p?.id===id?{...p,campaignType:type}:p); showToast("Campaign type updated") }
    else showToast("Failed to update campaign type")
    return ok
  }, [updateCampaignType])

  const handleColumnClick = (column: typeof COLUMNS[0]) => {
    setSelectedColumnStatus(column.key)
    setView("list")
    showToast(`Showing "${column.title}"`)
  }
  const clearColumnFilter = () => { setSelectedColumnStatus(null); showToast("Showing all influencers") }

  if (!brandId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-5 max-w-sm w-full px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            <svg
              className="w-7 h-7 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold text-gray-900">No brand selected</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Choose a brand from the dropdown above to view and manage your post tracker.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><IconLoader2 size={32} className="animate-spin text-[#1FAE5B]"/></div>
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-3"><p className="text-red-500 text-sm">{error}</p><button onClick={refetch} className="text-[13px] px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">Retry</button></div>

  return (
    <SubscriptionGate isSubscribed={isSubscribed} status={subscriptionStatus} featureName="Post Tracker">
      <div className="flex flex-col gap-4 p-6">
      {toastMsg&&<div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2">{toastMsg}</div>}

      {selectedInf&&(
        <ProfileDrawer inf={selectedInf} onClose={()=>setSelectedInf(null)}
          onColumnChange={handleMove} onPaidCollabSave={updatePaidCollab} onCampaignTypeChange={handleCampaignTypeChange}/>
      )}

      {/* ── Single inline toolbar row — matches Manage Influencers layout ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search influencer..."
            className="w-full pl-9 pr-3 h-9 border border-[#0F6B3E]/20 rounded-lg outline-none focus:ring-2 focus:ring-[#1FAE5B] text-sm"/>
        </div>

        {/* Filters */}
        <div className="relative">
          <button onClick={()=>setShowFilterPanel(!showFilterPanel)}
            className={`h-9 px-3 rounded-lg text-sm flex items-center gap-1.5 border transition-colors ${hasActiveFilters?"bg-[#1FAE5B] text-white border-[#1FAE5B]":"border-[#0F6B3E]/20 hover:border-[#0F6B3E]/40"}`}>
            <IconFilter size={15}/> Filters
          </button>
          {showFilterPanel&&(
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-30 w-[340px] p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">Filter by</span>
                {hasActiveFilters&&<button className="text-xs text-gray-400 hover:text-red-500 transition flex items-center gap-1" onClick={()=>setFilters({influencer:"",handle:"",location:"all",niche:"all"})}><IconX size={12}/> Clear all</button>}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Influencer</label><input type="text" value={filters.influencer} onChange={e=>setFilters(p=>({...p,influencer:e.target.value}))} placeholder="Search by name..." className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]"/></div>
                <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Handle</label><input type="text" value={filters.handle} onChange={e=>setFilters(p=>({...p,handle:e.target.value}))} placeholder="@username..." className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]"/></div>
                <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Location</label><select value={filters.location} onChange={e=>setFilters(p=>({...p,location:e.target.value}))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] appearance-none cursor-pointer"><option value="all">All Locations</option>{LOCATIONS.map(l=><option key={l}>{l}</option>)}</select></div>
                <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Niche</label><select value={filters.niche} onChange={e=>setFilters(p=>({...p,niche:e.target.value}))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] appearance-none cursor-pointer"><option value="all">All Niches</option>{NICHES.map(n=><option key={n}>{n}</option>)}</select></div>
              </div>
              {/* Sort inside filter panel */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="text-xs text-gray-500 block mb-2">Sort by date</label>
                <div className="flex gap-2">
                  <button onClick={()=>setSortOrder("newest")}
                    className={`flex-1 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5 border font-medium transition-colors ${sortOrder==="newest"?"bg-[#1FAE5B] text-white border-[#1FAE5B]":"border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <IconChevronDown size={14}/> Newest
                  </button>
                  <button onClick={()=>setSortOrder("oldest")}
                    className={`flex-1 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5 border font-medium transition-colors ${sortOrder==="oldest"?"bg-[#1FAE5B] text-white border-[#1FAE5B]":"border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <IconChevronUp size={14}/> Oldest
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end mt-4">
                <button className="px-5 py-1.5 bg-[#1FAE5B] text-white rounded-lg text-sm font-medium hover:bg-[#178a48] transition" onClick={()=>setShowFilterPanel(false)}>Apply</button>
              </div>
            </div>
          )}
        </div>
        {/* Count */}
        <span className="text-sm text-gray-500 whitespace-nowrap ml-1">
          {filteredData.length} of {data.length} influencer{data.length!==1?"s":""}
        </span>

        {/* Spacer */}
        <div className="flex-1"/>

        {/* View toggle */}
{/* View toggle */}
<div className="inline-flex h-9 items-center rounded-lg border border-[#0F6B3E]/20 bg-white p-1">
  <button
    onClick={() => {
      setView("Board")
      setSelectedColumnStatus(null)
    }}
    className={`h-7 px-3 rounded-md text-sm flex items-center gap-1.5 transition-all ${
      view === "Board"
        ? "bg-[#1FAE5B] text-white shadow-sm"
        : "text-gray-600 hover:bg-gray-50 hover:text-[#0F6B3E]"
    }`}
  >
    <IconLayoutKanban size={15} />
    {/* Board */}
  </button>

  <button
    onClick={() => {
      setView("list")
      setSelectedColumnStatus(null)
    }}
    className={`h-7 px-3 rounded-md text-sm flex items-center gap-1.5 transition-all ${
      view === "list"
        ? "bg-[#1FAE5B] text-white shadow-sm"
        : "text-gray-600 hover:bg-gray-50 hover:text-[#0F6B3E]"
    }`}
  >
    <IconList size={15} />
    {/* List */}
  </button>
</div>
      </div>

      {/* ── KANBAN ── */}
      {view==="Board"&&(
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="rounded-xl border border-[#0F6B3E]/10 bg-white p-5 overflow-x-auto">
            <div className="flex gap-4 min-w-max">

              {/* Main columns */}
              {COLUMNS.filter(c=>c.key!=="No post").map(col => {
                const items = getItemsByColumn(col.key)
                return (
                  <div key={col.key} className="w-[240px] flex-shrink-0">
                    <DroppableColumn id={col.key}>
                      {/* ── Column header — identical structure to pipeline ── */}
                      <div className={`${col.color} text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-between`}>
                        <span
                          onClick={() => handleColumnClick(col)}
                          className="flex-1 cursor-pointer hover:opacity-90 transition-opacity truncate mr-2"
                        >
                          {col.title}
                        </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <ColumnInfoTooltip colKey={col.key} variant="dark" />
                        <span className="bg-white/20 text-white rounded-full px-2 py-0.5 text-xs">{items.length}</span>
                      </div>
                      </div>
                      {/* No description text here — it's in the tooltip */}
                      <div className="flex flex-col gap-2 min-h-[400px] mt-2">
                        {items.length===0?(
                          <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">Drop here</div>
                        ):items.map(inf=>(
                          <DraggableCard key={inf.id} id={inf.id} onClick={()=>setSelectedInf(inf)}>
                            <PostTrackerCard inf={inf} onOpen={setSelectedInf} onMove={handleMove}/>
                          </DraggableCard>
                        ))}
                      </div>
                    </DroppableColumn>
                  </div>
                )
              })}

              {/* Exit separator */}
              <div className="flex flex-col items-center justify-center px-2 flex-shrink-0">
                <div className="h-16 w-px bg-gray-200"/>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest py-2">exit</span>
                <div className="h-16 w-px bg-gray-200"/>
              </div>

              {/* No post — exit column, consistent with pipeline NI column */}
              {(()=>{
                const col   = COLUMNS.find(c=>c.key==="No post")!
                const items = getItemsByColumn(col.key)
                return (
                  <div className="w-[240px] flex-shrink-0">
                    <DroppableColumn id={col.key} isExit>
                      {/* Soft red style matching pipeline NI header */}
                      <div className="bg-red-100 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-between">
                        <span
                          onClick={() => handleColumnClick(col)}
                          className="flex-1 cursor-pointer hover:opacity-90 transition-opacity truncate mr-2"
                        >
                          {col.title}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <ColumnInfoTooltip colKey={col.key} variant="light" />
                          <span className="bg-red-200 text-red-700 rounded-full px-2 py-0.5 text-xs">{items.length}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 min-h-[400px] mt-2">
                        {items.length===0?(
                          <div className="border-2 border-dashed border-red-200 rounded-lg p-4 text-center text-xs text-gray-400">Drop here</div>
                        ):items.map(inf=>(
                          <DraggableCard key={inf.id} id={inf.id} onClick={()=>setSelectedInf(inf)}>
                            <PostTrackerCard inf={inf} onOpen={setSelectedInf} onMove={handleMove}/>
                          </DraggableCard>
                        ))}
                      </div>
                    </DroppableColumn>
                  </div>
                )
              })()}
            </div>
          </div>
          <DragOverlay>
            {activeInf&&(
              <div className="bg-white border border-[#1FAE5B] rounded-lg p-3 shadow-lg rotate-1 w-[220px] ring-2 ring-[#1FAE5B]/20">
                <div className="font-medium text-sm text-gray-900">{activeInf.influencer}</div>
                <div className="text-xs text-gray-500 mt-0.5">@{activeInf.handle}</div>
                <div className="text-[11px] text-gray-400 mt-1">{activeInf.platform} · {activeInf.followers}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── LIST ── */}
      {view==="list"&&(
        <div className="bg-white border rounded-xl overflow-hidden">
          {selectedColumnStatus&&selectedColumnInfo&&(
            <div className={`${selectedColumnInfo.color} px-4 py-3 text-white flex items-center justify-between`}>
              <div className="flex items-center gap-2"><IconLayoutList size={20}/><span className="font-semibold">{selectedColumnInfo.title}</span><span className="text-sm bg-white/20 px-2 py-1 rounded">{filteredData.length} influencers</span></div>
              <button onClick={clearColumnFilter} className="text-white hover:bg-white/20 px-2 py-1 rounded transition flex items-center gap-1"><IconX size={16}/> Clear filter</button>
            </div>
          )}
          <div style={{overflowX:"auto"}}>
            <table className="w-full text-sm" style={{borderCollapse:"collapse"}}>
              <thead className="bg-gray-50 border-b">
                <tr>{["Influencer","Platform","Handle","Location","Followers","Engagement","Niche","Type","Stage"].map(h=><th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredData.length===0?(
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No influencers found</td></tr>
                ):filteredData.map(inf=>(
                  <tr key={inf.id} className="border-t hover:bg-gray-50 cursor-pointer transition" onClick={()=>setSelectedInf(inf)}>
                    <td className="px-4 py-3"><div className="flex items-center gap-3">{inf.profileImageUrl?<img src={inf.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"/>:<div className={`w-8 h-8 rounded-full flex-shrink-0 ${getAvatarColor(inf.influencer)} bg-opacity-20 flex items-center justify-center text-[#0F6B3E] font-semibold text-xs`}>{inf.influencer.charAt(0).toUpperCase()}</div>}<span className="font-medium">{inf.influencer}</span></div></td>
                    <td className="px-4 py-3">{inf.platform||"Instagram"}</td>
                    <td className="px-4 py-3 text-[#0F6B3E] font-medium">@{inf.handle}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1"><IconLocation size={14} className="text-gray-400"/>{inf.location||"—"}</div></td>
                    <td className="px-4 py-3">{inf.followers}</td>
                    <td className="px-4 py-3">{inf.engagementRate||"—"}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">{inf.niche||"—"}</span></td>
                    <td className="px-4 py-3"><CampaignBadge type={inf.campaignType}/></td>
                    <td className="px-4 py-3"><div onClick={e=>e.stopPropagation()}><select className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 font-medium outline-none cursor-pointer" value={inf.closedStatus} onChange={async e=>{await handleMove(inf.id,e.target.value as ClosedColumn)}}>{COLUMNS.map(c=><option key={c.key} value={c.key}>{c.title}</option>)}</select></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </SubscriptionGate>
  )
}
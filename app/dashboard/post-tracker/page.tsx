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
  IconSearch, IconX, IconChevronDown, IconChevronUp,
  IconLoader2, IconLayoutKanban, IconList, IconFilter, IconLocation,
  IconLayoutList, IconLink, IconArrowRight,
} from "@tabler/icons-react"
import { useClosedData, type ClosedInfluencer, type ClosedColumn } from "@/hooks/useClosedData"
import { SubscriptionGate } from "@/components/ui/subscription-gate"
import { HistoryTab } from "@/components/InfluencerProfileSidebar"

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
  { value: "gifting",        label: "Gifting",          color: "bg-purple-100 text-purple-700",   implied: "Product sent, no payment, no commission" },
  { value: "paid",           label: "Paid",             color: "bg-emerald-100 text-emerald-700", implied: "Product sent + flat fee" },
  { value: "affiliate",      label: "Affiliate",        color: "bg-blue-100 text-blue-700",       implied: "Product sent + commission link" },
  { value: "paid_gifting",   label: "Paid + Gifting",   color: "bg-teal-100 text-teal-700",       implied: "Product sent + flat fee, brand owns content" },
  { value: "paid_affiliate", label: "Paid + Affiliate", color: "bg-indigo-100 text-indigo-700",   implied: "Product sent + flat fee + commission" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getAvatarColor(name: string) {
  const colors = ["bg-pink-500","bg-purple-500","bg-indigo-500","bg-blue-500","bg-cyan-500","bg-teal-500","bg-green-500","bg-yellow-500","bg-orange-500","bg-red-500","bg-rose-500"]
  return colors[name.charCodeAt(0) % colors.length]
}
function CampaignBadge({ type }: { type: string | null }) {
  const found = CAMPAIGN_TYPES.find(t => t.value === type)
  if (!found) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Gifting</span>
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${found.color}`}>{found.label}</span>
}
function fmtMoney(v: number | null | undefined) {
  return v ? "$" + Math.round(v).toLocaleString() : "—"
}
function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString() : "—"
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

// ─── Profile Drawer — structure mirrors Pipeline's InfluencerProfileSidebar ──
// Tabs: Basic, Order, Post, Stats, History (same names/order/behavior as Pipeline).
const STAGE_OPTIONS: ClosedColumn[] = ["For Order Creation", "In-Transit", "Delivered", "Posted", "No post"]
const PROFILE_TABS = ["Basic", "Order", "Post", "Stats", "History"]

function ProfileDrawer({ inf, brandId, onClose, onColumnChange, onCampaignTypeChange }: {
  inf: ClosedInfluencer; brandId?: string; onClose: () => void
  onColumnChange: (id: string, col: ClosedColumn) => Promise<boolean>
  onCampaignTypeChange: (id: string, type: string) => Promise<boolean>
}) {
  const [profileTab, setProfileTab] = useState(0)
  const [drawerToast, setDT]        = useState("")
  const showToast = (msg: string) => { setDT(msg); setTimeout(()=>setDT(""),2600) }

  const campaignType = inf.campaignType ?? "gifting"
  const selectedCampaignMeta = CAMPAIGN_TYPES.find(c => c.value === campaignType)

  const [orderData, setOrderData] = useState({
    orderStatus: inf.orderStatus || "", productDetails: inf.productDetails || "",
    trackingNumber: inf.trackingNumber || "", shippedAt: inf.shippedAt ? inf.shippedAt.slice(0,10) : "",
    deliveredAt: inf.deliveredAt ? inf.deliveredAt.slice(0,10) : "", deadline: inf.deadline ? inf.deadline.slice(0,10) : "",
    deliverables: inf.deliverables || "", currency: inf.currency || "USD",
  })
  const [postData, setPostData] = useState({
    postUrl: inf.postUrl || "", postedAt: inf.postedAt ? inf.postedAt.slice(0,10) : "",
    likes: inf.likesCount ? String(inf.likesCount) : "", comments: inf.commentsCount ? String(inf.commentsCount) : "",
    engagement: inf.engagementCount ? String(inf.engagementCount) : "",
    scriptStatus: inf.scriptStatus || "", contentStatus: inf.contentStatus || "",
    internalRating: inf.internalRating ? String(inf.internalRating) : "",
  })

  const handleStageChange = async (newStage: ClosedColumn) => {
    const ok = await onColumnChange(inf.id, newStage)
    if (ok) showToast(`Moved to ${newStage}`)
  }
  const handleCampaignTypeChange = async (newType: string) => {
    const ok = await onCampaignTypeChange(inf.id, newType)
    if (ok) showToast("Campaign type updated")
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 400, cursor: "pointer" }} />

      <div className="pp">
        {/* ── Header ── */}
        <div className="pph">
          <div className="ppt">Influencer Profile</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            {inf.profileImageUrl ? (
              <img src={inf.profileImageUrl} alt={inf.influencer} className="pav" style={{ objectFit: "cover" }} />
            ) : (
              <div className="pav">{inf.influencer.charAt(0).toUpperCase()}</div>
            )}
            <div style={{ flex: 1 }}>
              <div className="pnm">{inf.influencer}</div>
              <div className="phd">@{inf.handle}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Stage</span>
                <select
                  className="ssel"
                  value={inf.closedStatus}
                  onChange={(e) => handleStageChange(e.target.value as ClosedColumn)}
                  style={{
                    borderColor: inf.closedStatus === "No post" ? "#fca5a5" : undefined,
                    background:  inf.closedStatus === "No post" ? "#fef2f2" : undefined,
                    color:       inf.closedStatus === "No post" ? "#dc2626" : undefined,
                  }}
                >
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s} value={s} style={s === "No post" ? { color: "#dc2626", fontWeight: 600 } : undefined}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Campaign Type</span>
                <select className="csel" value={campaignType} onChange={(e) => handleCampaignTypeChange(e.target.value)}>
                  {CAMPAIGN_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>

              <button onClick={onClose} title="Close" className="close-btn">✕</button>
            </div>
          </div>

          {selectedCampaignMeta && (
            <div className="collab-implied">
              <span className="collab-implied-type">{selectedCampaignMeta.label}</span>
              <span className="collab-implied-sep">·</span>
              <span className="collab-implied-text">{selectedCampaignMeta.implied}</span>
            </div>
          )}

          {inf.closedStatus === "No post" && (
            <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 11, color: "#dc2626", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>✕</span> No content published
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="atag plat">{inf.platform || "Instagram"}</button>
            <button className="atag">Send Email</button>
            <button className="atag">Send DM</button>
            <button className="atag">Follow up</button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="pit-bar">
          {PROFILE_TABS.map((tab, idx) => (
            <div key={idx} className={`pit ${profileTab === idx ? "active" : ""}`} onClick={() => setProfileTab(idx)}>
              {tab}
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="ppb">

          {/* ════ BASIC TAB ════ */}
          {profileTab === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="sr4">
                <div className="sbox"><div className="slb">Followers</div><div className="svl">{inf.followers}</div></div>
                <div className="sbox"><div className="slb">Eng Rate</div><div className="svl" style={{ color: "#2c8ec4" }}>{inf.engagementRate || "—"}</div></div>
                <div className="sbox"><div className="slb">Rate</div><div className="svl" style={{ color: "#1fae5b" }}>{fmtMoney(inf.agreedRate)}</div></div>
                <div className="sbox"><div className="slb">Rating</div><div className="svl">{inf.internalRating ? `${inf.internalRating}/5` : "—"}</div></div>
              </div>
              <div>
                <div className="section-label">Avg Metrics</div>
                <div className="avg-row">
                  <div className="avg-card"><div className="avg-val">{inf.likesCount?.toLocaleString() ?? "—"}</div><div className="avg-lbl">Likes</div></div>
                  <div className="avg-card"><div className="avg-val">{inf.commentsCount?.toLocaleString() ?? "—"}</div><div className="avg-lbl">Comments</div></div>
                  <div className="avg-card"><div className="avg-val">{inf.engagementCount?.toLocaleString() ?? "—"}</div><div className="avg-lbl">Engagement</div></div>
                </div>
              </div>
              <div className="fgrd">
                <div className="frow"><div className="flbl">Location</div><div className="fval">{inf.location || "—"}</div></div>
                <div className="frow"><div className="flbl">Niche</div><div className="fval">{inf.niche || "—"}</div></div>
                <div className="frow"><div className="flbl">Platform</div><div className="fval">{inf.platform || "—"}</div></div>
                <div className="frow"><div className="flbl">Email</div><div className="fval">{inf.email || "—"}</div></div>
                <div className="frow"><div className="flbl">Order Status</div><div className="fval">{inf.orderStatus || "—"}</div></div>
                <div className="frow"><div className="flbl">Stage</div><div className="fval">{inf.closedStatus}</div></div>
                <div className="frow"><div className="flbl">Campaign</div><div className="fval">{inf.campaignName || "—"}</div></div>
                <div className="frow"><div className="flbl">Contact Status</div><div className="fval">{inf.contactStatus || "—"}</div></div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>Notes</div>
                <textarea className="pfi" style={{ minHeight: 80, resize: "vertical" }} placeholder="Add notes..." defaultValue={inf.notes || ""} />
              </div>
            </div>
          )}

          {/* ════ ORDER TAB ════ */}
          {profileTab === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="pfg">
                <div className="pfl">Order Status</div>
                <select className="pfi" value={orderData.orderStatus} onChange={e => setOrderData(d => ({ ...d, orderStatus: e.target.value }))}>
                  <option value="">Select...</option><option value="pending">Pending</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option>
                </select>
              </div>
              <div className="pfg"><div className="pfl">Product Details</div><input className="pfi" value={orderData.productDetails} onChange={e => setOrderData(d => ({ ...d, productDetails: e.target.value }))} placeholder="Product Details" /></div>
              <div className="pfg"><div className="pfl">Tracking Number</div><input className="pfi" value={orderData.trackingNumber} onChange={e => setOrderData(d => ({ ...d, trackingNumber: e.target.value }))} placeholder="Tracking Number" /></div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Shipped At</div><input type="date" className="pfi" value={orderData.shippedAt} onChange={e => setOrderData(d => ({ ...d, shippedAt: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Delivered At</div><input type="date" className="pfi" value={orderData.deliveredAt} onChange={e => setOrderData(d => ({ ...d, deliveredAt: e.target.value }))} /></div>
              </div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Deadline</div><input type="date" className="pfi" value={orderData.deadline} onChange={e => setOrderData(d => ({ ...d, deadline: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Currency</div><input className="pfi" value={orderData.currency} onChange={e => setOrderData(d => ({ ...d, currency: e.target.value }))} /></div>
              </div>
              <div className="pfg"><div className="pfl">Deliverables</div><input className="pfi" value={orderData.deliverables} onChange={e => setOrderData(d => ({ ...d, deliverables: e.target.value }))} placeholder="Deliverables" /></div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn-primary">Save</button></div>
            </div>
          )}

          {/* ════ POST TAB ════ */}
          {profileTab === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="pfg"><div className="pfl">Post URL</div><input className="pfi" value={postData.postUrl} onChange={e => setPostData(d => ({ ...d, postUrl: e.target.value }))} placeholder="Post URL" /></div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Posted At</div><input type="date" className="pfi" value={postData.postedAt} onChange={e => setPostData(d => ({ ...d, postedAt: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Internal Rating</div>
                  <select className="pfi" value={postData.internalRating} onChange={e => setPostData(d => ({ ...d, internalRating: e.target.value }))}>
                    <option value="">Select...</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Likes</div><input className="pfi" value={postData.likes} onChange={e => setPostData(d => ({ ...d, likes: e.target.value }))} /></div>
                <div className="pfg"><div className="pfl">Comments</div><input className="pfi" value={postData.comments} onChange={e => setPostData(d => ({ ...d, comments: e.target.value }))} /></div>
              </div>
              <div className="pfg"><div className="pfl">Engagement</div><input className="pfi" value={postData.engagement} onChange={e => setPostData(d => ({ ...d, engagement: e.target.value }))} /></div>
              <div className="pfr">
                <div className="pfg"><div className="pfl">Script Status</div>
                  <select className="pfi" value={postData.scriptStatus} onChange={e => setPostData(d => ({ ...d, scriptStatus: e.target.value }))}>
                    <option value="">Select...</option><option value="pending">Pending</option><option value="revision_requested">Revision Requested</option><option value="approved">Approved</option>
                  </select>
                </div>
                <div className="pfg"><div className="pfl">Content Status</div>
                  <select className="pfi" value={postData.contentStatus} onChange={e => setPostData(d => ({ ...d, contentStatus: e.target.value }))}>
                    <option value="">Select...</option><option value="pending">Pending</option><option value="revision_requested">Revision Requested</option><option value="approved">Approved</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn-primary">Save</button></div>
            </div>
          )}

          {/* ════ STATS TAB ════ */}
          {profileTab === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div className="stit">Engagement &amp; Performance</div>
              <div className="skg">
                <div className="skc"><div className="skv-dark">{inf.followers}</div><div className="skl">Followers</div></div>
                <div className="skc"><div className="skv-blue">{inf.engagementRate || "—"}</div><div className="skl">Eng. rate</div></div>
                <div className="skc"><div className="skv-dark">{inf.likesCount?.toLocaleString() ?? "—"}</div><div className="skl">Likes</div></div>
                <div className="skc"><div className="skv-dark">{inf.commentsCount?.toLocaleString() ?? "—"}</div><div className="skl">Comments</div></div>
                <div className="skc"><div className="skv-dark">{inf.engagementCount?.toLocaleString() ?? "—"}</div><div className="skl">Total engagement</div></div>
                <div className="skc"><div className="skv-green">{fmtMoney(inf.agreedRate)}</div><div className="skl">Rate</div></div>
              </div>
              <div className="stit">Timeline</div>
              <div className="skg">
                <div className="skc"><div className="skv-dark">{fmtDate(inf.shippedAt)}</div><div className="skl">Shipped</div></div>
                <div className="skc"><div className="skv-dark">{fmtDate(inf.deliveredAt)}</div><div className="skl">Delivered</div></div>
                <div className="skc"><div className="skv-dark">{fmtDate(inf.postedAt)}</div><div className="skl">Posted</div></div>
              </div>
            </div>
          )}

          {/* ════ HISTORY TAB ════ */}
          {profileTab === 4 && (
            <HistoryTab brandId={brandId} biId={inf.id} />
          )}

        </div>

        {drawerToast && <div className="drawer-toast">{drawerToast}</div>}

        <style jsx>{`
          .pp { position:fixed; top:0; right:0; width:520px; max-width:100vw; height:100%; background:#fff; box-shadow:-8px 0 40px rgba(0,0,0,0.14); z-index:500; display:flex; flex-direction:column; font-family:"Inter",system-ui,sans-serif; }
          .pph { padding:16px 20px; border-bottom:1px solid #f0f0f0; }
          .ppt { font-size:11px; font-weight:600; color:#9ca3af; letter-spacing:.1em; text-transform:uppercase; margin-bottom:12px; }
          .pav { width:44px; height:44px; border-radius:50%; background:#1fae5b; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; color:#fff; flex-shrink:0; box-shadow:0 0 0 3px #dcfce7; }
          .pnm { font-size:15px; font-weight:700; color:#111827; }
          .phd { font-size:12px; color:#6b7280; margin-top:2px; }
          .ssel { font-size:11px; padding:5px 10px; border-radius:8px; border:.5px solid #f4b740; background:#fffbeb; color:#854f0b; cursor:pointer; font-family:inherit; font-weight:500; transition:all .15s; }
          .csel { font-size:11px; padding:5px 10px; border-radius:8px; border:1px solid #e5e7eb; background:#f9fafb; color:#374151; cursor:pointer; font-family:inherit; font-weight:600; transition:all .15s; min-width:130px; }
          .collab-implied { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:20px; border:1px solid #e5e7eb; background:#f9fafb; color:#374151; font-size:11px; margin-bottom:6px; flex-wrap:wrap; }
          .collab-implied-type { font-weight:700; font-size:11px; }
          .collab-implied-sep { opacity:.4; font-size:11px; }
          .collab-implied-text { font-size:11px; opacity:.75; }
          .close-btn { width:30px; height:30px; border-radius:50%; border:1.5px solid #e5e7eb; background:#f9fafb; color:#374151; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; flex-shrink:0; line-height:1; margin-top:14px; transition:background .15s,border-color .15s,color .15s; }
          .close-btn:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
          .atag { font-size:12px; font-weight:500; padding:6px 14px; border-radius:20px; cursor:pointer; border:1px solid #e5e7eb; background:#f9fafb; color:#555; }
          .atag.plat { background:#1fae5b; color:#fff; border-color:#1fae5b; }
          .pit-bar { display:flex; gap:0; padding:0 20px; border-bottom:1px solid #f0f0f0; overflow-x:auto; }
          .pit { font-size:12px; font-weight:600; padding:11px 14px; cursor:pointer; color:#9ca3af; border-bottom:2px solid transparent; white-space:nowrap; transition:color .15s; flex-shrink:0; }
          .pit.active { color:#1fae5b; border-bottom-color:#1fae5b; }
          .ppb { flex:1; overflow-y:auto; padding:18px 20px; }
          .sr4 { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; background:linear-gradient(135deg,#f0fdf4 0%,#f9fafb 100%); border-radius:12px; padding:14px; margin-bottom:4px; border:1px solid #dcfce7; }
          .sbox { text-align:center; }
          .slb { font-size:9px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:.07em; }
          .svl { font-size:16px; font-weight:700; color:#111827; margin-top:3px; }
          .section-label { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; padding-top:12px; border-top:1px solid #f3f4f6; }
          .avg-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
          .avg-card { background:#fff; border:1.5px solid #e5e7eb; border-radius:10px; padding:12px 8px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,.05); }
          .avg-val { font-size:18px; font-weight:700; color:#111827; }
          .avg-lbl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.07em; margin-top:3px; }
          .fgrd { display:grid; grid-template-columns:1fr 1fr; }
          .frow { padding:8px 0; border-bottom:.5px solid rgba(0,0,0,.05); }
          .flbl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
          .fval { font-size:13px; color:#111827; font-weight:500; }
          .pfr { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
          .pfg { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
          .pfl { font-size:10px; font-weight:600; color:#6b7280; }
          .pfi { width:100%; font-size:12px; padding:8px 10px; border-radius:8px; border:1.5px solid #e5e7eb; background:#f9fafb; color:#111827; font-family:inherit; box-sizing:border-box; outline:none; transition:border-color .15s,background .15s; }
          .pfi:focus { border-color:#1fae5b; background:#fff; }
          .pfi::placeholder { color:#c4c4c4; }
          textarea.pfi { resize:vertical; min-height:70px; }
          .stit { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.08em; padding:12px 0 8px; border-bottom:1px solid #f3f4f6; margin-bottom:10px; }
          .skg { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
          .skc { background:#f9fafb; border-radius:10px; padding:10px 12px; text-align:center; border:1px solid #f3f4f6; }
          .skl { font-size:9px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; margin-top:3px; }
          .skv-green { font-size:16px; font-weight:700; color:#1fae5b; }
          .skv-dark  { font-size:16px; font-weight:700; color:#111827; }
          .skv-blue  { font-size:16px; font-weight:700; color:#2c8ec4; }
          .btn-primary { background:#1fae5b; color:#fff; border:none; padding:8px 18px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; font-family:inherit; transition:background .15s; }
          .btn-primary:hover { background:#0f6b3e; }
          .drawer-toast { position:absolute; bottom:20px; right:20px; background:#111827; color:#fff; font-size:13px; padding:8px 16px; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.2); z-index:600; }
        `}</style>
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

  const { data, isLoading, error, updateColumn, updateCampaignType, refetch } = useClosedData(brandId)

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
        <ProfileDrawer inf={selectedInf} brandId={brandId} onClose={()=>setSelectedInf(null)}
          onColumnChange={handleMove} onCampaignTypeChange={handleCampaignTypeChange}/>
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
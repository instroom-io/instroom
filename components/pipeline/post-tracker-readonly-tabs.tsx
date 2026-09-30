"use client"

import Link from "next/link"
import type { ClosedInfluencer } from "@/hooks/useClosedData"
import { getDeliverables, deliverablePostUrl } from "@/lib/deliverables"
import { PaidCollabTab } from "@/components/table-sheet/profile-sidebar"

// Read-only copies of Post Tracker's Order, Post and Paid collab tabs for the
// Pipeline drawer. Editing stays in Post Tracker; layout mirrors its drawer.

/** Same list as Post Tracker's page, which shows Paid collab details only for these. */
export const PAID_COLLAB_TYPES = new Set(["paid", "paid-affiliate", "ugc-paid", "tiktok-shop-paid"])

const STAGE_TO_ORDER_STATUS: Record<string, string> = {
  "For Order Creation": "Pending",
  "In-Transit": "Shipped",
  "Delivered": "Delivered",
  "Posted": "Delivered",
}
const STEP_LABEL: Record<string, string> = {
  n_a: "N/A", pending: "Pending", revision_requested: "Revision Requested", approved: "Approved",
}
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "")

function Shell({ brandId, children }: { brandId?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="ro-note">
        <span>View only. These details are managed in Post Tracker.</span>
        <Link href={brandId ? `/dashboard/post-tracker?brandId=${brandId}` : "/dashboard/post-tracker"}>Edit in Post Tracker →</Link>
      </div>
      <fieldset disabled className="ro-body">{children}</fieldset>
      <style jsx>{`
        .ro-note { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:11px; color:#6b7280; background:#f9fafb; border:1px solid #f3f4f6; border-radius:8px; padding:8px 10px; }
        .ro-note :global(a) { color:#0f6b3e; font-weight:600; white-space:nowrap; }
        .ro-body { border:0; margin:0; padding:0; min-width:0; filter:grayscale(1); opacity:.75; }
        .ro-body :global(.pfr) { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .ro-body :global(.pfg) { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
        .ro-body :global(.pfl) { font-size:10px; font-weight:600; color:#6b7280; }
        .ro-body :global(.pfi) { width:100%; font-size:12px; padding:8px 10px; border-radius:8px; border:1.5px solid #e5e7eb; background:#f3f4f6; color:#374151; font-family:inherit; box-sizing:border-box; cursor:not-allowed; }
      `}</style>
    </div>
  )
}

const Field = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="pfg"><div className="pfl">{label}</div><input className="pfi" value={value == null || value === "" ? "—" : String(value)} readOnly /></div>
)

export function ReadOnlyOrderTab({ inf, brandId }: { inf: ClosedInfluencer; brandId?: string }) {
  let productDetails = ""
  try { productDetails = (JSON.parse(inf.productDetails || "{}") as { note?: string }).note || "" } catch { productDetails = inf.productDetails || "" }
  return (
    <Shell brandId={brandId}>
      <Field label="Order Status" value={STAGE_TO_ORDER_STATUS[inf.closedStatus]} />
      <Field label="Product Details" value={productDetails} />
      <Field label="Tracking Number" value={inf.trackingNumber} />
      <div className="pfr">
        <Field label="Shipped At" value={day(inf.shippedAt)} />
        <Field label="Delivered At" value={day(inf.deliveredAt)} />
      </div>
      <div className="pfr">
        <Field label="Deadline" value={day(inf.deadline)} />
        <Field label="Currency" value={inf.currency || "USD"} />
      </div>
      <Field label="Deliverables" value={inf.deliverables} />
    </Shell>
  )
}

export function ReadOnlyPostTab({ inf, brandId }: { inf: ClosedInfluencer; brandId?: string }) {
  const deliverables = getDeliverables(inf.paidCollabData)
  return (
    <Shell brandId={brandId}>
      {deliverables.length > 0 ? (
        deliverables.map((d, i) => (
          <Field key={d.id ?? i} label={`${i + 1}. ${d.name || `Deliverable ${i + 1}`}`} value={deliverablePostUrl(d, i, inf.postUrl)} />
        ))
      ) : (
        <Field label="Post URL" value={inf.postUrl} />
      )}
      <div className="pfr">
        <Field label="Posted At" value={day(inf.postedAt)} />
        <Field label="Internal Rating" value={inf.internalRating} />
      </div>
      <div className="pfr">
        <Field label="Likes" value={inf.likesCount || ""} />
        <Field label="Comments" value={inf.commentsCount || ""} />
      </div>
      <Field label="Views" value={inf.viewsCount || ""} />
      <div className="pfr">
        <Field label="Script Status" value={STEP_LABEL[inf.scriptStatus ?? ""]} />
        <Field label="Content Status" value={STEP_LABEL[inf.contentStatus ?? ""]} />
      </div>
    </Shell>
  )
}

export function ReadOnlyPaidCollabTab({ inf, brandId }: { inf: ClosedInfluencer; brandId?: string }) {
  return (
    <Shell brandId={brandId}>
      <PaidCollabTab
        influencerName={inf.influencer}
        rateHint={inf.agreedRate ?? undefined}
        initialDeliverables={getDeliverables(inf.paidCollabData).map((d, i) => ({ ...d, postUrl: deliverablePostUrl(d, i, inf.postUrl) }))}
      />
    </Shell>
  )
}

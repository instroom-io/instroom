// Shared Post Tracker kanban status logic — used by both the manual
// drag-and-drop PATCH route (app/api/brand/[brandId]/closed/[brandInfluencerId]/route.ts)
// and the Shopify pull-sync path (lib/shopify-orders.ts), so a human move and
// an automated move always write identical field shapes.

export type ClosedColumn =
  | "For Order Creation"
  | "In-Transit"
  | "Delivered"
  | "Posted"
  | "No post"

// Ranks only cover the automated forward-progress states — "Posted" and
// "No post" are terminal/human-decided and are never targeted by sync.
export const SHOPIFY_STAGE_RANK: Record<"For Order Creation" | "In-Transit" | "Delivered", number> = {
  "For Order Creation": 0,
  "In-Transit": 1,
  "Delivered": 2,
}

// ✅ Strict mapping (no stale data)
export function mapClosedToPipelineFields(
  closedStatus: ClosedColumn,
  currentRecord: any
) {
  switch (closedStatus) {
    case "For Order Creation":
      return {
        contact_status: "for_order_creation",
        stage: 5,
        order_status: "pending",

        shipped_at: null,
        delivered_at: null,

        content_posted: false,
        posted_at: null,

        approval_status: "Approved",
        approval_notes: null,
      }

    case "In-Transit":
      return {
        contact_status: "for_order_creation",
        stage: 6,
        order_status: "shipped",

        shipped_at: currentRecord.shipped_at || new Date(),
        delivered_at: null,

        content_posted: false,
        posted_at: null,

        approval_status: "Approved",
      }

    case "Delivered":
      return {
        contact_status: "for_order_creation",
        stage: 7,
        order_status: "delivered",

        shipped_at: currentRecord.shipped_at || null,
        delivered_at: currentRecord.delivered_at || new Date(),

        content_posted: false,
        posted_at: null,

        approval_status: "Approved",
      }

    case "Posted":
      return {
        contact_status: "for_order_creation",
        stage: 8,
        order_status: "delivered",

        shipped_at: currentRecord.shipped_at || null,
        delivered_at: currentRecord.delivered_at || new Date(),

        content_posted: true,
        posted_at: currentRecord.posted_at || new Date(),

        approval_status: "Approved",
      }

    case "No post":
      return {
        contact_status: "not_interested",
        stage: 0,
        order_status: null,

        shipped_at: null,
        delivered_at: null,

        content_posted: false,
        posted_at: null,

        approval_status: "Declined",
        approval_notes: "No content published - exited",
      }

    default:
      throw new Error("Invalid closedStatus")
  }
}

type ShopifyFulfillment = {
  status?: string | null
  shipment_status?: string | null
}

type ShopifyOrderLike = {
  cancelled_at?: string | null
  fulfillments?: ShopifyFulfillment[] | null
}

// Reads a Shopify order's embedded fulfillments to decide how far along
// Post Tracker's kanban should move. Returns null when there's nothing to
// apply (e.g. cancelled/refunded, or no fulfillment progress yet).
export function deriveShopifyTargetStatus(
  order: ShopifyOrderLike
): "For Order Creation" | "In-Transit" | "Delivered" | null {
  if (order.cancelled_at) {
    return null
  }

  const fulfillments = order.fulfillments ?? []
  const hasSuccessfulFulfillment = fulfillments.some((f) => f?.status === "success")

  if (!hasSuccessfulFulfillment) {
    return "For Order Creation"
  }

  const isDelivered = fulfillments.some((f) => f?.shipment_status === "delivered")
  return isDelivered ? "Delivered" : "In-Transit"
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─── Pipeline status → contact_status + stage ────────────────────────────────
// The stage vocabulary is owned by two places and must agree with them exactly,
// or a row written here reads back as a different stage everywhere else:
//   app/api/brand/[brandId]/pipeline/[brandInfluencerId]  (pipeline columns 1-5)
//   lib/post-tracker-status.ts                            (post-tracker 5-8)
// This route previously wrote "Contacted" at stage 1, "Deal Agreed"/"For Order
// Creation" at stage 2 and "Posted" at stage 5, so those moves came back as
// "For Outreach", "Contacted" and "For Order Creation" respectively — a move
// that appeared to revert. "Not Interested" also lost its status entirely.
function pipelineStatusToFields(pipelineStatus: string): {
  contact_status: string
  stage: number
  order_status?: string
  content_posted?: boolean
  approval_status?: string
} {
  switch (pipelineStatus) {
    case "For Outreach":
      return { contact_status: "pending", stage: 1, approval_status: "Approved" }
    case "Contacted":
      return { contact_status: "contacted", stage: 2, approval_status: "Approved" }
    case "Replied":
    case "In-Progress":
    case "In Conversation":
      return { contact_status: "negotiating", stage: 3, approval_status: "Approved" }
    case "Deal Agreed":
      return { contact_status: "agreed", stage: 4, approval_status: "Approved" }
    case "Not Interested":
      return { contact_status: "not_interested", stage: 0, approval_status: "Declined" }
    case "For Order Creation":
      return { contact_status: "for_order_creation", stage: 5, order_status: "pending", approval_status: "Approved" }
    case "In-Transit":
      return { contact_status: "for_order_creation", stage: 6, order_status: "shipped", approval_status: "Approved" }
    case "Delivered":
      return { contact_status: "for_order_creation", stage: 7, order_status: "delivered", approval_status: "Approved" }
    case "Posted":
    case "Completed":
      return { contact_status: "for_order_creation", stage: 8, order_status: "delivered", content_posted: true, approval_status: "Approved" }
    default:
      return { contact_status: "pending", stage: 1, approval_status: "Approved" }
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; brandInfluencerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, brandInfluencerId } = await params

    // Verify brand access
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        OR: [
          { owner_id: session.user.id },
          { members: { some: { user_id: session.user.id } } },
        ],
      },
    })

    if (!brand) {
      return NextResponse.json({ error: "Brand not found or access denied" }, { status: 403 })
    }

    const body = await req.json()
    const { pipelineStatus } = body

    if (!pipelineStatus) {
      return NextResponse.json({ error: "pipelineStatus is required" }, { status: 400 })
    }

    // Map the kanban column label back to DB fields
    const fields = pipelineStatusToFields(pipelineStatus)

    const updated = await prisma.brandInfluencer.update({
      // Scoped to the brand in the URL — the access check above only proves
      // membership of that brand, not ownership of this row.
      where: { id: brandInfluencerId, brand_id: brandId },
      data: {
        contact_status: fields.contact_status,
        stage: fields.stage,
        ...(fields.approval_status !== undefined && { approval_status: fields.approval_status }),
        ...(fields.order_status !== undefined && { order_status: fields.order_status }),
        ...(fields.content_posted !== undefined && { content_posted: fields.content_posted }),
        ...(fields.content_posted === true && { posted_at: new Date() }),
        ...(fields.order_status === "shipped" && { shipped_at: new Date() }),
        ...(fields.order_status === "delivered" && { delivered_at: new Date() }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error("PATCH /api/brands/[brandId]/pipeline/[brandInfluencerId] error:", error)
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ─── Pipeline status → contact_status + stage ────────────────────────────────
// Reverse of the derivePipelineStatus logic in route.ts
function pipelineStatusToFields(pipelineStatus: string): {
  contact_status: string
  stage: number
  order_status?: string
  content_posted?: boolean
} {
  switch (pipelineStatus) {
    case "For Outreach":
      return { contact_status: "not_contacted", stage: 1 }
    case "Contacted":
      return { contact_status: "contacted", stage: 1 }
    case "Replied":
      return { contact_status: "interested", stage: 1 }
    case "In-Progress":
      return { contact_status: "interested", stage: 1 }
    case "Not Interested":
      return { contact_status: "not_contacted", stage: 1 }
    case "For Order Creation":
      return { contact_status: "agreed", stage: 2, order_status: "pending" }
    case "In-Transit":
      return { contact_status: "agreed", stage: 3, order_status: "shipped" }
    case "Delivered":
      return { contact_status: "agreed", stage: 4, order_status: "delivered" }
    case "Posted":
      return { contact_status: "agreed", stage: 5, content_posted: true }
    case "Completed":
      return { contact_status: "agreed", stage: 5, content_posted: true }
    default:
      return { contact_status: "not_contacted", stage: 1 }
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
      where: { id: brandInfluencerId },
      data: {
        contact_status: fields.contact_status,
        stage: fields.stage,
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
// app/api/brand/[brandId]/closed/[brandInfluencerId]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type ClosedColumn =
  | "For Order Creation"
  | "In-Transit"
  | "Delivered"
  | "Posted"
  | "No post"

// ✅ Safe JSON parse
function safeParse(value: string | null) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

// ✅ Strict mapping (no stale data)
function mapClosedToPipelineFields(
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

    // ✅ Auth check
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        OR: [
          { owner_id: session.user.id },
          { members: { some: { user_id: session.user.id } } },
        ],
      },
      select: { id: true },
    })

    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { closedStatus, paidCollabData, campaignType } = body

    // ✅ Validate closedStatus
    const validStatuses: ClosedColumn[] = [
      "For Order Creation",
      "In-Transit",
      "Delivered",
      "Posted",
      "No post",
    ]

    if (closedStatus && !validStatuses.includes(closedStatus)) {
      return NextResponse.json(
        { error: "Invalid closedStatus" },
        { status: 400 }
      )
    }

    // ✅ Get current record
    const record = await prisma.brandInfluencer.findUnique({
      where: { id: brandInfluencerId },
    })

    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // ✅ Parse existing JSON safely
    const productDetails = safeParse(record.product_details)

    // ✅ Merge JSON updates (no overwrite loss)
    if (closedStatus !== undefined) {
      productDetails.closedStatus = closedStatus
    }
    if (paidCollabData !== undefined) {
      productDetails.paidCollab = paidCollabData
    }
    if (campaignType !== undefined) {
      productDetails.campaignType = campaignType
    }

    // ✅ Base update payload
    let updateData: any = {
      product_details: JSON.stringify(productDetails),
      updated_at: new Date(),
    }

    // ✅ Apply pipeline mapping
    if (closedStatus !== undefined) {
      const mapped = mapClosedToPipelineFields(closedStatus, record)
      Object.assign(updateData, mapped)
    }

    // ✅ Update DB
    const updated = await prisma.brandInfluencer.update({
      where: { id: brandInfluencerId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err: any) {
    console.error("PATCH closed error:", err)

    return NextResponse.json(
      { error: "Server error", detail: err?.message },
      { status: 500 }
    )
  }
}
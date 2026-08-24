// app/api/brand/[brandId]/closed/[brandInfluencerId]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasBrandCapability } from "@/lib/permissions"
import { mapClosedToPipelineFields, type ClosedColumn } from "@/lib/post-tracker-status"

// ✅ Safe JSON parse
function safeParse(value: string | null) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    // Legacy plain-text product details predate this column being used as a
    // JSON store (closedStatus/paidCollab/campaignType/note all live here
    // now) — rescue the original text into the new structure instead of
    // silently discarding it the next time anything else on this row saves.
    return { note: value }
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

    if (!(await hasBrandCapability(brandId, session.user.id, "approveInfluencers"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const {
      closedStatus, paidCollabData, campaignType, postUrl, resetWorkflow,
      // Order tab fields — note/trackingNumber live inside the product_details
      // JSON blob (alongside closedStatus/paidCollab/campaignType above);
      // the rest are their own BrandInfluencer columns.
      note, trackingNumber, shippedAt, deliveredAt, deadline, currency, deliverables,
    } = body

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
    // Scoped to the brand in the URL: the access check above proves membership
    // of THAT brand, so looking the row up by id alone would let a member of one
    // brand move another brand's row through the Post Tracker.
    const record = await prisma.brandInfluencer.findUnique({
      where: { id: brandInfluencerId, brand_id: brandId },
      // Only pull what mapClosedToPipelineFields / safeParse actually read —
      // this route fires on every drag-and-drop stage move, so avoid loading
      // the record's large @db.Text fields (notes, deliverables, etc.) here.
      select: {
        shipped_at: true,
        delivered_at: true,
        posted_at: true,
        product_details: true,
      },
    })

    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // ✅ Parse existing JSON safely
    const productDetails = safeParse(record.product_details)

    // ── POSTED is terminal ────────────────────────────────────────────────────
    // Once a row is Posted it stays Posted. Any move to another stage is
    // refused unless the caller explicitly asks to reset the workflow AND has
    // approval capability on the brand. This is enforced here, at the only
    // write path, so no client (drag, dropdown, bulk, drawer) can bypass it.
    const storedStatus = productDetails.closedStatus as ClosedColumn | undefined
    if (
      closedStatus !== undefined &&
      storedStatus === "Posted" &&
      closedStatus !== "Posted"
    ) {
      if (!resetWorkflow) {
        return NextResponse.json(
          {
            error:
              "This influencer has already Posted. Posted is a final stage — reset the workflow to move it back.",
            terminalState: true,
            currentStatus: "Posted",
          },
          { status: 409 }
        )
      }

      const canReset = await hasBrandCapability(brandId, session.user.id, "approveInfluencers")
      if (!canReset) {
        return NextResponse.json(
          {
            error: "Only a brand owner or manager can reset a Posted workflow.",
            terminalState: true,
            currentStatus: "Posted",
          },
          { status: 403 }
        )
      }

      console.warn(
        `[closed PATCH] workflow RESET from Posted → ${closedStatus} ` +
          `for brandInfluencer ${brandInfluencerId} by user ${session.user.id}`
      )
    }

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
    if (note !== undefined) {
      productDetails.note = note
    }
    if (trackingNumber !== undefined) {
      productDetails.trackingNumber = trackingNumber
    }

    // ✅ Validate postUrl
    if (postUrl !== undefined && postUrl !== null && typeof postUrl !== "string") {
      return NextResponse.json({ error: "Invalid postUrl" }, { status: 400 })
    }

    // ✅ Base update payload
    let updateData: any = {
      product_details: JSON.stringify(productDetails),
      updated_at: new Date(),
    }

    // ✅ Post URL — persisted so the "Posted" stage can require evidence of a
    // published post. An empty string clears it.
    if (postUrl !== undefined) {
      updateData.post_url = typeof postUrl === "string" ? (postUrl.trim() || null) : null
    }

    // ✅ Order tab fields with their own columns — an empty string clears them.
    if (shippedAt !== undefined) {
      updateData.shipped_at = shippedAt ? new Date(shippedAt) : null
    }
    if (deliveredAt !== undefined) {
      updateData.delivered_at = deliveredAt ? new Date(deliveredAt) : null
    }
    if (deadline !== undefined) {
      updateData.deadline = deadline ? new Date(deadline) : null
    }
    if (currency !== undefined) {
      updateData.currency = currency || null
    }
    if (deliverables !== undefined) {
      updateData.deliverables = deliverables || null
    }

    // ✅ Apply pipeline mapping
    if (closedStatus !== undefined) {
      const mapped = mapClosedToPipelineFields(closedStatus, record)
      Object.assign(updateData, mapped)
    }

    // ✅ Update DB
    const updated = await prisma.brandInfluencer.update({
      where: { id: brandInfluencerId, brand_id: brandId },
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
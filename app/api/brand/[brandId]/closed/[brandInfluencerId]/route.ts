// app/api/brand/[brandId]/closed/[brandInfluencerId]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma, timeStep } from "@/lib/prisma"
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
        // Read for the Posted evidence check below.
        post_url: true,
      },
    })

    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // ✅ Parse existing JSON safely
    const productDetails = safeParse(record.product_details)

    // ── POSTED needs proof of a post ─────────────────────────────────────────
    // The UI already refuses this (handleMove and runBulkStageMove in
    // app/dashboard/post-tracker/page.tsx both require a Post URL or a detected
    // post), but the rule lived ONLY there. A direct PATCH — or any future
    // caller — could set Posted on a row with no post at all, which is the one
    // state the whole stage flow exists to prevent.
    //
    // Enforced here, at the single write path, on exactly the same two pieces of
    // evidence the client uses: a stored post_url, or a DetectedPost row. Moves
    // to Delivered and to every earlier stage are untouched — those need no post,
    // which is the point of Delivered.
    if (closedStatus === "Posted") {
      const hasUrl = Boolean(record.post_url && record.post_url.trim())
      const detected = hasUrl
        ? 0
        : await prisma.detectedPost.count({
            where: { brand_influencer_id: brandInfluencerId, brand_id: brandId },
          })
      if (!hasUrl && detected === 0) {
        return NextResponse.json(
          {
            error:
              "This influencer has no post yet. Add a Post URL, or let Automatic Post Detection find the post, before moving to Posted.",
            needsPostEvidence: true,
          },
          { status: 409 }
        )
      }
    }

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
    // ── Write ────────────────────────────────────────────────────────────────
    // updateMany, not update().
    //
    // MEASURED against this deployment's database (median of 5, ~317ms baseline
    // round trip to the shared host):
    //
    //   raw SQL UPDATE .................  412ms   (1 round trip)
    //   prisma.updateMany ..............  1430ms
    //   prisma.update({ select }) ......  1839ms  (~5.8 round trips)
    //
    // `update` wraps itself in an implicit transaction and reads the row back:
    // BEGIN, UPDATE, SELECT, COMMIT. On MyISAM — every table here — the
    // transaction does nothing at all, since MyISAM is not transactional. This
    // call had no `select` either, so the read-back pulled the WHOLE row,
    // Text columns included, on the critical path of every card move.
    //
    // The client returns `{ ok: true }` without reading this body
    // (hooks/useClosedData.ts), so the echo was never used.
    const writeResult = await timeStep("closed.write", () =>
      prisma.brandInfluencer.updateMany({
        where: { id: brandInfluencerId, brand_id: brandId },
        data: updateData,
      })
    )

    // update() threw P2025 for a missing row, which the catch below reported as
    // a 500. updateMany reports a count, so the row is now correctly a 404.
    if (writeResult.count === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    // Same shape as before, built from what was written rather than read back.
    return NextResponse.json({
      success: true,
      data: { id: brandInfluencerId, ...updateData },
    })
  } catch (err: any) {
    console.error("PATCH closed error:", err)

    return NextResponse.json(
      { error: "Server error", detail: err?.message },
      { status: 500 }
    )
  }
}
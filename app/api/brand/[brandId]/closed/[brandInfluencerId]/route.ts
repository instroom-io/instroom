// app/api/brand/[brandId]/closed/[brandInfluencerId]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma, timeStep } from "@/lib/prisma"
import { hasBrandCapability } from "@/lib/permissions"
import { mapClosedToPipelineFields, parseMetricInput, type ClosedColumn } from "@/lib/post-tracker-status"

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
      // Post tab fields — each has its own BrandInfluencer column, same as the
      // Order tab fields above. postedAt/likes/comments/engagement/
      // internalRating were previously typed into the drawer's local state but
      // never sent to this route at all — only postUrl was.
      postedAt, likes, comments, engagement, internalRating,
      // scriptStatus/contentStatus are NOT their own columns — they are the
      // aggregate `inferContentStatuses` in useClosedData.ts computes from
      // paidCollabData.deliverables[].{scriptStatus,contentStatus}. Setting
      // one from the Post tab is handled as a bulk-set across every existing
      // deliverable (or a single placeholder one if there are none yet) —
      // see the dedicated block below, not a new column.
      scriptStatus, contentStatus,
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
      // A Post URL submitted in THIS same request (the Post tab's Save button
      // sends the URL and the Posted move together) is evidence too — `record`
      // was read before this request's body was merged in, so checking only
      // `record.post_url` would 409 a save that is itself supplying the very
      // URL the guard is asking for.
      const hasUrl = Boolean(record.post_url && record.post_url.trim()) ||
        Boolean(typeof postUrl === "string" && postUrl.trim())
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

    // ✅ Script/Content Status — a bulk-set across paidCollab.deliverables[],
    // not a column of their own. useClosedData's inferContentStatuses reads
    // these back as an "approved" / "pending" / null rollup over the whole
    // array, so the Post tab's one dropdown per field is exactly that rollup
    // control: setting it to a value applies that value to EVERY deliverable
    // (there is no per-deliverable UI on this tab — that lives in the
    // Influencer Profile's own Paid Collaboration editor, untouched here).
    //
    // Skipped entirely when `paidCollabData` was ALSO sent in this same
    // request (the Paid Collaboration editor's own save) — that payload is
    // already the full, authoritative deliverables array for this write, and
    // applying a rollup on top of it here would race the very save that just
    // set it.
    //
    // With zero deliverables yet (true for every row in this database today),
    // a single placeholder deliverable is created to hold the value — the same
    // shape components/table-sheet/profile-sidebar.tsx's own "add one more"
    // uses, so the Paid Collaboration editor reads back exactly what the Post
    // tab wrote if it's opened afterwards.
    if (paidCollabData === undefined && (scriptStatus !== undefined || contentStatus !== undefined)) {
      const existingPaid = (productDetails.paidCollab ?? {}) as Record<string, unknown>
      const existingDeliverables: Record<string, unknown>[] = Array.isArray(existingPaid.deliverables)
        ? (existingPaid.deliverables as Record<string, unknown>[])
        : []
      const nextDeliverables = existingDeliverables.length
        ? existingDeliverables.map((d) => ({
            ...d,
            ...(scriptStatus !== undefined ? { scriptStatus } : {}),
            ...(contentStatus !== undefined ? { contentStatus } : {}),
          }))
        : [
            {
              id: 1,
              name: "",
              scriptStatus: scriptStatus ?? "pending",
              scriptLink: "",
              scriptRevs: [],
              contentStatus: contentStatus ?? "pending",
              contentLink: "",
              contentRevs: [],
            },
          ]
      productDetails.paidCollab = { ...existingPaid, deliverables: nextDeliverables }
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

    // ✅ Post tab fields with their own columns — an empty string/blank clears
    // them, same convention as the Order tab fields above.
    if (postedAt !== undefined) {
      updateData.posted_at = postedAt ? new Date(postedAt) : null
    }
    // likes/comments/engagement come from a free-text input, so a human can
    // type shorthand ("10K", "1.5M", "25%") instead of a plain integer.
    // parseMetricInput handles that shorthand and always returns a finite
    // whole number (0 for blank/unparseable) — see its own comment in
    // lib/post-tracker-status.ts for why this must be shared with the
    // client's optimistic update in useClosedData.ts.
    if (likes !== undefined) {
      updateData.likes_count = parseMetricInput(likes)
    }
    if (comments !== undefined) {
      updateData.comments_count = parseMetricInput(comments)
    }
    if (engagement !== undefined) {
      updateData.engagement_count = parseMetricInput(engagement)
    }
    if (internalRating !== undefined) {
      updateData.internal_rating = internalRating === "" || internalRating === null ? null : Number(internalRating)
    }

    // ✅ Apply pipeline mapping
    //
    // mapClosedToPipelineFields's "Posted" case keeps `currentRecord.posted_at`
    // when the row already has one, else stamps `new Date()` — it has no way to
    // know about a `postedAt` this SAME request just set above, so without this
    // it would silently overwrite a manually-typed Posted At with "now" on the
    // very save that's meant to persist it. Feeding the resolved value back
    // into the record the mapper reads keeps mapClosedToPipelineFields as the
    // one place stage-derived fields are computed, rather than overriding its
    // output afterwards.
    if (closedStatus !== undefined) {
      const recordForMapping = updateData.posted_at !== undefined
        ? { ...record, posted_at: updateData.posted_at }
        : record
      const mapped = mapClosedToPipelineFields(closedStatus, recordForMapping)
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
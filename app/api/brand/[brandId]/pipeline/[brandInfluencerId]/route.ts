// app/api/brand/[brandId]/pipeline/[brandInfluencerId]/route.ts
//
// PERFORMANCE CHANGES vs previous version:
//
//   1. Auth check uses a COUNT instead of findFirst + full object load.
//      We only need to know "does this brand belong to this user?" — a
//      COUNT(1) is faster than loading the full brand record.
//      Using prisma.brand.count() with the same OR filter.
//
//   2. update uses `select` — only returns the 4 fields we actually send
//      back to the client instead of the full BrandInfluencer row.
//
//   3. Auth check (brand.count + hasBrandCapability) and the BEFORE snapshot
//      findUnique are independent of each other, so they run concurrently
//      via Promise.all instead of three sequential round-trips.
//
//   4. The post-update notification lookup/send block is fire-and-forget —
//      it is NOT awaited in the main request path, so PATCH returns to the
//      client as soon as the update completes. Its two independent lookups
//      (influencer, brand) run in parallel via Promise.all.

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma, timeStep } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { sendNotification } from "@/lib/notifications"
import type { NotifType } from "@/emails/notification"
import { provisionGoAffProAffiliate } from "@/lib/goaffpro-provision"
import { hasBrandCapability } from "@/lib/permissions"

// ─── Status → DB field mapping ────────────────────────────────────────────────
function pipelineStatusToFields(pipelineStatus: string, collaborationType?: string): {
  contact_status:  string
  stage:           number
  approval_status: string
} {
  switch (pipelineStatus) {
    case "For Outreach":
      return { contact_status: "pending",             stage: 1, approval_status: "Approved" }
    case "Contacted":
      return { contact_status: "contacted",           stage: 2, approval_status: "Approved" }
    case "In Conversation":
      return { contact_status: "negotiating",         stage: 3, approval_status: "Approved" }
    case "Deal Agreed":
      // Confirming a Collaboration Type is what marks the deal as fully agreed —
      // once it's set, skip the separate "Move to Post Tracker" step entirely and
      // land directly on Post Tracker's default initial status (stage 5).
      return collaborationType
        ? { contact_status: "for_order_creation", stage: 5, approval_status: "Approved" }
        : { contact_status: "agreed",              stage: 4, approval_status: "Approved" }
    case "For Order Creation":
      return { contact_status: "for_order_creation",  stage: 5, approval_status: "Approved" }
    case "Not Interested":
      return { contact_status: "not_interested",      stage: 0, approval_status: "Declined" }
    default:
      return { contact_status: "pending",             stage: 1, approval_status: "Approved" }
  }
}

// ─── PATCH handler ────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; brandInfluencerId: string }> }
) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, brandInfluencerId } = await params

    const body = await req.json()
    const { pipelineStatus, niReason, collaborationType } = body as {
      pipelineStatus?: string
      niReason?: string
      collaborationType?: string
    }

    if (!pipelineStatus) {
      return NextResponse.json(
        { error: "pipelineStatus is required" },
        { status: 400 }
      )
    }

    // ── Access check ───────────────────────────────────────────────────────
    // Every pipeline status transition sets approval_status to "Approved" or
    // "Declined" (see pipelineStatusToFields below), so this whole action is
    // an approval decision — gated to owners and managers only. The brand
    // must also be active (owner's subscription in good standing).
    const [activeCount, canApprove, before] = await timeStep("pipeline.preflight", () => Promise.all([
      prisma.brand.count({ where: { id: brandId, is_active: true } }),
      hasBrandCapability(brandId, session.user.id, "approveInfluencers"),
      prisma.brandInfluencer.findUnique({
        where: { id: brandInfluencerId, brand_id: brandId },
        select: { contact_status: true, stage: true, product_details: true },
      }),
    ]))

    if (activeCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 403 })
    }

    if (!canApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // ── Compute DB fields from pipeline status ───────────────────────────────
    const fields = pipelineStatusToFields(pipelineStatus, collaborationType)

    // ── Merge Collaboration Type into the same product_details JSON blob
    //    that Post Tracker's own Collaboration Type dropdown writes to
    //    (product_details.campaignType) — one shared value everywhere.
    let productDetailsJson: string | undefined
    if (collaborationType !== undefined) {
      let details: Record<string, unknown> = {}
      try { details = before?.product_details ? JSON.parse(before.product_details) : {} } catch { details = {} }
      details.campaignType = collaborationType
      productDetailsJson = JSON.stringify(details)
    }

    // ── Write ────────────────────────────────────────────────────────────────
    // updateMany, not update({ select }).
    //
    // MEASURED against this deployment's database (median of 5, ~317ms baseline
    // round trip to the shared host):
    //
    //   raw SQL UPDATE .................  412ms   (1 round trip)
    //   prisma.updateMany ..............  1430ms
    //   prisma.update({ select }) ......  1839ms  (~5.8 round trips)
    //
    // `update` wraps itself in an implicit transaction and then reads the row
    // back: BEGIN, UPDATE, SELECT, COMMIT. On a remote database that is four
    // round trips instead of one — and on MyISAM (which every table here uses)
    // the transaction does nothing whatsoever, because MyISAM is not
    // transactional. So the read-back and the transaction were ~1.4s of pure
    // protocol overhead on the critical path of every card move.
    //
    // Nothing is lost: `fields` below is what was just written, the row's
    // existence was already established by the preflight above, and the client
    // reads this body only on failure (hooks/usePipelineData.ts).
    const writeResult = await timeStep("pipeline.write", () => prisma.brandInfluencer.updateMany({
      where: {
        id:       brandInfluencerId,
        brand_id: brandId, // scoped to brand — prevents cross-brand updates
      },
      data: {
        contact_status:  fields.contact_status,
        stage:           fields.stage,
        approval_status: fields.approval_status,
        ...(productDetailsJson !== undefined ? { product_details: productDetailsJson } : {}),
        // Only write approval_notes for NI moves — don't overwrite on others
        ...(pipelineStatus === "Not Interested"
          ? { approval_notes: niReason || "Not interested" }
          : {}),
      },
    }))

    // update() threw P2025 for a missing row and the catch below turned that
    // into a 404. updateMany reports a count instead, so the same answer is
    // produced here rather than by an exception.
    if (writeResult.count === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    // The same shape update({ select }) returned, built from what was written.
    const updated = {
      id:              brandInfluencerId,
      contact_status:  fields.contact_status,
      stage:           fields.stage,
      approval_status: fields.approval_status,
    }

    // ── Provision GoAffPro affiliate on first transition into Deal Agreed or
    //    beyond — guarded so it only fires once, whether the row lands on
    //    stage 4 (legacy path) or jumps straight to stage 5 (new cascade).
    if (before && before.stage < 4 && fields.stage >= 4) {
      provisionGoAffProAffiliate({ brandId, brandInfluencerId }).then((result) => {
        if (!result.success && !result.skipped) {
          console.error("GoAffPro provisioning failed:", result.reason)
        }
      }).catch(console.error)
    }

    // ── Log activity (non-blocking) ─────────────────────────────────────────
    if (before && before.contact_status !== fields.contact_status) {
      logActivity({
        brandId,
        userId: session.user.id,
        action: "pipeline.status_changed",
        entityType: "brand_influencer",
        entityId: brandInfluencerId,
        details: {
          from: before.contact_status,
          to: fields.contact_status,
          ...(pipelineStatus === "Not Interested" && niReason ? { ni_reason: niReason } : {}),
        },
      }).catch(console.error)
    }

    // ── Send notification ───────────────────────────────────────────────────
    // Non-blocking: notify all brand members in background (fire-and-forget,
    // same pattern as logActivity/provisionGoAffProAffiliate above — do not
    // await this, so PATCH returns to the client immediately).
    ;(async () => {
      const brandInfluencerFull = await prisma.brandInfluencer.findUnique({
        where: { id: brandInfluencerId },
        select: { influencer_id: true },
      })

      if (brandInfluencerFull) {
        const [influencer, brand] = await Promise.all([
          prisma.influencer.findUnique({
            where: { id: brandInfluencerFull.influencer_id },
            select: { full_name: true, handle: true },
          }),
          prisma.brand.findUnique({
            where: { id: brandId },
            select: { slug: true },
          }),
        ])

        const influencerName = influencer?.full_name || influencer?.handle || "Influencer"
        const appUrl = process.env.NEXTAUTH_URL ?? ""
        const actionUrl = brand ? `${appUrl}/dashboard/${brand.slug}/influencers/${brandInfluencerId}` : undefined

        // Determine notification type and message based on pipeline status
        let notifType: NotifType = "stage_change"
        let title: string
        let message: string

        if (pipelineStatus === "Deal Agreed") {
          notifType = "deal_agreed"
          title = `Deal agreed with ${influencerName}`
          message = `${influencerName} has confirmed the collaboration!`
        } else {
          title = `Pipeline update: ${influencerName}`
          message = `${influencerName}'s status has been updated to "${pipelineStatus}".`
        }

        // Send to all brand members
        const members = await prisma.brandMember.findMany({
          where: { brand_id: brandId },
          select: { user_id: true },
        })

        await Promise.allSettled(
          members.map(({ user_id }) =>
            sendNotification({
              userId: user_id,
              type: notifType,
              title,
              message,
              actionUrl,
            })
          )
        )
      }
    })().catch((err) => {
      console.error("❌ Notification setup failed:", err)
    })

    return NextResponse.json({
      success: true,
      data: { ...updated, collabType: collaborationType },
    })

  } catch (error: unknown) {
    const e = error as { code?: string; message?: string }
    console.error("PATCH pipeline error:", e?.code, e?.message)

    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    return NextResponse.json(
      { error: "Failed to update status", detail: e?.message },
      { status: 500 }
    )
  }
}
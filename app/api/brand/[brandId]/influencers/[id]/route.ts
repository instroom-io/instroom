import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { provisionGoAffProAffiliate } from "@/lib/goaffpro-provision"
import { hasBrandCapability } from "@/lib/permissions"
import { NextRequest, NextResponse } from "next/server"

// Must cover every contact_status the app writes anywhere, because an unknown
// value here is silently rewritten to "not_contacted". "pending" is written by
// the Pipeline (For Outreach) and "for_order_creation" by the Pipeline and Post
// Tracker (stages 5-8), so leaving them out meant editing any field of such a
// row in the Influencer List knocked it out of the Post Tracker.
const VALID_CONTACT_STATUSES = new Set([
  "not_contacted", "pending", "contacted", "interested", "agreed",
  "not_interested", "responded", "replied", "email_error",
  "no_response", "paid_collab", "negotiating", "for_order_creation",
])
const VALID_APPROVAL_STATUSES = new Set(["Pending", "Approved", "Declined"])

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, id } = await params
    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Owner OR member, matching the GET/POST gate on this brand's influencers.
    // Owner-only here meant a Manager's edit — including an approval made
    // through a UI that allows it — 404'd, so the row silently reverted to its
    // stored value on the next read.
    const isOwner = brand.owner_id === session.user.id
    const isMember = isOwner
      ? true
      : !!(await prisma.brandMember.findFirst({
          where: { brand_id: brandId, user_id: session.user.id },
        }))
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const data = await req.json()

    // Approval is a privileged decision: enforce the same capability the UI
    // gates its approval controls on, server-side.
    if (data.approval_status !== undefined) {
      const canApprove = await hasBrandCapability(brandId, session.user.id, "approveInfluencers")
      if (!canApprove) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Snapshot BEFORE state for change tracking
    const before = await prisma.brandInfluencer.findUnique({
      where: { brand_id_influencer_id: { brand_id: brandId, influencer_id: id } },
      select: { id: true, contact_status: true, stage: true, approval_status: true },
    })

    const inf: any = {}
    if (data.full_name !== undefined) inf.full_name = data.full_name || null
    if (data.email !== undefined)
      inf.email = data.email && data.email.includes("@") ? data.email : null
    if (data.gender !== undefined) inf.gender = data.gender || null
    if (data.niche !== undefined) inf.niche = data.niche || null
    if (data.location !== undefined) inf.location = data.location || null
    if (data.bio !== undefined) inf.bio = data.bio || null
    if (data.profile_image_url !== undefined)
      inf.profile_image_url =
        data.profile_image_url && !data.profile_image_url.includes("x-expires=")
          ? data.profile_image_url
          : null
    if (data.social_link !== undefined) inf.social_link = data.social_link || null
    if (data.follower_count !== undefined)
      inf.follower_count = parseInt(String(data.follower_count)) || 0
    if (data.engagement_rate !== undefined)
      inf.engagement_rate = parseFloat(String(data.engagement_rate)) || 0
    if (data.avg_likes !== undefined) inf.avg_likes = parseInt(String(data.avg_likes)) || 0
    if (data.avg_comments !== undefined)
      inf.avg_comments = parseInt(String(data.avg_comments)) || 0
    if (data.avg_views !== undefined) inf.avg_views = parseInt(String(data.avg_views)) || 0

    const bi: any = {}
    if (data.contact_status !== undefined)
      bi.contact_status = VALID_CONTACT_STATUSES.has(data.contact_status)
        ? data.contact_status
        : "not_contacted"
    // 0 = Not Interested, 1-5 = pipeline columns, 6-8 = Post Tracker stages
    // (lib/post-tracker-status.ts). Clamping at 5 demoted a Delivered/Posted row
    // to For Order Creation whenever it was saved from the Influencer List.
    if (data.stage !== undefined)
      bi.stage = Math.max(0, Math.min(8, parseInt(String(data.stage)) || 1))
    if (data.agreed_rate !== undefined)
      bi.agreed_rate = data.agreed_rate ? parseFloat(String(data.agreed_rate)) : null
    if (data.notes !== undefined) bi.notes = data.notes || null
    if (data.approval_status !== undefined)
      bi.approval_status = VALID_APPROVAL_STATUSES.has(data.approval_status)
        ? data.approval_status
        : null
    if (data.approval_notes !== undefined) bi.approval_notes = data.approval_notes || null
    if (data.transferred_date !== undefined)
      bi.transferred_date = data.transferred_date ? new Date(data.transferred_date) : null

    const updates: Promise<any>[] = []
    let savedInf: { handle: string; platform: string } | null = null
    if (Object.keys(inf).length > 0) {
      updates.push(
        prisma.influencer
          .update({ where: { id }, data: inf, select: { handle: true, platform: true } })
          .then((row) => { savedInf = row })
      )
    }
    // Kept separate from `updates` so the persisted row can be read back and
    // returned — the client trusts what the DB stored, not what it sent.
    let savedBi: { approval_status: string | null; transferred_date: Date | null } | null = null
    if (Object.keys(bi).length > 0) {
      updates.push(
        prisma.brandInfluencer
          .update({
            where: { brand_id_influencer_id: { brand_id: brandId, influencer_id: id } },
            data: bi,
            select: { approval_status: true, transferred_date: true },
          })
          .then((row) => { savedBi = row })
      )
    }
    if (updates.length > 0) await Promise.all(updates)
    if (!savedInf) {
      savedInf = await prisma.influencer.findUnique({
        where: { id },
        select: { handle: true, platform: true },
      })
    }

    // ── Provision GoAffPro affiliate on first transition into Deal Agreed ────
    if (before && bi.stage !== undefined && before.stage !== 4 && bi.stage === 4) {
      provisionGoAffProAffiliate({ brandId, brandInfluencerId: before.id }).then((result) => {
        if (!result.success && !result.skipped) {
          console.error("GoAffPro provisioning failed:", result.reason)
        }
      }).catch(console.error)
    }

    // Log only what actually changed
    const userId = session.user.id
    const logs: Promise<void>[] = []

    if (before && Object.keys(inf).length > 0) {
      logs.push(
        logActivity({
          brandId,
          userId,
          action: "influencer.updated",
          entityType: "brand_influencer",
          entityId: before.id,
          details: { fields: Object.keys(inf) },
        })
      )
    }

    if (before && bi.stage !== undefined && bi.stage !== before.stage) {
      logs.push(
        logActivity({
          brandId,
          userId,
          action: "pipeline.stage_changed",
          entityType: "brand_influencer",
          entityId: before.id,
          details: { from: before.stage, to: bi.stage },
        })
      )
    }

    if (
      before &&
      bi.contact_status !== undefined &&
      bi.contact_status !== before.contact_status
    ) {
      logs.push(
        logActivity({
          brandId,
          userId,
          action: "pipeline.status_changed",
          entityType: "brand_influencer",
          entityId: before.id,
          details: {
            from: before.contact_status,
            to: bi.contact_status,
            ...(bi.contact_status === "not_interested" && data.ni_reason
              ? { ni_reason: data.ni_reason, ni_bucket: data.ni_bucket ?? null }
              : {}),
          },
        })
      )
    }

    if (
      before &&
      bi.approval_status !== undefined &&
      bi.approval_status !== before.approval_status
    ) {
      logs.push(
        logActivity({
          brandId,
          userId,
          action: "influencer.approval_changed",
          entityType: "brand_influencer",
          entityId: before.id,
          details: {
            from: before.approval_status,
            to: bi.approval_status,
            notes: data.approval_notes ?? null,
          },
        })
      )
    }

    if (logs.length > 0) Promise.all(logs).catch(console.error)

    return NextResponse.json({
      success: true,
      ...(savedInf
        ? {
            handle:   (savedInf as { handle: string }).handle,
            platform: (savedInf as { platform: string }).platform,
          }
        : {}),
      ...(savedBi
        ? {
            approval_status:   (savedBi as { approval_status: string | null }).approval_status,
            transferred_date: (savedBi as { transferred_date: Date | null }).transferred_date,
          }
        : {}),
    })
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Not found", code: err.code }, { status: 404 })
    }
    console.error("PUT /influencers/[id]:", err?.code, err?.message)
    return NextResponse.json(
      { error: err?.message ?? "error", code: err?.code },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, id } = await params
    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand || brand.owner_id !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.brandInfluencer.delete({
      where: { brand_id_influencer_id: { brand_id: brandId, influencer_id: id } },
    })

    logActivity({
      brandId,
      userId: session.user.id,
      action: "influencer.removed",
      entityType: "brand_influencer",
      entityId: id,
      details: {},
    }).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
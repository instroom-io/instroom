// app/api/brand/[brandId]/influencers/bulk-approval/route.ts
//
// One request for a whole selection.
//
// "Transfer to Outreach" used to reach the database through the table's normal
// per-cell save path: one debounced PUT per row, serialised through the page's
// PUT queue. Approving 40 influencers therefore meant 40 round-trips taken one
// at a time, each behind its own 1.5s debounce — slow, and any row whose PUT was
// dropped stayed Pending in the database while the table showed it Approved.
//
// This route applies the same three writes the row-by-row path applied, as
// `updateMany` statements inside a single transaction, then reads the rows back
// so the client can render what the database actually stored.
//
// Auth and permissions match PUT /api/brand/[brandId]/influencers/[id]: owner or
// member for access, plus the approveInfluencers capability for the decision.

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { hasBrandCapability } from "@/lib/permissions"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params

    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const isOwner = brand.owner_id === session.user.id
    const isMember = isOwner
      ? true
      : !!(await prisma.brandMember.findFirst({
          where: { brand_id: brandId, user_id: session.user.id },
        }))
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    if (!(await hasBrandCapability(brandId, session.user.id, "approveInfluencers"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const influencerIds: string[] = Array.isArray(body?.influencerIds)
      ? body.influencerIds.filter((v: unknown) => typeof v === "string" && v.length > 0)
      : []

    if (influencerIds.length === 0) {
      return NextResponse.json({ error: "influencerIds is required" }, { status: 400 })
    }

    // Drafts excluded. "Select all → approve" in the Influencer List passes
    // every visible row's id, drafts included; approving one would set the
    // approval and contact status that put it on the Pipeline board as a blank
    // card. A draft is not an influencer and cannot be approved.
    const scope = {
      brand_id: brandId,
      influencer_id: { in: influencerIds },
      influencer: { is_draft: false },
    }
    const reviewedAt = new Date()

    // The exact semantics of the row-by-row path: approve, stamp the review date
    // only where one isn't already set, and start outreach only for rows that
    // hadn't been contacted yet.
    await prisma.$transaction([
      prisma.brandInfluencer.updateMany({
        where: scope,
        data: { approval_status: "Approved" },
      }),
      prisma.brandInfluencer.updateMany({
        where: { ...scope, transferred_date: null },
        data: { transferred_date: reviewedAt },
      }),
      prisma.brandInfluencer.updateMany({
        where: { ...scope, contact_status: "not_contacted" },
        data: { contact_status: "contacted" },
      }),
    ])

    // Read back what was persisted — this is what the client renders, so the
    // optimistic row and the database cannot drift apart.
    const saved = await prisma.brandInfluencer.findMany({
      where: scope,
      select: {
        id: true,
        influencer_id: true,
        approval_status: true,
        transferred_date: true,
        contact_status: true,
      },
    })

    // Anything the caller asked for that isn't in the result was never a member
    // of this brand (deleted, or a stale row id) — reported, never swallowed.
    const savedIds = new Set(saved.map((row) => row.influencer_id))
    const failed = influencerIds.filter((id) => !savedIds.has(id))

    if (saved.length > 0) {
      logActivity({
        brandId,
        userId: session.user.id,
        action: "influencer.approval_changed",
        entityType: "brand_influencer",
        entityId: saved[0].id,
        details: { to: "Approved", count: saved.length, bulk: true },
      }).catch(console.error)
    }

    return NextResponse.json({ success: failed.length === 0, updated: saved, failed })
  } catch (err: any) {
    console.error("POST /influencers/bulk-approval:", err?.code, err?.message)
    return NextResponse.json({ error: err?.message ?? "error", code: err?.code }, { status: 500 })
  }
}

import { prisma, withUtf8mb4 } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { provisionGoAffProAffiliate } from "@/lib/goaffpro-provision"
import { hasBrandCapability } from "@/lib/permissions"
import { persistAvatarUrl } from "@/lib/avatar-storage"
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
    // The avatar is STORED, not linked. An Instagram/TikTok URL expires, so
    // this used to drop it (null) and the avatar vanished. It is now mirrored
    // into Cloudinary and the permanent URL is what gets written — see
    // lib/avatar-storage. A URL already stored there is returned as-is, so an
    // ordinary save does not re-upload anything.
    if (data.profile_image_url !== undefined) {
      if (!data.profile_image_url) {
        inf.profile_image_url = null
      } else {
        const stored = await persistAvatarUrl(data.profile_image_url, id)
        // null = the download or upload failed. Leave the stored avatar alone
        // rather than replacing a working one with nothing.
        if (stored) inf.profile_image_url = stored
      }
    }
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

    // ── Writes go through withUtf8mb4 ───────────────────────────────────────
    // `bio` is @db.Text and its content comes from Instagram, so it routinely
    // contains emoji. This host forces `SET NAMES utf8` (= utf8mb3) on every new
    // connection via init_connect, and MySQL then refuses to convert a 4-byte
    // parameter into the utf8mb4_unicode_ci column:
    //
    //   Error 3988: Conversion from collation utf8mb3_general_ci into
    //               utf8mb4_unicode_ci impossible for parameter
    //
    // Verified against this deployment: an ASCII bio saves, the same bio with an
    // emoji fails, and the same write inside withUtf8mb4 succeeds. Unhandled,
    // that surfaced as an HTTP 500 and the edit was silently never persisted.
    //
    // withUtf8mb4 is the existing helper for exactly this (lib/prisma.ts) — it
    // pins ONE connection so the `SET NAMES utf8mb4` and the write provably
    // share a session. Both writes therefore run sequentially on `tx`, not in
    // parallel on the global client: a statement issued on `prisma` in here
    // would take a different pooled connection and land back on utf8mb3.
    //
    // Nothing is sanitised, stripped or re-encoded — the bio is stored exactly
    // as received.
    let savedInf: {
      handle: string
      platform: string
      email: string | null
      profile_image_url: string | null
    } | null = null
    // Read back rather than echoed, so the client trusts what the DB stored.
    let savedBi: { approval_status: string | null; transferred_date: Date | null } | null = null

    // Only a 4-BYTE UTF-8 character needs the utf8mb4 session, and only those
    // fail: verified against this deployment, "\u2728" and "\u2615" save on the
    // plain path because they are 3-byte, while "\u{1F60A}" is 4-byte and raises
    // MySQL 3988. So the test is "is there a code point above the BMP", which is
    // what the /u surrogate-pair-aware range below matches.
    //
    // Worth branching on: withUtf8mb4 is an interactive transaction plus a
    // SET NAMES, i.e. two extra round trips, and a bare `SELECT 1` against this
    // remote shared host costs ~317ms (see lib/prisma.ts). Wrapping every save
    // made the ordinary ASCII edit about three times slower than it needs to be
    // for a problem it does not have.
    const needsUtf8mb4 = /[\u{10000}-\u{10FFFF}]/u.test(JSON.stringify(inf))

    // Called with EITHER withUtf8mb4's plain transaction client (the tx
    // branch below) OR the real `prisma` export directly (the fast path) —
    // the latter is Accelerate-extended (see lib/prisma.ts) and structurally
    // different (extra cacheStrategy option on every method), so this must
    // accept both rather than just the shape withUtf8mb4's callback expects.
    type WriteClient = Parameters<Parameters<typeof withUtf8mb4>[0]>[0] | typeof prisma

    const runInfluencerUpdate = (client: WriteClient) =>
      client.influencer.update({
        where: { id },
        data: inf,
        // email and profile_image_url are read back because the route NORMALISES
        // them (an address without "@" and an expiring CDN url both become null).
        // The client needs what was stored, not what it sent.
        select: { handle: true, platform: true, email: true, profile_image_url: true },
      })

    const runBrandInfluencerUpdate = (client: WriteClient) =>
      client.brandInfluencer.update({
        where: { brand_id_influencer_id: { brand_id: brandId, influencer_id: id } },
        data: bi,
        select: { approval_status: true, transferred_date: true },
      })

    if (Object.keys(inf).length > 0 || Object.keys(bi).length > 0) {
      if (needsUtf8mb4) {
        // One pinned connection, so the SET NAMES and the write provably share a
        // session — statements must go through `tx`, never the global client.
        await withUtf8mb4(async (tx) => {
          if (Object.keys(inf).length > 0) savedInf = await runInfluencerUpdate(tx)
          if (Object.keys(bi).length > 0) savedBi = await runBrandInfluencerUpdate(tx)
        })
      } else {
        // Fast path: no transaction. The two writes are independent but run one
        // after the other, not together: DATABASE_URL caps this deployment at
        // connection_limit=3, and this is the route every autosave goes
        // through, so a second concurrent connection per save was enough to
        // exhaust the pool under normal editing (P2037/P2024).
        if (Object.keys(inf).length > 0) savedInf = await runInfluencerUpdate(prisma)
        if (Object.keys(bi).length > 0) savedBi = await runBrandInfluencerUpdate(prisma)
      }
    }
    if (!savedInf) {
      savedInf = await prisma.influencer.findUnique({
        where: { id },
        select: { handle: true, platform: true, email: true, profile_image_url: true },
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
    // Queued as thunks rather than started immediately: these are fire-and-
    // forget writes, and starting them together took one pooled connection per
    // log on top of the save that is still finishing.
    const logs: (() => Promise<void>)[] = []

    if (before && Object.keys(inf).length > 0) {
      logs.push(() =>
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
      logs.push(() =>
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
      logs.push(() =>
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
      logs.push(() =>
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

    if (logs.length > 0) {
      // Sequential, for the same connection-pool reason as the writes above.
      void (async () => {
        for (const log of logs) await log()
      })().catch(console.error)
    }

    return NextResponse.json({
      success: true,
      ...(savedInf
        ? {
            handle:   (savedInf as { handle: string }).handle,
            platform: (savedInf as { platform: string }).platform,
            // Returned so the client can reconcile the two fields this route
            // rewrites. Without them the client kept showing an address it had
            // sent and the route had discarded, its diff saw no change, and the
            // value silently vanished on the next reload.
            email:             (savedInf as { email: string | null }).email,
            profile_image_url: (savedInf as { profile_image_url: string | null }).profile_image_url,
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

    // The full driver text — collation names, the parameter, the raw SQL error —
    // is for the log, not for the browser. It is unreadable to the person
    // editing an influencer and it describes our storage internals.
    console.error("PUT /influencers/[id]:", err?.code, err?.message)

    // Length overflow is the one remaining failure a user can act on.
    if (err?.code === "P2000") {
      return NextResponse.json(
        { error: "One of the fields is too long to save. Please shorten it and try again." },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Couldn't save this influencer. Please try again." },
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

    // ── Delete for real, not just the link ──────────────────────────────────
    // This used to delete ONLY the BrandInfluencer row. Two things were left
    // behind by that:
    //
    //   1. Every record owned by that membership — attribution, partner,
    //      custom values, outreach logs, content posts, detected posts,
    //      detection settings — kept pointing at a row that no longer existed.
    //      The schema declares onDelete: Cascade for these, but the tables are
    //      MyISAM, where MySQL accepts a foreign key and then ignores it, so
    //      nothing actually cascades and the children were orphaned. The same
    //      explicit, dependency-ordered cascade the global delete already
    //      performs (app/api/influencers/[id]) is done here.
    //
    //   2. The Influencer row itself, which is GLOBAL — /api/influencers/create
    //      reuses it by handle+platform. Re-adding the same handle afterwards
    //      therefore resurrected the old bio, avatar, email and stats instead
    //      of storing what was just fetched.
    //
    // The global row is only removed when THIS was its last membership. While
    // another brand still links it, it is that brand's data and must survive.
    const link = await prisma.brandInfluencer.findUnique({
      where: { brand_id_influencer_id: { brand_id: brandId, influencer_id: id } },
      select: { id: true },
    })
    if (!link) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const otherBrandLinks = await prisma.brandInfluencer.count({
      where: { influencer_id: id, id: { not: link.id } },
    })

    // One transaction, sequential array form — the form this codebase uses
    // everywhere except withUtf8mb4 (see lib/prisma.ts), and the one that holds
    // a single pooled connection rather than one per statement. A partial
    // delete therefore cannot leave a membership without its children, or
    // children without their membership.
    await prisma.$transaction([
      prisma.brandPartner.deleteMany({ where: { brand_influencer_id: link.id } }),
      prisma.attribution.deleteMany({ where: { brand_influencer_id: link.id } }),
      prisma.brandInfluencerCustomValue.deleteMany({ where: { brand_influencer_id: link.id } }),
      prisma.outreachLog.deleteMany({ where: { brand_influencer_id: link.id } }),
      prisma.contentPost.deleteMany({ where: { brand_influencer_id: link.id } }),
      prisma.detectedPost.deleteMany({ where: { brand_influencer_id: link.id } }),
      prisma.postDetectionSetting.deleteMany({ where: { brand_influencer_id: link.id } }),
      // Order history and monitoring runs are onDelete: SetNull in the schema:
      // they are the brand's own records and outlive the influencer, they just
      // lose the link. Deleting them would destroy financial and audit data.
      prisma.goAffProOrder.updateMany({
        where: { brand_influencer_id: link.id },
        data: { brand_influencer_id: null },
      }),
      prisma.shopifyOrder.updateMany({
        where: { brand_influencer_id: link.id },
        data: { brand_influencer_id: null },
      }),
      prisma.monitoringRun.updateMany({
        where: { brand_influencer_id: link.id },
        data: { brand_influencer_id: null },
      }),
      prisma.brandInfluencer.delete({ where: { id: link.id } }),
      ...(otherBrandLinks === 0
        ? [prisma.influencer.delete({ where: { id } })]
        : []),
    ])

    logActivity({
      brandId,
      userId: session.user.id,
      action: "influencer.removed",
      entityType: "brand_influencer",
      entityId: id,
      details: {},
    }).catch(console.error)

    // The id is returned so the client can drop exactly this row from its own
    // state and from the shared cache entry, rather than inferring it.
    return NextResponse.json({
      success: true,
      id,
      /** False when another brand still links this influencer, so the global row stays. */
      influencerDeleted: otherBrandLinks === 0,
    })
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { canAddInfluencer } from "@/lib/subscription-limits"
import { logActivity } from "@/lib/activity-log"
import { persistAvatarUrl } from "@/lib/avatar-storage"
import { newDraftHandle } from "@/lib/influencer-draft"
import { normalizeInfluencerIdentity } from "@/lib/influencer-draft"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await req.json()

    // ── Draft rows ──────────────────────────────────────────────────────────
    // A blank row the user just added in the Influencer List. Persisted right
    // away so it survives a refresh, but it is not an influencer yet:
    //
    //   * it carries a generated unique handle, so it cannot collide with
    //     another draft or with a real handle on @@unique([handle, platform]);
    //   * `is_draft` keeps it out of plan limits, analytics, Pipeline,
    //     approvals, admin metrics, exports and the influencer picker;
    //   * canAddInfluencer is deliberately NOT consulted — a blank row must not
    //     consume a paid slot. The limit is enforced when the row is promoted
    //     to a real influencer, which is where an influencer is actually added.
    //
    // Nothing else about this route changes: a request without `draft` still
    // requires a handle and a platform exactly as before.
    if (data.draft) {
      if (!data.brandId) {
        return NextResponse.json({ error: "brandId is required for a draft" }, { status: 400 })
      }

      const brand = await prisma.brand.findUnique({ where: { id: data.brandId } })
      if (!brand) {
        return NextResponse.json({ error: "Brand not found" }, { status: 404 })
      }
      // Same gate the brand's own influencer routes apply: owner or member.
      const isOwner = brand.owner_id === session.user.id
      const isMember = isOwner
        ? true
        : !!(await prisma.brandMember.findFirst({
            where: { brand_id: data.brandId, user_id: session.user.id },
          }))
      if (!isMember) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      const draft = await prisma.influencer.create({
        data: { handle: newDraftHandle(), platform: "", is_draft: true },
      })
      await prisma.brandInfluencer.create({
        data: {
          brand_id: data.brandId,
          influencer_id: draft.id,
          contact_status: "not_contacted",
          stage: 1,
        },
      })

      // Returned with a BLANK handle: the placeholder is an implementation
      // detail of the unique index and must never reach the sheet.
      return NextResponse.json({ ...draft, handle: "", is_draft: true }, { status: 201 })
    }

    if (!data.handle || !data.platform) {
      return NextResponse.json(
        { error: "handle and platform are required" },
        { status: 400 }
      )
    }

    // One shared normalizer, so the identity this stores is byte-identical to
    // the one the promote path and the find route look up. This used to omit the
    // "@" strip, so "@nike" was stored as a different influencer from "nike".
    const { handle, platform } = normalizeInfluencerIdentity(data.handle, data.platform)

    if (data.brandId) {
      const limitCheck = await canAddInfluencer(session.user.id, data.brandId)
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: limitCheck.message || "Influencer limit reached",
            requiresSubscription: limitCheck.requiresSubscription ?? false,
            current: limitCheck.current,
            max: limitCheck.max,
            subscriptionStatus: limitCheck.subscriptionStatus,
          },
          { status: 403 }
        )
      }
    }

    let influencer = await prisma.influencer.findUnique({
      where: { handle_platform: { handle, platform } },
    })

    const isNew = !influencer

    if (!influencer) {
      influencer = await prisma.influencer.create({
        data: {
          handle,
          platform,
          full_name: data.full_name || null,
          email: data.email || null,
          gender: data.gender || null,
          niche: data.niche || null,
          location: data.location || null,
          bio: data.bio || null,
          profile_image_url: null, // stored below, once the row has an id
          social_link: data.social_link || null,
          follower_count: data.follower_count || 0,
          engagement_rate: data.engagement_rate || 0,
          avg_likes: data.avg_likes || 0,
          avg_comments: data.avg_comments || 0,
          avg_views: data.avg_views || 0,
        },
      })

      // The avatar arrives as an Instagram/TikTok CDN link, which expires. It is
      // downloaded and stored on Cloudinary so what the database holds is a
      // permanent URL — see lib/avatar-storage. Done after the create because
      // the stored asset is keyed by the influencer's id; a failure here leaves
      // the influencer saved with no avatar rather than failing the create.
      const storedAvatar = await persistAvatarUrl(data.profile_image_url, influencer.id)
      if (storedAvatar) {
        influencer = await prisma.influencer.update({
          where: { id: influencer.id },
          data: { profile_image_url: storedAvatar },
        })
      }
    }

    if (data.brandId) {
      try {
        // ── Membership is UPSERTED, not checked-then-created ────────────────
        // The previous shape was `findFirst` then `create`, which is not atomic:
        // two adds of the same influencer landing together both saw "no link"
        // and both inserted, so the unique index rejected the loser and the user
        // got a failure for an add that should simply have been a no-op.
        //
        // `upsert` on the (brand_id, influencer_id) unique key lets the DATABASE
        // arbitrate. Re-adding an influencer that is already on the list is
        // therefore idempotent rather than an error, and a membership deleted
        // earlier is recreated cleanly — the global Influencer record is reused
        // untouched, which is what keeps brand membership separate from the
        // global directory.
        //
        // `update: {}` is deliberate: an existing membership keeps its stage,
        // status, notes and history. Re-adding must not reset someone's pipeline
        // position.
        const beforeUpsert = await prisma.brandInfluencer.findUnique({
          where: {
            brand_id_influencer_id: { brand_id: data.brandId, influencer_id: influencer.id },
          },
          select: { id: true },
        })

        const brandInfluencer = await prisma.brandInfluencer.upsert({
          where: {
            brand_id_influencer_id: { brand_id: data.brandId, influencer_id: influencer.id },
          },
          create: {
            brand_id: data.brandId,
            influencer_id: influencer.id,
            contact_status: "not_contacted",
            stage: 1,
          },
          update: {},
        })

        // Logged only for a membership that did not exist a moment ago, so
        // re-adding an existing one does not add a second "added" entry.
        if (!beforeUpsert) {

          logActivity({
            brandId: data.brandId,
            userId: session.user.id,
            action: "influencer.added",
            entityType: "brand_influencer",
            entityId: brandInfluencer.id,
            details: {
              method: data.method ?? "manual",
              handle,
              platform,
              is_new_global: isNew,
            },
          }).catch(console.error)
        }
      } catch (brandLinkError) {
        console.error(
          `Failed to link influencer ${influencer.id} to brand ${data.brandId}:`,
          brandLinkError
        )
        return NextResponse.json(
          { ...influencer, warning: "Influencer created/reused but brand linking failed." },
          { status: 201 }
        )
      }
    }

    return NextResponse.json({ ...influencer, reused: !isNew }, { status: 201 })
  } catch (error) {
    const e = error as { code?: string; message?: string }
    // The CODE and message, not just the object — "Failed to create influencer"
    // told nobody anything, and the actual cause of a burst failure (P2028 /
    // P2024, the connection pool refusing another transaction) was invisible in
    // the log as well as in the response.
    console.error("Error in POST /api/influencers/create:", e?.code, e?.message)

    // Running out of connections is a CAPACITY problem, not a broken request:
    // it clears on its own and the same call succeeds a moment later. Reported
    // as a retryable 503 so the client can tell "try again" from "this will
    // never work" — the same treatment the read routes already give it.
    //
    //   P2024  timed out fetching a connection from the pool
    //   P2028  unable to START a transaction in the given time — what a burst
    //          of concurrent creates actually hits, since each one opens a
    //          transaction against connection_limit=3
    if (e?.code === "P2024" || e?.code === "P2028" || isDatabaseCapacityError(e?.message ?? "")) {
      return databaseCapacityResponse()
    }

    return NextResponse.json({ error: "Failed to create influencer" }, { status: 500 })
  }
}
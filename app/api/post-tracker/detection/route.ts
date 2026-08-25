import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBrandAccess } from "@/lib/brand-access"
import { getAddonStatus, isAddonActive, getSubscriptionEligibility } from "@/lib/post-tracker/addon"
import { getQuota } from "@/lib/post-tracker/quota"

/** Must match the card's page size so "Load more" pages line up. */
const DETECTED_POSTS_PAGE_SIZE = 5

// GET /api/post-tracker/detection?brandId=...&biId=...
// Returns the automatic post-detection config + recently detected posts for
// one influencer (brand_influencer row), scoped to the requesting brand.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const brandId = req.nextUrl.searchParams.get("brandId")
    const biId = req.nextUrl.searchParams.get("biId")
    if (!brandId || !biId) {
      return NextResponse.json({ error: "brandId and biId are required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const influencer = await prisma.brandInfluencer.findFirst({
      where: { id: biId, brand_id: brandId },
      select: { id: true },
    })
    if (!influencer) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 })
    }

    const [setting, posts, addon, quota] = await Promise.all([
      prisma.postDetectionSetting.findUnique({ where: { brand_influencer_id: biId } }),
      // First page only. The card pages and polls through
      // /api/post-tracker/detection/posts; loading the full history here would
      // make every config read grow with the detection log.
      prisma.detectedPost.findMany({
        where: { brand_influencer_id: biId },
        orderBy: { detected_at: "desc" },
        take: DETECTED_POSTS_PAGE_SIZE + 1,
      }),
      getAddonStatus(brandId),
      getQuota(brandId),
    ])

    // Server-derived: does the user's live subscription entitle them to the
    // add-on? The card uses this to self-unlock on return from checkout, so the
    // UI reflects the database rather than any client-side breadcrumb.
    const eligibility = await getSubscriptionEligibility(session.user.id)

    return NextResponse.json({
      enabled: setting?.enabled ?? false,
      // Brand-level first — detection is configured once per brand now. The
      // per-influencer columns are the fallback for brands set up before that.
      hashtags: addon.hashtags || setting?.hashtags || "",
      mentions: addon.mentions || setting?.mentions || "",
      lastSyncedAt: setting?.last_synced_at ?? null,
      lastError: setting?.last_error ?? null,
      // Add-on entitlement and today's testing quota travel with the config so
      // the card renders its gate and quota readout without a second request.
      addonActive: addon.active,
      addonStatus: addon.status,
      // True when the subscription is paid but the entitlement row isn't active
      // yet — i.e. the user has paid and the add-on can be claimed right now.
      canClaimAddon: !addon.active && eligibility.eligible,
      subscriptionEligible: eligibility.eligible,
      quota: {
        apiRequests: quota.apiRequests,
        apiLimit: quota.apiLimit,
        postsImported: quota.postsImported,
        postLimit: quota.postLimit,
        exhausted: quota.exhausted,
        resetsAt: quota.resetsAt,
      },
      postsHasMore: posts.length > DETECTED_POSTS_PAGE_SIZE,
      posts: posts.slice(0, DETECTED_POSTS_PAGE_SIZE).map((p) => ({
        id: p.id,
        platform: p.platform,
        postUrl: p.post_url,
        matchedHashtag: p.matched_hashtag,
        matchedMention: p.matched_mention,
        author: p.author,
        caption: p.caption,
        publishedAt: p.published_at,
        likeCount: p.like_count,
        commentCount: p.comment_count,
        viewCount: p.view_count,
        detectedAt: p.detected_at,
      })),
    })
  } catch (error) {
    console.error("[GET /post-tracker/detection]", error)
    return NextResponse.json({ error: "Failed to load detection settings" }, { status: 500 })
  }
}

// PATCH /api/post-tracker/detection
// Body: { brandId, biId, enabled?, hashtags?, mentions? }
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { brandId, biId, enabled, hashtags, mentions } = body

    if (!brandId || !biId) {
      return NextResponse.json({ error: "brandId and biId are required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const influencer = await prisma.brandInfluencer.findFirst({
      where: { id: biId, brand_id: brandId },
      select: { id: true },
    })
    if (!influencer) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 })
    }

    const data: { enabled?: boolean; hashtags?: string | null; mentions?: string | null } = {}

    // Enabling monitoring requires the add-on. Enforced here, not just in the
    // UI: the toggle is a client control and the client can be bypassed.
    // Disabling is always allowed so an expired add-on can never trap a user
    // with monitoring stuck on.
    if (enabled === true && !(await isAddonActive(brandId))) {
      return NextResponse.json(
        { error: "The Post Tracker Add-on is required to enable automatic post detection.", addonRequired: true },
        { status: 402 }
      )
    }

    if (typeof enabled === "boolean") data.enabled = enabled

    // ── Hashtags and mentions are BRAND-level ─────────────────────────────────
    // Detection is a paid brand feature, so what it matches on is configured
    // once for the brand and used for every influencer handle it monitors.
    // Written to PostTrackerAddon, the row that already represents the add-on
    // for this brand.
    //
    // The per-influencer columns are deliberately NOT written any more. They
    // stay in place as a read-only fallback for brands configured before this,
    // which the monitor still honours.
    if (typeof hashtags === "string" || typeof mentions === "string") {
      await prisma.postTrackerAddon.upsert({
        where: { brand_id: brandId },
        create: {
          brand_id: brandId,
          // No entitlement is granted here — that is activateAddon's job. This
          // only carries configuration for a brand that has not bought it yet.
          status: "inactive",
          ...(typeof hashtags === "string" ? { detection_hashtags: hashtags.trim() || null } : {}),
          ...(typeof mentions === "string" ? { detection_mentions: mentions.trim() || null } : {}),
        },
        update: {
          ...(typeof hashtags === "string" ? { detection_hashtags: hashtags.trim() || null } : {}),
          ...(typeof mentions === "string" ? { detection_mentions: mentions.trim() || null } : {}),
        },
      })
    }

    const setting = await prisma.postDetectionSetting.upsert({
      where: { brand_influencer_id: biId },
      create: {
        brand_influencer_id: biId,
        brand_id: brandId,
        enabled: data.enabled ?? false,
      },
      update: data,
    })

    // Read back what the brand now holds, so the client renders the shared
    // values rather than this influencer's legacy copy.
    const addonConfig = await getAddonStatus(brandId)

    return NextResponse.json({
      enabled: setting.enabled,
      hashtags: addonConfig.hashtags || setting.hashtags || "",
      mentions: addonConfig.mentions || setting.mentions || "",
    })
  } catch (error) {
    console.error("[PATCH /post-tracker/detection]", error)
    return NextResponse.json({ error: "Failed to save detection settings" }, { status: 500 })
  }
}

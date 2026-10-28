import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBrandAccess } from "@/lib/brand-access"
import { getAddonStatus, isAddonActive, getSubscriptionEligibility } from "@/lib/post-tracker/addon"
import { getQuota } from "@/lib/post-tracker/quota"
import { isValidScheduleTime, isValidTimezone } from "@/lib/post-tracker/schedule"

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
      // Brand-wide switch — the same value on every influencer's card.
      enabled: addon.active && addon.detectionEnabled,
      // Brand-level first — detection is configured once per brand now. The
      // per-influencer columns are the fallback for brands set up before that.
      hashtags: addon.hashtags || setting?.hashtags || "",
      mentions: addon.mentions || setting?.mentions || "",
      // Brand-level Instagram account for tagged-posts detection.
      instagramUsername: addon.instagramUsername,
      instagramAccountFound: Boolean(addon.instagramUserId),
      taggedLastSyncedAt: addon.taggedLastSyncedAt,
      taggedLastError: addon.taggedLastError,
      tiktokKeyword: addon.tiktokKeyword,
      keywordLastSyncedAt: addon.keywordLastSyncedAt,
      keywordLastError: addon.keywordLastError,
      // Daily schedule (lib/post-tracker/schedule.ts).
      igScheduleTime: addon.igScheduleTime,
      tiktokScheduleTime: addon.tiktokScheduleTime,
      scheduleTimezone: addon.scheduleTimezone,
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
        source: p.source,
        mediaType: p.media_type,
        media: p.media,
        detectedAt: p.detected_at,
      })),
    })
  } catch (error) {
    console.error("[GET /post-tracker/detection]", error)
    return NextResponse.json({ error: "Failed to load detection settings" }, { status: 500 })
  }
}

/** An Instagram handle as stored: no '@', lowercase, Instagram's own charset. */
function cleanInstagramHandle(raw: string): string | null {
  const handle = raw.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").toLowerCase()
  if (!handle) return ""
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null
}

// PATCH /api/post-tracker/detection
// Body: { brandId, biId, enabled?, hashtags?, mentions?, instagramUsername?, tiktokKeyword?,
//         igScheduleTime?, tiktokScheduleTime?, scheduleTimezone? }
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { brandId, biId, enabled, hashtags, mentions, instagramUsername, tiktokKeyword, igScheduleTime, tiktokScheduleTime, scheduleTimezone } = body

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

    // ── The on/off switch is BRAND-level ──────────────────────────────────────
    // Detection covers every tracked influencer of the brand, so the toggle on
    // any influencer's card switches it for the whole brand. It used to be saved
    // per influencer (PostDetectionSetting.enabled), which nothing read.
    if (typeof enabled === "boolean") {
      await prisma.postTrackerAddon.upsert({
        where: { brand_id: brandId },
        // Configuration only — no entitlement is granted here.
        create: { brand_id: brandId, status: "inactive", detection_enabled: enabled },
        update: { detection_enabled: enabled },
      })
    }

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

    // ── The brand's Instagram account (tagged-posts detection) ─────────────────
    // Brand-level like the terms above. A changed handle drops the cached
    // numeric id and the last tagged-run state, so the next pass resolves the
    // new account instead of reading the old one's tags.
    if (typeof instagramUsername === "string") {
      const handle = cleanInstagramHandle(instagramUsername)
      if (handle === null) {
        return NextResponse.json(
          { error: "Enter the brand's Instagram username, e.g. @yourbrand." },
          { status: 400 }
        )
      }
      const existing = await prisma.postTrackerAddon.findUnique({
        where: { brand_id: brandId },
        select: { instagram_username: true },
      })
      if ((existing?.instagram_username ?? "") !== handle) {
        const fields = {
          instagram_username: handle || null,
          instagram_user_id: null,
          tagged_last_synced_at: null,
          tagged_last_error: null,
        }
        await prisma.postTrackerAddon.upsert({
          where: { brand_id: brandId },
          // Configuration only — no entitlement is granted here.
          create: { brand_id: brandId, status: "inactive", ...fields },
          update: fields,
        })
      }
    }

    // ── The brand's TikTok keyword (keyword-search detection) ──────────────────
    // Brand-level, like the Instagram account. A changed keyword resets the
    // last-run state so the card doesn't show the old keyword's result.
    if (typeof tiktokKeyword === "string") {
      // "@Lotgenootje" / "#lotgenootje" → "lotgenootje" — the bare word is what
      // the search takes and what captions are matched against.
      const keyword = tiktokKeyword.trim().replace(/^[#@]+/, "").toLowerCase().slice(0, 100)
      const existing = await prisma.postTrackerAddon.findUnique({
        where: { brand_id: brandId },
        select: { tiktok_keyword: true },
      })
      if ((existing?.tiktok_keyword ?? "") !== keyword) {
        const fields = { tiktok_keyword: keyword || null, keyword_last_synced_at: null, keyword_last_error: null }
        await prisma.postTrackerAddon.upsert({
          where: { brand_id: brandId },
          // Configuration only — no entitlement is granted here.
          create: { brand_id: brandId, status: "inactive", ...fields },
          update: fields,
        })
      }
    }

    // ── Daily schedule — brand-level, like everything above ───────────────────
    // Changing a time or the timezone clears that platform's "already ran
    // today" mark, so a time moved later today still runs today.
    if (igScheduleTime !== undefined || tiktokScheduleTime !== undefined || scheduleTimezone !== undefined) {
      if (igScheduleTime !== undefined && !isValidScheduleTime(igScheduleTime)) {
        return NextResponse.json({ error: "Instagram time must be HH:MM (24-hour)." }, { status: 400 })
      }
      if (tiktokScheduleTime !== undefined && !isValidScheduleTime(tiktokScheduleTime)) {
        return NextResponse.json({ error: "TikTok time must be HH:MM (24-hour)." }, { status: 400 })
      }
      if (scheduleTimezone !== undefined && !isValidTimezone(scheduleTimezone)) {
        return NextResponse.json({ error: "Unknown timezone." }, { status: 400 })
      }
      const fields = {
        ...(igScheduleTime !== undefined ? { ig_schedule_time: igScheduleTime, ig_last_scheduled_date: null } : {}),
        ...(tiktokScheduleTime !== undefined ? { tiktok_schedule_time: tiktokScheduleTime, tiktok_last_scheduled_date: null } : {}),
        ...(scheduleTimezone !== undefined
          ? { schedule_timezone: scheduleTimezone, ig_last_scheduled_date: null, tiktok_last_scheduled_date: null }
          : {}),
      }
      await prisma.postTrackerAddon.upsert({
        where: { brand_id: brandId },
        // Configuration only — no entitlement is granted here.
        create: { brand_id: brandId, status: "inactive", ...fields },
        update: fields,
      })
    }

    // Legacy per-influencer hashtags/mentions, read only as a fallback below.
    const setting = await prisma.postDetectionSetting.findUnique({ where: { brand_influencer_id: biId } })

    // Read back what the brand now holds, so the client renders the shared
    // values rather than this influencer's legacy copy.
    const addonConfig = await getAddonStatus(brandId)

    return NextResponse.json({
      enabled: addonConfig.active && addonConfig.detectionEnabled,
      hashtags: addonConfig.hashtags || setting?.hashtags || "",
      mentions: addonConfig.mentions || setting?.mentions || "",
      instagramUsername: addonConfig.instagramUsername,
      instagramAccountFound: Boolean(addonConfig.instagramUserId),
      taggedLastSyncedAt: addonConfig.taggedLastSyncedAt,
      taggedLastError: addonConfig.taggedLastError,
      tiktokKeyword: addonConfig.tiktokKeyword,
      keywordLastSyncedAt: addonConfig.keywordLastSyncedAt,
      keywordLastError: addonConfig.keywordLastError,
      igScheduleTime: addonConfig.igScheduleTime,
      tiktokScheduleTime: addonConfig.tiktokScheduleTime,
      scheduleTimezone: addonConfig.scheduleTimezone,
    })
  } catch (error) {
    console.error("[PATCH /post-tracker/detection]", error)
    return NextResponse.json({ error: "Failed to save detection settings" }, { status: 500 })
  }
}

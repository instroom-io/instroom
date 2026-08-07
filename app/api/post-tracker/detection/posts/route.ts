import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBrandAccess } from "@/lib/brand-access"

// GET /api/post-tracker/detection/posts?brandId=&biId=&limit=&since=&before=
//
// Detected posts only — deliberately separate from the config endpoint so the
// 30–60s poll and "Load more" fetch just the rows they need, instead of
// re-reading settings, add-on entitlement and quota every cycle.
//
// Modes:
//   since=<ISO>   newer than this timestamp  (incremental poll — usually empty)
//   before=<ISO>  older than this timestamp  (Load more — pagination cursor)
//   neither       the newest `limit` posts   (initial load)
//
// Always ordered by detected_at DESC — newest first, in every mode.

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 50

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    const brandId = sp.get("brandId")
    const biId = sp.get("biId")
    if (!brandId || !biId) {
      return NextResponse.json({ error: "brandId and biId are required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Scope the query to this brand as well as the influencer, so a guessed
    // biId from another workspace can't leak rows.
    const influencer = await prisma.brandInfluencer.findFirst({
      where: { id: biId, brand_id: brandId },
      select: { id: true },
    })
    if (!influencer) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 })
    }

    const limit = Math.min(Math.max(Number(sp.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT)

    const parseDate = (raw: string | null) => {
      if (!raw) return null
      const d = new Date(raw)
      return Number.isNaN(d.getTime()) ? null : d
    }
    const since = parseDate(sp.get("since"))
    const before = parseDate(sp.get("before"))

    const posts = await prisma.detectedPost.findMany({
      where: {
        brand_influencer_id: biId,
        ...(since ? { detected_at: { gt: since } } : {}),
        ...(before ? { detected_at: { lt: before } } : {}),
      },
      orderBy: { detected_at: "desc" },
      // One extra row is fetched purely to answer "is there more?" without a
      // second COUNT query; it is sliced off before responding.
      take: limit + 1,
    })

    const hasMore = posts.length > limit
    const page = hasMore ? posts.slice(0, limit) : posts

    return NextResponse.json({
      posts: page.map((p) => ({
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
      // Only meaningful for paging older rows; a `since` poll is open-ended.
      hasMore: since ? false : hasMore,
    })
  } catch (error) {
    console.error("[GET /post-tracker/detection/posts]", error)
    return NextResponse.json({ error: "Failed to load detected posts" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBrandAccess } from "@/lib/brand-access"

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

    const [setting, posts] = await Promise.all([
      prisma.postDetectionSetting.findUnique({ where: { brand_influencer_id: biId } }),
      prisma.detectedPost.findMany({
        where: { brand_influencer_id: biId },
        orderBy: { detected_at: "desc" },
        take: 20,
      }),
    ])

    return NextResponse.json({
      enabled: setting?.enabled ?? false,
      hashtags: setting?.hashtags ?? "",
      mentions: setting?.mentions ?? "",
      posts: posts.map((p) => ({
        id: p.id,
        platform: p.platform,
        postUrl: p.post_url,
        matchedHashtag: p.matched_hashtag,
        matchedMention: p.matched_mention,
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
    if (typeof enabled === "boolean") data.enabled = enabled
    if (typeof hashtags === "string") data.hashtags = hashtags.trim() || null
    if (typeof mentions === "string") data.mentions = mentions.trim() || null

    const setting = await prisma.postDetectionSetting.upsert({
      where: { brand_influencer_id: biId },
      create: {
        brand_influencer_id: biId,
        brand_id: brandId,
        enabled: data.enabled ?? false,
        hashtags: data.hashtags,
        mentions: data.mentions,
      },
      update: data,
    })

    return NextResponse.json({
      enabled: setting.enabled,
      hashtags: setting.hashtags ?? "",
      mentions: setting.mentions ?? "",
    })
  } catch (error) {
    console.error("[PATCH /post-tracker/detection]", error)
    return NextResponse.json({ error: "Failed to save detection settings" }, { status: 500 })
  }
}

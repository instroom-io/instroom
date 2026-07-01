// app/api/influencers/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search         = searchParams.get("search") || ""
    const excludeBrandId = searchParams.get("exclude_brand_id") || ""
    const limit          = Math.min(parseInt(searchParams.get("limit") || "100"), 200)

    // Collect influencer IDs already linked to the brand so we can exclude them
    const excludedInfluencerIds: string[] = []
    if (excludeBrandId) {
      const existing = await prisma.brandInfluencer.findMany({
        where: { brand_id: excludeBrandId },
        select: { influencer_id: true },
      })
      excludedInfluencerIds.push(...existing.map((e) => e.influencer_id))
    }

    const influencers = await prisma.influencer.findMany({
      where: {
        ...(excludedInfluencerIds.length > 0
          ? { id: { notIn: excludedInfluencerIds } }
          : {}),
        ...(search
          ? {
              OR: [
                { handle:    { contains: search } },
                { full_name: { contains: search } },
                { niche:     { contains: search } },
                { location:  { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { created_at: "desc" },
      take: limit,
      select: {
        id:              true,
        handle:          true,
        platform:        true,
        full_name:       true,
        niche:           true,
        location:        true,
        follower_count:  true,
        engagement_rate: true,
      },
    })

    return NextResponse.json({ data: influencers })
  } catch (error) {
    console.error("[GET /api/influencers]", error)
    return NextResponse.json({ error: "Failed to fetch influencers" }, { status: 500 })
  }
}
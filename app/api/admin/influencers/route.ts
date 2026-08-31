import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  const q = req.nextUrl.searchParams.get("q")?.trim() || ""

  // Drafts are blank rows belonging to one brand's sheet, not platform
  // influencers — they do not belong in the admin directory.
  const influencers = await prisma.influencer.findMany({
    where: {
      is_draft: false,
      ...(q ? { OR: [{ handle: { contains: q } }, { full_name: { contains: q } }] } : {}),
    },
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true, handle: true, full_name: true, platform: true, profile_image_url: true,
      follower_count: true, niche: true, verification_status: true, is_suspended: true,
      created_at: true,
      _count: { select: { brandInfluencers: true } },
    },
  })

  return NextResponse.json({
    influencers: influencers.map((i) => ({
      id: i.id,
      handle: i.handle,
      fullName: i.full_name,
      platform: i.platform,
      profileImageUrl: i.profile_image_url,
      followerCount: i.follower_count,
      category: i.niche,
      verificationStatus: i.verification_status,
      isSuspended: i.is_suspended,
      campaignCount: i._count.brandInfluencers,
      createdAt: i.created_at,
    })),
  })
}

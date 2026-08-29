import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { canAddInfluencer } from "@/lib/subscription-limits"
import { logActivity } from "@/lib/activity-log"
import { persistAvatarUrl } from "@/lib/avatar-storage"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await req.json()

    if (!data.handle || !data.platform) {
      return NextResponse.json(
        { error: "handle and platform are required" },
        { status: 400 }
      )
    }

    const handle = data.handle.trim().toLowerCase()
    const platform = data.platform.trim().toLowerCase()

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
        const existingLink = await prisma.brandInfluencer.findFirst({
          where: { brand_id: data.brandId, influencer_id: influencer.id },
        })

        if (!existingLink) {
          const brandInfluencer = await prisma.brandInfluencer.create({
            data: {
              brand_id: data.brandId,
              influencer_id: influencer.id,
              contact_status: "not_contacted",
              stage: 1,
            },
          })

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
    console.error("Error in POST /api/influencers/create:", error)
    return NextResponse.json({ error: "Failed to create influencer" }, { status: 500 })
  }
}
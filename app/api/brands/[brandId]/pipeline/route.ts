// app/api/influencers/create/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { canAddInfluencer } from "@/lib/subscription-limits"

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

    // Always strip @ for storage — display layer adds it back for TikTok
    const handle = data.handle.trim().replace(/^@/, "").toLowerCase()
    const platform = data.platform.toLowerCase()

    // Check subscription limit before anything else
    if (data.brandId) {
      const limitCheck = await canAddInfluencer(session.user.id, data.brandId)
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: limitCheck.message || "Influencer limit reached",
            requiresSubscription: true,
            current: limitCheck.current,
            max: limitCheck.max,
          },
          { status: 403 }
        )
      }
    }

    // Check if this handle+platform already exists globally
    const existing = await prisma.influencer.findUnique({
      where: { handle_platform: { handle, platform } },
    })

    if (existing) {
      // Influencer exists globally — just link them to the brand if brandId provided
      if (data.brandId) {
        const existingLink = await prisma.brandInfluencer.findUnique({
          where: {
            brand_id_influencer_id: {
              brand_id: data.brandId,
              influencer_id: existing.id,
            },
          },
        })

        if (!existingLink) {
          await prisma.brandInfluencer.create({
            data: {
              brand_id: data.brandId,
              influencer_id: existing.id,
              contact_status: "not_contacted",
              stage: 1,
            },
          })
        }
      }

      // Return 409 with the real id so the client can swap its temp UUID
      return NextResponse.json(
        {
          error: "Influencer already exists",
          id: existing.id,
          handle: existing.handle,
        },
        { status: 409 }
      )
    }

    const influencer = await prisma.influencer.create({
      data: {
        handle,
        platform,
        full_name: data.full_name || null,
        email: data.email || null,
        gender: data.gender || null,
        niche: data.niche || null,
        location: data.location || null,
        bio: data.bio || null,
        profile_image_url: data.profile_image_url || null,
        social_link: data.social_link || null,
        follower_count: parseInt(String(data.follower_count)) || 0,
        engagement_rate: parseFloat(String(data.engagement_rate)) || 0,
        avg_likes: parseInt(String(data.avg_likes)) || 0,
        avg_comments: parseInt(String(data.avg_comments)) || 0,
        avg_views: parseInt(String(data.avg_views)) || 0,
      },
    })

    // Link to brand
    if (data.brandId) {
      await prisma.brandInfluencer.create({
        data: {
          brand_id: data.brandId,
          influencer_id: influencer.id,
          contact_status: "not_contacted",
          stage: 1,
        },
      })
    }

    return NextResponse.json(influencer, { status: 201 })
  } catch (error: any) {
    if (error.code === "P2002") {
      const handle = (await req.json().catch(() => ({}))).handle?.replace(/^@/, "").toLowerCase()
      const existing = await prisma.influencer
        .findUnique({ where: { handle_platform: { handle: handle || "", platform: "" } } })
        .catch(() => null)
      return NextResponse.json(
        { error: "Influencer already exists", id: existing?.id },
        { status: 409 }
      )
    }
  }
}
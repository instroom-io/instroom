// app\api\influencers\[id]\route.ts

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  req: Request,
  context: any
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Properly await params which is a Promise in Next.js 13+
    const params = await context.params
    const id = params?.id

    if (!id) {
      return NextResponse.json({ error: "Influencer ID is required" }, { status: 400 })
    }

    const influencer = await prisma.influencer.findUnique({
      where: { id },
    })

    if (!influencer) {
      return NextResponse.json(
        { error: "Influencer not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(influencer)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch influencer", details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: Request,
  context: any
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Properly await params which is a Promise in Next.js 13+
    const params = await context.params
    const id = params?.id

    if (!id) {
      return NextResponse.json({ error: "Influencer ID is required" }, { status: 400 })
    }

    const data = await req.json()

    // First, verify the influencer exists
    const existingInfluencer = await prisma.influencer.findUnique({
      where: { id },
    })

    if (!existingInfluencer) {
      console.error(`Influencer not found for update: ${id}`)
      return NextResponse.json(
        { error: "Influencer not found", details: `No influencer record exists with ID: ${id}` },
        { status: 404 }
      )
    }

    // Build update object with only provided fields
    // NOTE: handle and platform are immutable - they have a unique constraint
    const updateData: any = {}
    
    if (data.full_name !== undefined) updateData.full_name = data.full_name
    if (data.email !== undefined) updateData.email = data.email
    if (data.gender !== undefined) updateData.gender = data.gender
    if (data.niche !== undefined) updateData.niche = data.niche
    if (data.location !== undefined) updateData.location = data.location
    if (data.bio !== undefined) updateData.bio = data.bio
    if (data.profile_image_url !== undefined) updateData.profile_image_url = data.profile_image_url
    if (data.social_link !== undefined) updateData.social_link = data.social_link
    if (data.follower_count !== undefined) updateData.follower_count = Number(data.follower_count)
    if (data.engagement_rate !== undefined) updateData.engagement_rate = Number(data.engagement_rate)
    if (data.avg_likes !== undefined) updateData.avg_likes = Number(data.avg_likes)
    if (data.avg_comments !== undefined) updateData.avg_comments = Number(data.avg_comments)
    if (data.avg_views !== undefined) updateData.avg_views = Number(data.avg_views)

    // Update influencer
    const influencer = await prisma.influencer.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(influencer)
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    
    // Handle case where record doesn't exist
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { error: "Influencer not found", details: "This influencer does not exist or was not saved to the database" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update influencer", details: errorMessage },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  context: any
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Properly await params which is a Promise in Next.js 13+
    const params = await context.params
    const id = params?.id

    if (!id) {
      return NextResponse.json({ error: "Influencer ID is required" }, { status: 400 })
    }

    await prisma.influencer.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    
    // Handle case where record doesn't exist
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { error: "Influencer not found", details: "This influencer does not exist" },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: "Failed to delete influencer", details: errorMessage },
      { status: 500 }
    )
  }
}

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params

    // Verify user owns or is member of the brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      )
    }

    // Check if user is owner or member (not just owner)
    const isMember = await prisma.brandMember.findUnique({
      where: { brand_id_user_id: { brand_id: brandId, user_id: session.user.id } },
    })

    if (brand.owner_id !== session.user.id && !isMember) {
      return NextResponse.json(
        { error: "Brand not found or unauthorized" },
        { status: 403 }
      )
    }

    // Owners can always manage collaborators
    // Members can only access if brand is active (subscription status)
    const isOwner = brand.owner_id === session.user.id
    if (!isOwner && !brand.is_active) {
      return NextResponse.json(
        { error: "This workspace is unavailable." },
        { status: 403 }
      )
    }

    // Get owner
    const owner = await prisma.user.findUnique({
      where: { id: brand.owner_id },
      select: { id: true, email: true, name: true, image: true },
    })

    // Get collaborators - fetch without including user first to avoid null errors
    const allMembers = await prisma.brandMember.findMany({
      where: { brand_id: brandId },
      orderBy: { joined_at: "desc" },
    })

    // Fetch users separately - only for members that have valid user_ids
    const userIds = allMembers.map((m) => m.user_id)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, image: true },
    })

    // Create a map of user IDs to user data
    const userMap = new Map(users.map((u) => [u.id, u]))

    // Combine members with their user data, filtering out orphaned records
    const validMembers = allMembers
      .filter((m) => userMap.has(m.user_id))
      .map((m) => {
        const user = userMap.get(m.user_id)!
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: m.role,
          joinedAt: m.joined_at,
        }
      })

    return NextResponse.json({
      owner,
      members: validMembers,
      brand: {
        id: brand.id,
        name: brand.name,
        logo_url: brand.logo_url,
        website_url: brand.website_url,
      },
    })
  } catch (error) {
    console.error("Error fetching collaborators:", error)
    return NextResponse.json(
      { error: "Failed to fetch collaborators", details: String(error) },
      { status: 500 }
    )
  }
}
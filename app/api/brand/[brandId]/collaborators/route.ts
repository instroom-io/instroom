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

    // Verify user owns or is member of the brand.
    //
    // These two are independent — the membership row is looked up by
    // (brand_id, user_id) from the URL and the session, neither of which comes
    // from the brand record — so they run together. On the remote database
    // this deployment uses, a round trip is ~500ms and dominates the query
    // cost itself, so awaiting them in sequence spent ~500ms for nothing.
    //
    // `select` rather than the whole row: only these four fields are read
    // below, and the full record drags in logo_url, which holds an inline
    // data-URL logo on branded workspaces.
    const [brand, isMember] = await Promise.all([
      prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, owner_id: true, is_active: true, name: true, logo_url: true, website_url: true },
      }),
      prisma.brandMember.findUnique({
        where: { brand_id_user_id: { brand_id: brandId, user_id: session.user.id } },
        select: { id: true },
      }),
    ])

    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      )
    }

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

    // Owner and member list are independent of each other, so they overlap
    // rather than costing a round trip each (see the note above).
    //
    // The members query keeps its "fetch members, then their users" shape
    // rather than an `include`, which is what makes it resilient to an
    // orphaned member row pointing at a deleted user — the filter below
    // depends on that. Only the columns actually read are selected.
    const [owner, allMembers] = await Promise.all([
      prisma.user.findUnique({
        where: { id: brand.owner_id },
        select: { id: true, email: true, name: true, image: true },
      }),
      prisma.brandMember.findMany({
        where: { brand_id: brandId },
        orderBy: { joined_at: "desc" },
        select: { user_id: true, role: true, joined_at: true },
      }),
    ])

    // Fetch users separately - only for members that have valid user_ids.
    // Skipped entirely when there are no members: an empty `in` list is a
    // guaranteed-empty result, and on this database that pointless round trip
    // costs as much as a real one. Solo workspaces are the common case.
    const userIds = allMembers.map((m) => m.user_id)
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true, image: true },
        })
      : []

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
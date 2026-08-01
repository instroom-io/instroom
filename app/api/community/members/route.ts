import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBrandAccess } from "@/lib/community-access"

// GET /api/community/members?brandId=...
// Community members today = the brand's own team (owner + collaborators) —
// the same authenticated users already in the app. Once an influencer/creator
// portal login exists, this is the endpoint to extend with that audience.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const brandId = req.nextUrl.searchParams.get("brandId")
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const brandRecord = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { owner_id: true },
    })

    const brandMembers = await prisma.brandMember.findMany({
      where: { brand_id: brandId },
      select: { role: true, user_id: true },
    })

    const userIds = [
      ...new Set([
        ...(brandRecord?.owner_id ? [brandRecord.owner_id] : []),
        ...brandMembers.map((m) => m.user_id),
      ]),
    ]

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, image: true, email: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))
    const roleMap = new Map(brandMembers.map((m) => [m.user_id, m.role]))

    const members = userIds
      .map((id) => userMap.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => ({
        ...u,
        role: u.id === brandRecord?.owner_id ? "owner" : roleMap.get(u.id) ?? "collaborator",
      }))

    return NextResponse.json({ members })
  } catch (error) {
    console.error("[GET /community/members]", error)
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 })
  }
}

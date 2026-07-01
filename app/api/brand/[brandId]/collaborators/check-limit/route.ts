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

    // Verify user owns the brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand || brand.owner_id !== session.user.id) {
      return NextResponse.json(
        { error: "Brand not found or you don't have permission" },
        { status: 403 }
      )
    }

    // Get user's subscription (optional - no limits applied)
    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: session.user.id },
      include: { plan: true },
    })

    // Count current collaborators
    const memberCount = await prisma.brandMember.count({
      where: { brand_id: brandId },
    })

    // Unlimited collaborators for all users
    return NextResponse.json(
      {
        allowed: true,
        current: memberCount,
        max: null,
        message: "Unlimited collaborators",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error checking collaborator limit:", error)
    return NextResponse.json(
      { error: "Failed to check collaborator limit" },
      { status: 500 }
    )
  }
}

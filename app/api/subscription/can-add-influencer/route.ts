import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { canAddInfluencer } from "@/lib/subscription-limits"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get("brandId")

    if (!brandId) {
      return NextResponse.json(
        { error: "brandId is required" },
        { status: 400 }
      )
    }

    const limitCheck = await canAddInfluencer(session.user.id, brandId)

    return NextResponse.json(limitCheck)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check influencer limit" },
      { status: 500 }
    )
  }
}

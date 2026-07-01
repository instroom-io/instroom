import { NextResponse } from "next/server"
import { canAddBrand, canAddCollaborator } from "@/lib/subscription-limits"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ brandId?: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId: paramBrandId } = await params
    const url = new URL(req.url)
    const type = url.searchParams.get("type") // "brand" or "collaborator"
    const brandId = paramBrandId || url.searchParams.get("brandId")

    if (type === "brand") {
      const limits = await canAddBrand(session.user.id)
      return NextResponse.json(limits)
    } else if (type === "collaborator" && brandId) {
      const limits = await canAddCollaborator(session.user.id, brandId)
      return NextResponse.json(limits)
    } else {
      return NextResponse.json(
        { error: "Invalid type or missing brandId" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error checking limits:", error)
    return NextResponse.json(
      { error: "Failed to check limits" },
      { status: 500 }
    )
  }
}

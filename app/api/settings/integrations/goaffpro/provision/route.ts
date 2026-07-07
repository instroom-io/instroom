import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { provisionGoAffProAffiliate } from "@/lib/goaffpro-provision"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { brandId, influencerId } = body

    if (!brandId || !influencerId) {
      return NextResponse.json({ error: "brandId and influencerId are required" }, { status: 400 })
    }

    const result = await provisionGoAffProAffiliate({
      brandId,
      brandInfluencerId: influencerId,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.reason || "Failed to provision GoAffPro affiliate" }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[POST /settings/integrations/goaffpro/provision]", error)
    return NextResponse.json(
      { error: error?.message || "Failed to provision GoAffPro affiliate" },
      { status: 500 }
    )
  }
}

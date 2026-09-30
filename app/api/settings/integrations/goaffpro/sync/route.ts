import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkBrandAccess } from "@/lib/brand-access"
import { syncGoAffProForBrand } from "@/lib/goaffpro-sync"

// POST { brandId } — on-demand GoAffPro sync (same logic as the cron job).
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await req.json()
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await syncGoAffProForBrand(brandId)
    if (!result.success) {
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[POST /settings/integrations/goaffpro/sync]", error)
    return NextResponse.json(
      { error: (error instanceof Error && error.message) || "Failed to sync GoAffPro" },
      { status: 500 }
    )
  }
}

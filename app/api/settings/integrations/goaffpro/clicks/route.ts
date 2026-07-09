import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { listGoAffProAffiliates, listGoAffProTraffic } from "@/lib/goaffpro"
import { getGoAffProConnection } from "@/lib/goaffpro-connection"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const brandId = searchParams.get("brandId")
    const daysParam = Number(searchParams.get("days") ?? "7")
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 3650) : 7

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 })
    }

    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        OR: [{ owner_id: session.user.id }, { members: { some: { user_id: session.user.id } } }],
      },
      select: { id: true },
    })

    if (!brand) {
      return NextResponse.json({ error: "Brand not found or access denied" }, { status: 403 })
    }

    const connection = await getGoAffProConnection(brandId)
    if (!connection) {
      return NextResponse.json({ error: "GoAffPro is not connected" }, { status: 400 })
    }

    const [affiliates, traffic] = await Promise.all([
      listGoAffProAffiliates(connection.accessToken),
      listGoAffProTraffic(connection.accessToken, days),
    ])

    const clickCounts = new Map<string, number>()

    for (const visit of traffic) {
      if (visit.affiliate_id === null || visit.affiliate_id === undefined || visit.affiliate_id === "") {
        continue
      }

      const affiliateId = String(visit.affiliate_id)
      clickCounts.set(affiliateId, (clickCounts.get(affiliateId) ?? 0) + 1)
    }

    const affiliatesWithClicks = affiliates
      .map((affiliate) => ({
        ...affiliate,
        clicks: clickCounts.get(String(affiliate.id)) ?? 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)

    return NextResponse.json({
      data: {
        windowDays: days,
        totalClicks: traffic.length,
        trackedAffiliates: affiliatesWithClicks.filter((affiliate) => affiliate.clicks > 0).length,
        affiliates: affiliatesWithClicks,
        recentTraffic: traffic.slice(0, 20),
      },
    })
  } catch (error: any) {
    console.error("[GET /settings/integrations/goaffpro/clicks]", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch GoAffPro clicks" },
      { status: 500 }
    )
  }
}

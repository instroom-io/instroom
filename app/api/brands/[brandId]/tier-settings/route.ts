// app/api/brands/[brandId]/tier-settings/route.ts
//
// One settings row per brand. GET returns defaults (2000/10000) if the
// brand hasn't customized thresholds yet — no row is created until PUT.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkBrandAccess } from "@/lib/brand-access"

const DEFAULTS = { bronze_max: 2000, silver_max: 10000 }

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await context.params

    // Viewing tier thresholds is needed by every brand member to render tier
    // badges — only changing them (PUT, below) is restricted to the owner.
    if (!(await checkBrandAccess(brandId, session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const settings = await prisma.brandTierSettings.findUnique({
      where: { brand_id: brandId },
    })

    return NextResponse.json({
      data: settings ?? { brand_id: brandId, ...DEFAULTS, updated_at: null },
    })
  } catch (error) {
    console.error("[GET /tier-settings]", error)
    return NextResponse.json({ error: "Failed to fetch tier settings" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await context.params

    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand || brand.owner_id !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await req.json()
    const { bronze_max, silver_max } = body

    if (
      typeof bronze_max !== "number" ||
      typeof silver_max !== "number" ||
      bronze_max < 0 ||
      silver_max <= bronze_max
    ) {
      return NextResponse.json(
        { error: "Invalid thresholds — silver_max must be greater than bronze_max." },
        { status: 400 }
      )
    }

    const saved = await prisma.brandTierSettings.upsert({
      where: { brand_id: brandId },
      update: { bronze_max, silver_max },
      create: { brand_id: brandId, bronze_max, silver_max },
    })

    return NextResponse.json({ data: saved })
  } catch (error) {
    console.error("[PUT /tier-settings]", error)
    return NextResponse.json({ error: "Failed to save tier settings" }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.brandId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.brandTierSettings.findUnique({
    where: { brand_id: session.user.brandId },
  })

  // Return defaults if no settings exist yet
  return NextResponse.json(settings ?? {
    bronze_max: 2000,
    silver_max: 10000,
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.brandId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { bronze_max, silver_max } = body

  if (typeof bronze_max !== "number" || typeof silver_max !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  if (bronze_max >= silver_max) {
    return NextResponse.json(
      { error: "bronze_max must be less than silver_max" },
      { status: 400 }
    )
  }

  const settings = await prisma.brandTierSettings.upsert({
    where: { brand_id: session.user.brandId },
    create: {
      brand_id: session.user.brandId,
      bronze_max,
      silver_max,
    },
    update: {
      bronze_max,
      silver_max,
    },
  })

  return NextResponse.json(settings)
}
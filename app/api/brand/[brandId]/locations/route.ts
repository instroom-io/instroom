// app/api/brand/[brandId]/locations/route.ts
// FIXED: returns full location objects { id, brand_id, name, created_at }
// so the hook can use location.id for deletion

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function checkBrandAccess(brandId: string, userId: string) {
  return prisma.brand.findFirst({
    where: {
      id: brandId,
      OR: [
        { owner_id: userId },
        { members: { some: { user_id: userId } } },
      ],
    },
    select: { id: true },
  })
}

// GET /api/brand/[brandId]/locations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params
    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const locations = await prisma.brandLocation.findMany({
      where: { brand_id: brandId },
      orderBy: { name: "asc" },
    })

    // Return full objects so hook can use location.id for deletion
    return NextResponse.json({ locations })
  } catch (error: any) {
    console.error("GET locations error:", error)
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 })
  }
}

// POST /api/brand/[brandId]/locations
// Body: { name: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params
    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    // Check duplicate first so we can return 409
    const existing = await prisma.brandLocation.findUnique({
      where: { brand_id_name: { brand_id: brandId, name } },
    })
    if (existing) {
      return NextResponse.json({ error: "Location already exists" }, { status: 409 })
    }

    const location = await prisma.brandLocation.create({
      data: { brand_id: brandId, name },
    })

    return NextResponse.json({ location })
  } catch (error: any) {
    console.error("POST location error:", error)
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 })
  }
}
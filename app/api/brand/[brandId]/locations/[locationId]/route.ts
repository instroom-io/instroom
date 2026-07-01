// app/api/brand/[brandId]/locations/[locationId]/route.ts

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; locationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, locationId } = await params

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.brandLocation.delete({
      where: { id: locationId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    console.error("DELETE location error:", error)
    return NextResponse.json({ error: "Failed to delete location" }, { status: 500 })
  }
}
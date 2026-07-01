import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { canAddBrand } from "@/lib/subscription-limits"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, description, website_url } = await req.json()

    if (!name) {
      return NextResponse.json({ error: "Brand name is required" }, { status: 400 })
    }

    // Check if user can add a brand
    const canAdd = await canAddBrand(session.user.id)
    if (!canAdd.allowed) {
      return NextResponse.json(
        {
          error: canAdd.message || "Cannot add brand",
          current: canAdd.current,
          max: canAdd.max,
        },
        { status: 403 }
      )
    }

    // Create brand
    const brand = await prisma.brand.create({
      data: {
        owner_id: session.user.id,
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now(),
        description: description || null,
        website_url: website_url || null,
      },
    })

    // Create onboarding for brand
    const onboarding = await prisma.onboarding.findUnique({
      where: { user_id: session.user.id },
    })
    if (onboarding) {
      await prisma.activityLog.create({
        data: {
          brand_id: brand.id,
          user_id: session.user.id,
          action: "created",
          entity_type: "brand",
          entity_id: brand.id,
          details: `Created brand: ${name}`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      brand,
      remaining: canAdd.max !== null ? canAdd.max - canAdd.current - 1 : null,
    })
  } catch (error) {
    console.error("Error creating brand:", error)
    return NextResponse.json(
      { error: "Failed to create brand" },
      { status: 500 }
    )
  }
}

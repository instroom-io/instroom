// ============================================================================
// FILE: app/api/brands/me/route.ts
// ============================================================================
// Returns brands the logged-in user owns or is a member of.
// Used by the manage-influencers page to determine which brand to load
// when no brandId is in the URL.
// ============================================================================

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { userHasActiveSubscription } from "@/lib/subscription-limits"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Get brands the user owns
    const ownedBrands = await prisma.brand.findMany({
      where: {
        owner_id: userId,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo_url: true,
        description: true,
      },
      orderBy: { created_at: "asc" },
    })

    // Get brands the user is a member of (but doesn't own)
    const memberships = await prisma.brandMember.findMany({
      where: {
        user_id: userId,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo_url: true,
            description: true,
            owner_id: true,
            is_active: true,
          },
        },
      },
    })

    // Filter member brands where owner has active subscription
    const memberBrands = []
    for (const m of memberships) {
      if (m.brand.is_active && m.brand.owner_id !== userId) {
        const ownerHasActiveSubscription = await userHasActiveSubscription(m.brand.owner_id)
        memberBrands.push({
          id: m.brand.id,
          name: m.brand.name,
          slug: m.brand.slug,
          logo_url: m.brand.logo_url,
          description: m.brand.description,
          role: m.role,
          subscriptionActive: ownerHasActiveSubscription,
        })
      }
    }

    // Combine: owned brands first, then member brands
    const allBrands = [
      ...ownedBrands.map((b) => ({ ...b, role: "owner" as const })),
      ...memberBrands,
    ]

    return NextResponse.json({
      brands: allBrands,
      defaultBrandId: allBrands.length > 0 ? allBrands[0].id : null,
    })
  } catch (error: any) {
    console.error("Failed to fetch user brands:", error)
    return NextResponse.json(
      { error: "Failed to fetch brands", details: error?.message },
      { status: 500 }
    )
  }
}
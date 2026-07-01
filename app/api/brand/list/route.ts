import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { userHasActiveSubscription } from "@/lib/subscription-limits"

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Get brands owned by user OR where user is a member
  const brands = await prisma.brand.findMany({
    where: {
      OR: [
        { owner_id: session.user.id },  // User is owner
        { members: { some: { user_id: session.user.id } } },  // User is member
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logo_url: true,
      owner_id: true,
    },
    orderBy: { created_at: "desc" },
  })

  // Get subscription status for each brand owner
  const accessibleBrands = []
  for (const brand of brands) {
    const isCurrentUserOwner = brand.owner_id === session.user.id
    const ownerHasActiveSubscription = await userHasActiveSubscription(brand.owner_id)
    
    // Include all brands, but mark subscription status
    accessibleBrands.push({
      ...brand,
      subscriptionActive: ownerHasActiveSubscription,
    })
  }

  return Response.json({
    brands: accessibleBrands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logo_url: brand.logo_url,
      isOwner: brand.owner_id === session.user.id,
      subscriptionActive: brand.subscriptionActive,
    })),
  })
}

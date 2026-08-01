import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { UserSubscription } from "@prisma/client"

// Mirrors the logic of lib/subscription-limits.ts#userHasActiveSubscription,
// evaluated in-memory against a subscription already fetched in bulk (see
// below) instead of issuing a fresh DB round-trip per brand.
function isSubscriptionActive(subscription: UserSubscription | undefined): boolean {
  if (!subscription) return false
  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return false
  }

  const now = new Date()

  if (subscription.current_period_end && subscription.current_period_end < now) {
    return false
  }

  if (subscription.ended_at && subscription.ended_at < now) {
    return false
  }

  return true
}

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

  // Get subscription status for each brand owner in a single batched query
  // instead of one sequential round-trip per brand.
  const ownerIds = [...new Set(brands.map((brand) => brand.owner_id))]
  const subscriptions = ownerIds.length
    ? await prisma.userSubscription.findMany({
        where: { user_id: { in: ownerIds } },
      })
    : []
  const subscriptionMap = new Map(subscriptions.map((sub) => [sub.user_id, sub]))

  const accessibleBrands = brands.map((brand) => {
    const subscription = subscriptionMap.get(brand.owner_id)
    const ownerHasActiveSubscription = isSubscriptionActive(subscription)

    // Include all brands, but mark subscription status
    return {
      ...brand,
      subscriptionActive: ownerHasActiveSubscription,
    }
  })

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

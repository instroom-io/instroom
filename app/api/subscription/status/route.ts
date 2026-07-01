import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: session.user.id },
      include: { plan: true },
    })

    if (!subscription) {
      // No subscription = free tier
      return NextResponse.json({
        status: "free",
        subscription: null,
        isExpired: false,
        isExpiringSoon: false,
        daysUntilExpiry: null,
      })
    }

    // Calculate days until expiry
    const now = new Date()
    const endDate = subscription.current_period_end
    const daysUntilExpiry = endDate
      ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Determine if expired
    const isExpired =
      subscription.status === "cancelled" ||
      subscription.status === "paused" ||
      (endDate && endDate < now)

    // Determine if expiring soon (within 7 days and not expired)
    const isExpiringSoon =
      !isExpired && endDate && daysUntilExpiry !== null && daysUntilExpiry <= 7

    return NextResponse.json({
      status: subscription.status,
      subscription: {
        id: subscription.id,
        plan_id: subscription.plan_id,
        plan: {
          name: subscription.plan.name,
          display_name: subscription.plan.display_name,
        },
        billing_cycle: subscription.billing_cycle,
        current_period_end: endDate?.toISOString() ?? null,
        current_period_start: subscription.current_period_start?.toISOString() ?? null,
        ended_at: subscription.ended_at?.toISOString() ?? null,
      },
      isExpired,
      isExpiringSoon,
      daysUntilExpiry,
    })
  } catch (error) {
    console.error("Error fetching subscription status:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscription status" },
      { status: 500 }
    )
  }
}

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"
import { getBillingSource, maybeSyncShopifyBilling } from "@/lib/shopify-billing"

// Session user only; a body user_id is ignored.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user_id = session.user.id

    await maybeSyncShopifyBilling(user_id)
    const billing = await getBillingSource(user_id)

    const subscription = await prisma.userSubscription.findFirst({
      where: {
        user_id,
        status: { in: ["active", "trialing"] },
      },
      include: {
        plan: true,
      },
    })

    if (!subscription) {
      return NextResponse.json({ active: false, billing }, { status: 200 })
    }

    const now = new Date()

    // Check if subscription period has ended
    if (subscription.current_period_end && subscription.current_period_end < now) {
      return NextResponse.json({ active: false, billing }, { status: 200 })
    }

    // Check if subscription was explicitly ended
    if (subscription.ended_at && subscription.ended_at < now) {
      return NextResponse.json({ active: false, billing }, { status: 200 })
    }

    return NextResponse.json({ active: true, subscription, billing }, { status: 200 })
  } catch (error) {
    if (isDatabaseCapacityError(error)) return databaseCapacityResponse()
    return NextResponse.json(
      { error: "Failed to check subscription", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

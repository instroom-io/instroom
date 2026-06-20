import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: session.user.id },
      select: { payment_subscription_id: true },
    })

    if (!subscription?.payment_subscription_id) {
      return NextResponse.json({ paymentMethod: null })
    }

    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscription.payment_subscription_id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
          Accept: "application/vnd.api+json",
        },
        // card details/portal links can rotate; avoid stale cache
        cache: "no-store",
      }
    )

    if (!res.ok) {
      return NextResponse.json({ paymentMethod: null })
    }

    const data = await res.json()
    const attrs = data?.data?.attributes

    return NextResponse.json({
      paymentMethod: {
        cardBrand: attrs?.card_brand || null,
        cardLastFour: attrs?.card_last_four || null,
        customerPortalUrl: attrs?.urls?.customer_portal || null,
      },
    })
  } catch (error) {
    console.error("Error fetching payment method:", error)
    return NextResponse.json({ paymentMethod: null })
  }
}
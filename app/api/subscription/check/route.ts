import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { user_id } = await req.json()
    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

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
      return NextResponse.json({ active: false }, { status: 200 })
    }

    const now = new Date()
    
    // Check if subscription period has ended
    if (subscription.current_period_end && subscription.current_period_end < now) {
      return NextResponse.json({ active: false }, { status: 200 })
    }
    
    // Check if subscription was explicitly ended
    if (subscription.ended_at && subscription.ended_at < now) {
      return NextResponse.json({ active: false }, { status: 200 })
    }

    return NextResponse.json({ active: true, subscription }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check subscription", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
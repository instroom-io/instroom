import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { planName, cycle } = await req.json()

    if (!planName || !cycle) {
      return NextResponse.json(
        { error: "Missing required fields: planName, cycle" },
        { status: 400 }
      )
    }

    // Get the plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { name: planName },
    })

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    // Check if user already has an active or trialing subscription
    const existingSubscription = await prisma.userSubscription.findFirst({
      where: {
        user_id: session.user.id,
        status: { in: ["active", "trialing"] },
      },
    })

    if (existingSubscription) {
      return NextResponse.json(
        { error: "User already has an active subscription or ongoing trial" },
        { status: 400 }
      )
    }

    // Early access beta gives Solo trials 3 months instead of the usual 30-day trial
    const trialEndDate = new Date()
    if (planName === "solo") {
      trialEndDate.setMonth(trialEndDate.getMonth() + 3)
    } else {
      trialEndDate.setDate(trialEndDate.getDate() + 30)
    }

    const subscription = await prisma.userSubscription.create({
      data: {
        user_id: session.user.id,
        plan_id: plan.id,
        billing_cycle: cycle as "monthly" | "yearly",
        status: "trialing",
        started_at: new Date(),
        current_period_start: new Date(),
        current_period_end: trialEndDate,
      },
      include: {
        plan: true,
      },
    })

    return NextResponse.json({ 
      success: true, 
      subscription,
      message: planName === "solo"
        ? "Trial started successfully. You have 3 months to try the plan."
        : "Trial started successfully. You have 30 days to try the plan.",
    })
  } catch (error) {
    console.error("Error starting trial:", error)
    return NextResponse.json(
      { error: "Failed to start trial" },
      { status: 500 }
    )
  }
}

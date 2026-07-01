import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const onboarding = await prisma.onboarding.findFirst({
      where: {
        user: {
          email: email,
        },
      },
    })

    const isComplete = !!onboarding?.completed_at

    return NextResponse.json({ isComplete }, { status: 200 })
  } catch (error) {
    console.error("Check onboarding error:", error)
    return NextResponse.json(
      { error: "Failed to check onboarding status" },
      { status: 500 }
    )
  }
}

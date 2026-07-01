import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()

    if (!session?.user?.email) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const onboarding = await prisma.onboarding.findFirst({
      where: {
        user: { email: session.user.email },
      },
    })

    const isComplete = !!onboarding?.completed_at

    return NextResponse.redirect(
      new URL(isComplete ? "/dashboard/influencer-discovery" : "/onboarding", req.url)
    )
  } catch (error) {
    console.error("Auth redirect error:", error)
    return NextResponse.redirect(new URL("/onboarding", req.url))
  }
}

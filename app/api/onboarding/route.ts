import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const onboarding = await prisma.onboarding.findUnique({
      where: { user_id: session.user.id },
    })

    if (!onboarding) {
      return NextResponse.json(
        { error: "Onboarding record not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { onboarding },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve onboarding data" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      user_id,
      operator_type,
      business_type,
      campaign_goal,
      influencer_count,
      acquisition_source,
    } = await req.json()

    if (!user_id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    const userExists = await prisma.user.findUnique({
      where: { id: user_id },
    })
    if (!userExists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    const acquisitionSourceJson = acquisition_source ? JSON.stringify(acquisition_source) : null
    const now = new Date()
    const onboardingId = generateId()

    await prisma.$executeRawUnsafe(`SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci`)

    await prisma.$executeRaw`
      INSERT INTO Onboarding (
        id, user_id, operator_type, business_type, campaign_goal, 
        influencer_count, acquisition_source, completed_at, created_at, updated_at
      ) VALUES (
        ${onboardingId}, ${user_id}, ${operator_type || null}, ${business_type || null}, 
        ${campaign_goal || null}, ${influencer_count || null}, 
        ${acquisitionSourceJson}, ${now}, ${now}, ${now}
      )
      ON DUPLICATE KEY UPDATE
        operator_type = VALUES(operator_type),
        business_type = VALUES(business_type),
        campaign_goal = VALUES(campaign_goal),
        influencer_count = VALUES(influencer_count),
        acquisition_source = VALUES(acquisition_source),
        completed_at = VALUES(completed_at),
        updated_at = VALUES(updated_at)
    `

    const onboarding = await prisma.onboarding.findUnique({
      where: { user_id },
    })

    return NextResponse.json(
      {
        success: true,
        onboarding,
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save onboarding data" },
      { status: 500 }
    )
  }
}

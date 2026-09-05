import { prisma, withUtf8mb4 } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

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

    const data = {
      operator_type: operator_type || null,
      business_type: business_type || null,
      campaign_goal: campaign_goal || null,
      influencer_count: influencer_count || null,
      acquisition_source: acquisition_source ?? null,
      completed_at: new Date(),
    }

    // withUtf8mb4, not a `$transaction([...])` array: this host forces
    // `SET NAMES utf8` (= utf8mb3) on every new connection via init_connect
    // (see lib/prisma.ts), and the array form of $transaction does not
    // guarantee its statements share one physical connection — so the SET
    // NAMES here previously had no effect on whichever connection the upsert
    // actually landed on. Confirmed directly against this database: an
    // emoji-prefixed answer (every real option in this form starts with one)
    // was silently written as "?". withUtf8mb4 pins one connection for both
    // statements, the same fix already used for Instagram/TikTok captions.
    const onboarding = await withUtf8mb4((tx) =>
      tx.onboarding.upsert({
        where: { user_id },
        update: data,
        create: { user_id, ...data },
      })
    )

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

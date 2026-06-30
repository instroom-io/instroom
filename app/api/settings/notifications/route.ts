import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const prefs = await prisma.notificationPreference.findUnique({
    where: { user_id: session.user.id },
  })

  // Return saved prefs or defaults if the row doesn't exist yet
  return NextResponse.json({
    influencer_reply: prefs?.influencer_reply ?? true,
    stage_change:     prefs?.stage_change     ?? false,
    deal_agreed:      prefs?.deal_agreed      ?? true,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as any
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json()
  const { influencer_reply, stage_change, deal_agreed } = body

  const prefs = await prisma.notificationPreference.upsert({
    where:  { user_id: session.user.id },
    create: {
      user_id:          session.user.id,
      influencer_reply: influencer_reply ?? true,
      stage_change:     stage_change     ?? false,
      deal_agreed:      deal_agreed      ?? true,
    },
    update: {
      ...(influencer_reply !== undefined && { influencer_reply }),
      ...(stage_change     !== undefined && { stage_change }),
      ...(deal_agreed      !== undefined && { deal_agreed }),
    },
  })

  return NextResponse.json({ success: true, data: prefs })
}
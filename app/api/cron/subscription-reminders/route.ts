import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSubscriptionExpiringEmail } from "@/lib/email"

const APP_URL = process.env.NEXTAUTH_URL ?? "https://instroom.io"
const REMINDER_WINDOW_DAYS = 7

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const headerSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const querySecret = searchParams.get("secret")
  const providedSecret = headerSecret || querySecret

  if (!providedSecret || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  // Only trialing subscriptions: paid plans renew automatically through
  // Lemon Squeezy, which handles its own renewal/dunning emails.
  const expiringSoon = await prisma.userSubscription.findMany({
    where: {
      status: "trialing",
      ended_at: null,
      reminder_sent_at: null,
      current_period_end: { gt: now, lte: windowEnd },
    },
    include: { user: true, plan: true },
  })

  const results: Array<{ user_id: string; sent: boolean }> = []

  for (const sub of expiringSoon) {
    if (!sub.user?.email || !sub.current_period_end) continue

    const daysLeft = Math.max(
      1,
      Math.ceil((sub.current_period_end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    )

    const sent = await sendSubscriptionExpiringEmail(
      sub.user.email,
      sub.user.name || "there",
      sub.plan.display_name,
      daysLeft,
      sub.current_period_end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      `${APP_URL}/pricing?cycle=monthly`,
    )

    if (sent) {
      await prisma.userSubscription.update({
        where: { id: sub.id },
        data: { reminder_sent_at: now },
      })
    }

    results.push({ user_id: sub.user_id, sent })
  }

  return NextResponse.json({ success: true, checked: expiringSoon.length, results })
}

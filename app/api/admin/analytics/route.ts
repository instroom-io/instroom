import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

const DAYS = 30

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildDayBuckets(): string[] {
  const days: string[] = []
  const now = new Date()
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push(dayKey(d))
  }
  return days
}

function bucketCounts(dates: Date[], days: string[]): number[] {
  const counts = new Map(days.map((d) => [d, 0]))
  for (const date of dates) {
    const k = dayKey(date)
    if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1)
  }
  return days.map((d) => counts.get(d) || 0)
}

// Cumulative running total per day, starting from the count that already
// existed before the window — so "growth" charts show the real trend line,
// not just that day's new signups.
function cumulative(dailyNew: number[], baseline: number): number[] {
  let running = baseline
  return dailyNew.map((n) => { running += n; return running })
}

export async function GET() {
  const gate = await requireAdmin()
  if (gate) return gate

  const days = buildDayBuckets()
  const windowStart = new Date(days[0])

  const [users, influencers, campaigns, usersBefore, influencersBefore, campaignsBefore] = await Promise.all([
    prisma.user.findMany({ where: { created_at: { gte: windowStart } }, select: { created_at: true } }),
    prisma.influencer.findMany({ where: { created_at: { gte: windowStart } }, select: { created_at: true } }),
    prisma.campaign.findMany({ where: { created_at: { gte: windowStart } }, select: { created_at: true } }),
    prisma.user.count({ where: { created_at: { lt: windowStart } } }),
    prisma.influencer.count({ where: { created_at: { lt: windowStart } } }),
    prisma.campaign.count({ where: { created_at: { lt: windowStart } } }),
  ])

  const dailyUserSignups = bucketCounts(users.map((u) => u.created_at), days)

  return NextResponse.json({
    days,
    userGrowth: cumulative(dailyUserSignups, usersBefore),
    influencerGrowth: cumulative(bucketCounts(influencers.map((i) => i.created_at), days), influencersBefore),
    campaignGrowth: cumulative(bucketCounts(campaigns.map((c) => c.created_at), days), campaignsBefore),
    dailyRegistrations: dailyUserSignups,
  })
}

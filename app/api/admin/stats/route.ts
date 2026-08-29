import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET() {
  const gate = await requireAdmin()
  if (gate) return gate

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [
    totalUsers,
    totalInfluencers,
    totalBrands,
    totalCampaigns,
    activeCollaborations,
    newUsersToday,
    pendingInfluencerApprovals,
    recentUsers,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    // Drafts excluded from both influencer figures: a blank row is not a
    // platform influencer, and its verification_status defaults to "pending",
    // which would otherwise put every draft in the moderation queue's count.
    prisma.influencer.count({ where: { is_draft: false } }),
    prisma.brand.count(),
    prisma.campaign.count(),
    prisma.brandInfluencer.count({ where: { approval_status: "Approved" } }),
    prisma.user.count({ where: { created_at: { gte: startOfDay } } }),
    prisma.influencer.count({ where: { verification_status: "pending", is_draft: false } }),
    prisma.user.findMany({
      orderBy: { created_at: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, created_at: true },
    }),
    prisma.adminAuditLog.findMany({
      orderBy: { created_at: "desc" },
      take: 5,
    }),
  ])

  // Recent Activity — merges recent signups with recent admin actions into
  // one feed, newest first. Simple MVP approach rather than a unified events
  // table.
  const recentActivity = [
    ...recentUsers.map((u) => ({
      type: "signup" as const,
      label: `${u.name || u.email} signed up`,
      at: u.created_at,
    })),
    ...recentAuditLogs.map((l) => ({
      type: "admin_action" as const,
      label: `${l.action.replace(/_/g, " ")}${l.target_label ? ` — ${l.target_label}` : ""}`,
      at: l.created_at,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8)

  return NextResponse.json({
    stats: {
      totalUsers,
      totalInfluencers,
      totalBrands,
      totalCampaigns,
      activeCollaborations,
      newUsersToday,
      pendingInfluencerApprovals,
    },
    recentActivity,
  })
}

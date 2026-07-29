"use client"

import { useEffect, useState } from "react"
import {
  IconUsers, IconUserStar, IconBuildingStore, IconSpeakerphone,
  IconUsersGroup, IconUserPlus, IconClockHour4,
} from "@tabler/icons-react"

interface Stats {
  totalUsers: number
  totalInfluencers: number
  totalBrands: number
  totalCampaigns: number
  activeCollaborations: number
  newUsersToday: number
  pendingInfluencerApprovals: number
}
interface ActivityItem {
  type: "signup" | "admin_action"
  label: string
  at: string
}

const CARDS: { key: keyof Stats; label: string; icon: typeof IconUsers }[] = [
  { key: "totalUsers", label: "Total Users", icon: IconUsers },
  { key: "totalInfluencers", label: "Total Influencers", icon: IconUserStar },
  { key: "totalBrands", label: "Total Brands", icon: IconBuildingStore },
  { key: "totalCampaigns", label: "Total Campaigns", icon: IconSpeakerphone },
  { key: "activeCollaborations", label: "Active Collaborations", icon: IconUsersGroup },
  { key: "newUsersToday", label: "New Users Today", icon: IconUserPlus },
  { key: "pendingInfluencerApprovals", label: "Pending Influencer Approvals", icon: IconClockHour4 },
]

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((json) => {
        setStats(json.stats)
        setActivity(json.recentActivity || [])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Platform-wide overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {CARDS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">{label}</span>
              <Icon size={16} className="text-[#1FAE5B]" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {loading ? "—" : stats?.[key] ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-gray-400">No recent activity.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {activity.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.type === "admin_action" ? "bg-amber-500" : "bg-[#1FAE5B]"}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="text-gray-400 ml-2 text-xs">{new Date(item.at).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

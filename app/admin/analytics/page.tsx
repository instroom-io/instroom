"use client"

import { useEffect, useState } from "react"
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

interface AnalyticsData {
  days: string[]
  userGrowth: number[]
  influencerGrowth: number[]
  campaignGrowth: number[]
  dailyRegistrations: number[]
}

function toChartData(days: string[], values: number[]) {
  return days.map((d, i) => ({ day: d.slice(5), value: values[i] ?? 0 }))
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#0F6B3E]/10 rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      {/* Taller on phones so 30 daily ticks don't collide at narrow widths */}
      <div className="h-[260px] sm:h-[220px] w-full">{children}</div>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-gray-500">Last 30 days</p>
      </div>

      {loading || !data ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="User Growth">
            <ResponsiveContainer>
              <LineChart data={toChartData(data.days, data.userGrowth)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} width={32} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#1FAE5B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Influencer Growth">
            <ResponsiveContainer>
              <LineChart data={toChartData(data.days, data.influencerGrowth)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} width={32} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#2C8EC4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Campaign Growth">
            <ResponsiveContainer>
              <LineChart data={toChartData(data.days, data.campaignGrowth)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} width={32} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#E08D3C" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Daily Registrations">
            <ResponsiveContainer>
              <BarChart data={toChartData(data.days, data.dailyRegistrations)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} width={32} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  )
}

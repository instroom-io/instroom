"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  IconLayoutDashboard, IconUsers, IconUserStar, IconSpeakerphone,
  IconClockHour4, IconChartBar, IconShieldLock, IconLogout,
} from "@tabler/icons-react"

const NAV = [
  { href: "/admin", label: "Dashboard", icon: IconLayoutDashboard, exact: true },
  { href: "/admin/users", label: "User Management", icon: IconUsers },
  { href: "/admin/influencers", label: "Influencer Management", icon: IconUserStar },
  { href: "/admin/campaigns", label: "Campaign Management", icon: IconSpeakerphone },
  { href: "/admin/early-access", label: "Early Access Users", icon: IconClockHour4 },
  { href: "/admin/analytics", label: "Analytics", icon: IconChartBar },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: IconShieldLock },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 flex-shrink-0 bg-[#0F1B14] text-white flex flex-col min-h-svh sticky top-0">
      <div className="px-5 py-6 border-b border-white/10">
        <div className="text-lg font-bold">Instroom</div>
        <div className="text-xs text-white/50 mt-0.5 uppercase tracking-wider">Admin Dashboard</div>
      </div>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active ? "bg-[#1FAE5B] text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition"
        >
          <IconLogout size={17} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  IconLayoutDashboard, IconUsers, IconUserStar, IconSpeakerphone,
  IconClockHour4, IconChartBar, IconShieldLock, IconLogout, IconMenu2, IconX,
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
  const [open, setOpen] = useState(false)

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              active ? "bg-[#1FAE5B] text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon size={17} className="flex-shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0F1B14] text-white sticky top-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="p-1.5 -ml-1.5 flex-shrink-0"
          >
            <IconMenu2 size={22} />
          </button>
          <span className="text-base font-bold truncate">Instroom Admin</span>
        </div>
      </div>

      {/* Mobile off-canvas drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-[#0F1B14] text-white flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-6 border-b border-white/10 flex-shrink-0">
              <div>
                <div className="text-lg font-bold">Instroom</div>
                <div className="text-xs text-white/50 mt-0.5 uppercase tracking-wider">Admin Dashboard</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-1.5">
                <IconX size={20} />
              </button>
            </div>

            {renderNav(() => setOpen(false))}

            <div className="px-3 py-4 border-t border-white/10 flex-shrink-0">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition"
              >
                <IconLogout size={17} />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 bg-[#0F1B14] text-white flex-col min-h-svh sticky top-0">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="text-lg font-bold">Instroom</div>
          <div className="text-xs text-white/50 mt-0.5 uppercase tracking-wider">Admin Dashboard</div>
        </div>

        {renderNav()}

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
    </>
  )
}

"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  IconLayoutDashboard, IconUsers, IconUserStar, IconSpeakerphone,
  IconClockHour4, IconChartBar, IconShieldLock, IconLogout,
} from "@tabler/icons-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar"

// Same nav, same routes, same order as before — only the presentation changed.
const NAV = [
  { href: "/admin", label: "Dashboard", icon: IconLayoutDashboard, exact: true },
  { href: "/admin/users", label: "User Management", icon: IconUsers },
  { href: "/admin/influencers", label: "Influencer Management", icon: IconUserStar },
  { href: "/admin/campaigns", label: "Campaign Management", icon: IconSpeakerphone },
  { href: "/admin/early-access", label: "Early Access Users", icon: IconClockHour4 },
  { href: "/admin/analytics", label: "Analytics", icon: IconChartBar },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: IconShieldLock },
]

// Built on the same Sidebar primitives as the user dashboard's AppSidebar, so
// admin inherits the app's offcanvas behaviour for free: a Radix Sheet drawer
// on mobile (focus trap, Escape, scroll lock, animation), Ctrl/Cmd+B, and
// cookie-persisted collapse state — none of which the hand-rolled <aside> had.
export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  // Close the drawer after navigating on mobile, matching the old behaviour
  const handleNavigate = () => { if (isMobile) setOpenMobile(false) }

  return (
    <Sidebar collapsible="offcanvas" className="bg-[#0F6B3E] text-[#F7F9F8]" {...props}>
      {/* Same logo, placement and sizing as the user dashboard */}
      <SidebarHeader className="h-24 flex items-center px-4 border-b border-white/10 bg-[#0F6B3E]">
        <Link href="/admin" className="flex items-center w-full" onClick={handleNavigate}>
          <Image
            src="/INSTROOM WHITE.png"
            alt="Instroom Admin"
            width={150}
            height={32}
            className="object-contain"
            priority
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="bg-[#0F6B3E] text-[#F7F9F8] px-2 pt-2">
        <SidebarMenu>
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            // Preserved exactly: exact match for the index route, prefix match
            // for the rest, so sub-routes keep highlighting their section.
            const isActive = exact ? pathname === href : pathname.startsWith(href)
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild tooltip={label} className="h-auto p-0 hover:bg-transparent active:bg-transparent">
                  <Link
                    href={href}
                    onClick={handleNavigate}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-[#1FAE5B] text-white font-medium"
                        : "text-[#F7F9F8] hover:bg-white/10"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="bg-[#0F6B3E] text-[#F7F9F8] border-t border-white/10 px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sign out" className="h-auto p-0 hover:bg-transparent active:bg-transparent">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#F7F9F8] transition-colors hover:bg-white/10"
              >
                <IconLogout className="h-4 w-4 shrink-0" />
                <span className="truncate">Sign out</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

/** Page title for the admin header bar — mirrors SiteHeader's route map. */
export function useAdminPageTitle() {
  const pathname = usePathname()
  const match = [...NAV].reverse().find((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)))
  return match?.label ?? "Admin"
}

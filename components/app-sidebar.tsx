"use client"

import * as React from "react"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  IconChartBar,
  IconDashboard,
  IconSearch,
  IconUsers,
  IconGitBranch,
  IconCircleCheck,
  IconMail,
  IconBuildingStore,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"

import Image from "next/image"

const navData = {
  navMain: [
    // { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
    { title: "Discovery", url: "/dashboard/influencer-discovery", icon: IconSearch },
    { title: "Inbox", url: "/dashboard/inbox", icon: IconMail },
    { title: "Influencers List", url: "/dashboard/manage-influencers", icon: IconUsers },
    { title: "Pipeline", url: "/dashboard/pipeline", icon: IconGitBranch },
    { title: "Post Tracker", url: "/dashboard/post-tracker", icon: IconCircleCheck },
    { title: "Brand Partners", url: "/dashboard/brand-partners", icon: IconBuildingStore },
    { title: "Analytics", url: "/dashboard/analytics", icon: IconChartBar },
  ],
}

function AppSidebarInner({
  setView,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  setView?: (view: string) => void
}) {
  const [mounted, setMounted] = useState(false)
  // useSearchParams is reactive to query-string-only changes (unlike usePathname),
  // which matters here: the brand selector often adds/updates ?brandId on the
  // SAME route (no pathname change) right after a first-time login. Reading it
  // once on mount via window.location.search would otherwise get stuck null
  // forever, and every sidebar link would keep losing brandId thereafter.
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId")

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <Sidebar
      collapsible="offcanvas"
      className="bg-[#0F6B3E] text-[#F7F9F8]"
      {...props}
    >
      {/* HEADER */}
      <SidebarHeader className="h-24 flex items-center px-4 border-b border-white/10 bg-[#0F6B3E]">
        <button
          onClick={() => setView?.("dashboard")}
          className="flex items-center w-full"
        >
          <Image
            src="/INSTROOM WHITE.png"
            alt="Instroom Logo"
            width={150}
            height={32}
            className="object-contain"
            priority
          />
        </button>
      </SidebarHeader>

      {/* MENU */}
      <SidebarContent className="bg-[#0F6B3E] text-[#F7F9F8] px-2">
        <NavMain items={navData.navMain} brandId={brandId} />
      </SidebarContent>
    </Sidebar>
  )
}

export function AppSidebar(
  props: React.ComponentProps<typeof Sidebar> & { setView?: (view: string) => void }
) {
  return (
    <Suspense fallback={null}>
      <AppSidebarInner {...props} />
    </Suspense>
  )
}
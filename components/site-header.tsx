"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { BrandSelector } from "@/components/brand-selector"

export function SiteHeader() {
  const pathname = usePathname()

  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/dashboard/manage-influencers": "Manage Influencers",
    "/dashboard/inbox": "Inbox",
    "/dashboard/pipeline": "Pipeline",
    "/dashboard/brand-partners": "Brand Partners",
    "/dashboard/post-tracker": "Post Tracker",
    "/dashboard/analytics": "Analytics",
    "/dashboard/influencer-discovery": "Influencer Discovery",
    "/dashboard/influencer-discovery/search": "Discovery › Search Results",
    "/dashboard/settings": "Account · Profile",
    "/dashboard/settings/security": "Account · Security",
    "/dashboard/settings/notifications": "Account · Notifications",
    "/dashboard/settings/collaborators": "Workspace · Team & Collaborators",
    "/dashboard/settings/integrations": "Workspace · Integrations",
    "/dashboard/settings/branding": "Workspace · Branding",
    "/dashboard/settings/billing": "Plan · Billing & Subscription",
  }

  const title = titles[pathname] || "Dashboard"

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-1 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4" />

        <h1 className="text-base font-medium">{title}</h1>

        <div className="ml-auto flex items-center gap-4">
          <BrandSelector />
        </div>
      </div>
    </header>
  )
}
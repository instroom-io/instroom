"use client"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAdminPageTitle } from "@/components/admin-sidebar"

// Mirrors components/site-header.tsx so admin gets the same header geometry,
// the same sidebar trigger, and a working hamburger on mobile.
export function AdminHeader() {
  const title = useAdminPageTitle()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-white">
      <div className="flex w-full items-center gap-1 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4" />
        {/* No branding here — the Admin identity lives in the sidebar only.
            This bar carries the trigger, the current page title, and actions. */}
        <h1 className="min-w-0 truncate text-base font-medium">{title}</h1>
      </div>
    </header>
  )
}

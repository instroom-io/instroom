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
        <h1 className="text-base font-medium truncate">{title}</h1>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#0F6B3E] bg-[#1FAE5B]/10 border border-[#1FAE5B]/30 rounded-full px-2 py-0.5 shrink-0">
          Admin
        </span>
      </div>
    </header>
  )
}

"use client"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAdminPageTitle } from "@/components/admin-sidebar"

// Mirrors components/site-header.tsx so admin gets the same header geometry,
// the same sidebar trigger, and a working hamburger on mobile.
export function AdminHeader() {
  const title = useAdminPageTitle()

  return (
    // rounded-t-2xl matches the SidebarInset's own radius exactly, so the two
    // read as one surface rather than a square bar sitting on a rounded panel.
    // It has to be stated here: the inset has no overflow-hidden (that would
    // clip dropdowns and popovers escaping the content area), so this opaque
    // white header paints over the container's corners unless it carries the
    // same curve itself.
    //
    // md: only, deliberately. Below md the inset is full-bleed — no margin, no
    // radius — so rounding the header there would put curved corners against a
    // square container edge and expose a sliver of background in each corner.
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-white md:rounded-t-2xl">
      {/* Padding tracks the content container below (p-4 sm:p-6 md:p-8) so the
          title sits on the same left edge as the cards, instead of the header
          stopping at 24px while the content starts at 32px. */}
      <div className="flex w-full items-center gap-1 px-4 sm:px-6 md:px-8">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4" />
        {/* No branding here — the Admin identity lives in the sidebar only.
            This bar carries the trigger, the current page title, and actions. */}
        <h1 className="min-w-0 truncate text-base font-medium">{title}</h1>
      </div>
    </header>
  )
}

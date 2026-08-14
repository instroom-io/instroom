"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SubscriptionStatusProvider } from "@/components/subscription-status-provider"
import { TourProvider } from "@/components/product-tour/tour-provider"
import InstroomChatbot from "@/components/instroom-chatbot"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // `sidebar-shell` (app/globals.css) carries the responsive rail widths and
    // the off-canvas drawer rules — shared with the admin layout.
    <SidebarProvider
      className="sidebar-shell"
      style={
        {
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <TourProvider>
        <AppSidebar variant="inset" />

        {/* shadow-none! only. The content sheet's own shadow-sm falls leftward
            onto the rail's gutter and is the other half of the dark seam at the
            sidebar's right edge; the sheet keeps its size, position and rounded
            top. Important flag: the rule it overrides is a peer-data selector. */}
        <SidebarInset className="md:shadow-none!">
          <SiteHeader />

          <SubscriptionStatusProvider>
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                {children}
              </div>
            </div>
          </SubscriptionStatusProvider>
        </SidebarInset>

        {/* Instroom Chatbot */}
        {/* <InstroomChatbot /> */}
      </TourProvider>
    </SidebarProvider>
  )
}
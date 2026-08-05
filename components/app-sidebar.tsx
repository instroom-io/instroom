"use client"

import * as React from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import type { Sidebar } from "@/components/ui/sidebar"
import { DASHBOARD_NAV } from "@/components/sidebar/nav-config"
import { PortalSidebar } from "@/components/sidebar/portal-sidebar"

function AppSidebarInner({
  setView,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  setView?: (view: string) => void
}) {
  // useSearchParams is reactive to query-string-only changes (unlike usePathname),
  // which matters here: the brand selector often adds/updates ?brandId on the
  // SAME route (no pathname change) right after a first-time login. Reading it
  // once on mount via window.location.search would otherwise get stuck null
  // forever, and every sidebar link would keep losing brandId thereafter.
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId")

  // Preserved from the previous NavMain implementation: brandId is threaded
  // onto every destination so it survives navigation.
  const transformHref = React.useCallback(
    (href: string) => {
      if (!brandId) return href
      const separator = href.includes("?") ? "&" : "?"
      return `${href}${separator}brandId=${brandId}`
    },
    [brandId]
  )

  return (
    // Presentation is shared with the admin rail; only the config differs.
    <PortalSidebar
      sections={DASHBOARD_NAV}
      onBrandClick={() => setView?.("dashboard")}
      brandAlt="Instroom Logo"
      transformHref={transformHref}
      {...props}
    />
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

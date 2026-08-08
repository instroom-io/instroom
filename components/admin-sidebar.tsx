"use client"

import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { signOutEverywhere } from "@/lib/sign-out"
import type { Sidebar } from "@/components/ui/sidebar"
import { ADMIN_NAV } from "@/components/sidebar/nav-config"
import { PortalSidebar, resolvePageTitle } from "@/components/sidebar/portal-sidebar"

/**
 * Admin rail. All presentation comes from PortalSidebar — this file only
 * supplies the admin nav config and the signed-in user, so the admin and
 * dashboard rails cannot drift apart.
 */
export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()

  return (
    <PortalSidebar
      sections={ADMIN_NAV}
      brandHref="/admin"
      brandBadge="Admin"
      brandAlt="Instroom Admin"
      navLabel="Admin navigation"
      user={{
        name: session?.user?.name || "Administrator",
        email: session?.user?.email || undefined,
        image: session?.user?.image,
        onSignOut: () => signOutEverywhere(),
      }}
      {...props}
    />
  )
}

/** Page title for the admin header bar — mirrors SiteHeader's route map. */
export function useAdminPageTitle() {
  const pathname = usePathname()
  return resolvePageTitle(ADMIN_NAV, pathname, "Admin")
}

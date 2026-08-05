"use client"
// components/sidebar/portal-sidebar.tsx
// The single navigation rail used by every portal in the app.
//
// Portals differ ONLY in their nav config (components/sidebar/nav-config.ts).
// Typography, spacing, icon size, item height, radius, hover motion, active
// state, width and responsive behaviour all live here and in the --sb-* tokens
// in app/globals.css. Adding a portal means adding a config, not a component.
//
// Mobile: the shared <Sidebar collapsible="offcanvas"> gives a Radix Sheet
// drawer with focus trap, Escape, outside-click close and scroll lock. The
// hamburger is the <SidebarTrigger> in each portal's header.

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar"
import {
  SidebarBrand, SidebarNavItem, SidebarSectionLabel, SidebarUserCard,
  SIDEBAR_ROOT_CLASS, SIDEBAR_HEADER_CLASS, SIDEBAR_CONTENT_CLASS, SIDEBAR_FOOTER_CLASS,
} from "@/components/sidebar/nav-primitives"
import type { NavItem, NavSection } from "@/components/sidebar/nav-config"

export type PortalUser = {
  name: string
  email?: string
  image?: string | null
  onSignOut: () => void
}

/** Active-route test. `exact` compares the full pathname; otherwise prefix. */
export function isNavItemActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href)
}

/**
 * Resolve the page title for a portal's header bar. Prefers the item's long
 * `title` so shortening a nav label never renames the page heading.
 */
export function resolvePageTitle(sections: NavSection[], pathname: string, fallback: string) {
  const items = sections.flatMap((s) => s.items)
  // Reversed so the most specific (deepest) match wins over "/admin" etc.
  const match = [...items].reverse().find((i) => isNavItemActive(i, pathname))
  return match?.title ?? match?.label ?? fallback
}

export function PortalSidebar({
  sections,
  brandHref,
  onBrandClick,
  brandBadge,
  brandAlt,
  user,
  navLabel = "Main navigation",
  /** Lets a portal thread query state (e.g. ?brandId=) onto every href. */
  transformHref,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  sections: NavSection[]
  brandHref?: string
  onBrandClick?: () => void
  brandBadge?: string
  brandAlt?: string
  user?: PortalUser
  navLabel?: string
  transformHref?: (href: string) => string
}) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  // Close the drawer after navigating on mobile
  const handleNavigate = () => { if (isMobile) setOpenMobile(false) }

  return (
    <Sidebar collapsible="offcanvas" className={SIDEBAR_ROOT_CLASS} {...props}>
      <SidebarHeader className={SIDEBAR_HEADER_CLASS}>
        <SidebarBrand
          href={brandHref}
          onClick={onBrandClick ?? handleNavigate}
          badge={brandBadge}
          alt={brandAlt}
        />
      </SidebarHeader>

      <SidebarContent className={SIDEBAR_CONTENT_CLASS} aria-label={navLabel}>
        {sections.map((section, i) => (
          <div key={section.label ?? `section-${i}`} className="mb-4 last:mb-2">
            {section.label && <SidebarSectionLabel>{section.label}</SidebarSectionLabel>}
            <nav aria-label={section.label ?? navLabel} className="flex flex-col gap-1">
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={transformHref ? transformHref(item.href) : item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isNavItemActive(item, pathname)}
                  onNavigate={handleNavigate}
                />
              ))}
            </nav>
          </div>
        ))}
      </SidebarContent>

      {user && (
        <SidebarFooter className={SIDEBAR_FOOTER_CLASS}>
          <SidebarUserCard
            name={user.name}
            email={user.email}
            image={user.image}
            onSignOut={user.onSignOut}
          />
        </SidebarFooter>
      )}
    </Sidebar>
  )
}

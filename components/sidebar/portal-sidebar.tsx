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

/* ── Active route ─────────────────────────────────────────────────────────
   The highlight is derived from the pathname on every render and stored
   nowhere, so it follows navigation and survives a refresh by construction.
   ------------------------------------------------------------------------ */

/** Drop any query/hash and a trailing slash so comparisons are stable. */
function normalisePath(pathname: string): string {
  const path = pathname.split("?")[0].split("#")[0]
  return path.length > 1 ? path.replace(/\/+$/, "") : path
}

/**
 * Does this item cover `pathname`?
 *
 * Matching is SEGMENT-AWARE: "/dashboard/inbox" covers "/dashboard/inbox/42"
 * but not "/dashboard/inbox-archive". A bare `startsWith` would claim both,
 * which is how a prefix quietly steals another item's highlight.
 */
function itemCovers(item: NavItem, pathname: string): boolean {
  const href = normalisePath(item.href)
  if (pathname === href) return true
  // `exact` opts an item out of owning its children.
  if (item.exact) return false
  return pathname.startsWith(`${href}/`)
}

/**
 * The one active href for `pathname`, or null when nothing matches.
 *
 * Longest match wins. That is what guarantees a single active item even when
 * hrefs nest: on "/admin/users" both "/admin" and "/admin/users" cover the
 * path, and the deeper one is the answer.
 */
export function resolveActiveHref(sections: NavSection[], pathname: string): string | null {
  const path = normalisePath(pathname)
  let best: string | null = null
  for (const section of sections) {
    for (const item of section.items) {
      if (!itemCovers(item, path)) continue
      const href = normalisePath(item.href)
      if (best === null || href.length > best.length) best = href
    }
  }
  return best
}

/**
 * Resolve the page title for a portal's header bar. Prefers the item's long
 * `title` so shortening a nav label never renames the page heading.
 */
export function resolvePageTitle(sections: NavSection[], pathname: string, fallback: string) {
  const activeHref = resolveActiveHref(sections, pathname)
  if (!activeHref) return fallback
  const match = sections
    .flatMap((s) => s.items)
    .find((i) => normalisePath(i.href) === activeHref)
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
  // One resolution per render; every row is a string comparison against it.
  const activeHref = React.useMemo(() => resolveActiveHref(sections, pathname), [sections, pathname])
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
                  active={normalisePath(item.href) === activeHref}
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

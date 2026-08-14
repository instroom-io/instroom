// components/sidebar/nav-config.ts
// Navigation configuration for every portal. This file is the ONLY thing that
// differs between portals — the rail component, styling and behaviour are
// shared (components/sidebar/portal-sidebar.tsx).
//
// To add a portal: add a `NavSection[]` here and render <PortalSidebar
// sections={...} />. No new component, no new styles.
//
// `label` is the short caption shown in the rail. `title` is the optional long
// name the portal's header bar shows, so shortening a rail label never renames
// a page heading. `exact` compares the full pathname instead of a prefix.

import {
  LayoutDashboard, Search, Mail, Users, GitBranch, CircleCheck,
  Store, MessageCircle, BarChart3, Star, Megaphone, Clock, ShieldCheck,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  title?: string
  icon: LucideIcon
  exact?: boolean
  /** data-tour id, for anchoring a first-time product tour step. */
  tourId?: string
}

export type NavSection = {
  /** Omit for an ungrouped run of items. */
  label?: string
  items: NavItem[]
}

/* ── User dashboard ────────────────────────────────────────────────────────
   Same eight destinations; grouped for scanability. Items own their sub-routes
   (see resolveActiveHref) so a detail or search page keeps its parent lit. Tabler icons swapped for their Lucide equivalents so both
   portals draw from one icon set.
   ------------------------------------------------------------------------ */
// One flat list, no section heading — the original order is preserved exactly.
// A section with no `label` renders its items with no heading, so this needs no
// special case in PortalSidebar.
export const DASHBOARD_NAV: NavSection[] = [
  {
    items: [
      // Temporarily hidden — page is still "Coming soon" with nothing to do
      // yet. Restore this line to bring Discovery back into the sidebar.
      // { href: "/dashboard/influencer-discovery", label: "Discovery", icon: Search },
      { href: "/dashboard/manage-influencers", label: "Influencers List", icon: Users, tourId: "nav-influencers" },
      { href: "/dashboard/inbox", label: "Inbox", icon: Mail, tourId: "nav-inbox" },
      { href: "/dashboard/pipeline", label: "Pipeline", icon: GitBranch, tourId: "nav-pipeline" },
      { href: "/dashboard/post-tracker", label: "Post Tracker", icon: CircleCheck, tourId: "nav-post-tracker" },
      { href: "/dashboard/brand-partners", label: "Brand Partners", icon: Store, tourId: "nav-brand-partners" },
      { href: "/dashboard/community", label: "Community", icon: MessageCircle, tourId: "nav-community" },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, tourId: "nav-analytics" },
    ],
  },
]

/* ── Admin panel ─────────────────────────────────────────────────────────── */
export const ADMIN_NAV: NavSection[] = [
  {
    label: "General",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/users", label: "Users", title: "User Management", icon: Users },
      { href: "/admin/influencers", label: "Influencers", title: "Influencer Management", icon: Star },
      { href: "/admin/campaigns", label: "Campaigns", title: "Campaign Management", icon: Megaphone },
      { href: "/admin/early-access", label: "Early Access", title: "Early Access Users", icon: Clock },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/audit-logs", label: "Audit Logs", icon: ShieldCheck },
    ],
  },
]

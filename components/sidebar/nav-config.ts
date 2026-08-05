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
}

export type NavSection = {
  /** Omit for an ungrouped run of items. */
  label?: string
  items: NavItem[]
}

/* ── User dashboard ────────────────────────────────────────────────────────
   Same eight destinations and same exact-match behaviour as before; grouped
   for scanability. Tabler icons swapped for their Lucide equivalents so both
   portals draw from one icon set.
   ------------------------------------------------------------------------ */
// One flat list, no section heading — the original order is preserved exactly.
// A section with no `label` renders its items with no heading, so this needs no
// special case in PortalSidebar.
export const DASHBOARD_NAV: NavSection[] = [
  {
    items: [
      { href: "/dashboard/influencer-discovery", label: "Discovery", icon: Search, exact: true },
      { href: "/dashboard/inbox", label: "Inbox", icon: Mail, exact: true },
      { href: "/dashboard/manage-influencers", label: "Influencers List", icon: Users, exact: true },
      { href: "/dashboard/pipeline", label: "Pipeline", icon: GitBranch, exact: true },
      { href: "/dashboard/post-tracker", label: "Post Tracker", icon: CircleCheck, exact: true },
      { href: "/dashboard/brand-partners", label: "Brand Partners", icon: Store, exact: true },
      { href: "/dashboard/community", label: "Community", icon: MessageCircle, exact: true },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, exact: true },
    ],
  },
]

/* ── Admin panel ─────────────────────────────────────────────────────────── */
export const ADMIN_NAV: NavSection[] = [
  {
    label: "General",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
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

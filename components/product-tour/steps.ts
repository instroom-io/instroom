// The product tour is split into independent "scenes" — a short upfront
// walkthrough (the Create Workspace wizard + a sidebar overview), plus one
// tiny contextual tour per page that fires the first time a user actually
// visits it, whenever that happens. Seeing (or skipping) one scene never
// marks any other scene seen; each is tracked separately in
// User.product_tour_seen_scenes.
export type TourStep = {
  target: string
  title: string
  body: string
  placement?: "right" | "bottom" | "top" | "left"
  // hasBrandId reflects whether the URL already carries ?brandId= — the same
  // signal BrandSelector itself resolves before deciding whether to redirect
  // a brand-new account to the wizard or reveal the real dashboard.
  matchesRoute: (pathname: string, hasBrandId: boolean) => boolean
}

export type TourScene = {
  key: string
  steps: TourStep[]
}

const WIZARD_ROUTE_PREFIX = "/dashboard/brand/create"
const MANAGE_INFLUENCERS_ROUTE_PREFIX = "/dashboard/manage-influencers"
const INBOX_ROUTE_PREFIX = "/dashboard/inbox"
const PIPELINE_ROUTE_PREFIX = "/dashboard/pipeline"
const POST_TRACKER_ROUTE_PREFIX = "/dashboard/post-tracker"
const BRAND_PARTNERS_ROUTE_PREFIX = "/dashboard/brand-partners"
const COMMUNITY_ROUTE_PREFIX = "/dashboard/community"
const ANALYTICS_ROUTE_PREFIX = "/dashboard/analytics"

// Every matcher below except isWizardRoute requires hasBrandId, not just a
// path prefix match: a brand-new account briefly sits on /dashboard or
// /dashboard/manage-influencers (no ?brandId= yet) while BrandSelector's own
// async brand-list fetch decides whether to send them to the wizard instead.
// Without this guard, whichever scene's step happens to match that transient
// path (any of them, from the sidebar overview to a page's own content tour)
// can win the race and flash in before the wizard ever gets a turn. Once
// brandId is actually in the URL, BrandSelector has resolved and no wizard
// redirect is still pending, so it's safe to match on path alone.
const requiresResolvedBrand =
  (matchesPath: (pathname: string) => boolean) => (pathname: string, hasBrandId: boolean) =>
    matchesPath(pathname) && hasBrandId

export const isWizardRoute = (pathname: string) => pathname.startsWith(WIZARD_ROUTE_PREFIX)
export const isManageInfluencersRoute = requiresResolvedBrand((pathname) =>
  pathname.startsWith(MANAGE_INFLUENCERS_ROUTE_PREFIX)
)
export const isInboxRoute = requiresResolvedBrand((pathname) => pathname.startsWith(INBOX_ROUTE_PREFIX))
export const isPipelineRoute = requiresResolvedBrand((pathname) => pathname.startsWith(PIPELINE_ROUTE_PREFIX))
export const isPostTrackerRoute = requiresResolvedBrand((pathname) =>
  pathname.startsWith(POST_TRACKER_ROUTE_PREFIX)
)
export const isBrandPartnersRoute = requiresResolvedBrand((pathname) =>
  pathname.startsWith(BRAND_PARTNERS_ROUTE_PREFIX)
)
export const isCommunityRoute = requiresResolvedBrand((pathname) => pathname.startsWith(COMMUNITY_ROUTE_PREFIX))
export const isAnalyticsRoute = requiresResolvedBrand((pathname) => pathname.startsWith(ANALYTICS_ROUTE_PREFIX))
export const isDashboardRoute = requiresResolvedBrand(
  (pathname) => pathname.startsWith("/dashboard") && !isWizardRoute(pathname)
)

export const SCENES: TourScene[] = [
  {
    // Wizard fields (Create Workspace) + a sidebar overview, ending on
    // whichever dashboard page the user lands on first. One continuous
    // upfront walkthrough — everything after this is contextual, per page.
    key: "onboarding",
    steps: [
      {
        target: "wizard-brand-name",
        title: "Start with your brand name",
        body: "This is how your workspace shows up everywhere in Instroom, so make it recognizable.",
        placement: "right",
        matchesRoute: isWizardRoute,
      },
      {
        target: "wizard-brand-description",
        title: "What does your brand do?",
        body: "Totally optional, but a short description helps us tailor things to your business later.",
        placement: "right",
        matchesRoute: isWizardRoute,
      },
      {
        target: "wizard-brand-website",
        title: "Got a website?",
        body: "Add it if you have one — you can always come back and fill this in later.",
        placement: "right",
        matchesRoute: isWizardRoute,
      },
      {
        target: "nav-influencers",
        title: "Your influencer list",
        body: "Every influencer you've added or discovered lives here, ready to organize and reach out to.",
        placement: "right",
        matchesRoute: isDashboardRoute,
      },
      {
        target: "nav-inbox",
        title: "Inbox",
        body: "Conversations with influencers land here, so you never have to dig through email.",
        placement: "right",
        matchesRoute: isDashboardRoute,
      },
      {
        target: "nav-pipeline",
        title: "Pipeline",
        body: "Track where each influencer stands — from first contact to signed deal — in one board.",
        placement: "right",
        matchesRoute: isDashboardRoute,
      },
      {
        target: "nav-post-tracker",
        title: "Post Tracker",
        body: "Once content goes live, track posts and performance right here.",
        placement: "right",
        matchesRoute: isDashboardRoute,
      },
      {
        target: "nav-brand-partners",
        title: "Brand Partners",
        body: "Team up with other brands and share access to your influencer network.",
        placement: "right",
        matchesRoute: isDashboardRoute,
      },
      {
        target: "nav-community",
        title: "Community",
        body: "Connect with other brands, swap notes, and see what's working for them.",
        placement: "right",
        matchesRoute: isDashboardRoute,
      },
      {
        target: "nav-analytics",
        title: "Analytics",
        body: "See how your campaigns are performing at a glance.",
        placement: "right",
        matchesRoute: isDashboardRoute,
      },
      {
        target: "brand-selector",
        title: "Switch brands anytime",
        body: "Managing more than one brand? Switch between them here — everything else on this page updates with it.",
        placement: "bottom",
        matchesRoute: isDashboardRoute,
      },
    ],
  },
  {
    key: "influencers",
    steps: [
      {
        target: "table-search",
        title: "Find anyone fast",
        body: "Search by handle, name, or any other field once your list starts growing.",
        placement: "bottom",
        matchesRoute: isManageInfluencersRoute,
      },
      {
        target: "table-filters",
        title: "Filter your list",
        body: "Narrow down by platform, niche, location, gender, or approval status.",
        placement: "bottom",
        matchesRoute: isManageInfluencersRoute,
      },
      {
        target: "table-add-influencer",
        title: "Add an influencer",
        body: "Type a handle and we'll auto-fetch their profile data from Instagram or TikTok.",
        placement: "left",
        matchesRoute: isManageInfluencersRoute,
      },
      {
        target: "table-import-export",
        title: "Import or export in bulk",
        body: "Already have a list? Import a CSV to add everyone at once, or export what's here.",
        placement: "left",
        matchesRoute: isManageInfluencersRoute,
      },
    ],
  },
  {
    key: "inbox",
    steps: [
      {
        target: "inbox-pipeline-toggle",
        title: "Your pipeline at a glance",
        body: "See how many conversations are in each stage, from first contact to posted.",
        placement: "bottom",
        matchesRoute: isInboxRoute,
      },
      {
        target: "inbox-connect-email",
        title: "Connect your inbox",
        body: "Link Gmail or Outlook to manage every influencer conversation right here.",
        placement: "right",
        matchesRoute: isInboxRoute,
      },
    ],
  },
  {
    key: "pipeline",
    steps: [
      {
        target: "pipeline-search",
        title: "Find anyone in your pipeline",
        body: "Search by name or handle to jump straight to a deal.",
        placement: "bottom",
        matchesRoute: isPipelineRoute,
      },
      {
        target: "pipeline-filters",
        title: "Filter the board",
        body: "Narrow down by stage, approval status, location, or niche.",
        placement: "bottom",
        matchesRoute: isPipelineRoute,
      },
      {
        target: "pipeline-view-toggle",
        title: "Board or table",
        body: "Switch between the visual Kanban board and a sortable table of the same data.",
        placement: "bottom",
        matchesRoute: isPipelineRoute,
      },
      {
        target: "pipeline-board",
        title: "Drag to update stage",
        body: "Move an influencer's card across stages as a deal progresses — from first contact to signed deal.",
        placement: "bottom",
        matchesRoute: isPipelineRoute,
      },
    ],
  },
  {
    key: "post-tracker",
    steps: [
      {
        target: "post-tracker-search",
        title: "Find anyone fast",
        body: "Search tracked influencers by name or handle from anywhere in the tracker.",
        placement: "bottom",
        matchesRoute: isPostTrackerRoute,
      },
      {
        target: "post-tracker-filters",
        title: "Filter what you're tracking",
        body: "Filter by stage, collab type, location, or niche.",
        placement: "bottom",
        matchesRoute: isPostTrackerRoute,
      },
      {
        target: "post-tracker-view-toggle",
        title: "Board or table",
        body: "Switch between the Kanban board and a flat table view of the same tracked posts.",
        placement: "bottom",
        matchesRoute: isPostTrackerRoute,
      },
      {
        target: "post-tracker-stage-columns",
        title: "Once content goes live",
        body: "Drag a card across these stages as an influencer moves from order to delivery to posted.",
        placement: "bottom",
        matchesRoute: isPostTrackerRoute,
      },
    ],
  },
  {
    key: "brand-partners",
    steps: [
      {
        target: "brand-partners-add-partner",
        title: "Add a brand partner",
        body: "Add your first influencer as a brand partner to start tracking their performance.",
        placement: "left",
        matchesRoute: isBrandPartnersRoute,
      },
      {
        target: "brand-partners-tier-settings",
        title: "Set your partner tiers",
        body: "Set your Gold, Silver, and Bronze revenue thresholds to automatically tier your partners.",
        placement: "bottom",
        matchesRoute: isBrandPartnersRoute,
      },
      {
        target: "brand-partners-search",
        title: "Find a partner fast",
        body: "Search your partner roster by handle, niche, platform, or location.",
        placement: "bottom",
        matchesRoute: isBrandPartnersRoute,
      },
      {
        target: "brand-partners-filters",
        title: "Filter your roster",
        body: "Filter partners by tier, platform, niche, location, or contact status.",
        placement: "bottom",
        matchesRoute: isBrandPartnersRoute,
      },
    ],
  },
  {
    key: "community",
    steps: [
      {
        target: "community-setup-heading",
        title: "Your own space",
        body: "Community runs on your own Discord server, so conversations with other brands stay in one place — and stay yours.",
        placement: "bottom",
        matchesRoute: isCommunityRoute,
      },
      {
        target: "community-setup-progress",
        title: "Two quick steps",
        body: "Connecting your server takes just a couple of steps, and this tracks exactly where you are.",
        placement: "bottom",
        matchesRoute: isCommunityRoute,
      },
      {
        // Anchored on whichever setup step is showing: the account link comes
        // first, and the server step replaces it once the account is connected.
        target: "community-connect-server",
        title: "Start here",
        body: "Link your Discord account first, then connect your team's server — this button walks you through whichever step is next.",
        placement: "top",
        matchesRoute: isCommunityRoute,
      },
    ],
  },
  {
    key: "analytics",
    steps: [
      {
        target: "analytics-search",
        title: "Find anyone fast",
        body: "Search for a specific influencer by name or handle across every metric on the page.",
        placement: "bottom",
        matchesRoute: isAnalyticsRoute,
      },
      {
        target: "analytics-filters",
        title: "Filter every chart",
        body: "Narrow everything down to a specific platform, date range, niche, or location.",
        placement: "bottom",
        matchesRoute: isAnalyticsRoute,
      },
      {
        target: "analytics-tabs",
        title: "Four views, one page",
        body: "Switch between campaign performance, posting activity, reach, and conversions.",
        placement: "bottom",
        matchesRoute: isAnalyticsRoute,
      },
      {
        target: "analytics-export",
        title: "Export for reporting",
        body: "Download the current view as a spreadsheet whenever you need it outside Instroom.",
        placement: "left",
        matchesRoute: isAnalyticsRoute,
      },
    ],
  },
]

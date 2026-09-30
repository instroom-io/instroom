import type { ReactNode } from "react"

// Shared between /pricing and /pricing/payment so the two pages can never
// drift out of sync the way they did before (payment page had its own
// hardcoded plan copy/features that fell behind the real pricing page).

export const PLAN_TAGLINES: Record<string, string> = {
  basic: "Run one brand, free — for as long as you like.",
  solo: "For one brand, running at full scale.",
  team: "For scaling brands and multi-brand teams.",
}

export function getPlanFeatures(plan: any): ReactNode[] {
  if (plan.name === "basic") {
    return [
      <><strong>Unlimited</strong> seats</>,
      <><strong>{plan.included_brands}</strong> workspace{plan.included_brands !== 1 ? "s" : ""}</>,
      <><strong>{plan.max_influencers}</strong> influencers <span className="muted">(one-time)</span></>,
      "Auto-enriched profiles — engagement, followers, email & location",
      "Pipeline, approvals & payment tracking",
    ]
  }
  if (plan.name === "solo") {
    return [
      "Everything in Basic, plus:",
      <><strong>{plan.max_influencers}</strong> new influencers / month</>,
      "Inbox — Gmail & Outlook",
      "Import & export",
    ]
  }
  if (plan.name === "team") {
    return [
      "Everything in Solo, plus:",
      <><strong>{plan.max_influencers}</strong> new influencers / month</>,
      <><strong>{plan.included_brands}</strong> workspaces <span className="muted">(add more anytime)</span></>,
      "Priority support",
    ]
  }
  return []
}

// Shared with onboarding, which checks out a preselected paid plan directly
// without routing through /pricing/payment first.
export const LEMON_SQUEEZY_VARIANTS: Record<string, Record<string, string>> = {
  solo: {
    monthly: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_SOLO_MONTHLY || "1532578",
    yearly: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_SOLO_YEARLY || "1532542",
  },
  team: {
    monthly: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_TEAM_MONTHLY || "1532585",
    yearly: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_TEAM_YEARLY || "1532588",
  },
}

export function formatPrice(plan: any, cycle: "monthly" | "yearly") {
  const price = cycle === "yearly" ? plan.price_yearly : plan.price_monthly
  if (Number(price) === 0) return { amount: "Free", period: "" }
  return { amount: `$${Number(price).toLocaleString()}`, period: "/mo" }
}

export function formatPriceSub(plan: any, cycle: "monthly" | "yearly") {
  if (Number(plan.price_monthly) === 0) return "Free forever · no credit card"
  if (cycle === "monthly") return "Billed monthly"
  return `$${(Number(plan.price_yearly) * 12).toLocaleString()} billed annually`
}

export function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.6" width="11" height="11">
      <path d="M5 13l4 4L19 7" stroke="#1FAE5B" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

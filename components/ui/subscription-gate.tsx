"use client"

import Link from "next/link"

interface SubscriptionGateProps {
  /** null = still loading (no flash), true = subscribed, false = show gate */
  isSubscribed: boolean | null
  /** "active", "trialing", "inactive", etc. - used to customize messaging */
  status?: string
  /** Label shown in the overlay title e.g. "the pipeline" */
  featureName?: string
  /** Plan pills shown in the card */
  plans?: string[]
  /** Display name of the subscriber's current plan (e.g. "Basic"), when
   *  they're blocked despite already having an active subscription — lets
   *  the message say "upgrade from Basic" instead of implying they have no
   *  subscription at all, which would be wrong. */
  currentPlanDisplayName?: string | null
  children: React.ReactNode
}

/**
 * SubscriptionGate — place inside components/ui/subscription-gate.tsx
 *
 * Wraps ONLY the main page content area.
 * Sidebar and navbar live in layout.tsx and are never touched.
 *
 * Import path:
 *   import { SubscriptionGate } from "@/components/ui/subscription-gate"
 */
export function SubscriptionGate({
  isSubscribed,
  status = "inactive",
  featureName = "this feature",
  plans = ["Solo", "Team"],
  currentPlanDisplayName = null,
  children,
}: SubscriptionGateProps) {
  // Still resolving — render children normally to avoid layout flash
  if (isSubscribed === null) return <>{children}</>

  // Subscribed — just render the page
  if (isSubscribed) return <>{children}</>

  // Determine if trialing
  const isTrialing = status === "trialing"
  // Blocked despite an active subscription — it's just the wrong tier for
  // this feature (e.g. Basic trying to open Inbox), not "no subscription."
  const isWrongPlan = !isTrialing && !!currentPlanDisplayName
  const isUpgradeCase = isTrialing || isWrongPlan

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-64px)] overflow-hidden">
      {/* Lightly blurred content — visible but clearly locked */}
      <div
        className="pointer-events-none select-none w-full h-full"
        style={{ filter: "blur(3px)", opacity: 0.72 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay — soft backdrop blur for depth.
          items-start + a viewport-height-relative top offset, not
          items-center: dead-center in the remaining content height read as
          floating in the middle of the screen, disconnected from the header
          above it. pt-[12vh] keeps the card sitting just beneath the header
          on any viewport HEIGHT rather than fixing a pixel offset that would
          only look right at one resolution. */}
      <div
        className="absolute inset-0 z-10 flex items-start justify-center pt-[12vh] sm:pt-[14vh]"
        style={{ background: "rgba(10,20,15,0.45)", backdropFilter: "blur(1px)" }}
      >
        <div
          className="flex flex-col items-center rounded-2xl px-6 sm:px-8 pt-6 sm:pt-7 pb-7 sm:pb-8 text-center"
          style={{
            background: "rgba(255,255,255,0.98)",
            boxShadow:
              "0 2px 0px rgba(15,107,62,0.08) inset, 0 32px 72px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(31,174,91,0.2)",
            maxWidth: 380,
            width: "88%",
            borderRadius: 20,
          }}
        >
          {/* Lock icon — icon, title and description read as ONE top group:
              tight gaps within it (mb-3.5, gap-1.5), then a wider gap below
              before the separate plan/CTA action group. The old uniform
              gap-6 between every child treated the icon as its own section
              with as much air below it as above the CTA, which is what read
              as "floating" at the top. */}
          <div
            className="flex items-center justify-center mb-3.5"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: isUpgradeCase
                ? "linear-gradient(145deg, #fef3c7 0%, #fde68a 100%)"
                : "linear-gradient(145deg, #e6f9ef 0%, #c8f0db 100%)",
              boxShadow: isUpgradeCase
                ? "0 1px 3px rgba(180,83,9,0.15), 0 0 0 1px rgba(180,83,9,0.1)"
                : "0 1px 3px rgba(15,107,62,0.15), 0 0 0 1px rgba(15,107,62,0.1)",
            }}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isUpgradeCase ? "#b45309" : "#0F6B3E"}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isTrialing ? (
                // Clock icon for trial
                <>
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 6 12 12 16 14" />
                </>
              ) : (
                // Lock icon for unsubscribed or wrong-tier
                <>
                  <rect x="3" y="11" width="18" height="11" rx="2.5" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </>
              )}
            </svg>
          </div>

          {/* Text */}
          <div className="flex flex-col gap-1.5 mb-6">
            <h2
              className="text-xl font-semibold leading-tight"
              style={{ color: "#111827", letterSpacing: "-0.025em" }}
            >
              {isUpgradeCase ? `Upgrade to use ${featureName}` : `Unlock ${featureName}`}
            </h2>
            <p
              className="text-sm leading-relaxed mx-auto"
              style={{ color: "#6b7280", maxWidth: 300 }}
            >
              {isTrialing
                ? `You're currently on a free trial. Upgrade to a paid plan to access ${featureName}.`
                : isWrongPlan
                ? `You're currently on the ${currentPlanDisplayName} plan, which doesn't include ${featureName}. Upgrade to get access.`
                : "This page requires an active subscription. Pick a plan and get full access instantly."}
            </p>
          </div>

          {/* Plan pills + CTA — grouped tighter than the sections above, since
              together they form one "here's how to upgrade" action block. */}
          <div className="flex flex-col items-center gap-3 w-full">
            {plans.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {plans.map((plan) => (
                  <span
                    key={plan}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide"
                    style={{
                      background: "#f0faf5",
                      color: "#0F6B3E",
                      border: "1px solid #c3e6d4",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {plan}
                  </span>
                ))}
              </div>
            )}

            <Link
              href="/pricing"
              className="block w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg,#22c55e 0%,#0F6B3E 100%)",
                boxShadow: "0 4px 16px rgba(15,107,62,0.32), 0 1px 0 rgba(255,255,255,0.15) inset",
              }}
            >
              {isUpgradeCase ? "View pricing & upgrade" : "View plans & pricing"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
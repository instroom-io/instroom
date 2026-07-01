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
  children,
}: SubscriptionGateProps) {
  // Still resolving — render children normally to avoid layout flash
  if (isSubscribed === null) return <>{children}</>

  // Subscribed — just render the page
  if (isSubscribed) return <>{children}</>

  // Determine if trialing
  const isTrialing = status === "trialing"

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

      {/* Overlay — soft backdrop blur for depth */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center"
        style={{ background: "rgba(10,20,15,0.45)", backdropFilter: "blur(1px)" }}
      >
        <div
          className="flex flex-col items-center gap-6 rounded-2xl px-8 py-9 text-center"
          style={{
            background: "rgba(255,255,255,0.98)",
            boxShadow:
              "0 2px 0px rgba(15,107,62,0.08) inset, 0 32px 72px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(31,174,91,0.2)",
            maxWidth: 380,
            width: "88%",
            borderRadius: 20,
          }}
        >
          {/* Lock icon */}
          <div
            className="flex items-center justify-center"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: isTrialing
                ? "linear-gradient(145deg, #fef3c7 0%, #fde68a 100%)"
                : "linear-gradient(145deg, #e6f9ef 0%, #c8f0db 100%)",
              boxShadow: isTrialing
                ? "0 1px 3px rgba(180,83,9,0.15), 0 0 0 1px rgba(180,83,9,0.1)"
                : "0 1px 3px rgba(15,107,62,0.15), 0 0 0 1px rgba(15,107,62,0.1)",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isTrialing ? "#b45309" : "#0F6B3E"}
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
                // Lock icon for unsubscribed
                <>
                  <rect x="3" y="11" width="18" height="11" rx="2.5" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </>
              )}
            </svg>
          </div>

          {/* Text */}
          <div className="flex flex-col gap-2">
            <h2
              className="text-xl font-semibold leading-tight"
              style={{ color: "#111827", letterSpacing: "-0.025em" }}
            >
              {isTrialing ? `Upgrade to use ${featureName}` : `Unlock ${featureName}`}
            </h2>
            <p
              className="text-sm leading-relaxed mx-auto"
              style={{ color: "#6b7280", maxWidth: 280 }}
            >
              {isTrialing
                ? `You're currently on a free trial. Upgrade to a paid plan to access ${featureName}.`
                : "This page requires an active subscription. Pick a plan and get full access instantly."}
            </p>
          </div>

          {/* Plan pills */}
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

          {/* CTA */}
          <Link
            href="/pricing"
            className="block w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg,#22c55e 0%,#0F6B3E 100%)",
              boxShadow: "0 4px 16px rgba(15,107,62,0.32), 0 1px 0 rgba(255,255,255,0.15) inset",
            }}
          >
            {isTrialing ? "View pricing & upgrade" : "View plans & pricing"}
          </Link>
        </div>
      </div>
    </div>
  )
}
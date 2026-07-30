"use client"

import Link from "next/link"

// Flip to `false` once real subscriptions open back up after the beta.
const BETA_CHECKOUT_DISABLED = true

interface PricingPlanButtonProps {
  planName: string
  cycle: string
  isCurrentPlan: boolean
  isPopular: boolean
  currentPlanName?: string | null
  isPlanHigher: boolean
}

export function PricingPlanButton({
  planName,
  cycle,
  isCurrentPlan,
  isPopular,
  currentPlanName,
  isPlanHigher,
}: PricingPlanButtonProps) {
  let buttonText = planName === "basic" ? "Get Started Free" : "Get Started"

  if (isCurrentPlan) {
    buttonText = "Current Plan"
  } else if (currentPlanName && isPlanHigher) {
    buttonText = "Upgrade"
  } else if (currentPlanName && !isPlanHigher) {
    buttonText = "Downgrade"
  }

  const isHighlighted = isPopular || isCurrentPlan

  if (isCurrentPlan) {
    return (
      <span className="w-full block rounded-lg py-3 text-center text-base font-semibold cursor-default bg-[#1FAE5B]/10 text-[#1FAE5B] border-2 border-[#1FAE5B]/30">
        {buttonText}
      </span>
    )
  }

  if (BETA_CHECKOUT_DISABLED) {
    return (
      <span
        aria-disabled="true"
        title="Not available during the private beta"
        className="w-full block rounded-lg py-3 text-center text-base font-semibold cursor-not-allowed bg-gray-100 text-gray-400 border-2 border-gray-200"
      >
        {buttonText}
      </span>
    )
  }

  return (
    <Link
      href={`/pricing/payment?plan=${planName}&cycle=${cycle}`}
      className={`w-full block rounded-lg py-3 text-center text-base font-semibold transition-all duration-150 ${
        isHighlighted
          ? "bg-gradient-to-r from-[#1FAE5B] to-[#0F6B3E] text-white shadow-lg shadow-[#1FAE5B]/25 hover:shadow-xl hover:shadow-[#1FAE5B]/35"
          : "border-2 border-[#0F6B3E]/30 bg-white text-[#1E1E1E] hover:border-[#1FAE5B]/60 hover:bg-[#1FAE5B]/5"
      }`}
    >
      {buttonText}
    </Link>
  )
}
"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

const planSummaries: Record<string, string> = {
  basic: "1 workspace",
  solo: "1 workspace (cannot add more)",
  team: "3 workspaces included (can buy more)",
  agency: "10 workspaces included (can buy more)",
};

const plans = {
  basic: {
    display_name: "Basic",
    price_monthly: 0,
    price_yearly: 0,
    included_seats: 0,
    max_seats: null,
    included_brands: 1,
    max_brands: 1,
    max_influencers: 100,
    max_campaigns: null,
    can_use_api: false,
    custom_branding: true,
    priority_support: false,
  },
  solo: {
    display_name: "Solo",
    price_monthly: 19,
    price_yearly: 15,
    included_seats: 0,
    max_seats: 5,
    included_brands: 1,
    max_brands: 1,
    max_influencers: 100,
    max_campaigns: 3,
    can_use_api: false,
    custom_branding: true,
    priority_support: false,
  },
  team: {
    display_name: "Team",
    price_monthly: 49,
    price_yearly: 39,
    included_seats: 10,
    max_seats: 25,
    included_brands: 3,
    max_brands: 10,
    max_influencers: 500,
    max_campaigns: 10,
    can_use_api: true,
    custom_branding: true,
    priority_support: true,
  },
};

const lemonSqueezyVariants: Record<string, Record<string, string>> = {
  solo: {
    monthly: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_SOLO_MONTHLY || "1532578",
    yearly: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_SOLO_YEARLY || "1532542",
  },
  team: {
    monthly: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_TEAM_MONTHLY || "1532585",
    yearly: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_TEAM_YEARLY || "1532588",
  },
};

function PaymentPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planKey = (searchParams.get("plan") || "team") as keyof typeof plans;
  const cycle = (searchParams.get("cycle") === "yearly") ? "yearly" : "monthly";
  const plan = plans[planKey] || plans.team;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: session } = useSession();
  const userId = session?.user?.id;

  const price = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
  const isFree = planKey === "basic";

  const handleCheckout = async () => {
    if (!userId) {
      router.push("/login");
      return;
    }

    setError(null);

    // Free plan — create a trial subscription via API, then go to dashboard
    if (isFree) {
      try {
        setLoading(true);
        const response = await fetch("/api/subscription/start-trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planName: "basic", cycle: "monthly" }),
        });

        const data = await response.json();

        if (!response.ok) {
          // If user already has a subscription, just send them to dashboard
          if (response.status === 400 && data.error?.includes("already has")) {
            router.push("/dashboard");
            return;
          }
          setError(data.error || "Failed to start trial. Please try again.");
          return;
        }

        router.push("/dashboard");
      } catch (err) {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Paid plan — go through Lemon Squeezy checkout
    try {
      setLoading(true);

      const variantId = lemonSqueezyVariants[planKey]?.[cycle];
      if (!variantId) return;

      const response = await fetch("/api/lemon-squeezy/create-checkout-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, planKey, cycle, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create checkout. Please try again.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#F7F9F8] text-[#1E1E1E] overflow-hidden">
      <div className="pointer-events-none fixed top-0 left-0 w-96 h-96 rounded-full bg-[#1FAE5B]/8 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-80 h-80 rounded-full bg-[#0F6B3E]/6 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="pointer-events-none fixed top-1/3 right-1/4 w-64 h-64 rounded-full bg-[#2C8EC4]/5 blur-3xl" />

      <div className="fixed top-6 left-12 z-50">
        <Image
          src="/images/Instroom Logo 1.png"
          alt="Instroom Logo"
          width={180}
          height={180}
          priority
          quality={95}
          className="drop-shadow-sm"
        />
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl bg-white border border-[#0F6B3E]/15 rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
          <div className="md:w-1/2 p-8 flex flex-col justify-center bg-gradient-to-br from-[#1FAE5B]/5 to-[#0F6B3E]/5 border-b md:border-b-0 md:border-r-0">
            <h2 className="text-2xl font-bold mb-1 text-center md:text-left text-[#1E1E1E]">Your Plan</h2>
            <h3 className="text-lg font-semibold mb-1 text-[#1E1E1E]">
              {plan.display_name}
              {isFree && <span className="ml-2 text-xs font-normal text-[#0F6B3E]">(30-day free trial)</span>}
            </h3>
            <div className="text-3xl font-bold mb-2 text-[#1E1E1E]">
              {isFree
                ? "Free"
                : cycle === "yearly"
                  ? `$${plan.price_yearly}/yr`
                  : `$${plan.price_monthly}/mo`}
            </div>
            <p className="mb-6 text-xs text-[#0F6B3E] font-semibold">{planSummaries[planKey]}</p>
            <ul className="space-y-3 text-sm text-[#1E1E1E] mb-6">
              <li><b>Seats:</b> Unlimited</li>
              <li>
                <b>Workspaces:</b> {plan.included_brands}
              </li>
              {plan.max_influencers && (
                <li>
                  <b>Influencer List:</b> {isFree ? plan.max_influencers : "Unlimited"}
                </li>
              )}
              {plan.max_campaigns && (
                <li>
                  <b>Active campaigns:</b> {plan.max_campaigns}
                </li>
              )}
            </ul>
            <button
              className="w-full text-sm text-[#0F6B3E] hover:underline mt-auto"
              type="button"
              onClick={() => router.back()}
            >
              &larr; Choose a different plan
            </button>
          </div>
          <div className="hidden md:flex items-center">
            <div className="h-96 w-1 bg-gradient-to-b from-[#1FAE5B]/40 via-[#1E1E1E]/10 to-[#0F6B3E]/40 rounded-full mx-6" />
          </div>
          <div className="md:w-1/2 p-8 flex flex-col justify-center">
            <h2 className="text-2xl font-bold mb-2 text-center md:text-left text-[#1E1E1E]">
              {isFree ? "Get Started for Free" : "Payment Information"}
            </h2>
            <p className="text-[#666666] text-center md:text-left mb-8">
              {isFree
                ? "No credit card required. Click below to start your 30-day free trial."
                : "Click the button below to securely complete your subscription."}
            </p>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full rounded-lg py-3 px-6 text-center text-base font-semibold transition-all duration-150 bg-gradient-to-r from-[#1FAE5B] to-[#0F6B3E] text-white shadow-lg shadow-[#1FAE5B]/25 hover:shadow-xl hover:shadow-[#1FAE5B]/35 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : isFree ? "Start Free Trial" : "Subscribe Now"}
            </button>
            <button
              onClick={() => router.push("/pricing")}
              disabled={loading}
              className="w-full rounded-lg py-3 px-6 text-center text-base font-semibold transition-all duration-150 bg-white border-2 border-[#0F6B3E] text-[#0F6B3E] hover:bg-[#0F6B3E]/5 disabled:opacity-50 disabled:cursor-not-allowed mt-3"
            >
              Cancel
            </button>
            {!isFree && (
              <p className="text-xs text-[#999999] text-center mt-4">
                Powered by Lemon Squeezy
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F9F8] flex items-center justify-center text-[#1E1E1E]">Loading...</div>}>
      <PaymentPageInner />
    </Suspense>
  );
}
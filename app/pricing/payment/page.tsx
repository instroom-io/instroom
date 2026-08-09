"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo"
import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import Script from "next/script";
import { PLAN_TAGLINES, getPlanFeatures, formatPrice, formatPriceSub, Check } from "@/lib/pricing-plans";

declare global {
  interface Window {
    createLemonSqueezy?: () => void
    LemonSqueezy?: { Url: { Open: (url: string) => void } }
  }
}

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
  const planKey = searchParams.get("plan") || "team";
  const cycle = (searchParams.get("cycle") === "monthly") ? "monthly" : "yearly";

  const [plan, setPlan] = useState<any>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: session } = useSession();
  const userId = session?.user?.id;

  // Pull the same live plan data /pricing shows — no separate copy to fall
  // out of sync with pricing, features, or the "free forever" wording.
  useEffect(() => {
    setPlanLoaded(false);
    fetch(`/api/subscription/plans/${planKey}`)
      .then((r) => r.json())
      .then((data) => setPlan(data.plan ?? null))
      .catch(() => setPlan(null))
      .finally(() => setPlanLoaded(true));
  }, [planKey]);

  const isFree = plan ? Number(plan.price_monthly) === 0 : false;
  const price = plan ? formatPrice(plan, cycle) : null;

  const handleCheckout = async () => {
    if (!userId) {
      router.push("/login");
      return;
    }

    setError(null);

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
          setError(data.error || "Failed to get started. Please try again.");
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
        const overlayUrl = data.url.includes("?") ? `${data.url}&embed=1` : `${data.url}?embed=1`;
        // Open as an in-page overlay when the SDK is ready; fall back to a
        // full redirect if lemon.js hasn't loaded yet so checkout never stalls.
        if (window.LemonSqueezy) {
          window.LemonSqueezy.Url.Open(overlayUrl);
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!planLoaded) {
    return (
      <div className="min-h-screen bg-[#F7F9F8] flex items-center justify-center text-[#1E1E1E]">
        Loading...
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#F7F9F8] flex flex-col items-center justify-center gap-4 text-[#1E1E1E]">
        <p>We couldn't find that plan.</p>
        <button
          onClick={() => router.push("/pricing")}
          className="rounded-lg py-2 px-5 text-sm font-semibold bg-[#1FAE5B] text-white"
        >
          Back to pricing
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F7F9F8] text-[#1E1E1E] overflow-hidden">
      <Script
        src="https://assets.lemonsqueezy.com/lemon.js"
        strategy="afterInteractive"
        onLoad={() => window.createLemonSqueezy?.()}
      />
      <div className="pointer-events-none fixed top-0 left-0 w-64 sm:w-96 h-64 sm:h-96 rounded-full bg-[#1FAE5B]/8 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-56 sm:w-80 h-56 sm:h-80 rounded-full bg-[#0F6B3E]/6 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="pointer-events-none hidden sm:block fixed top-1/3 right-1/4 w-64 h-64 rounded-full bg-[#2C8EC4]/5 blur-3xl" />

      <div className="fixed top-4 sm:top-6 left-4 sm:left-12 z-50">
        <Logo size="page" alt="Instroom" priority className="drop-shadow-sm" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-sm sm:max-w-xl md:max-w-4xl bg-white border border-[#0F6B3E]/15 rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
          <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-center bg-gradient-to-br from-[#1FAE5B]/5 to-[#0F6B3E]/5 border-b md:border-b-0 md:border-r-0">
            <h2 className="text-xl sm:text-2xl font-bold mb-1 text-center md:text-left text-[#1E1E1E]">Your Plan</h2>
            <h3 className="text-lg font-semibold mb-1 text-[#1E1E1E]">
              {plan.display_name}
            </h3>
            <div className="text-3xl font-bold mb-1 text-[#1E1E1E]">
              {price!.amount}
              {price!.period && <span className="text-base font-medium text-[#71717a]">{price!.period}</span>}
            </div>
            <p className="mb-2 text-xs text-[#71717a]">{formatPriceSub(plan, cycle)}</p>
            <p className="mb-6 text-xs text-[#0F6B3E] font-semibold">{PLAN_TAGLINES[planKey] ?? ""}</p>
            <ul className="space-y-3 text-sm text-[#1E1E1E] mb-6">
              {getPlanFeatures(plan).map((feature, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex-shrink-0 w-[18px] h-[18px] rounded-full bg-[#EAF7F0] grid place-items-center">
                    <Check />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              className="w-full text-sm text-[#0F6B3E] hover:underline mt-auto"
              type="button"
              onClick={() => router.back()}
            >
              &larr; Choose a different plan
            </button>
          </div>
          <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-2 text-center md:text-left text-[#1E1E1E]">
              {isFree ? "Get Started for Free" : "Payment Information"}
            </h2>
            <p className="text-sm sm:text-base text-[#666666] text-center md:text-left mb-6 sm:mb-8">
              {isFree
                ? "Click below to get started — free forever."
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
              {loading ? "Processing..." : isFree ? "Get Started" : "Subscribe Now"}
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

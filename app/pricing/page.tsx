import Link from "next/link";
import Image from "next/image";
import { getActivePlans } from "@/prisma/plans";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from  "@/lib/prisma";
import { PricingPlanButton } from "@/components/pricing-plan-button";

function getPlanSummary(plan: any) {
  if (plan.name === "basic") {
    return "1 workspace (30-day free trial)";
  }
  if (plan.name === "solo") {
    return "1 workspace (cannot add more)";
  }
  if (plan.name === "team") {
    return "3 workspaces included (can buy more)";
  }
  if (plan.name === "agency") {
    return "10 workspaces included (can buy more)";
  }
  return "";
}

const planHierarchy: { [key: string]: number } = {
  basic: 0,
  solo: 1,
  team: 2,
  agency: 3,
};

const additionalFeatures = [
  {
    name: "Instroom Post Tracker",
    tooltip: "Track influencer posts and performance across all your campaigns.",
  },
  {
    name: "Instroom Chrome Extension",
    tooltip: "Discover and save influencer profiles directly from your browser.",
  },
];

export default async function PricingPage({ searchParams }: { searchParams?: { cycle?: string } }) {
  const session = await getServerSession(authOptions);
  let currentPlanName: string | null = null;
  let userSubscription: any = null;

  if (session?.user?.id) {
    try {
      userSubscription = await prisma.userSubscription.findFirst({
        where: {
          user_id: session.user.id,
        },
        include: {
          plan: true,
        },
      });
      
      if (userSubscription) {
        currentPlanName = userSubscription.plan.name;
      }
    } catch (error) {
      // Silently ignore database errors and show pricing page
    }
  }

  const allPlans = await getActivePlans();
  // Sort by sort_order from DB, exclude agency
  const plans = allPlans
    .filter((plan: any) => plan.name !== "agency")
    .sort((a: any, b: any) => a.sort_order - b.sort_order);

  const params = await searchParams;
  const cycle = params?.cycle === "monthly" ? "monthly" : "yearly";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F7F9F8] text-[#1E1E1E]">
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

      <section className="mx-auto max-w-4xl px-6 pt-20 pb-12 text-center lg:px-0">
        <h1 className="text-3xl font-extrabold md:text-4xl bg-gradient-to-r from-[#1FAE5B] to-[#0F6B3E] bg-clip-text text-transparent">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-6 text-[#666666] text-lg md:text-xl max-w-2xl mx-auto">
          Choose the perfect plan for your influencer marketing needs. No hidden fees. Cancel anytime.
        </p>

        <div className="flex justify-center mt-10 gap-1 bg-white border border-[#0F6B3E]/20 rounded-full p-1 w-fit mx-auto">
          <a
            href="?cycle=monthly"
            className={`px-6 py-2 rounded-full text-base font-semibold transition-all duration-150 ${
              cycle === "monthly"
                ? "bg-[#1FAE5B] text-white shadow-md"
                : "text-[#1E1E1E] hover:text-[#1FAE5B]"
            }`}
          >
            Monthly Billing
          </a>
          <a
            href="?cycle=yearly"
            className={`px-6 py-2 rounded-full text-base font-semibold transition-all duration-150 flex items-center gap-2 ${
              cycle === "yearly"
                ? "bg-[#1FAE5B] text-white shadow-md"
                : "text-[#1E1E1E] hover:text-[#1FAE5B]"
            }`}
          >
            Yearly Billing
            <span className="text-xs bg-[#F4B740]/20 text-[#C87500] px-2 py-0.5 rounded-full font-semibold">
              Save 20%
            </span>
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="flex flex-col lg:flex-row justify-center items-end gap-8 lg:gap-6">
          {plans.map((plan, idx) => {
            const price = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
            const priceLabel = cycle === "yearly" ? "/yr" : "/mo";
            const showAdditionalFeatures = plan.name === "solo" || plan.name === "team";
            return (
              <div
                key={plan.id}
                className={`relative w-full lg:w-80 rounded-2xl border transition-all duration-300 shadow-lg group ${
                  idx === 2
                    ? "border-[#1FAE5B]/60 bg-gradient-to-br from-white to-[#1FAE5B]/5 ring-2 ring-[#1FAE5B]/30 lg:scale-105"
                    : "border-[#0F6B3E]/15 bg-white hover:shadow-xl hover:border-[#0F6B3E]/25"
                }`}
              >
                {idx === 2 && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
                    <span className="inline-block rounded-full bg-gradient-to-r from-[#1FAE5B] to-[#0F6B3E] px-4 py-1.5 text-xs font-bold text-white shadow-lg">
                      ⭐ MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="pointer-events-none absolute -inset-0.5 rounded-2xl blur opacity-30 group-hover:opacity-40 transition duration-300 -z-10 ${
                  idx === 1
                    ? 'bg-gradient-to-br from-[#1FAE5B]/40 to-[#0F6B3E]/20'
                    : 'bg-gradient-to-br from-[#1FAE5B]/10 to-[#0F6B3E]/5'
                }" />

                <div className="p-8 flex flex-col h-full">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-[#1E1E1E] capitalize mb-1">
                      {plan.display_name}
                    </h3>
                    <p className="text-sm text-[#666666]">
                      {getPlanSummary(plan)}
                    </p>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-extrabold text-[#1E1E1E]">
                        ${Number(price).toLocaleString()}
                      </span>
                      <span className="text-base text-[#666666] font-medium">{priceLabel}</span>
                    </div>
                  </div>

                  <ul className="mb-8 flex-1 space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="text-[#1FAE5B] font-bold mt-0.5">✓</span>
                      <span className="text-[#1E1E1E]">
                        <b className="font-semibold">Unlimited seats</b>
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#1FAE5B] font-bold mt-0.5">✓</span>
                      <span className="text-[#1E1E1E]">
                        <b className="font-semibold">{plan.included_brands} workspaces</b>
                      </span>
                    </li>
                    {plan.max_influencers && (
                      <li className="flex items-start gap-3">
                        <span className="text-[#1FAE5B] font-bold mt-0.5">✓</span>
                        <span className="text-[#1E1E1E]">
                          <b className="font-semibold">{plan.name !== "basic" ? "Unlimited" : plan.max_influencers}</b> influencers per brand
                        </span>
                      </li>
                    )}
                    {plan.max_campaigns && (
                      <li className="flex items-start gap-3">
                        <span className="text-[#1FAE5B] font-bold mt-0.5">✓</span>
                        <span className="text-[#1E1E1E]">
                          <b className="font-semibold">{plan.max_campaigns}</b> active campaigns
                        </span>
                      </li>
                    )}
                  </ul>

                  <PricingPlanButton
                    planName={plan.name}
                    cycle={cycle}
                    isCurrentPlan={currentPlanName === plan.name}
                    isPopular={idx === 2}
                    currentPlanName={currentPlanName}
                    isPlanHigher={
                      currentPlanName
                        ? (planHierarchy[plan.name] || 0) > (planHierarchy[currentPlanName] || 0)
                        : false
                    }
                  />

                  {showAdditionalFeatures && (
                    <div className="mt-5 pt-4 border-t border-[#0F6B3E]/10">
                      <p className="text-[0.625rem] font-bold uppercase tracking-widest text-[#a1a1aa] mb-2">
                        Additional Features
                      </p>
                      <ul>
                        {additionalFeatures.map((feature, i) => (
                          <li
                            key={feature.name}
                            className={`flex items-center justify-between py-2 group/feature ${
                              i < additionalFeatures.length - 1 ? "border-b border-[#0F6B3E]/08" : ""
                            }`}
                          >
                            <span className="text-[0.8125rem] text-[#52525b]">{feature.name}</span>
                            <span
                              title={feature.tooltip}
                              className="flex items-center justify-center w-4 h-4 rounded-full border-[1.5px] border-[#d4d4d8] text-[#a1a1aa] text-[0.5625rem] font-bold cursor-default leading-none flex-shrink-0 transition-colors duration-150 group-hover/feature:border-[#1FAE5B] group-hover/feature:text-[#1FAE5B]"
                            >
                              i
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
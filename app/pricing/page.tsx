import Link from "next/link";
import { Logo } from "@/components/brand/logo"
import type { ReactNode } from "react";
import { getActivePlans } from "@/prisma/plans";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from  "@/lib/prisma";
import { PricingPlanButton } from "@/components/pricing-plan-button";
import { PLAN_TAGLINES, getPlanFeatures, formatPrice, formatPriceSub, Check } from "@/lib/pricing-plans";

// Reads plans from the DB — render at request time, not at build.
export const dynamic = "force-dynamic";

const planHierarchy: { [key: string]: number } = {
  basic: 0,
  solo: 1,
  team: 2,
  agency: 3,
};

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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        .container {
          max-width: 1140px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* ── Plans section ── */
        .plans-section {
          padding: 16px 0 64px;
        }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: stretch;
          gap: 20px;
          max-width: 920px;
          margin: 0 auto;
        }

        .plan-card {
          position: relative;
          width: 100%;
          border-radius: 20px;
          border: 1px solid rgba(15,107,62,0.15);
          background: white;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          transition: box-shadow 0.2s, border-color 0.2s;
          display: flex;
        }

        .plan-card:hover {
          box-shadow: 0 8px 40px rgba(0,0,0,0.1);
          border-color: rgba(15,107,62,0.25);
        }

        .plan-card.popular {
          border-color: rgba(31,174,91,0.6);
          background: linear-gradient(to bottom right, white, rgba(31,174,91,0.04));
          box-shadow: 0 0 0 2px rgba(31,174,91,0.3), 0 8px 40px rgba(31,174,91,0.1);
          z-index: 1;
        }

        .popular-badge {
          position: absolute;
          top: -18px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(to right, #1FAE5B, #0F6B3E);
          color: white;
          font-size: 0.6875rem;
          font-weight: 800;
          padding: 5px 16px;
          border-radius: 9999px;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(31,174,91,0.35);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .plan-inner {
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .plan-name {
          font-family: 'Manrope', sans-serif;
          font-size: 1.25rem;
          font-weight: 700;
          color: #1E1E1E;
          margin-bottom: 4px;
        }

        .plan-summary {
          font-size: 0.8125rem;
          color: #71717a;
          margin-bottom: 20px;
          line-height: 1.5;
          min-height: 38px;
        }

        .plan-price {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .plan-price-amount {
          font-family: 'Manrope', sans-serif;
          font-size: 2.75rem;
          font-weight: 800;
          color: #1E1E1E;
          line-height: 1;
        }

        .plan-price-period {
          font-size: 0.9375rem;
          color: #71717a;
          font-weight: 500;
        }

        .plan-price-sub {
          font-size: 0.8125rem;
          color: #71717a;
          margin-top: 6px;
          min-height: 18px;
        }

        .plan-cta-wrap {
          margin: 20px 0 22px;
        }

        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .plan-features li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 0.875rem;
          color: #3f3f46;
          line-height: 1.5;
        }

        .plan-features li .check {
          flex: 0 0 18px;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #EAF7F0;
          display: grid;
          place-items: center;
          margin-top: 1px;
        }

        .plan-features li .muted {
          color: #7C7C7C;
        }

        .reassure {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 14px 32px;
          margin-top: 40px;
        }

        .reassure div {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #4B4B4B;
          font-size: 0.90625rem;
          font-weight: 500;
        }

        @media (max-width: 1040px) {
          .plans-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 560px) {
          .plans-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 640px) {
          .plan-inner { padding: 24px; }
          .container { padding: 0 16px; }
        }
      `}</style>

      <div className="fixed top-4 left-4 z-50 sm:top-6 sm:left-12">
        <Link href="/">
          <Logo size="page" alt="Instroom" priority className="drop-shadow-sm" />
        </Link>
      </div>

      <section className="mx-auto max-w-4xl px-4 pt-24 pb-6 text-center sm:px-6 sm:pt-20 lg:px-0">
        <h1 className="text-2xl font-extrabold sm:text-3xl md:text-4xl bg-gradient-to-r from-[#1FAE5B] to-[#0F6B3E] bg-clip-text text-transparent">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-6 text-[#666666] text-base sm:text-lg md:text-xl max-w-2xl mx-auto">
          Choose the perfect plan for your influencer marketing needs. No hidden fees. Cancel anytime.
        </p>

        <div className="flex flex-wrap justify-center mt-10 gap-1 bg-white border border-[#0F6B3E]/20 rounded-full p-1 w-fit mx-auto">
          <a
            href="?cycle=monthly"
            className={`px-4 py-2 rounded-full text-sm sm:px-6 sm:text-base font-semibold transition-all duration-150 ${
              cycle === "monthly"
                ? "bg-[#1FAE5B] text-white shadow-md"
                : "text-[#1E1E1E] hover:text-[#1FAE5B]"
            }`}
          >
            Monthly Billing
          </a>
          <a
            href="?cycle=yearly"
            className={`px-4 py-2 rounded-full text-sm sm:px-6 sm:text-base font-semibold transition-all duration-150 flex items-center gap-2 ${
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

      {/* PLANS */}
      <section className="plans-section">
        <div className="container">
          <div className="plans-grid">
            {plans.map((plan: any) => {
              const isPopular = plan.name === "team";
              const price = formatPrice(plan, cycle);
              return (
                <div key={plan.id} className={`plan-card${isPopular ? " popular" : ""}`}>
                  {isPopular && <div className="popular-badge">Most Popular</div>}
                  <div className="plan-inner">
                    <div className="plan-name">{plan.display_name}</div>
                    <div className="plan-summary">{PLAN_TAGLINES[plan.name] ?? ""}</div>
                    <div className="plan-price">
                      <span className="plan-price-amount">{price.amount}</span>
                      {price.period && <span className="plan-price-period">{price.period}</span>}
                    </div>
                    <div className="plan-price-sub">{formatPriceSub(plan, cycle)}</div>

                    <div className="plan-cta-wrap">
                      <PricingPlanButton
                        planName={plan.name}
                        cycle={cycle}
                        isCurrentPlan={currentPlanName === plan.name}
                        isPopular={isPopular}
                        currentPlanName={currentPlanName}
                        isPlanHigher={
                          currentPlanName
                            ? (planHierarchy[plan.name] || 0) > (planHierarchy[currentPlanName] || 0)
                            : false
                        }
                      />
                    </div>

                    <ul className="plan-features">
                      {getPlanFeatures(plan).map((feature: ReactNode, i: number) => (
                        <li key={i}>
                          <span className="check"><Check /></span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="reassure">
            <div><Check /> Free forever plan</div>
            <div><Check /> Unlimited seats</div>
            <div><Check /> Cancel anytime</div>
            <div><Check /> 7-day money-back for new subscribers</div>
          </div>
        </div>
      </section>
    </div>
  );
}

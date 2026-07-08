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
          grid-template-columns: repeat(3, minmax(0, 320px));
          justify-content: center;
          align-items: stretch;
          gap: 24px;
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
        }

        .plan-inner {
          padding: 32px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .plan-name {
          font-family: 'Manrope', sans-serif;
          font-size: 1.375rem;
          font-weight: 700;
          color: #1E1E1E;
          margin-bottom: 4px;
        }

        .plan-summary {
          font-size: 0.8125rem;
          color: #71717a;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .plan-price {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 28px;
        }

        .plan-price-amount {
          font-family: 'Manrope', sans-serif;
          font-size: 3rem;
          font-weight: 800;
          color: #1E1E1E;
          line-height: 1;
        }

        .plan-price-period {
          font-size: 0.9375rem;
          color: #71717a;
          font-weight: 500;
        }

        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 28px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .plan-features li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 0.9375rem;
          color: #3f3f46;
          line-height: 1.5;
        }

        .plan-features li .check {
          color: #1FAE5B;
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* ── Additional Features (inside card) ── */
        .card-additional-features {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(15,107,62,0.12);
        }

        .card-additional-features-label {
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #a1a1aa;
          margin-bottom: 8px;
          display: block;
        }

        .card-additional-features-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .card-additional-features-list li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(15,107,62,0.08);
          font-size: 0.8125rem;
          color: #52525b;
        }

        .card-additional-features-list li:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .card-additional-features-info {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          border: 1.5px solid #d4d4d8;
          color: #a1a1aa;
          font-size: 0.5625rem;
          font-weight: 700;
          flex-shrink: 0;
          cursor: default;
          line-height: 1;
          transition: border-color 0.15s, color 0.15s;
        }

        .card-additional-features-list li:hover .card-additional-features-info {
          border-color: #1FAE5B;
          color: #1FAE5B;
        }

        @media (max-width: 900px) {
          .plans-grid { grid-template-columns: 1fr; justify-items: center; }
        }

        @media (max-width: 640px) {
          .plan-card { max-width: 360px; }
        }
      `}</style>

      <div className="fixed top-6 left-12 z-50">
        <Image
          src="/images/INSTROOM LOGO 1.png"
          alt="Instroom Logo"
          width={180}
          height={180}
          priority
          quality={95}
          className="drop-shadow-sm"
        />
      </div>

      <section className="mx-auto max-w-4xl px-6 pt-20 pb-6 text-center lg:px-0">
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

      {/* PLANS */}
      <section className="plans-section">
        <div className="container">
          <div className="plans-grid">
            {plans.map((plan: any) => {
              const price = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
              const priceLabel = cycle === "yearly" ? "/yr" : "/mo";
              const isPopular = plan.name === "solo";
              const showAdditionalFeatures = plan.name === "solo" || plan.name === "team";
              return (
                <div key={plan.id} className={`plan-card${isPopular ? " popular" : ""}`}>
                  {isPopular && <div className="popular-badge">⭐ MOST POPULAR</div>}
                  <div className="plan-inner">
                    <div className="plan-name">{plan.display_name}</div>
                    <div className="plan-summary">{getPlanSummary(plan)}</div>
                    <div className="plan-price">
                      <span className="plan-price-amount">${Number(price).toLocaleString()}</span>
                      <span className="plan-price-period">{priceLabel}</span>
                    </div>
                    <ul className="plan-features">
                      <li><span className="check">✓</span><span><strong>Unlimited seats</strong></span></li>
                      <li>
                        <span className="check">✓</span>
                        <span><strong>{plan.included_brands}</strong> workspace{plan.included_brands !== 1 ? "s" : ""}</span>
                      </li>
                      {plan.max_influencers && (
                        <li>
                          <span className="check">✓</span>
                          <span><strong>{plan.name !== "basic" ? "Unlimited" : plan.max_influencers}</strong> influencers per brand</span>
                        </li>
                      )}
                      {plan.max_campaigns && (
                        <li>
                          <span className="check">✓</span>
                          <span><strong>{plan.max_campaigns}</strong> active campaigns</span>
                        </li>
                      )}
                    </ul>

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

                    <div
                      className="card-additional-features"
                      style={showAdditionalFeatures ? undefined : { visibility: "hidden" }}
                    >
                      <span className="card-additional-features-label">Additional Features</span>
                      <ul className="card-additional-features-list">
                        {additionalFeatures.map((feature) => (
                          <li key={feature.name}>
                            <span>{feature.name}</span>
                            <span className="card-additional-features-info" title={feature.tooltip}>i</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

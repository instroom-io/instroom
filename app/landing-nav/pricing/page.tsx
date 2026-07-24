import Link from "next/link";
import { getActivePlans } from "@/prisma/plans";
import { MainHeader } from "@/components/shared/main-header";
import { MainFooter } from "@/components/shared/main-footer";
import { PricingFinalCTA } from "@/components/pricing-page/final-cta";

function getPlanSummary(plan: any) {
  if (plan.name === "basic") return "1 workspace (free)";
  if (plan.name === "solo") return "1 workspace (cannot add more)";
  if (plan.name === "team") return "3 workspaces included (can buy more)";
  if (plan.name === "agency") return "10 workspaces included (can buy more)";
  return "";
}


export default async function PricingPage({ searchParams }: { searchParams?: { cycle?: string } }) {
  const allPlans = await getActivePlans();
  const plans = allPlans
    .filter((plan: any) => plan.name !== "agency")
    .sort((a: any, b: any) => a.sort_order - b.sort_order);

  const params = await searchParams;
  const cycle = params?.cycle === "monthly" ? "monthly" : "yearly";

  return (
    <div className="features-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        .features-page {
          background: white;
          color: #1E1E1E;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .container {
          max-width: 1140px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* ── Page Hero ── */
        .page-hero {
          padding: 56px 0 48px;
          text-align: center;
          background: #F4F7F5;
          background-image: radial-gradient(circle, rgba(31,174,91,0.12) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(31,174,91,0.1);
          border: 1px solid rgba(31,174,91,0.28);
          border-radius: 100px;
          padding: 6px 14px 6px 10px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #0F6B3E;
          margin-bottom: 16px;
        }

        .eyebrow-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #1FAE5B;
          animation: eyebrowPulse 1.6s ease-in-out infinite;
          flex-shrink: 0;
        }

        @keyframes eyebrowPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.7); }
        }

        .page-hero h1 {
          max-width: 800px;
          margin: 0 auto 20px;
          font-family: 'Manrope', sans-serif;
          font-size: clamp(2.25rem, 5vw, 3.5rem);
          font-weight: 800;
          line-height: 1.12;
          letter-spacing: -0.02em;
          color: #1E1E1E;
        }

        .page-hero .lead {
          max-width: 620px;
          margin: 0 auto 40px;
          font-size: 1.125rem;
          color: #52525b;
          line-height: 1.65;
        }

        /* ── Billing toggle ── */
        .billing-toggle {
          display: flex;
          justify-content: center;
          gap: 4px;
          background: white;
          border: 1px solid rgba(15,107,62,0.2);
          border-radius: 9999px;
          padding: 4px;
          width: fit-content;
          margin: 0 auto;
        }

        .billing-toggle a {
          padding: 8px 24px;
          border-radius: 9999px;
          font-size: 0.9375rem;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.15s;
          color: #1E1E1E;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .billing-toggle a:hover {
          color: #1FAE5B;
        }

        .billing-toggle a.active {
          background: #1FAE5B;
          color: white;
          box-shadow: 0 2px 8px rgba(31,174,91,0.3);
        }

        .billing-toggle a.active:hover {
          color: white;
        }

        .save-badge {
          font-size: 0.6875rem;
          background: rgba(244,183,64,0.2);
          color: #C87500;
          padding: 2px 8px;
          border-radius: 9999px;
          font-weight: 700;
        }

        /* ── Plans section ── */
        .plans-section {
          padding: 80px 0 96px;
          background: white;
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

        /* ── Plan CTA button ── */
        .plan-cta {
          display: block;
          width: 100%;
          padding: 12px 24px;
          border-radius: 10px;
          font-size: 0.9375rem;
          font-weight: 600;
          text-align: center;
          text-decoration: none;
          transition: all 0.15s;
          border: 2px solid #0F6B3E;
          color: #0F6B3E;
          background: white;
        }

        .plan-cta:hover {
          background: rgba(15,107,62,0.05);
        }

        .plan-cta-popular {
          background: linear-gradient(to right, #1FAE5B, #0F6B3E);
          color: white;
          border-color: transparent;
          box-shadow: 0 4px 14px rgba(31,174,91,0.35);
        }

        .plan-cta-popular:hover {
          box-shadow: 0 6px 20px rgba(31,174,91,0.45);
          background: linear-gradient(to right, #1FAE5B, #0a5a34);
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
          .page-hero { padding: 64px 0 48px; }
          .plan-card { max-width: 360px; }
        }
      `}</style>

      {/* NAV */}
      <MainHeader />

      {/* PAGE HERO */}
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Pricing
          </div>
          <h1>Simple, transparent pricing.</h1>
          <p className="lead">
            Choose the perfect plan for your influencer marketing needs. No hidden fees. Cancel anytime.
          </p>
          <div className="billing-toggle">
            <a href="?cycle=monthly" className={cycle === "monthly" ? "active" : ""}>
              Monthly Billing
            </a>
            <a href="?cycle=yearly" className={cycle === "yearly" ? "active" : ""}>
              Yearly Billing
              <span className="save-badge">Save 20%</span>
            </a>
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section className="plans-section">
        <div className="container">
          <div className="plans-grid">
            {plans.map((plan: any, idx: number) => {
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
                    <Link
                      href="/signup"
                      className={`plan-cta${isPopular ? " plan-cta-popular" : ""}`}
                    >
                      {plan.name === "basic" ? "Get Started Free" : "Get Started"}
                    </Link>

                    <div
                      className="card-additional-features"
                      style={showAdditionalFeatures ? undefined : { visibility: "hidden" }}
                    >
                      <span className="card-additional-features-label">Additional Features</span>
                      <ul className="card-additional-features-list">
                        <li>
                          <span>Instroom Post Tracker</span>
                          <span className="card-additional-features-info" title="Track influencer posts and performance across all your campaigns.">i</span>
                        </li>
                        <li>
                          <span>Instroom Chrome Extension</span>
                          <span className="card-additional-features-info" title="Discover and save influencer profiles directly from your browser.">i</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <PricingFinalCTA />

      {/* FOOTER */}
      <MainFooter />
    </div>
  );
}
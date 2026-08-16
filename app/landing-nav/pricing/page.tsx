import Link from "next/link";
import type { ReactNode } from "react";
import { getActivePlans } from "@/prisma/plans";
import { MainHeader } from "@/components/shared/main-header";
import { MainFooter } from "@/components/shared/main-footer";
import { PricingFinalCTA } from "@/components/pricing-page/final-cta";
import { DemoCtaButton } from "@/components/pricing-page/demo-cta-button";
import { PricingFaq } from "@/components/pricing-page/pricing-faq";

const PLAN_TAGLINES: Record<string, string> = {
  basic: "Run one brand, free — for as long as you like.",
  solo: "For one brand, running at full scale.",
  team: "For scaling brands and multi-brand teams.",
};

const FEATURE_MATRIX: Record<string, { insights: boolean; inbox: boolean; importExport: boolean }> = {
  basic: { insights: true, inbox: false, importExport: false },
  solo: { insights: true, inbox: true, importExport: true },
  team: { insights: true, inbox: true, importExport: true },
};

const SUPPORT_TEXT: Record<string, string> = { basic: "Email", solo: "Email", team: "Priority" };
const ONBOARDING_TEXT: Record<string, string> = { basic: "—", solo: "Self-serve", team: "Guided" };

function getPlanFeatures(plan: any): ReactNode[] {
  if (plan.name === "basic") {
    return [
      <><b>Unlimited</b> seats</>,
      <><b>{plan.included_brands}</b> workspace{plan.included_brands !== 1 ? "s" : ""}</>,
      <><b>{plan.max_influencers}</b> influencers <span className="muted">(one-time)</span></>,
      "Auto-enriched profiles — engagement, followers, email & location",
      "Pipeline, approvals & payment tracking",
    ];
  }
  if (plan.name === "solo") {
    return [
      "Everything in Basic, plus:",
      <><b>{plan.max_influencers}</b> new influencers / month</>,
      "Inbox — Gmail & Outlook",
      "Import & export",
    ];
  }
  if (plan.name === "team") {
    return [
      "Everything in Solo, plus:",
      <><b>{plan.max_influencers}</b> new influencers / month</>,
      <><b>{plan.included_brands}</b> workspaces <span className="muted">(add more anytime)</span></>,
      "Priority support",
    ];
  }
  return [];
}

function formatPrice(plan: any, cycle: "monthly" | "yearly") {
  const price = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
  if (Number(price) === 0) return { amount: "Free", period: "" };
  return { amount: `$${Number(price).toLocaleString()}`, period: "/mo" };
}

function formatPriceSub(plan: any, cycle: "monthly" | "yearly") {
  if (Number(plan.price_monthly) === 0) return "Free forever · no credit card";
  if (cycle === "monthly") return "Billed monthly";
  return `$${(Number(plan.price_yearly) * 12).toLocaleString()} billed annually`;
}

function ctaFor(plan: any, cycle: "monthly" | "yearly") {
  const href = `/signup?plan=${plan.name}&cycle=${cycle}`;
  if (plan.name === "basic") return { href, label: "Get started free", cls: "plan-cta-quiet" };
  return { href, label: "Get started", cls: "plan-cta-solid" };
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.6" width="16" height="16">
      <path d="M5 13l4 4L19 7" stroke="#1FAE5B" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
          color: #0F6B3E;
        }

        .page-hero h1 .accent {
          color: #1FAE5B;
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

        .billing-toggle a.active .save-badge {
          background: rgba(255,255,255,0.9);
          color: #178C49;
        }

        /* ── Plans section ── */
        .plans-section {
          padding: 80px 0 56px;
          background: white;
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

        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 24px;
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

        .plan-features li .check svg {
          width: 11px;
          height: 11px;
        }

        .plan-features li .muted {
          color: #7C7C7C;
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
          border: 1.5px solid transparent;
          cursor: pointer;
          margin: 20px 0 22px;
        }

        .plan-cta-quiet {
          background: white;
          color: #1E1E1E;
          border-color: #D2D6D3;
        }

        .plan-cta-quiet:hover {
          border-color: #7C7C7C;
        }

        .plan-cta-solid {
          background: linear-gradient(to right, #1FAE5B, #0F6B3E);
          color: white;
          border-color: transparent;
          box-shadow: 0 4px 14px rgba(31,174,91,0.35);
        }

        .plan-cta-solid:hover {
          box-shadow: 0 6px 20px rgba(31,174,91,0.45);
        }

        .plan-cta-blue {
          background: transparent;
          color: #2C8EC4;
          border-color: #2C8EC4;
        }

        .plan-cta-blue:hover {
          background: rgba(44,142,196,0.08);
        }

        @media (max-width: 1040px) {
          .plans-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 560px) {
          .plans-grid { grid-template-columns: 1fr; }
        }

        /* ── Reassurance row ── */
        .reassure {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 14px 32px;
          margin-top: 40px;
          padding: 8px 0 8px;
        }

        .reassure div {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #4B4B4B;
          font-size: 0.90625rem;
          font-weight: 500;
        }

        /* ── Volume banner ── */
        .volume-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          flex-wrap: wrap;
          max-width: 900px;
          margin: 36px auto 0;
          background: white;
          border: 1px solid rgba(15,107,62,0.15);
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          padding: 22px 28px;
        }

        .volume-banner-text {
          min-width: 260px;
          flex: 1;
        }

        .volume-banner-text h3 {
          font-family: 'Manrope', sans-serif;
          font-size: 1.125rem;
          font-weight: 700;
          color: #0F6B3E;
          margin: 0 0 6px;
        }

        .volume-banner-text p {
          color: #52525b;
          font-size: 0.90625rem;
          margin: 0;
        }

        /* ── Compare table ── */
        .compare-section {
          padding: 64px 0 24px;
          background: #F4F7F5;
        }

        .section-head {
          text-align: center;
          margin-bottom: 36px;
        }

        .section-head h2 {
          font-family: 'Manrope', sans-serif;
          font-size: clamp(1.75rem, 4vw, 2.5rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
          color: #0F6B3E;
          margin: 0;
        }

        .info {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 15px;
          height: 15px;
          border-radius: 9999px;
          border: 1px solid #D2D6D3;
          color: #7C7C7C;
          font-size: 10px;
          font-weight: 700;
          font-style: normal;
          margin-left: 6px;
          cursor: help;
          position: relative;
          vertical-align: middle;
        }

        .info .tip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translate(-50%, 2px);
          background: #1E1E1E;
          color: #fff;
          font-weight: 400;
          font-size: 12.5px;
          line-height: 1.4;
          padding: 9px 12px;
          border-radius: 9px;
          width: 240px;
          text-align: left;
          opacity: 0;
          visibility: hidden;
          transition: 0.16s ease;
          z-index: 20;
          box-shadow: 0 8px 24px rgba(0,0,0,0.22);
        }

        .info:hover .tip,
        .info:focus .tip {
          opacity: 1;
          visibility: visible;
          transform: translate(-50%, -4px);
        }

        .section-head p {
          color: #52525b;
          max-width: 540px;
          margin: 12px auto 0;
        }

        .compare-scroll {
          overflow-x: auto;
          border: 1px solid #E4E7E5;
          border-radius: 20px;
          background: white;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        }

        .compare-table {
          border-collapse: collapse;
          width: 100%;
          min-width: 720px;
        }

        .compare-table th,
        .compare-table td {
          text-align: left;
          padding: 16px 20px;
          font-size: 0.90625rem;
          border-bottom: 1px solid #E4E7E5;
        }

        .compare-table thead th {
          font-family: 'Manrope', sans-serif;
          font-size: 0.9375rem;
          font-weight: 700;
          color: #0F6B3E;
        }

        .compare-table thead th.plan {
          text-align: center;
        }

        .compare-table thead th.plan.pop {
          color: #1FAE5B;
        }

        .compare-table tbody td:not(:first-child) {
          text-align: center;
        }

        .compare-table tbody tr td:first-child {
          font-weight: 500;
          color: #4B4B4B;
        }

        .compare-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .compare-table .yes {
          display: inline-flex;
        }

        .compare-table .no {
          color: #D2D6D3;
          font-size: 18px;
          line-height: 1;
        }

        .compare-table .col-pop {
          background: rgba(31,174,91,0.05);
        }

        .compare-table .big {
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
          color: #1E1E1E;
        }

        .compare-cta {
          display: inline-block;
          padding: 8px 16px;
          font-size: 0.875rem;
          border-radius: 10px;
          font-weight: 600;
          text-decoration: none;
          border: 1.5px solid transparent;
          cursor: pointer;
        }

        /* ── Add-ons ── */
        .addons-section {
          padding: 40px 0 24px;
        }

        .addon-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          max-width: 760px;
          margin: 0 auto;
        }

        @media (max-width: 820px) {
          .addon-grid { grid-template-columns: 1fr; }
        }

        .addon {
          border: 1px dashed #D2D6D3;
          border-radius: 20px;
          padding: 26px 24px;
          display: flex;
          flex-direction: column;
        }

        .addon h3 {
          font-family: 'Manrope', sans-serif;
          font-size: 1.1875rem;
          font-weight: 800;
          color: #0F6B3E;
          margin: 0 0 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .addon p {
          color: #4B4B4B;
          font-size: 0.90625rem;
          margin: 0 0 20px;
          flex: 1;
        }

        .addon-price {
          font-size: 0.875rem;
          color: #7C7C7C;
        }

        .soon-tag {
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: #EEF0EF;
          color: #7C7C7C;
          padding: 3px 9px;
          border-radius: 9999px;
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
          <h1>Simple, <span className="accent">transparent</span> pricing.</h1>
          <p className="lead">
            Start free and stay free for as long as you like. Unlimited seats on every plan — no hidden fees, cancel anytime.
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
            {plans.map((plan: any) => {
              const isPopular = plan.name === "team";
              const price = formatPrice(plan, cycle);
              const cta = ctaFor(plan, cycle);
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
                    <Link href={cta.href} className={`plan-cta ${cta.cls}`}>
                      {cta.label}
                    </Link>
                    <ul className="plan-features">
                      {getPlanFeatures(plan).map((feature, i) => (
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

          <div className="volume-banner">
            <div className="volume-banner-text">
              <h3>Running an agency, or need higher volume?</h3>
              <p>
                We build custom plans with volume influencer limits, unlimited workspaces, white-label reports,
                and a dedicated manager — arranged directly and billed by agreement.
              </p>
            </div>
            <DemoCtaButton className="compare-cta plan-cta-blue">Talk to us</DemoCtaButton>
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section className="compare-section">
        <div className="container">
          <div className="section-head">
            <h2>Compare plans</h2>
            <p>Every plan runs on the same core toolkit. Here&apos;s what changes as you scale.</p>
          </div>
          <div className="compare-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>&nbsp;</th>
                  {plans.map((plan: any) => (
                    <th key={plan.id} className={`plan${plan.name === "team" ? " pop" : ""}`}>
                      {plan.display_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Price</td>
                  {plans.map((plan: any) => {
                    const isTeam = plan.name === "team";
                    const price = formatPrice(plan, cycle);
                    return (
                      <td key={plan.id} className={`big${isTeam ? " col-pop" : ""}`}>
                        {price.amount}{price.period}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>
                    Workspaces
                    <span className="info" tabIndex={0}>
                      i
                      <span className="tip">
                        A workspace is a dedicated space for one brand or client — its own influencers, pipeline,
                        and reports. One workspace = one brand.
                      </span>
                    </span>
                  </td>
                  {plans.map((plan: any) => {
                    const isTeam = plan.name === "team";
                    const value =
                      plan.name === "team" ? `${plan.included_brands} (add more)` :
                      `${plan.included_brands}`;
                    return <td key={plan.id} className={isTeam ? "col-pop" : ""}>{value}</td>;
                  })}
                </tr>
                <tr>
                  <td>
                    Influencers
                    <span className="info" tabIndex={0}>
                      i
                      <span className="tip">
                        How many influencers you can add to your list. Basic is a one-time allotment. Solo and
                        Team refresh monthly — every add auto-fills the creator&apos;s engagement, followers,
                        email, and location.
                      </span>
                    </span>
                  </td>
                  {plans.map((plan: any) => {
                    const isTeam = plan.name === "team";
                    const count = Number(plan.max_influencers).toLocaleString();
                    const value = plan.name === "basic" ? `${count} one-time` : `${count}/mo`;
                    return <td key={plan.id} className={isTeam ? "col-pop" : ""}>{value}</td>;
                  })}
                </tr>
                <tr>
                  <td>Creator insights</td>
                  {plans.map((plan: any) => {
                    const isTeam = plan.name === "team";
                    const has = FEATURE_MATRIX[plan.name]?.insights;
                    return (
                      <td key={plan.id} className={isTeam ? "col-pop" : ""}>
                        {has ? <span className="yes"><Check /></span> : <span className="no">–</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>
                    Inbox — Gmail &amp; Outlook
                    <span className="info" tabIndex={0}>
                      i
                      <span className="tip">
                        Connect Gmail or Outlook to message and track influencers in one place. Chats outside
                        email (like IG DMs) are still tracked in the pipeline.
                      </span>
                    </span>
                  </td>
                  {plans.map((plan: any) => {
                    const isTeam = plan.name === "team";
                    const has = FEATURE_MATRIX[plan.name]?.inbox;
                    return (
                      <td key={plan.id} className={isTeam ? "col-pop" : ""}>
                        {has ? <span className="yes"><Check /></span> : <span className="no">–</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>Import &amp; export</td>
                  {plans.map((plan: any) => {
                    const isTeam = plan.name === "team";
                    const has = FEATURE_MATRIX[plan.name]?.importExport;
                    return (
                      <td key={plan.id} className={isTeam ? "col-pop" : ""}>
                        {has ? <span className="yes"><Check /></span> : <span className="no">–</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>Support</td>
                  {plans.map((plan: any) => (
                    <td key={plan.id} className={plan.name === "team" ? "col-pop" : ""}>
                      {SUPPORT_TEXT[plan.name]}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Onboarding</td>
                  {plans.map((plan: any) => (
                    <td key={plan.id} className={plan.name === "team" ? "col-pop" : ""}>
                      {ONBOARDING_TEXT[plan.name]}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td></td>
                  {plans.map((plan: any) => {
                    const isTeam = plan.name === "team";
                    const cta = ctaFor(plan, cycle);
                    return (
                      <td key={plan.id} className={isTeam ? "col-pop" : ""}>
                        <Link href={cta.href} className={`compare-cta ${isTeam ? "plan-cta-solid" : "plan-cta-quiet"}`}>
                          {plan.name === "basic" ? "Start free" : `Choose ${plan.display_name}`}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ADD-ONS */}
      <section className="addons-section">
        <div className="container">
          <div className="section-head">
            <h2>On the roadmap</h2>
            <p>A preview of what we&apos;re building next. Neither is available to purchase yet.</p>
          </div>
          <div className="addon-grid">
            <div className="addon">
              <h3>Post Tracker <span className="soon-tag">Coming soon</span></h3>
              <p>
                Automatically detect every post from your campaign influencers by hashtag or mention, and save
                the content to Google Drive when usage rights are granted. Planned as an optional add-on — never
                required to run Instroom.
              </p>
              <div className="addon-price">Optional add-on · pricing to be announced</div>
            </div>
            <div className="addon">
              <h3>Discovery <span className="soon-tag">Coming soon</span></h3>
              <p>
                Find and vet new creators to work with — search by platform, niche, audience, and engagement —
                without ever leaving Instroom.
              </p>
              <div className="addon-price">Built into the platform · included when it launches</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <PricingFaq />

      {/* FINAL CTA */}
      <PricingFinalCTA />

      {/* FOOTER */}
      <MainFooter />
    </div>
  );
}

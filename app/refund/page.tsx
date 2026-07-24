"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TocItem {
  id: string;
  label: string;
}

interface ScenarioCard {
  eligible: boolean;
  title: string;
  description: string;
}

interface ProcessStep {
  number: number;
  title: string;
  description: string;
}

interface PlanRow {
  plan: string;
  price: string;
  billing: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const tocItems: TocItem[] = [
  { id: "s1", label: "1. Overview" },
  { id: "s2", label: "2. Plans & Billing Model" },
  { id: "s3", label: "3. Free Plan" },
  { id: "s4", label: "4. Eligible Refunds" },
  { id: "s5", label: "5. Non-Refundable Cases" },
  { id: "s6", label: "6. Annual Plans" },
  { id: "s7", label: "7. Companion Tools & Upcoming Features" },
  { id: "s8", label: "8. How to Request a Refund" },
  { id: "s9", label: "9. Processing & Timeline" },
  { id: "s10", label: "10. Chargebacks & Disputes" },
  { id: "s11", label: "11. Consumer Rights" },
  { id: "s12", label: "12. Contact" },
];

const plansBilling: PlanRow[] = [
  { plan: "Basic", price: "Free forever", billing: "No charge, no card required" },
  { plan: "Solo", price: "$19/mo, or $15/mo billed annually ($180/year)", billing: "Monthly or annual, in advance" },
  { plan: "Team", price: "$49/mo, or $39/mo billed annually ($468/year)", billing: "Monthly or annual, in advance" },
  { plan: "Agency", price: "Custom", billing: "Quoted per agreement" },
];

const eligibleScenarios: ScenarioCard[] = [
  {
    eligible: true,
    title: "Duplicate Charge",
    description:
      "You were charged more than once for the same billing period due to a technical error on our end.",
  },
  {
    eligible: true,
    title: "Unauthorized Transaction",
    description:
      "A charge was made to your payment method without your authorization, and you notify us promptly.",
  },
  {
    eligible: true,
    title: "Extended Service Outage",
    description:
      "The Service was unavailable for more than 72 consecutive hours due to issues on our side — not third-party platforms or scheduled maintenance.",
  },
  {
    eligible: true,
    title: "Charge After Cancellation",
    description: "You were billed after a confirmed cancellation had already taken effect.",
  },
  {
    eligible: true,
    title: "First-Time Subscriber — 7-Day Window",
    description:
      "New subscribers who have not previously held a paid Instroom subscription may request a full refund within 7 days of their first charge if unsatisfied.",
  },
  {
    eligible: true,
    title: "Billing Error",
    description: "We charged you at an incorrect price due to a pricing error on our platform.",
  },
];

const ineligibleScenarios: ScenarioCard[] = [
  {
    eligible: false,
    title: "Change of Mind",
    description:
      "You no longer wish to use the Service after your billing period has begun, beyond the 7-day new-subscriber window.",
  },
  {
    eligible: false,
    title: "Unused Subscription",
    description: "You paid for a billing period but did not actively use the Service during that time.",
  },
  {
    eligible: false,
    title: "Partial-Period Usage",
    description:
      "You cancel mid-period. Access continues until the period ends; no prorated refund is issued.",
  },
  {
    eligible: false,
    title: "Termination for Violations",
    description: "Your account was suspended or terminated for a breach of our Terms of Service.",
  },
  {
    eligible: false,
    title: "Third-Party Limitations",
    description:
      "A feature was affected by Instagram, TikTok, Google, or another third party restricting API access — outside our control.",
  },
];

const processSteps: ProcessStep[] = [
  {
    number: 1,
    title: "Contact Support",
    description: 'Email billing@instroom.io with the subject line "Refund Request."',
  },
  {
    number: 2,
    title: "Include the Details",
    description:
      "Your registered email address, the date and amount of the charge, and the reason for your request.",
  },
  {
    number: 3,
    title: "Await Confirmation",
    description:
      "We acknowledge requests within 2 business days and communicate a decision within 5 business days.",
  },
  {
    number: 4,
    title: "Refund Issued",
    description:
      "If approved, the refund is returned to your original payment method within 7–14 business days, depending on your bank or card issuer.",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#edf7f1] border border-[#b8dfc7] border-l-[3px] border-l-[#2d7a4f] rounded-lg px-5 py-4 my-5">
      <p className="text-sm text-[#1a4a2e] font-normal m-0">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 border-l-[3px] border-l-amber-500 rounded-lg px-5 py-4 my-5">
      <p className="text-sm text-amber-900 font-normal m-0">{children}</p>
    </div>
  );
}

function HighlightBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0d2b1a] rounded-xl px-7 py-6 my-6">
      <p className="text-sm text-white/80 m-0">{children}</p>
    </div>
  );
}

function SectionLabel({ num }: { num: string }) {
  return (
    <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#2d7a4f] mb-2">
      {num}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-serif text-[26px] font-normal text-[#0d2b1a] mb-4 leading-tight tracking-[-0.2px]"
      style={{ fontFamily: "'Instrument Serif', serif" }}
    >
      {children}
    </h2>
  );
}

function ScenarioCardComponent({ card }: { card: ScenarioCard }) {
  return (
    <div
      className={`rounded-xl p-5 border ${
        card.eligible
          ? "bg-green-50 border-green-300"
          : "bg-orange-50 border-orange-200"
      }`}
    >
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase mb-3 px-2.5 py-1 rounded-full ${
          card.eligible
            ? "bg-green-100 text-green-700"
            : "bg-orange-100 text-orange-700"
        }`}
      >
        {card.eligible ? "✓ Eligible" : "✗ Not Eligible"}
      </span>
      <h4 className="text-sm font-semibold mb-2 text-[#1a1a1a]">{card.title}</h4>
      <p className="text-[13px] m-0 font-light text-[#5a6b5e]">{card.description}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RefundPolicy() {
  const [activeSection, setActiveSection] = useState<string>("s1");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    tocItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="min-h-screen font-sans text-[#1a1a1a]"
      style={{ background: "#F4F7F5", fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .section-animate { animation: fadeUp 0.4s ease both; }
      `}</style>

      {/* ── Topbar ── */}
      <nav className="bg-[#0d2b1a] px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between sticky top-0 z-50 border-b border-[#1f3d28]">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <Image
            src="/images/instroomLogo.png"
            alt="Instroom Logo"
            width={36}
            height={36}
            className="w-9 h-9 rounded-full object-cover"
            priority
          />
          <span className="font-semibold text-lg text-white tracking-[-0.3px]">Instroom</span>
        </Link>
        <span className="text-[12px] font-medium text-[#a8e6c1] tracking-[0.08em] uppercase bg-[rgba(61,189,114,0.12)] px-3 py-1 rounded-full border border-[rgba(61,189,114,0.25)]">
          Refund Policy
        </span>
      </nav>

      {/* ── Hero ── */}
      <header className="bg-[#0d2b1a] px-6 sm:px-8 lg:px-12 pt-12 sm:pt-16 lg:pt-[72px] pb-12 lg:pb-16 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full border border-[rgba(61,189,114,0.08)]" />
        <div className="absolute top-5 right-10 w-44 h-44 rounded-full border border-[rgba(61,189,114,0.12)]" />
        <div className="max-w-[760px] relative z-10">
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#3dbd72] mb-4">
            Legal Document
          </div>
          <h1
            className="text-[clamp(36px,5vw,54px)] font-normal text-white leading-[1.1] mb-5 tracking-[-0.5px]"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Refund <em className="text-[#3dbd72] italic">Policy</em>
          </h1>
          <div className="flex gap-6 flex-wrap">
            {[
              ["Effective", "July 24, 2026"],
              ["Jurisdiction", "Republic of the Philippines"],
              ["Entity", "Armful OPC, trading as Armful Media"],
            ].map(([label, value]) => (
              <span key={label} className="text-[13px] text-white/50">
                <strong className="text-white/85 font-medium">{label}:</strong> {value}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Layout ── */}
      <div className="max-w-[1100px] mx-auto px-6 sm:px-8 lg:px-12 py-10 lg:py-[60px] grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 lg:gap-16 items-start">

        {/* ── TOC ── */}
        <aside className="sticky top-[88px] hidden lg:block">
          <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#5a6b5e] mb-4">
            Contents
          </div>
          <ol className="list-none p-0 flex flex-col gap-0.5">
            {tocItems.map(({ id, label }) => (
              <li key={id}>
                <button
                  onClick={() => scrollTo(id)}
                  className={`w-full text-left text-[13px] px-2.5 py-1.5 rounded-md border-l-2 transition-all duration-150 leading-snug cursor-pointer bg-transparent ${
                    activeSection === id
                      ? "text-[#2d7a4f] bg-[rgba(45,122,79,0.06)] border-l-[#2d7a4f] font-medium"
                      : "text-[#5a6b5e] border-l-transparent font-normal hover:text-[#2d7a4f] hover:bg-[rgba(45,122,79,0.06)] hover:border-l-[#2d7a4f]"
                  }`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        {/* ── Content ── */}
        <main className="min-w-0">
          <Callout>
            Instroom is a Software-as-a-Service (SaaS) product. Because access is digital and
            granted immediately upon payment, our refund policy is specific and limited. Please
            read it before subscribing to a paid plan.
          </Callout>

          {/* S1 — Overview */}
          <section id="s1" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 01" />
            <SectionHeading>Overview</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              This Refund Policy explains when and how Armful OPC — a One Person Corporation
              registered in the Republic of the Philippines, trading as Armful Media and the owner
              and operator of Instroom ("we," "us," or "our") — issues refunds for payments made
              for the Instroom platform and its paid features.
            </p>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              We want you to be confident before you pay, which is why Instroom offers a{" "}
              <strong>free-forever plan</strong> with no time limit and no credit card required. If
              you run into a genuine problem on a paid plan, please contact our support team first
              — most issues can be resolved without a refund.
            </p>
          </section>

          {/* S2 — Plans & Billing Model */}
          <section id="s2" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 02" />
            <SectionHeading>Plans &amp; Billing Model</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              Instroom uses <strong>workspace-based billing</strong> — you are charged per
              workspace you own, not per user or seat. Every plan includes unlimited team members.
            </p>

            <div className="overflow-x-auto my-5">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr>
                    {["Plan", "Price", "Billing"].map((h) => (
                      <th
                        key={h}
                        className="bg-[#1a4a2e] text-white px-3.5 py-2.5 text-left text-[12px] font-medium tracking-[0.05em]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plansBilling.map((row, i) => (
                    <tr key={row.plan} className={i % 2 === 1 ? "bg-[rgba(45,122,79,0.03)]" : ""}>
                      <td className="px-3.5 py-2.5 border-b border-[#d4e8db] font-semibold text-[#1a1a1a]">
                        {row.plan}
                      </td>
                      <td className="px-3.5 py-2.5 border-b border-[#d4e8db] text-[#2e3d34] font-light">
                        {row.price}
                      </td>
                      <td className="px-3.5 py-2.5 border-b border-[#d4e8db] text-[#2e3d34] font-light">
                        {row.billing}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="pl-5 mb-3 list-disc">
              {[
                <>
                  The <strong>Basic plan is free forever</strong>, subject to its usage limits. It
                  is not a trial, nothing expires, and no payment is ever required to keep using
                  it.
                </>,
                <>
                  Paid subscriptions (Solo, Team, Agency) are billed{" "}
                  <strong>monthly or annually, in advance</strong>.
                </>,
                <>
                  Access to paid features begins <strong>immediately upon payment</strong>.
                </>,
                <>
                  <strong>No trial period applies.</strong> You can evaluate Instroom on the free
                  plan for as long as you like before deciding to pay.
                </>,
                <>
                  You may <strong>cancel at any time.</strong> Cancellation takes effect at the end
                  of the current billing period, and you keep access until that date.
                </>,
              ].map((item, i) => (
                <li key={i} className="text-[15px] text-[#2e3d34] font-light mb-1.5">
                  {item}
                </li>
              ))}
            </ul>

            <Warning>
              <strong>Important:</strong> Because paid access is granted immediately and our
              subscriptions are digital services, charges are generally non-refundable once a
              billing period has begun — except in the specific cases below.
            </Warning>
          </section>

          {/* S3 — Free Plan */}
          <section id="s3" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 03" />
            <SectionHeading>Free Plan</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              The Basic plan is offered at no cost and is not subject to billing or refunds. There
              are no charges associated with it, and you can use it indefinitely within its
              limits.
            </p>
          </section>

          {/* S4 — Eligible Refunds */}
          <section id="s4" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 04" />
            <SectionHeading>Eligible Refund Scenarios</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              We will issue a refund in the following circumstances:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
              {eligibleScenarios.map((card) => (
                <ScenarioCardComponent key={card.title} card={card} />
              ))}
            </div>
          </section>

          {/* S5 — Non-Refundable */}
          <section id="s5" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 05" />
            <SectionHeading>Non-Refundable Cases</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              We do not issue refunds in the following circumstances:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
              {ineligibleScenarios.map((card) => (
                <ScenarioCardComponent key={card.title} card={card} />
              ))}
            </div>
          </section>

          {/* S6 — Annual Plans */}
          <section id="s6" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 06" />
            <SectionHeading>Annual Plans</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              Annual plans are prepaid for 12 months at a discounted rate (Solo: $15/mo billed
              annually; Team: $39/mo billed annually).
            </p>
            <ul className="pl-5 mb-3 list-disc">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">
                <strong>Within the first 7 days:</strong> New annual subscribers are eligible for a
                full refund, consistent with the new-subscriber window.
              </li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">
                <strong>After 7 days:</strong> Annual payments are non-refundable. You may cancel
                renewal at any time and keep access through the end of the paid period.
              </li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">
                <strong>Prorated refunds</strong> for the unused portion of an annual plan are not
                offered, except in the case of a verifiable platform failure or billing error on
                our side.
              </li>
            </ul>
            <HighlightBox>
              No annual contracts are required — but once an annual plan is activated beyond the
              7-day window, the subscription is non-refundable.{" "}
              <strong className="text-[#3dbd72]">
                We recommend trialing the platform on a monthly plan before committing annually.
              </strong>
            </HighlightBox>
          </section>

          {/* S7 — Companion Tools & Upcoming Features */}
          <section id="s7" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 07" />
            <SectionHeading>Companion Tools &amp; Upcoming Features</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              Instroom offers companion tools alongside the core platform:
            </p>
            <ul className="pl-5 mb-3 list-disc">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">
                <strong>Chrome Extension</strong> — Currently available as a free tool (with a
                daily usage limit). The free version is not subject to billing or refunds. Any
                future paid tier will be governed by this policy.
              </li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">
                <strong>Post Tracker</strong> and <strong>Discovery</strong> — Not yet available.
                When these launch — whether as plan add-ons or standalone products — their pricing
                and refund terms will be published and governed by this policy (or a successor
                version).
              </li>
            </ul>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              We will update this policy before any new paid tool or add-on becomes available for
              purchase.
            </p>
          </section>

          {/* S8 — How to Request */}
          <section id="s8" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 08" />
            <SectionHeading>How to Request a Refund</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              To request a refund, please follow these steps:
            </p>

            {/* Process steps */}
            <div className="relative flex flex-col my-5">
              <div className="absolute left-5 top-7 bottom-7 w-0.5 bg-gradient-to-b from-[#2d7a4f] to-transparent" />
              {processSteps.map((step) => (
                <div key={step.number} className="flex gap-5 items-start py-4">
                  <div className="w-10 h-10 min-w-[40px] bg-[#2d7a4f] rounded-full flex items-center justify-center text-white text-[13px] font-semibold relative z-10">
                    {step.number}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">{step.title}</h4>
                    <p className="text-sm text-[#5a6b5e] font-light m-0">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <Callout>
              Refund requests must be submitted within <strong>30 days</strong> of the charge in
              question. Requests beyond this window will not be considered, except in cases of
              fraud or billing error.
            </Callout>
          </section>

          {/* S9 — Processing */}
          <section id="s9" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 09" />
            <SectionHeading>Processing &amp; Timeline</SectionHeading>
            <ul className="pl-5 mb-3 list-disc">
              {[
                "Refunds are issued to the original payment method used for the charge.",
                <>Processing typically takes <strong>7–14 business days</strong> from approval, depending on your bank or card issuer.</>,
                "We do not issue refunds via alternative payment methods, credits to other accounts, or cash.",
                "We email you a confirmation once the refund has been initiated on our end.",
              ].map((item, i) => (
                <li key={i} className="text-[15px] text-[#2e3d34] font-light mb-1.5">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* S10 — Chargebacks */}
          <section id="s10" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 10" />
            <SectionHeading>Chargebacks &amp; Disputes</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              Please contact us before initiating a chargeback with your bank or card provider —
              most issues are resolved quickly through support, while a chargeback can take much
              longer.
            </p>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              Filing a chargeback without contacting us first may result in immediate suspension of
              your account pending investigation. If a chargeback is found to be fraudulent or made
              in bad faith, we reserve the right to recover the disputed amount and to permanently
              terminate the associated account.
            </p>
          </section>

          {/* S11 — Consumer Rights */}
          <section id="s11" className="section-animate mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionLabel num="Section 11" />
            <SectionHeading>Consumer Rights Under Philippine Law</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              Nothing in this Refund Policy limits or excludes your statutory rights as a consumer
              under the laws of the Republic of the Philippines, including the Consumer Act of the
              Philippines (RA 7394) and related regulations. If you believe your consumer rights
              have been violated, you may also contact:
            </p>
            <ul className="pl-5 mb-3 list-disc">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">
                <strong>Department of Trade and Industry (DTI)</strong> —{" "}
                <a
                  href="https://www.dti.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2d7a4f] underline"
                >
                  www.dti.gov.ph
                </a>
              </li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">
                <strong>National Telecommunications Commission (NTC)</strong> — for electronic
                services disputes
              </li>
            </ul>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              We handle all refund requests in good faith and in compliance with applicable
              Philippine consumer-protection laws.
            </p>
          </section>

          {/* S12 — Contact */}
          <section id="s12" className="section-animate mb-0">
            <SectionLabel num="Section 12" />
            <SectionHeading>Contact</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">
              For all billing and refund-related inquiries, please reach us at:
            </p>
            <h3 className="text-sm font-semibold mt-6 mb-2">
              Armful OPC, trading as Armful Media — Instroom Billing Support
            </h3>
            <ul className="pl-5 list-disc">
              {[
                ["SEC Registration No.", "2024090169123-01"],
                ["Email", "billing@instroom.io"],
                [
                  "Registered Address",
                  "2/F Armful Media Bldg., Santiago, Naujan, Oriental Mindoro, Philippines 5204",
                ],
                ["Response Time", "Within 2 business days"],
              ].map(([label, value]) => (
                <li key={label} className="text-[15px] text-[#2e3d34] font-light mb-1.5">
                  {label}: <strong>{value}</strong>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="bg-[#0d2b1a] px-6 sm:px-8 lg:px-12 py-9 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-[13px] text-white/40 font-light m-0">
          © 2026 Armful OPC, trading as Armful Media (SEC Reg. No. 2024090169123-01). Instroom is a product of Armful OPC. 2/F Armful Media Bldg., Santiago, Naujan, Oriental Mindoro, Philippines 5204. All rights reserved.
        </p>
        <div className="flex gap-6">
          {["Terms of Service", "Privacy Policy", "Refund Policy"].map((link) => (
            <a
              key={link}
              href={link === "Terms of Service" ? "/terms-of-service" : link === "Privacy Policy" ? "/privacy" : "/refund"}
              className="text-[13px] text-white/50 no-underline font-normal hover:text-[#3dbd72] transition-colors duration-150"
            >
              {link}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

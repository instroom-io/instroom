import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"
import {
  LegalHero,
  LegalSection,
  LegalP,
  PlainList,
  Callout,
  HighlightBox,
  ContactCard,
  DocTable,
  ScenarioCard,
  Steps,
} from "@/components/legal-page/shared"

export const metadata = {
  title: "Refund Policy | Instroom",
  description:
    "Instroom's refund policy: a free-forever Basic plan, workspace-based billing, and a 7-day refund window for first-time subscribers.",
}

const plansBilling = [
  { plan: "Basic", price: "Free forever", billing: "No charge, no card required" },
  { plan: "Solo", price: "$19/mo, or $15/mo billed annually ($180/year)", billing: "Monthly or annual, in advance" },
  { plan: "Team", price: "$49/mo, or $39/mo billed annually ($468/year)", billing: "Monthly or annual, in advance" },
  { plan: "Agency", price: "Custom", billing: "Quoted per agreement" },
]

const eligibleScenarios = [
  {
    title: "Duplicate Charge",
    description: "You were charged more than once for the same billing period due to a technical error on our end.",
  },
  {
    title: "Unauthorized Transaction",
    description: "A charge was made to your payment method without your authorization, and you notify us promptly.",
  },
  {
    title: "Extended Service Outage",
    description:
      "The Service was unavailable for more than 72 consecutive hours due to issues on our side — not third-party platforms or scheduled maintenance.",
  },
  {
    title: "Charge After Cancellation",
    description: "You were billed after a confirmed cancellation had already taken effect.",
  },
  {
    title: "First-Time Subscriber — 7-Day Window",
    description:
      "New subscribers who have not previously held a paid Instroom subscription may request a full refund within 7 days of their first charge if unsatisfied.",
  },
  {
    title: "Billing Error",
    description: "We charged you at an incorrect price due to a pricing error on our platform.",
  },
]

const ineligibleScenarios = [
  {
    title: "Change of Mind",
    description:
      "You no longer wish to use the Service after your billing period has begun, beyond the 7-day new-subscriber window.",
  },
  {
    title: "Unused Subscription",
    description: "You paid for a billing period but did not actively use the Service during that time.",
  },
  {
    title: "Partial-Period Usage",
    description: "You cancel mid-period. Access continues until the period ends; no prorated refund is issued.",
  },
  {
    title: "Termination for Violations",
    description: "Your account was suspended or terminated for a breach of our Terms of Service.",
  },
  {
    title: "Third-Party Limitations",
    description:
      "A feature was affected by Instagram, TikTok, Google, or another third party restricting API access — outside our control.",
  },
]

const processSteps = [
  { number: 1, title: "Contact Support", description: 'Email billing@instroom.io with the subject line "Refund Request."' },
  {
    number: 2,
    title: "Include the Details",
    description: "Your registered email address, the date and amount of the charge, and the reason for your request.",
  },
  {
    number: 3,
    title: "Await Confirmation",
    description: "We acknowledge requests within 2 business days and communicate a decision within 5 business days.",
  },
  {
    number: 4,
    title: "Refund Issued",
    description:
      "If approved, the refund is returned to your original payment method within 7–14 business days, depending on your bank or card issuer.",
  },
]

export default function RefundPolicy() {
  return (
    <div className="font-sans text-[#1E1E1E]" style={{ background: "#F7F9F8" }}>
      <MainHeader />

      <LegalHero
        title="Refund"
        emphasis="Policy"
        meta={[
          { label: "Effective", value: "July 24, 2026" },
          { label: "Jurisdiction", value: "Republic of the Philippines" },
          { label: "Entity", value: "Armful OPC, trading as Armful Media" },
        ]}
        lede="Instroom is a Software-as-a-Service (SaaS) product. Because access is digital and granted immediately upon payment, our refund policy is specific and limited. Please read it before subscribing to a paid plan."
      />

      <div className="max-w-[860px] mx-auto px-6 pb-20">
        <LegalSection number="Section 01" heading="Overview">
          <LegalP>
            This Refund Policy explains when and how Armful OPC — a One Person Corporation registered in the
            Republic of the Philippines, trading as Armful Media and the owner and operator of Instroom ("we,"
            "us," or "our") — issues refunds for payments made for the Instroom platform and its paid features.
          </LegalP>
          <LegalP>
            We want you to be confident before you pay, which is why Instroom offers a{" "}
            <strong className="text-[#1E1E1E] font-semibold">free-forever plan</strong> with no time limit and no
            credit card required. If you run into a genuine problem on a paid plan, please contact our support
            team first — most issues can be resolved without a refund.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 02" heading="Plans & Billing Model">
          <LegalP>
            Instroom uses <strong className="text-[#1E1E1E] font-semibold">workspace-based billing</strong> — you
            are charged per workspace you own, not per user or seat. Every plan includes unlimited team members.
          </LegalP>
          <DocTable
            headers={["Plan", "Price", "Billing"]}
            rows={plansBilling.map((row) => [<strong key="p">{row.plan}</strong>, row.price, row.billing])}
          />
          <PlainList
            items={[
              <>
                The <strong className="text-[#1E1E1E] font-semibold">Basic plan is free forever</strong>, subject
                to its usage limits. It is not a trial, nothing expires, and no payment is ever required to keep
                using it.
              </>,
              <>
                Paid subscriptions (Solo, Team, Agency) are billed{" "}
                <strong className="text-[#1E1E1E] font-semibold">monthly or annually, in advance</strong>.
              </>,
              <>
                Access to paid features begins{" "}
                <strong className="text-[#1E1E1E] font-semibold">immediately upon payment</strong>.
              </>,
              <>
                <strong className="text-[#1E1E1E] font-semibold">No trial period applies.</strong> You can
                evaluate Instroom on the free plan for as long as you like before deciding to pay.
              </>,
              <>
                You may <strong className="text-[#1E1E1E] font-semibold">cancel at any time.</strong> Cancellation
                takes effect at the end of the current billing period, and you keep access until that date.
              </>,
            ]}
          />
          <Callout>
            <strong className="text-[#1E1E1E] font-semibold">Important:</strong> Because paid access is granted
            immediately and our subscriptions are digital services, charges are generally non-refundable once a
            billing period has begun — except in the specific cases below.
          </Callout>
        </LegalSection>

        <LegalSection number="Section 03" heading="Free Plan">
          <LegalP>
            The Basic plan is offered at no cost and is not subject to billing or refunds. There are no charges
            associated with it, and you can use it indefinitely within its limits.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 04" heading="Eligible Refund Scenarios">
          <LegalP>We will issue a refund in the following circumstances:</LegalP>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-6">
            {eligibleScenarios.map((card) => (
              <ScenarioCard key={card.title} eligible {...card} />
            ))}
          </div>
        </LegalSection>

        <LegalSection number="Section 05" heading="Non-Refundable Cases">
          <LegalP>We do not issue refunds in the following circumstances:</LegalP>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-6">
            {ineligibleScenarios.map((card) => (
              <ScenarioCard key={card.title} eligible={false} {...card} />
            ))}
          </div>
        </LegalSection>

        <LegalSection number="Section 06" heading="Annual Plans">
          <LegalP>
            Annual plans are prepaid for 12 months at a discounted rate (Solo: $15/mo billed annually; Team:
            $39/mo billed annually).
          </LegalP>
          <PlainList
            items={[
              <>
                <strong className="text-[#1E1E1E] font-semibold">Within the first 7 days:</strong> New annual
                subscribers are eligible for a full refund, consistent with the new-subscriber window.
              </>,
              <>
                <strong className="text-[#1E1E1E] font-semibold">After 7 days:</strong> Annual payments are
                non-refundable. You may cancel renewal at any time and keep access through the end of the paid
                period.
              </>,
              <>
                <strong className="text-[#1E1E1E] font-semibold">Prorated refunds</strong> for the unused portion
                of an annual plan are not offered, except in the case of a verifiable platform failure or billing
                error on our side.
              </>,
            ]}
          />
          <HighlightBox>
            No annual contracts are required — but once an annual plan is activated beyond the 7-day window, the
            subscription is non-refundable.{" "}
            <strong className="text-[#1FAE5B]">
              We recommend trialing the platform on a monthly plan before committing annually.
            </strong>
          </HighlightBox>
        </LegalSection>

        <LegalSection number="Section 07" heading="Companion Tools & Upcoming Features">
          <LegalP>Instroom offers companion tools alongside the core platform:</LegalP>
          <PlainList
            items={[
              <>
                <strong className="text-[#1E1E1E] font-semibold">Chrome Extension</strong> — Currently available
                as a free tool (with a daily usage limit). The free version is not subject to billing or refunds.
                Any future paid tier will be governed by this policy.
              </>,
              <>
                <strong className="text-[#1E1E1E] font-semibold">Post Tracker</strong> and{" "}
                <strong className="text-[#1E1E1E] font-semibold">Discovery</strong> — Not yet available. When these
                launch — whether as plan add-ons or standalone products — their pricing and refund terms will be
                published and governed by this policy (or a successor version).
              </>,
            ]}
          />
          <LegalP>We will update this policy before any new paid tool or add-on becomes available for purchase.</LegalP>
        </LegalSection>

        <LegalSection number="Section 08" heading="How to Request a Refund">
          <LegalP>To request a refund, please follow these steps:</LegalP>
          <Steps steps={processSteps} />
          <Callout>
            Refund requests must be submitted within <strong className="text-[#1E1E1E] font-semibold">30 days</strong>{" "}
            of the charge in question. Requests beyond this window will not be considered, except in cases of
            fraud or billing error.
          </Callout>
        </LegalSection>

        <LegalSection number="Section 09" heading="Processing & Timeline">
          <PlainList
            items={[
              "Refunds are issued to the original payment method used for the charge.",
              <>
                Processing typically takes{" "}
                <strong className="text-[#1E1E1E] font-semibold">7–14 business days</strong> from approval,
                depending on your bank or card issuer.
              </>,
              "We do not issue refunds via alternative payment methods, credits to other accounts, or cash.",
              "We email you a confirmation once the refund has been initiated on our end.",
            ]}
          />
        </LegalSection>

        <LegalSection number="Section 10" heading="Chargebacks & Disputes">
          <LegalP>
            Please contact us before initiating a chargeback with your bank or card provider — most issues are
            resolved quickly through support, while a chargeback can take much longer.
          </LegalP>
          <LegalP>
            Filing a chargeback without contacting us first may result in immediate suspension of your account
            pending investigation. If a chargeback is found to be fraudulent or made in bad faith, we reserve the
            right to recover the disputed amount and to permanently terminate the associated account.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 11" heading="Consumer Rights Under Philippine Law">
          <LegalP>
            Nothing in this Refund Policy limits or excludes your statutory rights as a consumer under the laws of
            the Republic of the Philippines, including the Consumer Act of the Philippines (RA 7394) and related
            regulations. If you believe your consumer rights have been violated, you may also contact:
          </LegalP>
          <PlainList
            items={[
              <>
                <strong className="text-[#1E1E1E] font-semibold">Department of Trade and Industry (DTI)</strong> —{" "}
                <a href="https://www.dti.gov.ph" target="_blank" rel="noopener noreferrer" className="text-[#178C49] underline">
                  www.dti.gov.ph
                </a>
              </>,
              <>
                <strong className="text-[#1E1E1E] font-semibold">National Telecommunications Commission (NTC)</strong> —
                for electronic services disputes
              </>,
            ]}
          />
          <LegalP>
            We handle all refund requests in good faith and in compliance with applicable Philippine
            consumer-protection laws.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 12" heading="Contact">
          <LegalP>For all billing and refund-related inquiries, please reach us at:</LegalP>
          <ContactCard
            heading="Armful OPC, trading as Armful Media — Instroom Billing Support"
            rows={[
              { label: "SEC Registration No.", value: "2024090169123-01" },
              { label: "Email", value: "billing@instroom.io" },
              { label: "Registered Address", value: "2/F Armful Media Bldg., Santiago, Naujan, Oriental Mindoro, Philippines 5204" },
              { label: "Response Time", value: "Within 2 business days" },
            ]}
          />
        </LegalSection>

        <hr className="border-0 border-t border-[#E4E7E5] mt-11" />
        <p className="text-[13px] text-[#7C7C7C] mt-5">
          © 2026 Armful OPC, trading as Armful Media (SEC Reg. No. 2024090169123-01). Instroom is a product of
          Armful OPC. All rights reserved.
        </p>
      </div>

      <MainFooter />
    </div>
  )
}

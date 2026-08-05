import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"
import { LegalHero, LegalSection, LegalP, LegalH3, PlainList, Callout, ContactCard } from "@/components/legal-page/shared"

export const metadata = {
  title: "Terms of Service | Instroom",
  description: "Instroom's terms of service: the rules and conditions for creating an account and using the Instroom platform.",
}

const tocItems = [
  { label: "Agreement to Terms", href: "#s1" },
  { label: "Description of Services", href: "#s2" },
  { label: "Account Registration", href: "#s3" },
  { label: "Subscriptions & Billing", href: "#s4" },
  { label: "Acceptable Use", href: "#s5" },
  { label: "Intellectual Property", href: "#s6" },
  { label: "Third-Party Integrations", href: "#s7" },
  { label: "Disclaimers & Limitations", href: "#s8" },
  { label: "Termination", href: "#s9" },
  { label: "Governing Law", href: "#s10" },
  { label: "Changes to These Terms", href: "#s11" },
  { label: "Contact", href: "#s12" },
]

export default function InstroomTermsOfService() {
  return (
    <div className="font-sans text-[#1E1E1E]" style={{ background: "#F7F9F8" }}>
      <MainHeader />

      <LegalHero
        title="Terms of"
        emphasis="Service"
        meta={[
          { label: "Effective", value: "April 21, 2026" },
          { label: "Jurisdiction", value: "Republic of the Philippines" },
          { label: "Entity", value: "Armful OPC, trading as Armful Media" },
        ]}
        lede="Please read these Terms of Service carefully before using Instroom. By creating an account or using any part of our platform, you agree to be bound by these terms. If you do not agree, do not use the Service."
        toc={tocItems}
      />

      <div className="max-w-[860px] mx-auto px-4 sm:px-6 pb-20">
        <LegalSection id="s1" number="Section 01" heading="Agreement to Terms">
          <LegalP>
            These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or
            "your") and Armful OPC, a One Person Corporation registered in the Republic of the Philippines, trading
            as Armful Media, and the owner and operator of the Instroom platform ("Company," "we," "us," or "our"),
            governing your access to and use of the Instroom platform, including its website at instroom.io,
            Chrome Extension, Post Tracker, and all related tools and services (collectively, the "Service").
          </LegalP>
          <LegalP>
            By registering for an account, subscribing to a plan, or otherwise using the Service, you represent
            that you are at least 18 years of age and have the legal capacity to enter into this agreement. If you
            are using the Service on behalf of a company or organization, you represent that you have authority to
            bind that entity to these Terms.
          </LegalP>
        </LegalSection>

        <LegalSection id="s2" number="Section 02" heading="Description of Services">
          <LegalP>
            Instroom is an influencer relationship management (IRM) platform designed for small businesses, solo
            operators, and agencies. The Service comprises:
          </LegalP>
          <LegalH3>Core Products</LegalH3>
          <PlainList
            items={[
              <>
                <strong className="text-[#1E1E1E] font-semibold">Instroom Platform</strong> — the core CRM and
                workspace for influencer list management, a visual pipeline, an embedded inbox, outreach, deal,
                contract, and payment tracking, reporting and analytics, and team collaboration with role-based
                access control. Offered on a free-forever Basic plan and paid Solo, Team, and Agency plans, as
                described in Section 4.
              </>,
              <>
                <strong className="text-[#1E1E1E] font-semibold">Chrome Extension</strong> — surfaces influencer
                insights (engagement rate, follower count, email, and location) while you browse Instagram and
                TikTok. Currently available as a free tool with a daily usage limit; any future paid tier will be
                introduced under these Terms.
              </>,
            ]}
          />
          <LegalH3>Integrations</LegalH3>
          <LegalP>
            The Service connects with third-party tools including Gmail and Outlook (for the embedded inbox),
            Shopify (for sales, revenue, conversion, and automatic shipment tracking), and GoAffPro (for affiliate
            sales and payout tracking). See Section 7.
          </LegalP>
          <LegalH3>Coming soon</LegalH3>
          <PlainList
            items={[
              <>
                <strong className="text-[#1E1E1E] font-semibold">Post Tracker</strong> — automatic post monitoring
                and content downloads to Google Drive. An optional add-on, not yet available.
              </>,
              <>
                <strong className="text-[#1E1E1E] font-semibold">Discovery</strong> — creator search across a
                curated database. Not yet available.
              </>,
            ]}
          />
          <LegalP>
            When these tools launch — whether as standalone products or workspace add-ons — their availability,
            pricing, and terms will be introduced under these Terms. We reserve the right to modify, suspend, or
            discontinue any feature of the Service with reasonable notice.
          </LegalP>
        </LegalSection>

        <LegalSection id="s3" number="Section 03" heading="Account Registration">
          <LegalP>
            To access the Service, you must create an account and provide accurate, complete, and current
            information. You are responsible for maintaining the confidentiality of your login credentials and for
            all activity that occurs under your account.
          </LegalP>
          <LegalH3>Account Types</LegalH3>
          <PlainList
            items={[
              <><strong className="text-[#1E1E1E] font-semibold">Basic Account</strong> — Free forever. Includes 1 owned workspace, subject to usage limits. No credit card required.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Solo Account</strong> — Includes 1 owned workspace. Cannot be expanded. Suitable for individual operators and freelancers.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Team Account</strong> — Includes 3 owned workspaces by default, expandable for an additional fee. Suitable for agencies and in-house teams.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Agency Account</strong> — A custom plan with volume workspaces and support, arranged by agreement.</>,
            ]}
          />
          <LegalH3>Workspace Rules</LegalH3>
          <PlainList
            items={[
              "Each workspace has exactly one Admin at all times.",
              "All other roles (Manager, Researcher, Viewer) are free and unlimited.",
              "Shared workspace access does not count toward your workspace quota.",
              "Transferring the Admin role does not transfer the billing subscription.",
            ]}
          />
          <LegalP>You agree to notify us immediately of any unauthorized use of your account. We are not liable for any loss resulting from unauthorized account access.</LegalP>
        </LegalSection>

        <LegalSection id="s4" number="Section 04" heading="Subscriptions & Billing">
          <LegalP>Instroom uses workspace-based billing. You are billed per workspace you own, not per user or seat. All roles are free and unlimited.</LegalP>
          <LegalH3>Free Plan &amp; Trials</LegalH3>
          <LegalP>
            The <strong className="text-[#1E1E1E] font-semibold">Basic plan is free forever</strong> and is not
            billed; no credit card is required. <strong className="text-[#1E1E1E] font-semibold">We do not offer
            a free trial</strong> on paid plans — you may evaluate Instroom on the Basic plan for as long as you
            like before deciding to upgrade.
          </LegalP>
          <LegalH3>Billing Cycle</LegalH3>
          <PlainList
            items={[
              <><strong className="text-[#1E1E1E] font-semibold">Monthly plans</strong> are billed on a recurring monthly basis (Solo: $19/mo; Team: $49/mo).</>,
              <><strong className="text-[#1E1E1E] font-semibold">Annual plans</strong> are billed annually at a discounted rate (Solo: $15/mo; Team: $39/mo).</>,
              "No annual contracts are required on any plan. You may cancel at any time.",
            ]}
          />
          <LegalH3>Add-ons</LegalH3>
          <LegalP>When paid add-ons become available, they will be billed per workspace per month. Enabling an add-on across multiple workspaces will be charged at the add-on price multiplied by the number of workspaces using it.</LegalP>
          <LegalH3>Payment</LegalH3>
          <LegalP>All payments are processed in United States Dollars (USD) via our authorized payment processor. By subscribing, you authorize us to charge your designated payment method on a recurring basis.</LegalP>
          <Callout>
            <strong className="text-[#1E1E1E] font-semibold">Note:</strong> Billing is tied to the account record,
            not the Admin user. If you transfer the Admin role of a workspace, the billing subscription remains
            with the original account holder.
          </Callout>
        </LegalSection>

        <LegalSection id="s5" number="Section 05" heading="Acceptable Use">
          <LegalP>You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not:</LegalP>
          <PlainList
            items={[
              "Violate any applicable Philippine law, including the Cybercrime Prevention Act of 2012 (RA 10175) and the Data Privacy Act of 2012 (RA 10173).",
              "Scrape, collect, or harvest data from the platform in a manner that violates the terms of Instagram, TikTok, Shopify, Google, or any other third-party service integrated with Instroom.",
              "Use the platform to send unsolicited communications or spam.",
              "Attempt to gain unauthorized access to other users' accounts or workspaces.",
              "Reverse-engineer, decompile, or disassemble any part of the Service.",
              "Use the Service to store or transmit malicious code or to conduct phishing, fraud, or any deceptive practices.",
              "Misrepresent your identity or affiliation when using the Service.",
            ]}
          />
          <LegalP>We reserve the right to suspend or terminate accounts that violate these provisions without prior notice.</LegalP>
        </LegalSection>

        <LegalSection id="s6" number="Section 06" heading="Intellectual Property">
          <LegalP>
            All content, features, functionality, branding, and technology comprising the Instroom platform —
            including but not limited to the software, databases, design elements, trademarks, and documentation
            — are the exclusive property of Instroom and are protected under applicable intellectual property laws
            of the Philippines and international treaties.
          </LegalP>
          <LegalP>
            You are granted a limited, non-exclusive, non-transferable, revocable license to use the Service
            solely for your internal business purposes during the term of your subscription. You may not
            sublicense, resell, or otherwise transfer your access rights.
          </LegalP>
          <LegalH3>Your Content</LegalH3>
          <LegalP>
            You retain ownership of any data, content, or materials you upload or input into the Service ("User
            Content"). By using the Service, you grant Instroom a limited license to host, store, and process your
            User Content solely to provide and improve the Service. We do not claim ownership of your User
            Content.
          </LegalP>
        </LegalSection>

        <LegalSection id="s7" number="Section 07" heading="Third-Party Integrations">
          <LegalP>
            The Service integrates with third-party platforms including Instagram and TikTok (via the Chrome
            Extension), Gmail and Outlook (for the embedded inbox), Shopify (for sales and shipment tracking),
            Google Drive (for Post Tracker, upon its availability), and GoAffPro (for affiliate tracking). Your use
            of these integrations is subject to the respective terms of service and privacy policies of those
            platforms.
          </LegalP>
          <LegalP>
            We are not responsible for the availability, accuracy, or reliability of any third-party service.
            Platform policy changes (e.g., Instagram or TikTok API restrictions) may affect the functionality of
            certain features, such as the Discovery tool, and we do not guarantee uninterrupted access to features
            dependent on third-party APIs.
          </LegalP>
        </LegalSection>

        <LegalSection id="s8" number="Section 08" heading="Disclaimers & Limitations of Liability">
          <LegalP>
            The Service is provided on an "as is" and "as available" basis without warranties of any kind, either
            express or implied, including but not limited to warranties of merchantability, fitness for a
            particular purpose, or non-infringement.
          </LegalP>
          <LegalP>
            To the maximum extent permitted by applicable law, Instroom shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising out of or related to your use of the
            Service, including loss of profits, data, or business opportunities.
          </LegalP>
          <LegalP>
            Our total aggregate liability to you for any claim arising out of or related to these Terms or the
            Service shall not exceed the total amount paid by you to Instroom in the three (3) months preceding the
            claim.
          </LegalP>
          <Callout>
            Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or
            any liability that cannot be excluded under Philippine law.
          </Callout>
        </LegalSection>

        <LegalSection id="s9" number="Section 09" heading="Termination">
          <LegalP>
            You may cancel your subscription at any time through your account settings. Cancellation takes effect
            at the end of your current billing period; you will retain access to the Service until that date.
          </LegalP>
          <LegalP>
            We may suspend or terminate your access to the Service immediately, with or without notice, if you
            violate these Terms or if we determine, in our sole discretion, that your continued use poses a risk
            to the Service, other users, or third parties.
          </LegalP>
          <LegalP>
            Upon termination, your right to use the Service ceases immediately. You may request an export of your
            User Content within 30 days of termination, after which we may delete your data in accordance with our
            Privacy Policy.
          </LegalP>
        </LegalSection>

        <LegalSection id="s10" number="Section 10" heading="Governing Law & Dispute Resolution">
          <LegalP>
            These Terms shall be governed by and construed in accordance with the laws of the Republic of the
            Philippines, without regard to its conflict of law principles.
          </LegalP>
          <LegalP>
            Any dispute, controversy, or claim arising out of or relating to these Terms or the Service shall
            first be attempted to be resolved through good-faith negotiation between the parties. If not resolved
            within thirty (30) days, the dispute shall be submitted to the appropriate courts of the Philippines
            having jurisdiction over the matter.
          </LegalP>
        </LegalSection>

        <LegalSection id="s11" number="Section 11" heading="Changes to These Terms">
          <LegalP>
            We may update these Terms from time to time to reflect changes in our practices, technology, or
            applicable law. When we make material changes, we will notify you via email or a prominent notice
            within the platform at least 15 days before the changes take effect.
          </LegalP>
          <LegalP>
            Your continued use of the Service after the effective date of the revised Terms constitutes your
            acceptance of the changes. If you do not agree, you must stop using the Service before the effective
            date.
          </LegalP>
        </LegalSection>

        <LegalSection id="s12" number="Section 12" heading="Contact Us">
          <LegalP>If you have any questions about these Terms of Service, please contact us at:</LegalP>
          <ContactCard
            heading="Armful OPC, trading as Armful Media"
            rows={[
              { label: "SEC Registration No.", value: "2024090169123-01" },
              { label: "Email", value: "legal@instroom.io" },
              { label: "Registered Address", value: "2/F Armful Media Bldg., Santiago, Naujan, Oriental Mindoro, Philippines 5204" },
              { label: "Website", value: "instroom.io" },
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

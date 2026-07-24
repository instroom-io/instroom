import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"
import {
  LegalHero,
  LegalSection,
  LegalP,
  LegalH3,
  PlainList,
  Callout,
  HighlightBox,
  ContactCard,
  DocTable,
} from "@/components/legal-page/shared"

export const metadata = {
  title: "Privacy Policy | Instroom",
  description:
    "Instroom's privacy policy: how we collect, use, and protect your data, in compliance with the Data Privacy Act of 2012 (Republic Act No. 10173).",
}

const dataTableRows = [
  ["Account information", "You, directly", "Account creation, authentication, billing"],
  ["Usage data", "Automatically collected", "Platform operation, analytics, troubleshooting"],
  ["Campaign & influencer data", "You, directly", "Service delivery"],
  ["Third-party API data", "Instagram, TikTok, Shopify, GoAffPro", "Feature functionality (Discovery, Affiliate Tracking)"],
  ["Payment data", "Payment processor", "Billing and subscription management"],
]

const privacyRights = [
  { title: "Right to be Informed", desc: "You have the right to know whether your personal data is being collected and processed, and for what purpose." },
  { title: "Right to Access", desc: "You may request a copy of the personal information we hold about you at any time." },
  { title: "Right to Correction", desc: "You may request correction of inaccurate, outdated, or incomplete personal information." },
  { title: "Right to Erasure", desc: "You may request deletion of your personal information, subject to legal retention obligations." },
  { title: "Right to Object", desc: "You may object to the processing of your personal data for purposes other than those consented to or required by law." },
  { title: "Right to Data Portability", desc: "You may request your personal data in a structured, machine-readable format for transfer to another service." },
]

export default function InstroomPrivacyPolicy() {
  return (
    <div className="font-sans text-[#1E1E1E]" style={{ background: "#F7F9F8" }}>
      <MainHeader />

      <LegalHero
        title="Privacy"
        emphasis="Policy"
        meta={[
          { label: "Effective", value: "April 21, 2026" },
          { label: "Jurisdiction", value: "Republic of the Philippines" },
          { label: "Entity", value: "Armful OPC, trading as Armful Media" },
        ]}
        lede="Your privacy is important to us. This Policy explains what personal information Instroom collects, how we use it, and the rights you have under Philippine law. We are committed to full compliance with the Data Privacy Act of 2012 (RA 10173)."
      />

      <div className="max-w-[860px] mx-auto px-6 pb-20">
        <LegalSection number="Section 01" heading="Introduction">
          <LegalP>
            Armful OPC, a One Person Corporation registered in the Republic of the Philippines, trading as Armful
            Media, owns and operates the Instroom influencer relationship management platform accessible at
            instroom.io ("we," "us," or "our"). This Privacy Policy describes how we collect, use, store, share,
            and protect personal information in connection with your use of our platform, Chrome Extension, Post
            Tracker, and related services (the "Service").
          </LegalP>
          <LegalP>
            This Policy applies to all registered users, free trial users, and visitors to our website. It does
            not apply to third-party services linked from our platform — please review their individual privacy
            policies.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 02" heading="Data We Collect">
          <LegalP>We collect information in the following categories:</LegalP>
          <LegalH3>Account & Identity Information</LegalH3>
          <PlainList
            items={[
              "Name, email address, and password (hashed) upon registration",
              "Billing information (processed by our payment provider; we do not store full card details)",
              "Company name and role (optional, for team accounts)",
            ]}
          />
          <LegalH3>Usage & Platform Data</LegalH3>
          <PlainList
            items={[
              "Log data: IP address, browser type, pages visited, actions taken within the platform",
              "Workspace structure, campaign data, and influencer records you create",
              "Chrome Extension activity (profile captures, searches) associated with your account",
              "Post Tracker data: post links, content downloads, Google Drive export activity",
            ]}
          />
          <LegalH3>Integration Data</LegalH3>
          <PlainList
            items={[
              "OAuth tokens for Google Drive, Shopify, and other connected services",
              "Data returned from Instagram and TikTok APIs when using the Discovery add-on",
              "GoAffPro data (discount codes, affiliate links, sales data) when using Affiliate Tracking",
            ]}
          />
          <DocTable headers={["Data Type", "Source", "Purpose"]} rows={dataTableRows} />
        </LegalSection>

        <LegalSection number="Section 03" heading="How We Use Your Data">
          <LegalP>We use the personal information we collect for the following purposes:</LegalP>
          <PlainList
            items={[
              <><strong className="text-[#1E1E1E] font-semibold">To provide and operate the Service</strong> — including managing workspaces, campaigns, influencer lists, and add-on features.</>,
              <><strong className="text-[#1E1E1E] font-semibold">To process payments</strong> — billing, subscription management, and invoicing.</>,
              <><strong className="text-[#1E1E1E] font-semibold">To communicate with you</strong> — transactional emails, product updates, security alerts, and support responses.</>,
              <><strong className="text-[#1E1E1E] font-semibold">To improve the Service</strong> — analyzing usage patterns to enhance features and fix issues.</>,
              <><strong className="text-[#1E1E1E] font-semibold">To enforce our Terms</strong> — detecting fraud, abuse, and violations of our acceptable use policy.</>,
              <><strong className="text-[#1E1E1E] font-semibold">To comply with legal obligations</strong> — including requirements under Philippine law.</>,
            ]}
          />
          <LegalP>We do not sell your personal information to third parties for their own marketing purposes.</LegalP>
        </LegalSection>

        <LegalSection number="Section 04" heading="Legal Basis for Processing">
          <LegalP>Under the Data Privacy Act of 2012 (RA 10173), we process personal information on the following legal bases:</LegalP>
          <PlainList
            items={[
              <><strong className="text-[#1E1E1E] font-semibold">Contractual necessity</strong> — Processing required to deliver the Service you have subscribed to.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Consent</strong> — For optional communications and certain cookies. You may withdraw consent at any time.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Legitimate interests</strong> — For security monitoring, fraud prevention, and improving the Service, provided our interests are not overridden by your rights.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Legal obligation</strong> — Where processing is required to comply with applicable Philippine law.</>,
            ]}
          />
        </LegalSection>

        <LegalSection number="Section 05" heading="Data Sharing & Disclosure">
          <LegalP>We share personal information only in the following circumstances:</LegalP>
          <LegalH3>Service Providers</LegalH3>
          <LegalP>
            We engage trusted third-party service providers who assist us in operating the platform, including
            payment processors, cloud infrastructure providers, and analytics services. These parties are
            contractually bound to process data only on our instructions and to maintain appropriate security.
          </LegalP>
          <LegalH3>Third-Party Integrations</LegalH3>
          <LegalP>
            When you connect third-party services (Google Drive, Shopify, GoAffPro), data may be exchanged with
            those platforms as necessary to fulfill the integration. Your use of those services is governed by
            their respective privacy policies.
          </LegalP>
          <LegalH3>Legal Requirements</LegalH3>
          <LegalP>
            We may disclose information if required to do so by law, court order, or government authority in the
            Philippines or another jurisdiction, or when necessary to protect our rights, users, or the public.
          </LegalP>
          <LegalH3>Business Transfers</LegalH3>
          <LegalP>
            In the event of a merger, acquisition, or sale of all or part of our business, user data may be
            transferred as part of that transaction. We will notify you before any such transfer and your data
            becomes subject to a different privacy policy.
          </LegalP>
          <HighlightBox>
            <strong className="text-[#1FAE5B]">We do not sell, rent, or trade your personal information</strong> to
            third parties for advertising or marketing purposes.
          </HighlightBox>
        </LegalSection>

        <LegalSection number="Section 06" heading="Influencer Data">
          <LegalP>
            Instroom is a B2B tool. When you use the platform to manage influencer campaigns, you may input
            personal information about third-party individuals (influencers), such as their name, social media
            handles, contact details, engagement metrics, and performance data.
          </LegalP>
          <LegalP>
            As the user creating and managing this data,{" "}
            <strong className="text-[#1E1E1E] font-semibold">you act as the data controller</strong> for that
            information. You are responsible for ensuring you have a lawful basis for collecting and processing
            influencer personal data, and for complying with applicable data protection laws when using Instroom's
            features to contact or manage those individuals.
          </LegalP>
          <LegalP>
            Instroom acts as a data processor with respect to influencer data stored in your workspace. We process
            it only to deliver the Service to you.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 07" heading="Cookies & Tracking Technologies">
          <LegalP>We use cookies and similar technologies to operate and improve the Service. These include:</LegalP>
          <PlainList
            items={[
              <><strong className="text-[#1E1E1E] font-semibold">Essential cookies</strong> — Required for authentication, session management, and platform security. Cannot be disabled.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Analytics cookies</strong> — Help us understand how users interact with the platform so we can improve it. You may opt out via your browser settings or our cookie preference center.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Preference cookies</strong> — Remember your settings and workspace preferences.</>,
            ]}
          />
          <LegalP>
            The Chrome Extension does not inject tracking scripts into third-party websites. It reads publicly
            visible profile data from Instagram and TikTok pages you browse while signed in and logged into the
            extension.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 08" heading="Data Retention">
          <LegalP>
            We retain your personal information for as long as your account is active or as necessary to provide
            the Service. Specific retention periods:
          </LegalP>
          <PlainList
            items={[
              <><strong className="text-[#1E1E1E] font-semibold">Account data</strong> — Retained for the duration of your subscription, plus 30 days after cancellation to allow for data export requests.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Billing records</strong> — Retained for a minimum of 5 years to comply with Philippine tax and accounting regulations.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Usage logs</strong> — Retained for up to 12 months for security and troubleshooting purposes.</>,
              <><strong className="text-[#1E1E1E] font-semibold">Workspace and campaign data</strong> — Deleted within 60 days of account termination unless a longer retention period is required by law.</>,
            ]}
          />
          <LegalP>
            You may request deletion of your account and associated personal data at any time by contacting us at
            privacy@instroom.io.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 09" heading="Data Security">
          <LegalP>
            We implement appropriate technical and organizational measures to protect your personal information
            against unauthorized access, disclosure, alteration, or destruction. These include encrypted data
            transmission (TLS/HTTPS), hashed passwords, access controls based on the principle of least privilege,
            and regular security reviews.
          </LegalP>
          <LegalP>
            While we take reasonable steps to protect your data, no method of transmission over the internet or
            electronic storage is 100% secure. We encourage you to use a strong, unique password and to enable any
            additional security features available in your account settings.
          </LegalP>
          <LegalP>
            In the event of a personal data breach that affects your rights and freedoms, we will notify the
            National Privacy Commission (NPC) and affected users in accordance with the requirements of RA 10173
            and its Implementing Rules and Regulations.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 10" heading="Your Privacy Rights">
          <LegalP>Under the Data Privacy Act of 2012, you have the following rights with respect to your personal information:</LegalP>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
            {privacyRights.map(({ title, desc }) => (
              <div key={title} className="bg-white border border-[#E4E7E5] rounded-xl p-4">
                <h4 className="text-[13px] font-bold text-[#0F6B3E] mb-1.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {title}
                </h4>
                <p className="text-[13px] text-[#4B4B4B] m-0">{desc}</p>
              </div>
            ))}
          </div>
          <LegalP>
            To exercise any of these rights, contact us at{" "}
            <strong className="text-[#1E1E1E] font-semibold">privacy@instroom.io</strong>. We will respond within
            15 business days. You also have the right to file a complaint with the{" "}
            <strong className="text-[#1E1E1E] font-semibold">National Privacy Commission (NPC)</strong> at
            www.privacy.gov.ph if you believe we have not handled your data lawfully.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 11" heading="Children's Privacy">
          <LegalP>
            The Service is not directed to individuals under the age of 18. We do not knowingly collect personal
            information from minors. If we become aware that a minor has provided us with personal information
            without parental consent, we will take steps to delete it promptly. If you believe a minor has
            submitted information to us, please contact privacy@instroom.io.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 12" heading="Changes to This Policy">
          <LegalP>
            We may update this Privacy Policy from time to time. When we make material changes, we will notify
            you by email or via a prominent notice within the platform, with at least 15 days' notice before the
            new policy takes effect.
          </LegalP>
          <LegalP>
            We encourage you to review this Policy periodically. Continued use of the Service after the effective
            date of changes constitutes your acceptance of the updated Policy.
          </LegalP>
        </LegalSection>

        <LegalSection number="Section 13" heading="Contact & Data Protection Officer">
          <LegalP>
            For any questions, concerns, or requests related to this Privacy Policy or your personal data, please
            contact our Data Protection Officer (DPO):
          </LegalP>
          <ContactCard
            heading="Armful OPC, trading as Armful Media — Data Protection Officer"
            rows={[
              { label: "SEC Registration No.", value: "2024090169123-01" },
              { label: "Registered Address", value: "2/F Armful Media Bldg., Santiago, Naujan, Oriental Mindoro, Philippines 5204" },
              { label: "Email", value: "privacy@instroom.io" },
              { label: "Website", value: "instroom.io" },
            ]}
          />
          <Callout>
            You also have the right to lodge a complaint with the{" "}
            <strong className="text-[#1E1E1E] font-semibold">National Privacy Commission (NPC)</strong> of the
            Philippines. Visit www.privacy.gov.ph for more information.
          </Callout>
        </LegalSection>

        <hr className="border-0 border-t border-[#E4E7E5] mt-11" />
        <p className="text-[13px] text-[#7C7C7C] mt-5">
          © 2026 Armful OPC, trading as Armful Media (SEC Reg. No. 2024090169123-01). Instroom is a product of
          Armful OPC. Compliant with RA 10173. All rights reserved.
        </p>
      </div>

      <MainFooter />
    </div>
  )
}

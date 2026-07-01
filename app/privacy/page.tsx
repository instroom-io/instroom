"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

const tocItems = [
  { id: "s1", label: "1. Introduction" },
  { id: "s2", label: "2. Data We Collect" },
  { id: "s3", label: "3. How We Use Your Data" },
  { id: "s4", label: "4. Legal Basis" },
  { id: "s5", label: "5. Data Sharing" },
  { id: "s6", label: "6. Influencer Data" },
  { id: "s7", label: "7. Cookies & Tracking" },
  { id: "s8", label: "8. Data Retention" },
  { id: "s9", label: "9. Security" },
  { id: "s10", label: "10. Your Rights" },
  { id: "s11", label: "11. Children's Privacy" },
  { id: "s12", label: "12. Policy Updates" },
  { id: "s13", label: "13. Contact & DPO" },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[26px] font-normal text-[#0d2b1a] mb-4 leading-tight tracking-[-0.2px]"
      style={{ fontFamily: "'Instrument Serif', serif" }}
    >
      {children}
    </h2>
  );
}

function SectionNum({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#2d7a4f] mb-2">
      {children}
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#edf7f1] border border-[#b8dfc7] border-l-[3px] border-l-[#2d7a4f] rounded-lg px-5 py-4 my-5">
      <p className="text-[14px] text-[#1a4a2e] font-normal m-0">{children}</p>
    </div>
  );
}

function HighlightBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0d2b1a] rounded-xl px-7 py-6 my-6">
      {children}
    </div>
  );
}

export default function InstroomPrivacyPolicy() {
  const [activeSection, setActiveSection] = useState("s1");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    tocItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      style={{ background: "#F4F7F5", fontFamily: "'DM Sans', sans-serif" }}
      className="text-[#1a1a1a] text-base leading-[1.75]"
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>

      {/* Nav */}
      <nav className="bg-[#0d2b1a] px-12 h-16 flex items-center justify-between sticky top-0 z-50 border-b border-[#1f3d28]">
        <div className="flex items-center gap-2.5 cursor-pointer">
          <Image
            src="/images/instroomLogo.png"
            alt="Instroom Logo"
            width={36}
            height={36}
            className="w-9 h-9 rounded-full object-cover"
          />
          <span className="font-semibold text-[18px] text-white tracking-[-0.3px]">
            instroom
          </span>
        </div>
        <span className="text-[12px] font-medium text-[#a8e6c1] tracking-[0.08em] uppercase bg-[rgba(61,189,114,0.12)] px-3 py-1 rounded-full border border-[rgba(61,189,114,0.25)]">
          Privacy Policy
        </span>
      </nav>

      {/* Hero */}
      <header className="bg-[#0d2b1a] px-12 pt-[72px] pb-16 relative overflow-hidden">
        <div className="absolute top-[-60px] right-[-60px] w-[320px] h-[320px] rounded-full border border-[rgba(61,189,114,0.08)]" />
        <div className="absolute top-5 right-10 w-[180px] h-[180px] rounded-full border border-[rgba(61,189,114,0.12)]" />
        <div className="max-w-[760px] relative z-10">
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#3dbd72] mb-4">
            Legal Document
          </div>
          <h1
            className="font-normal text-white leading-[1.1] mb-5 tracking-[-0.5px]"
            style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(36px, 5vw, 54px)" }}
          >
            Privacy <em className="text-[#3dbd72] italic">Policy</em>
          </h1>
          <div className="flex gap-6 flex-wrap">
            <span className="text-[13px] text-white/50">
              <strong className="text-white/85 font-medium">Effective:</strong> April 21, 2026
            </span>
            <span className="text-[13px] text-white/50">
              <strong className="text-white/85 font-medium">Jurisdiction:</strong> Republic of the Philippines
            </span>
            <span className="text-[13px] text-white/50">
              <strong className="text-white/85 font-medium">Entity:</strong> Armful OPC, trading as Armful Media
            </span>
          </div>
          <div className="inline-flex items-center gap-2 bg-[rgba(61,189,114,0.15)] border border-[rgba(61,189,114,0.3)] rounded-lg px-4 py-2.5 mt-6">
            <span className="text-[18px]">🛡️</span>
            <span className="text-[13px] text-[#a8e6c1] font-normal">
              Compliant with <strong className="text-[#3dbd72]">Republic Act No. 10173</strong> — Data Privacy Act of 2012 (Philippines)
            </span>
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="max-w-[1100px] mx-auto px-12 pt-[60px] pb-20 grid grid-cols-[220px_1fr] gap-16 items-start">

        {/* TOC */}
        <aside className="sticky top-[88px] hidden md:block">
          <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#5a6b5e] mb-4">
            Contents
          </div>
          <ol className="list-none flex flex-col gap-0.5 p-0 m-0">
            {tocItems.map(({ id, label }) => (
              <li key={id}>
                <button
                  className={`w-full text-left text-[13px] px-2.5 py-1.5 rounded-md border-l-2 transition-all duration-150 leading-snug cursor-pointer bg-transparent border-0 ${
                    activeSection === id
                      ? "text-[#2d7a4f] bg-[rgba(45,122,79,0.06)] border-l-[#2d7a4f] font-medium"
                      : "text-[#5a6b5e] border-l-transparent font-normal hover:text-[#2d7a4f] hover:bg-[rgba(45,122,79,0.06)] hover:border-l-[#2d7a4f]"
                  }`}
                  onClick={() => scrollTo(id)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        {/* Content */}
        <main className="min-w-0">

          <Callout>
            Your privacy is important to us. This Policy explains what personal information Instroom collects, how we use it, and the rights you have under Philippine law. We are committed to full compliance with the Data Privacy Act of 2012 (RA 10173).
          </Callout>

          {/* S1 */}
          <section id="s1" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 01</SectionNum>
            <SectionHeading>Introduction</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">Armful OPC, a One Person Corporation registered in the Republic of the Philippines, trading as Armful Media, owns and operates the Instroom influencer relationship management platform accessible at instroom.io ("we," "us," or "our"). This Privacy Policy describes how we collect, use, store, share, and protect personal information in connection with your use of our platform, Chrome Extension, Post Tracker, and related services (the "Service").</p>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">This Policy applies to all registered users, free trial users, and visitors to our website. It does not apply to third-party services linked from our platform — please review their individual privacy policies.</p>
          </section>

          {/* S2 */}
          <section id="s2" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 02</SectionNum>
            <SectionHeading>Data We Collect</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We collect information in the following categories:</p>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a] mt-6 mb-2">Account & Identity Information</h3>
            <ul className="pl-5 mb-3">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Name, email address, and password (hashed) upon registration</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Billing information (processed by our payment provider; we do not store full card details)</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Company name and role (optional, for team accounts)</li>
            </ul>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a] mt-6 mb-2">Usage & Platform Data</h3>
            <ul className="pl-5 mb-3">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Log data: IP address, browser type, pages visited, actions taken within the platform</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Workspace structure, campaign data, and influencer records you create</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Chrome Extension activity (profile captures, searches) associated with your account</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Post Tracker data: post links, content downloads, Google Drive export activity</li>
            </ul>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a] mt-6 mb-2">Integration Data</h3>
            <ul className="pl-5 mb-3">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">OAuth tokens for Google Drive, Shopify, and other connected services</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Data returned from Instagram and TikTok APIs when using the Discovery add-on</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">GoAffPro data (discount codes, affiliate links, sales data) when using Affiliate Tracking</li>
            </ul>
            <div className="overflow-x-auto my-5">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr>
                    {["Data Type", "Source", "Purpose"].map((h) => (
                      <th key={h} className="bg-[#1a4a2e] text-white px-3.5 py-2.5 text-left text-[12px] font-medium tracking-[0.05em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Account information", "You, directly", "Account creation, authentication, billing"],
                    ["Usage data", "Automatically collected", "Platform operation, analytics, troubleshooting"],
                    ["Campaign & influencer data", "You, directly", "Service delivery"],
                    ["Third-party API data", "Instagram, TikTok, Shopify, GoAffPro", "Feature functionality (Discovery, Affiliate Tracking)"],
                    ["Payment data", "Payment processor", "Billing and subscription management"],
                  ].map((row, i) => (
                    <tr key={i} className={i % 2 === 1 ? "bg-[rgba(45,122,79,0.03)]" : ""}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-3.5 py-2.5 border-b border-[#d4e8db] text-[#2e3d34] align-top font-light">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* S3 */}
          <section id="s3" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 03</SectionNum>
            <SectionHeading>How We Use Your Data</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We use the personal information we collect for the following purposes:</p>
            <ul className="pl-5 mb-3">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>To provide and operate the Service</strong> — including managing workspaces, campaigns, influencer lists, and add-on features.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>To process payments</strong> — billing, subscription management, and invoicing.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>To communicate with you</strong> — transactional emails, product updates, security alerts, and support responses.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>To improve the Service</strong> — analyzing usage patterns to enhance features and fix issues.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>To enforce our Terms</strong> — detecting fraud, abuse, and violations of our acceptable use policy.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>To comply with legal obligations</strong> — including requirements under Philippine law.</li>
            </ul>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We do not sell your personal information to third parties for their own marketing purposes.</p>
          </section>

          {/* S4 */}
          <section id="s4" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 04</SectionNum>
            <SectionHeading>Legal Basis for Processing</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">Under the Data Privacy Act of 2012 (RA 10173), we process personal information on the following legal bases:</p>
            <ul className="pl-5 mb-3">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Contractual necessity</strong> — Processing required to deliver the Service you have subscribed to.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Consent</strong> — For optional communications and certain cookies. You may withdraw consent at any time.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Legitimate interests</strong> — For security monitoring, fraud prevention, and improving the Service, provided our interests are not overridden by your rights.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Legal obligation</strong> — Where processing is required to comply with applicable Philippine law.</li>
            </ul>
          </section>

          {/* S5 */}
          <section id="s5" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 05</SectionNum>
            <SectionHeading>Data Sharing & Disclosure</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We share personal information only in the following circumstances:</p>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a] mt-6 mb-2">Service Providers</h3>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We engage trusted third-party service providers who assist us in operating the platform, including payment processors, cloud infrastructure providers, and analytics services. These parties are contractually bound to process data only on our instructions and to maintain appropriate security.</p>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a] mt-6 mb-2">Third-Party Integrations</h3>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">When you connect third-party services (Google Drive, Shopify, GoAffPro), data may be exchanged with those platforms as necessary to fulfill the integration. Your use of those services is governed by their respective privacy policies.</p>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a] mt-6 mb-2">Legal Requirements</h3>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We may disclose information if required to do so by law, court order, or government authority in the Philippines or another jurisdiction, or when necessary to protect our rights, users, or the public.</p>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a] mt-6 mb-2">Business Transfers</h3>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">In the event of a merger, acquisition, or sale of all or part of our business, user data may be transferred as part of that transaction. We will notify you before any such transfer and your data becomes subject to a different privacy policy.</p>
            <HighlightBox>
              <p className="text-white/80 m-0 text-[14px]"><strong className="text-[#3dbd72]">We do not sell, rent, or trade your personal information</strong> to third parties for advertising or marketing purposes.</p>
            </HighlightBox>
          </section>

          {/* S6 */}
          <section id="s6" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 06</SectionNum>
            <SectionHeading>Influencer Data</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">Instroom is a B2B tool. When you use the platform to manage influencer campaigns, you may input personal information about third-party individuals (influencers), such as their name, social media handles, contact details, engagement metrics, and performance data.</p>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">As the user creating and managing this data, <strong>you act as the data controller</strong> for that information. You are responsible for ensuring you have a lawful basis for collecting and processing influencer personal data, and for complying with applicable data protection laws when using Instroom's features to contact or manage those individuals.</p>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">Instroom acts as a data processor with respect to influencer data stored in your workspace. We process it only to deliver the Service to you.</p>
          </section>

          {/* S7 */}
          <section id="s7" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 07</SectionNum>
            <SectionHeading>Cookies & Tracking Technologies</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We use cookies and similar technologies to operate and improve the Service. These include:</p>
            <ul className="pl-5 mb-3">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Essential cookies</strong> — Required for authentication, session management, and platform security. Cannot be disabled.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Analytics cookies</strong> — Help us understand how users interact with the platform so we can improve it. You may opt out via your browser settings or our cookie preference center.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Preference cookies</strong> — Remember your settings and workspace preferences.</li>
            </ul>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">The Chrome Extension does not inject tracking scripts into third-party websites. It reads publicly visible profile data from Instagram and TikTok pages you browse while signed in and logged into the extension.</p>
          </section>

          {/* S8 */}
          <section id="s8" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 08</SectionNum>
            <SectionHeading>Data Retention</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We retain your personal information for as long as your account is active or as necessary to provide the Service. Specific retention periods:</p>
            <ul className="pl-5 mb-3">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Account data</strong> — Retained for the duration of your subscription, plus 30 days after cancellation to allow for data export requests.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Billing records</strong> — Retained for a minimum of 5 years to comply with Philippine tax and accounting regulations.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Usage logs</strong> — Retained for up to 12 months for security and troubleshooting purposes.</li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5"><strong>Workspace and campaign data</strong> — Deleted within 60 days of account termination unless a longer retention period is required by law.</li>
            </ul>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">You may request deletion of your account and associated personal data at any time by contacting us at privacy@instroom.io.</p>
          </section>

          {/* S9 */}
          <section id="s9" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 09</SectionNum>
            <SectionHeading>Data Security</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, disclosure, alteration, or destruction. These include encrypted data transmission (TLS/HTTPS), hashed passwords, access controls based on the principle of least privilege, and regular security reviews.</p>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">While we take reasonable steps to protect your data, no method of transmission over the internet or electronic storage is 100% secure. We encourage you to use a strong, unique password and to enable any additional security features available in your account settings.</p>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">In the event of a personal data breach that affects your rights and freedoms, we will notify the National Privacy Commission (NPC) and affected users in accordance with the requirements of RA 10173 and its Implementing Rules and Regulations.</p>
          </section>

          {/* S10 */}
          <section id="s10" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 10</SectionNum>
            <SectionHeading>Your Privacy Rights</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">Under the Data Privacy Act of 2012, you have the following rights with respect to your personal information:</p>
            <div className="grid grid-cols-2 gap-3 my-5">
              {[
                { title: "Right to be Informed", desc: "You have the right to know whether your personal data is being collected and processed, and for what purpose." },
                { title: "Right to Access", desc: "You may request a copy of the personal information we hold about you at any time." },
                { title: "Right to Correction", desc: "You may request correction of inaccurate, outdated, or incomplete personal information." },
                { title: "Right to Erasure", desc: "You may request deletion of your personal information, subject to legal retention obligations." },
                { title: "Right to Object", desc: "You may object to the processing of your personal data for purposes other than those consented to or required by law." },
                { title: "Right to Data Portability", desc: "You may request your personal data in a structured, machine-readable format for transfer to another service." },
              ].map(({ title, desc }) => (
                <div key={title} className="bg-white border border-[#d4e8db] rounded-xl p-4">
                  <h4 className="text-[13px] font-semibold text-[#1a4a2e] mb-1.5">{title}</h4>
                  <p className="text-[13px] text-[#5a6b5e] m-0 font-light">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">To exercise any of these rights, contact us at <strong>privacy@instroom.io</strong>. We will respond within 15 business days. You also have the right to file a complaint with the <strong>National Privacy Commission (NPC)</strong> at www.privacy.gov.ph if you believe we have not handled your data lawfully.</p>
          </section>

          {/* S11 */}
          <section id="s11" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 11</SectionNum>
            <SectionHeading>Children's Privacy</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">The Service is not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that a minor has provided us with personal information without parental consent, we will take steps to delete it promptly. If you believe a minor has submitted information to us, please contact privacy@instroom.io.</p>
          </section>

          {/* S12 */}
          <section id="s12" className="mb-[52px] pb-[52px] border-b border-[#d4e8db]">
            <SectionNum>Section 12</SectionNum>
            <SectionHeading>Changes to This Policy</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email or via a prominent notice within the platform, with at least 15 days' notice before the new policy takes effect.</p>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">We encourage you to review this Policy periodically. Continued use of the Service after the effective date of changes constitutes your acceptance of the updated Policy.</p>
          </section>

          {/* S13 */}
          <section id="s13" className="mb-0 pb-0">
            <SectionNum>Section 13</SectionNum>
            <SectionHeading>Contact & Data Protection Officer</SectionHeading>
            <p className="text-[15px] text-[#2e3d34] font-light mb-3">For any questions, concerns, or requests related to this Privacy Policy or your personal data, please contact our Data Protection Officer (DPO):</p>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a] mt-6 mb-2">Armful OPC, trading as Armful Media — Data Protection Officer</h3>
            <ul className="pl-5 mb-3">
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">SEC Registration No.: <strong>2024090169123-01</strong></li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Registered Address: <strong>2/F Armful Media Bldg., Santiago, Naujan, Oriental Mindoro, Philippines 5204</strong></li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Email: <strong>privacy@instroom.io</strong></li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Website: <strong>instroom.io</strong></li>
              <li className="text-[15px] text-[#2e3d34] font-light mb-1.5">Jurisdiction: Republic of the Philippines</li>
            </ul>
            <Callout>
              You also have the right to lodge a complaint with the <strong>National Privacy Commission (NPC)</strong> of the Philippines. Visit www.privacy.gov.ph for more information.
            </Callout>
          </section>

        </main>
      </div>

      {/* Footer */}
      <footer className="bg-[#0d2b1a] px-12 py-9 flex items-center justify-between flex-wrap gap-4">
        <p className="text-[13px] text-white/40 font-light m-0">
          © 2026 Armful OPC, trading as Armful Media (SEC Reg. No. 2024090169123-01). Instroom is a product of Armful OPC. 2/F Armful Media Bldg., Santiago, Naujan, Oriental Mindoro, Philippines 5204. Compliant with RA 10173.
        </p>
        <div className="flex gap-6">
          {[
            { label: "Terms of Service", href: "/terms-of-service" },
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Refund Policy", href: "/refund" },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-[13px] text-white/50 no-underline font-normal hover:text-[#3dbd72] transition-colors duration-150"
            >
              {label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
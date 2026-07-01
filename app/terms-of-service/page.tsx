"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --green-deep: #0d2b1a;
    --green-mid: #1a4a2e;
    --green-brand: #2d7a4f;
    --green-bright: #3dbd72;
    --green-light: #a8e6c1;
    --cream: #F4F7F5;
    --text-main: #1a1a1a;
    --text-muted: #5a6b5e;
    --border: #d4e8db;
    --white: #ffffff;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .tos-body {
    font-family: 'DM Sans', sans-serif;
    background: var(--cream);
    color: var(--text-main);
    font-size: 16px;
    line-height: 1.75;
  }

  .tos-topbar {
    background: var(--green-deep);
    padding: 0 48px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid #1f3d28;
  }
  .tos-logo {
    display: flex; align-items: center; gap: 10px; text-decoration: none; cursor: pointer;
  }
  .tos-logo-icon {
    width: 36px; height: 36px;
    border: 2.5px solid var(--green-bright);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Instrument Serif', serif;
    font-style: italic;
    color: var(--green-bright);
    font-size: 18px;
    font-weight: 400;
  }
  .tos-logo-text {
    font-family: 'DM Sans', sans-serif;
    font-weight: 600; font-size: 18px; color: var(--white); letter-spacing: -0.3px;
  }
  .tos-doc-label {
    font-size: 12px; font-weight: 500; color: var(--green-light);
    letter-spacing: 0.08em; text-transform: uppercase;
    background: rgba(61,189,114,0.12); padding: 4px 12px;
    border-radius: 20px; border: 1px solid rgba(61,189,114,0.25);
  }

  .tos-hero {
    background: var(--green-deep);
    padding: 72px 48px 64px;
    position: relative; overflow: hidden;
  }
  .tos-hero::before {
    content: ''; position: absolute; top: -60px; right: -60px;
    width: 320px; height: 320px; border-radius: 50%;
    border: 1px solid rgba(61,189,114,0.08);
  }
  .tos-hero::after {
    content: ''; position: absolute; top: 20px; right: 40px;
    width: 180px; height: 180px; border-radius: 50%;
    border: 1px solid rgba(61,189,114,0.12);
  }
  .tos-hero-inner { max-width: 760px; position: relative; z-index: 1; }
  .tos-hero-eyebrow {
    font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--green-bright); margin-bottom: 16px;
  }
  .tos-hero h1 {
    font-family: 'Instrument Serif', serif;
    font-size: clamp(36px, 5vw, 54px);
    font-weight: 400; color: var(--white);
    line-height: 1.1; margin-bottom: 20px; letter-spacing: -0.5px;
  }
  .tos-hero h1 em { color: var(--green-bright); font-style: italic; }
  .tos-hero-meta { display: flex; gap: 24px; flex-wrap: wrap; }
  .tos-meta-item { font-size: 13px; color: rgba(255,255,255,0.5); }
  .tos-meta-item strong { color: rgba(255,255,255,0.85); font-weight: 500; }

  .tos-layout {
    max-width: 1100px; margin: 0 auto;
    padding: 60px 48px 80px;
    display: grid; grid-template-columns: 220px 1fr;
    gap: 64px; align-items: start;
  }

  .tos-toc { position: sticky; top: 88px; }
  .tos-toc-title {
    font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--text-muted); margin-bottom: 16px;
  }
  .tos-toc ol { list-style: none; display: flex; flex-direction: column; gap: 2px; padding-left: 0; }
  .tos-toc ol li a {
    display: block; font-size: 13px; font-weight: 400;
    color: var(--text-muted); text-decoration: none;
    padding: 6px 10px; border-radius: 6px;
    border-left: 2px solid transparent; transition: all 0.15s; line-height: 1.4;
  }
  .tos-toc ol li a:hover,
  .tos-toc ol li a.active {
    color: var(--green-brand); background: rgba(45,122,79,0.06);
    border-left-color: var(--green-brand);
  }

  .tos-content section {
    margin-bottom: 52px; padding-bottom: 52px;
    border-bottom: 1px solid var(--border);
    animation: tosFadeUp 0.4s ease both;
  }
  .tos-content section:last-child { border-bottom: none; }
  @keyframes tosFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .tos-section-num {
    font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--green-brand); margin-bottom: 8px;
  }
  .tos-content h2 {
    font-family: 'Instrument Serif', serif;
    font-size: 26px; font-weight: 400; color: var(--green-deep);
    margin-bottom: 16px; line-height: 1.2; letter-spacing: -0.2px;
  }
  .tos-content h3 {
    font-size: 14px; font-weight: 600; color: var(--text-main);
    margin: 24px 0 8px; letter-spacing: 0.01em;
  }
  .tos-content p { font-size: 15px; color: #2e3d34; margin-bottom: 12px; font-weight: 300; }
  .tos-content ul, .tos-content ol { padding-left: 20px; margin-bottom: 12px; }
  .tos-content li { font-size: 15px; color: #2e3d34; margin-bottom: 6px; font-weight: 300; }

  .tos-callout {
    background: #edf7f1; border: 1px solid #b8dfc7;
    border-left: 3px solid var(--green-brand);
    border-radius: 8px; padding: 16px 20px; margin: 20px 0;
  }
  .tos-callout p { margin: 0; font-size: 14px; color: var(--green-mid); font-weight: 400; }

  .tos-highlight-box {
    background: var(--green-deep); border-radius: 12px;
    padding: 24px 28px; margin: 24px 0;
  }
  .tos-highlight-box p { color: rgba(255,255,255,0.8); margin: 0; font-size: 14px; }
  .tos-highlight-box strong { color: var(--green-bright); }

  .tos-footer {
    background: var(--green-deep); padding: 36px 48px;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 16px;
  }
  .tos-footer p { font-size: 13px; color: rgba(255,255,255,0.4); margin: 0; font-weight: 300; }
  .tos-footer-links { display: flex; gap: 24px; }
  .tos-footer-links a {
    font-size: 13px; color: rgba(255,255,255,0.5); text-decoration: none;
    font-weight: 400; transition: color 0.15s;
  }
  .tos-footer-links a:hover { color: var(--green-bright); }

  @media (max-width: 768px) {
    .tos-layout { grid-template-columns: 1fr; padding: 40px 24px; gap: 40px; }
    .tos-toc { display: none; }
    .tos-hero { padding: 48px 24px; }
    .tos-topbar { padding: 0 24px; }
    .tos-footer { padding: 28px 24px; }
  }
`;

const tocItems = [
  { id: "s1",  label: "1. Agreement to Terms" },
  { id: "s2",  label: "2. Description of Services" },
  { id: "s3",  label: "3. Account Registration" },
  { id: "s4",  label: "4. Subscriptions & Billing" },
  { id: "s5",  label: "5. Acceptable Use" },
  { id: "s6",  label: "6. Intellectual Property" },
  { id: "s7",  label: "7. Third-Party Integrations" },
  { id: "s8",  label: "8. Disclaimers & Limitations" },
  { id: "s9",  label: "9. Termination" },
  { id: "s10", label: "10. Governing Law" },
  { id: "s11", label: "11. Changes to These Terms" },
  { id: "s12", label: "12. Contact" },
];

export default function InstroomTermsOfService() {
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
    <div className="tos-body">
      <style>{styles}</style>

      {/* Top Bar */}
      <nav className="tos-topbar">
        <div className="tos-logo">
          <Image src="/images/instroomLogo.png" alt="Instroom Logo" width={36} height={36} className="pp-logo-icon" />
          <span className="tos-logo-text">instroom</span>
        </div>
        <span className="tos-doc-label">Terms of Service</span>
      </nav>

      {/* Hero */}
      <header className="tos-hero">
        <div className="tos-hero-inner">
          <div className="tos-hero-eyebrow">Legal Document</div>
          <h1>Terms of <em>Service</em></h1>
          <div className="tos-hero-meta">
            <span className="tos-meta-item"><strong>Effective:</strong> April 21, 2026</span>
            <span className="tos-meta-item"><strong>Jurisdiction:</strong> Republic of the Philippines</span>
            <span className="tos-meta-item"><strong>Entity:</strong> Armful OPC, trading as Armful Media</span>
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="tos-layout">

        {/* TOC */}
        <aside className="tos-toc">
          <div className="tos-toc-title">Contents</div>
          <ol>
            {tocItems.map(({ id, label }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={activeSection === id ? "active" : ""}
                  onClick={(e) => { e.preventDefault(); scrollTo(id); }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        {/* Main Content */}
        <main className="tos-content">

          <div className="tos-callout">
            <p>Please read these Terms of Service carefully before using Instroom. By creating an account or using any part of our platform, you agree to be bound by these terms. If you do not agree, do not use the Service.</p>
          </div>

          <section id="s1">
            <div className="tos-section-num">Section 01</div>
            <h2>Agreement to Terms</h2>
            <p>These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and Armful OPC, a One Person Corporation registered in the Republic of the Philippines, trading as Armful Media, and the owner and operator of the Instroom platform ("Company," "we," "us," or "our"), governing your access to and use of the Instroom platform, including its website at instroom.io, Chrome Extension, Post Tracker, and all related tools and services (collectively, the "Service").</p>
            <p>By registering for an account, subscribing to a plan, or otherwise using the Service, you represent that you are at least 18 years of age and have the legal capacity to enter into this agreement. If you are using the Service on behalf of a company or organization, you represent that you have authority to bind that entity to these Terms.</p>
          </section>

          <section id="s2">
            <div className="tos-section-num">Section 02</div>
            <h2>Description of Services</h2>
            <p>Instroom is an influencer relationship management (IRM) platform designed for small businesses, solo operators, and agencies. The Service includes the following products, available individually or as part of a subscription:</p>
            <h3>Core Products</h3>
            <ul>
              <li><strong>Chrome Extension</strong> — Captures influencer data while browsing Instagram and TikTok. Available in Free, Pro ($9/mo), and Team ($19/mo) tiers, or as a workspace add-on ($6/workspace/month).</li>
              <li><strong>Post Tracker</strong> — Tracks influencer posts and campaign content, enables watermark-free content downloads, and auto-saves to Google Drive. Available standalone or as a workspace add-on ($12/workspace/month).</li>
              <li><strong>Instroom Platform</strong> — Core CRM for influencer list management, campaign tracking, outreach, deal management, and team collaboration with role-based access control.</li>
            </ul>
            <h3>Optional Add-ons</h3>
            <ul>
              <li>Post Tracker Pro ($12/workspace/month)</li>
              <li>Discovery ($29/workspace/month) — Powered by Instagram and TikTok API plus a curated creator database of 15M+ profiles.</li>
              <li>Shopify Connect ($19/workspace/month)</li>
              <li>Affiliate Tracking ($19/workspace/month)</li>
            </ul>
            <p>We reserve the right to modify, suspend, or discontinue any feature of the Service with reasonable notice.</p>
          </section>

          <section id="s3">
            <div className="tos-section-num">Section 03</div>
            <h2>Account Registration</h2>
            <p>To access the Service, you must create an account and provide accurate, complete, and current information. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.</p>
            <h3>Account Types</h3>
            <ul>
              <li><strong>Solo Account</strong> — Includes 1 owned workspace. Cannot be expanded. Suitable for individual operators and freelancers.</li>
              <li><strong>Team Account</strong> — Includes 3 owned workspaces by default, expandable for an additional fee. Suitable for agencies and in-house teams.</li>
            </ul>
            <h3>Workspace Rules</h3>
            <ul>
              <li>Each workspace has exactly one Admin at all times.</li>
              <li>All roles (Manager, Researcher, Viewer) are free and unlimited.</li>
              <li>Shared workspace access does not count toward your workspace quota.</li>
              <li>Transferring the Admin role does not transfer the billing subscription.</li>
            </ul>
            <p>You agree to notify us immediately of any unauthorized use of your account. We are not liable for any loss resulting from unauthorized account access.</p>
          </section>

          <section id="s4">
            <div className="tos-section-num">Section 04</div>
            <h2>Subscriptions & Billing</h2>
            <p>Instroom uses workspace-based billing. You are billed per workspace you own, not per user or seat. All roles are free and unlimited.</p>
            <h3>Billing Cycle</h3>
            <ul>
              <li><strong>Monthly plans</strong> are billed on a recurring monthly basis.</li>
              <li><strong>Annual plans</strong> are billed annually at a discounted rate (Solo: $15/mo; Team: $39/mo).</li>
              <li>No annual contracts are required on any plan. You may cancel at any time.</li>
            </ul>
            <h3>Add-ons</h3>
            <p>Add-ons are billed per workspace per month. Enabling an add-on across multiple workspaces will be charged at the add-on price multiplied by the number of workspaces using it.</p>
            <h3>Payment</h3>
            <p>All payments are processed in United States Dollars (USD) via our authorized payment processor. By subscribing, you authorize us to charge your designated payment method on a recurring basis.</p>
            <div className="tos-highlight-box">
              <p><strong>Note:</strong> Billing is tied to the account record, not the Admin user. If you transfer the Admin role of a workspace, the billing subscription remains with the original account holder.</p>
            </div>
          </section>

          <section id="s5">
            <div className="tos-section-num">Section 05</div>
            <h2>Acceptable Use</h2>
            <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not:</p>
            <ul>
              <li>Violate any applicable Philippine law, including the Cybercrime Prevention Act of 2012 (RA 10175) and the Data Privacy Act of 2012 (RA 10173).</li>
              <li>Scrape, collect, or harvest data from the platform in a manner that violates the terms of Instagram, TikTok, Shopify, Google, or any other third-party service integrated with Instroom.</li>
              <li>Use the platform to send unsolicited communications or spam.</li>
              <li>Attempt to gain unauthorized access to other users' accounts or workspaces.</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Service.</li>
              <li>Use the Service to store or transmit malicious code or to conduct phishing, fraud, or any deceptive practices.</li>
              <li>Misrepresent your identity or affiliation when using the Service.</li>
            </ul>
            <p>We reserve the right to suspend or terminate accounts that violate these provisions without prior notice.</p>
          </section>

          <section id="s6">
            <div className="tos-section-num">Section 06</div>
            <h2>Intellectual Property</h2>
            <p>All content, features, functionality, branding, and technology comprising the Instroom platform — including but not limited to the software, databases (including the 15M+ curated creator profile database), design elements, trademarks, and documentation — are the exclusive property of Instroom and are protected under applicable intellectual property laws of the Philippines and international treaties.</p>
            <p>You are granted a limited, non-exclusive, non-transferable, revocable license to use the Service solely for your internal business purposes during the term of your subscription. You may not sublicense, resell, or otherwise transfer your access rights.</p>
            <h3>Your Content</h3>
            <p>You retain ownership of any data, content, or materials you upload or input into the Service ("User Content"). By using the Service, you grant Instroom a limited license to host, store, and process your User Content solely to provide and improve the Service. We do not claim ownership of your User Content.</p>
          </section>

          <section id="s7">
            <div className="tos-section-num">Section 07</div>
            <h2>Third-Party Integrations</h2>
            <p>The Service integrates with third-party platforms including Instagram, TikTok, Google Drive, Shopify, and GoAffPro. Your use of these integrations is subject to the respective terms of service and privacy policies of those platforms.</p>
            <p>We are not responsible for the availability, accuracy, or reliability of any third-party service. Platform policy changes (e.g., Instagram or TikTok API restrictions) may affect the functionality of certain features, such as the Discovery add-on, and we do not guarantee uninterrupted access to features dependent on third-party APIs.</p>
          </section>

          <section id="s8">
            <div className="tos-section-num">Section 08</div>
            <h2>Disclaimers & Limitations of Liability</h2>
            <p>The Service is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
            <p>To the maximum extent permitted by applicable law, Instroom shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service, including loss of profits, data, or business opportunities.</p>
            <p>Our total aggregate liability to you for any claim arising out of or related to these Terms or the Service shall not exceed the total amount paid by you to Instroom in the three (3) months preceding the claim.</p>
            <div className="tos-callout">
              <p>Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or any liability that cannot be excluded under Philippine law.</p>
            </div>
          </section>

          <section id="s9">
            <div className="tos-section-num">Section 09</div>
            <h2>Termination</h2>
            <p>You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of your current billing period; you will retain access to the Service until that date.</p>
            <p>We may suspend or terminate your access to the Service immediately, with or without notice, if you violate these Terms or if we determine, in our sole discretion, that your continued use poses a risk to the Service, other users, or third parties.</p>
            <p>Upon termination, your right to use the Service ceases immediately. You may request an export of your User Content within 30 days of termination, after which we may delete your data in accordance with our Privacy Policy.</p>
          </section>

          <section id="s10">
            <div className="tos-section-num">Section 10</div>
            <h2>Governing Law & Dispute Resolution</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines, without regard to its conflict of law principles.</p>
            <p>Any dispute, controversy, or claim arising out of or relating to these Terms or the Service shall first be attempted to be resolved through good-faith negotiation between the parties. If not resolved within thirty (30) days, the dispute shall be submitted to the appropriate courts of the Philippines having jurisdiction over the matter.</p>
          </section>

          <section id="s11">
            <div className="tos-section-num">Section 11</div>
            <h2>Changes to These Terms</h2>
            <p>We may update these Terms from time to time to reflect changes in our practices, technology, or applicable law. When we make material changes, we will notify you via email or a prominent notice within the platform at least 15 days before the changes take effect.</p>
            <p>Your continued use of the Service after the effective date of the revised Terms constitutes your acceptance of the changes. If you do not agree, you must stop using the Service before the effective date.</p>
          </section>

          <section id="s12">
            <div className="tos-section-num">Section 12</div>
            <h2>Contact Us</h2>
            <p>If you have any questions about these Terms of Service, please contact us at:</p>
            <h3>Armful OPC, trading as Armful Media</h3>
            <ul>
              <li>SEC Registration No.: <strong>2024090169123-01</strong></li>
              <li>Registered Address: <strong>2/F Armful Media Bldg., Santiago, Naujan, Oriental Mindoro, Philippines 5204</strong></li>
              <li>Website: <strong>instroom.io</strong></li>
              <li>Email: <strong>legal@instroom.io</strong></li>
              <li>Jurisdiction: Republic of the Philippines</li>
            </ul>
          </section>

        </main>
      </div>

      {/* Footer */}
      <footer className="tos-footer">
        <p>© 2026 Armful OPC, trading as Armful Media (SEC Reg. No. 2024090169123-01). Instroom is a product of Armful OPC. 2/F Armful Media Bldg., Santiago, Naujan, Oriental Mindoro, Philippines 5204. All rights reserved.</p>
        <div className="tos-footer-links">
          <a href="/terms-of-service">Terms of Service</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/refund">Refund Policy</a>
        </div>
      </footer>
    </div>
  );
}
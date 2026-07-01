"use client"

import { useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MainHeader } from "@/components/shared/main-header"

export default function FeaturesPage() {
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) {
      setTimeout(() => {
        const target = document.getElementById(hash)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        // Highlight the matching jump nav link
        document.querySelectorAll('.jumpnav a').forEach(a => {
          a.classList.remove('jumpnav-active')
          if ((a as HTMLAnchorElement).getAttribute('href') === `#${hash}`) {
            a.classList.add('jumpnav-active')
          }
        })
      }, 100)
    }

    // Keep jump nav in sync while scrolling
    const sections = ['pipeline', 'email', 'crm', 'reporting', 'brand-partners']
    const onScroll = () => {
      let current = ''
      sections.forEach(id => {
        const el = document.getElementById(id)
        if (el && window.scrollY >= el.offsetTop - 180) current = id
      })
      document.querySelectorAll('.jumpnav a').forEach(a => {
        a.classList.toggle('jumpnav-active', (a as HTMLAnchorElement).getAttribute('href') === `#${current}`)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="features-page">
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        /* ── Design tokens (hardcoded — no var() to avoid scoping issues) ── */

        .features-page {
          background: white;
          color: #1E1E1E;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        /* ── Container ── */
        .container {
          max-width: 1140px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* ── Page Hero ── */
        .page-hero {
          padding: 96px 0 72px;
          text-align: center;
          background: #F4F7F5;
          background-image: radial-gradient(circle, rgba(31,174,91,0.12) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .eyebrow {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #1FAE5B;
          margin-bottom: 16px;
          display: block;
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
          margin: 0 auto;
          font-size: 1.125rem;
          color: #52525b;
          line-height: 1.65;
        }

        /* ── Jump nav ── */
        .jumpnav {
          position: sticky;
          top: 65px;
          z-index: 50;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid rgba(30,30,30,0.09);
          padding: 0;
        }

        .jumpnav-inner {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 4px;
          max-width: 1140px;
          margin: 0 auto;
          padding: 0 24px;
          overflow-x: auto;
        }

        .jumpnav a {
          color: #52525b;
          font-size: 0.875rem;
          font-weight: 500;
          text-decoration: none;
          padding: 14px 16px;
          border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }

        .jumpnav a:hover {
          color: #1FAE5B;
          border-bottom-color: #1FAE5B;
        }

        .jumpnav-active {
          color: #1FAE5B !important;
          border-bottom-color: #1FAE5B !important;
        }

        /* ── Feature sections — alternating backgrounds ── */

        /* Odd features (1, 3, 5): white bg */
        .feat-odd {
          padding: 96px 0;
          scroll-margin-top: 140px;
          background: #ffffff;
          border-bottom: 1px solid rgba(30,30,30,0.07);
        }

        /* Even features (2, 4): light green-tinted bg */
        .feat-even {
          padding: 96px 0;
          scroll-margin-top: 140px;
          background: #F4F7F5;
          border-bottom: 1px solid rgba(30,30,30,0.07);
        }

        .feat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 72px;
          align-items: center;
        }

        /* Reversed layout for even features */
        .feat-grid.reversed {
          direction: rtl;
        }

        .feat-grid.reversed > * {
          direction: ltr;
        }

        /* Feature label (e.g. "Feature 01 — Pipeline") */
        .feat-label {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: #1FAE5B;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .feat-label-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(31,174,91,0.12);
          color: #0F6B3E;
          font-size: 0.625rem;
          font-weight: 800;
          flex-shrink: 0;
        }

        .feat-text h2 {
          font-family: 'Manrope', sans-serif;
          font-size: clamp(1.625rem, 3vw, 2.125rem);
          font-weight: 700;
          line-height: 1.2;
          color: #1E1E1E;
          margin-bottom: 16px;
        }

        .feat-lead {
          font-size: 1.0625rem;
          color: #3f3f46;
          line-height: 1.68;
          margin-bottom: 28px;
          font-weight: 500;
        }

        .feat-body p {
          color: #52525b;
          margin-bottom: 16px;
          line-height: 1.72;
          font-size: 0.9375rem;
        }

        .feat-bullets {
          list-style: none;
          padding: 0;
          margin: 20px 0 0;
        }

        .feat-bullets li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 10px;
          color: #3f3f46;
          font-size: 0.9375rem;
          line-height: 1.55;
        }

        .feat-bullets li::before {
          content: "✓";
          color: #1FAE5B;
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* ── Feature visual placeholder ── */
        .feat-visual {
          border-radius: 20px;
          aspect-ratio: 4 / 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 32px;
          overflow: hidden;
          position: relative;
        }

        /* Odd sections: subtle green gradient visual */
        .feat-visual-light {
          background: linear-gradient(135deg, #EDF5F0 0%, #D4EDDF 100%);
          border: 1px solid rgba(31,174,91,0.15);
          box-shadow: 0 8px 40px rgba(15,107,62,0.07);
        }

        /* Even sections: crisp white visual */
        .feat-visual-white {
          background: linear-gradient(135deg, #ffffff 0%, #F4F7F5 100%);
          border: 1px solid rgba(30,30,30,0.09);
          box-shadow: 0 8px 40px rgba(0,0,0,0.05);
        }

        .feat-visual-icon {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          background: #1FAE5B;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          box-shadow: 0 8px 20px rgba(31,174,91,0.3);
        }

        .feat-visual-label {
          font-size: 0.8125rem;
          color: #71717a;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: 8px;
        }

        /* ── Final CTA ── */
        .final-cta {
          background: #1E1E1E;
          color: white;
          text-align: center;
          padding: 96px 0;
          position: relative;
          overflow: hidden;
        }

        .final-cta::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 60% at 50% 50%, rgba(31,174,91,0.12) 0%, transparent 70%);
          pointer-events: none;
        }

        .final-cta-inner {
          position: relative;
          z-index: 1;
        }

        .final-cta h2 {
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
          font-size: clamp(2rem, 4vw, 2.875rem);
          color: white;
          max-width: 640px;
          margin: 0 auto 16px;
          line-height: 1.2;
        }

        .final-cta-lead {
          font-size: 1.0625rem;
          color: rgba(255,255,255,0.75);
          margin-bottom: 36px;
        }

        .final-cta-ctas {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .final-cta-sub {
          margin-top: 20px;
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.5);
        }

        /* ── Footer — matches landing page exactly ── */
        .footer {
          background: #111;
          color: rgba(255,255,255,0.65);
          padding: 56px 0 32px;
          font-size: 0.875rem;
        }

        .footer-inner {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 40px;
          margin-bottom: 40px;
          max-width: 1140px;
          margin-left: auto;
          margin-right: auto;
          padding: 0 24px;
        }

        .footer h4 {
          color: white;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 16px;
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
        }

        .footer ul {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .footer li { margin-bottom: 10px; }

        .footer a {
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          transition: color 0.15s;
        }

        .footer a:hover { color: white; }

        .footer-brand-desc {
          color: rgba(255,255,255,0.55);
          max-width: 260px;
          font-size: 0.875rem;
          line-height: 1.65;
          margin-top: 12px;
        }

        .footer-bottom {
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          justify-content: space-between;
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.4);
          flex-wrap: wrap;
          gap: 12px;
          max-width: 1140px;
          margin: 0 auto;
          padding: 24px 24px 0;
        }

        .footer-legal {
          display: flex;
          gap: 24px;
        }

        .footer-legal a {
          color: rgba(255,255,255,0.5);
          text-decoration: none;
        }

        .footer-legal a:hover { color: white; }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .feat-grid,
          .feat-grid.reversed {
            grid-template-columns: 1fr;
            gap: 40px;
            direction: ltr;
          }

          .footer-inner {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px) {
          .footer-inner { grid-template-columns: 1fr; }
          .page-hero { padding: 64px 0 48px; }
        }
      `}</style>

      {/* NAV */}
      <MainHeader />

      {/* PAGE HERO */}
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">What's Inside</p>
          <h1>Five tools that replace the stack.</h1>
          <p className="lead">Pipeline management, embedded email, creator CRM, reporting, and Brand Partners. One workspace, built for how you actually run campaigns.</p>
        </div>
      </section>

      {/* JUMP NAV */}
      <div className="jumpnav">
        <div className="jumpnav-inner">
          <a href="#pipeline">Pipeline</a>
          <a href="#email">Email</a>
          <a href="#crm">Creator CRM</a>
          <a href="#reporting">Reporting</a>
          <a href="#brand-partners">Brand Partners</a>
        </div>
      </div>

      {/* FEATURE 1: PIPELINE — white bg, visual on right */}
      <section className="feat-odd" id="pipeline">
        <div className="container">
          <div className="feat-grid">
            <div className="feat-text">
              <p className="feat-label">
                <span className="feat-label-num">01</span>
                Pipeline Management
              </p>
              <h2>Work the way you want. List, board, or both.</h2>
              <p className="feat-lead">The same data in two views. See everything at a glance in a Kanban board, or scan fast in a spreadsheet view. Switch between them in a single click.</p>
              <div className="feat-body">
                <p>Every campaign comes with pre-built pipeline stages: prospect, reached out, negotiating, confirmed, posted, paid. Customize them or use them as-is. No more setting up a new tracker for every campaign.</p>
                <p>The list view feels exactly like the spreadsheet you already love, because it works. The board view gives you the visual read on where things stand. Same data, same updates, two perspectives.</p>
                <ul className="feat-bullets">
                  <li>Pre-built pipeline stages per campaign type</li>
                  <li>Switch between List and Kanban with one click</li>
                  <li>Drag and drop creators between stages</li>
                  <li>Custom fields for deliverables, fees, deadlines</li>
                  <li>Bulk actions: update, assign, or move in one move</li>
                </ul>
              </div>
            </div>
            <div className="feat-visual feat-visual-light">
              <div className="feat-visual-icon">📊</div>
              <p className="feat-visual-label">Pipeline Preview</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 2: EMAIL — tinted bg, visual on left */}
      <section className="feat-even" id="email">
        <div className="container">
          <div className="feat-grid reversed">
            <div className="feat-text">
              <p className="feat-label">
                <span className="feat-label-num">02</span>
                Embedded Email
              </p>
              <h2>Reach out, reply, and track without leaving Instroom.</h2>
              <p className="feat-lead">Your inbox lives inside the workspace. Every email is auto-tagged to the right campaign and pipeline stage, so context never gets lost.</p>
              <div className="feat-body">
                <p>When a creator responds at 11pm and your teammate picks it up at 9am, they have the full thread, the campaign, and the creator's history already loaded. No forwarding. No "wait, which one is this?" No copy-pasting into a spreadsheet after the fact.</p>
                <p>Replies update the pipeline stage automatically. Follow-up reminders live alongside the conversation. Email templates pull creator details so every outreach feels personal without writing every word.</p>
                <ul className="feat-bullets">
                  <li>Connect Gmail or Outlook in one click</li>
                  <li>Every email auto-tagged to campaign and stage</li>
                  <li>Personalized templates with creator variables</li>
                  <li>Follow-up reminders tied to the conversation</li>
                  <li>Full thread history visible on every creator profile</li>
                </ul>
              </div>
            </div>
            <div className="feat-visual feat-visual-white">
              <div className="feat-visual-icon">✉️</div>
              <p className="feat-visual-label">Email Interface</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 3: CREATOR CRM — white bg, visual on right */}
      <section className="feat-odd" id="crm">
        <div className="container">
          <div className="feat-grid">
            <div className="feat-text">
              <p className="feat-label">
                <span className="feat-label-num">03</span>
                Creator CRM
              </p>
              <h2>Profiles that remember everything.</h2>
              <p className="feat-lead">Every campaign, every post, every payment, every conversation. When you come back to a creator six months later, the full history is waiting.</p>
              <div className="feat-body">
                <p>Stop rebuilding context every time you reach out. A creator's profile shows you what you've done together, what worked, and what's next. The conversation from March, the product gifting in June, the post that drove 40 sales in September — all in one place.</p>
                <p>Tags, notes, custom fields, and a shared team view mean your whole team sees the same creator the same way. No more "wait, who was handling this relationship?"</p>
                <ul className="feat-bullets">
                  <li>Full campaign and content history per creator</li>
                  <li>Payment and deal history attached to the profile</li>
                  <li>Tags, custom fields, and internal notes</li>
                  <li>Shared across your team with role-based access</li>
                  <li>Quick search across your entire creator database</li>
                </ul>
              </div>
            </div>
            <div className="feat-visual feat-visual-light">
              <div className="feat-visual-icon">👥</div>
              <p className="feat-visual-label">Creator Database</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 4: REPORTING — tinted bg, visual on left */}
      <section className="feat-even" id="reporting">
        <div className="container">
          <div className="feat-grid reversed">
            <div className="feat-text">
              <p className="feat-label">
                <span className="feat-label-num">04</span>
                Reporting &amp; Analytics
              </p>
              <h2>Client-ready reports, one click away.</h2>
              <p className="feat-lead">Stop building reports the night before a client call. Pull performance by creator, by campaign, or by deliverable. Export clean PDFs or share a live link.</p>
              <div className="feat-body">
                <p>The data was already in Instroom. Now it's presentable. Campaign summaries, creator performance breakdowns, spend vs. return, content posted, and engagement metrics — all in a format a client can actually read.</p>
                <p>Share a live link that updates as the campaign progresses, or export a final PDF when everything's wrapped. Either way, you stop screenshotting and copy-pasting.</p>
                <ul className="feat-bullets">
                  <li>One-click campaign summary reports</li>
                  <li>Per-creator performance breakdowns</li>
                  <li>Live-updating shareable links</li>
                  <li>Clean PDF exports for final deliverables</li>
                  <li>Custom date ranges and filters</li>
                </ul>
              </div>
            </div>
            <div className="feat-visual feat-visual-white">
              <div className="feat-visual-icon">📈</div>
              <p className="feat-visual-label">Analytics Dashboard</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 5: BRAND PARTNERS — white bg, visual on right */}
      <section className="feat-odd" id="brand-partners">
        <div className="container">
          <div className="feat-grid">
            <div className="feat-text">
              <p className="feat-label">
                <span className="feat-label-num">05</span>
                Brand Partners
              </p>
              <h2>Creators worth more than a campaign.</h2>
              <p className="feat-lead">Some creators keep delivering, campaign after campaign. Brand Partners gives those relationships structure: tiered status, retainer tracking, and full performance history.</p>
              <div className="feat-body">
                <p>Set your revenue thresholds. Instroom assigns Bronze, Silver, and Gold tiers automatically as creators hit milestones. No manual updating, no missed promotions — just a tier list that reflects reality.</p>
                <p>When the budget conversation comes up, the answer is already in the data. You know exactly who's making you money, who's consistent, and who deserves a retainer. The best influencer programs aren't built on campaigns. They're built on relationships.</p>
                <ul className="feat-bullets">
                  <li>Client workspace access</li>
                  <li>Permission levels</li>
                  <li>Real-time updates</li>
                  <li>White-labeling ready</li>
                </ul>
              </div>
            </div>
            <div className="feat-visual feat-visual-light">
              <div className="feat-visual-icon">🤝</div>
              <p className="feat-visual-label">Brand Portal</p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta">
        <div className="container final-cta-inner">
          <h2>See it for yourself.</h2>
          <p className="final-cta-lead">30 days free. Full platform access. No credit card.</p>
          <div className="final-cta-ctas">
            <Link href="/signup">
              <Button className="bg-gradient-to-r from-[#1FAE5B] to-[#28c96a] text-white font-semibold h-12 px-8 rounded-xl hover:from-[#158a48] hover:to-[#1FAE5B] shadow-lg shadow-emerald-500/30">
                Start Free Trial
              </Button>
            </Link>
          </div>
          <p className="final-cta-sub">No annual contracts · Cancel anytime</p>
        </div>
      </section>

      {/* FOOTER — matches landing page */}
      <footer className="footer">
        <div className="footer-inner">
          <div>
            <Image
              src="/images/instroomLogoWhite.png"
              alt="Instroom logo"
              width={120}
              height={120}
              style={{ marginBottom: "4px" }}
            />
            <p className="footer-brand-desc">
              The influencer marketing workspace for eCommerce brands and agencies.
            </p>
          </div>
          <div>
            <h4>Products</h4>
            <ul>
              <li><a href="/features">Instroom Platform</a></li>
              <li><a href="#">Chrome Extension</a></li>
              <li><a href="#">Post Tracker</a></li>
              <li><a href="/features">Features</a></li>
              <li><a href="/pricing">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4>Resources</h4>
            <ul>
              <li><a href="#">Blog</a></li>
              <li><a href="#">FAQ's</a></li>
              <li><a href="#">Demo</a></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><a href="/about">About</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Instroom. All rights reserved.</p>
          <div className="footer-legal">
            <Link href="/terms-of-service" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Terms of Service</Link>
            <Link href="/privacy" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Privacy Policy</Link>
            <Link href="/refund" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
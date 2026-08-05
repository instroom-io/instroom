import { MainHeader } from "@/components/shared/main-header";
import { MainFooter } from "@/components/shared/main-footer";
import { PricingFinalCTA } from "@/components/pricing-page/final-cta";

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" width="11" height="11">
      <path d="M5 13l4 4L19 7" stroke="#1FAE5B" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ANCHOR_LINKS = [
  { id: "pipeline", label: "Pipeline" },
  { id: "email", label: "Email" },
  { id: "crm", label: "Creator CRM" },
  { id: "reporting", label: "Reporting" },
  { id: "brand-partners", label: "Brand Partners" },
];

export default function FeaturesPage() {
  return (
    <div className="whats-inside-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap');

        .whats-inside-page {
          background: #fff;
          color: #1E1E1E;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .container {
          max-width: 1140px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* ── Hero ── */
        .wi-hero {
          text-align: center;
          padding: 56px 0 48px;
          background: #F4F7F5;
          background-image: radial-gradient(circle, rgba(31,174,91,0.12) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .wi-eyebrow {
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

        .wi-eyebrow-dot {
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

        .wi-hero h1 {
          font-family: 'Manrope', sans-serif;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
          color: #0F6B3E;
          font-size: clamp(2.375rem, 6vw, 3.625rem);
          margin: 0 auto 20px;
          max-width: 16ch;
        }

        .wi-hero h1 .accent {
          color: #1FAE5B;
        }

        .wi-hero p {
          max-width: 620px;
          margin: 0 auto 26px;
          color: #4B4B4B;
          font-size: 1.125rem;
        }

        .anchor-nav {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .anchor-nav a {
          font-size: 0.875rem;
          font-weight: 600;
          color: #0F6B3E;
          background: #fff;
          border: 1px solid #E4E7E5;
          padding: 8px 16px;
          border-radius: 9999px;
          box-shadow: 0 1px 2px rgba(15,107,62,.04), 0 10px 30px rgba(15,107,62,.07);
          text-decoration: none;
        }

        .anchor-nav a:hover {
          border-color: #1FAE5B;
          color: #178C49;
        }

        /* ── Tool sections ── */
        .tool {
          padding: 64px 0;
          scroll-margin-top: 84px;
        }

        .tool-inner {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 44px;
          align-items: center;
        }

        @media (max-width: 860px) {
          .tool-inner { grid-template-columns: 1fr; gap: 28px; }
        }

        .tool.rev {
          background: #F4F7F5;
        }

        .tool.rev .tool-text {
          order: 2;
        }

        @media (max-width: 860px) {
          .tool.rev .tool-text { order: 0; }
        }

        .tool-num {
          font-family: 'Manrope', sans-serif;
          font-size: 0.8125rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #1FAE5B;
          text-transform: uppercase;
        }

        .tool-text h2 {
          font-family: 'Manrope', sans-serif;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
          color: #0F6B3E;
          font-size: clamp(1.5rem, 3.2vw, 2rem);
          margin: 8px 0 14px;
        }

        .tool-text p {
          color: #4B4B4B;
          margin: 0 0 14px;
          font-size: 0.96875rem;
        }

        .checks {
          list-style: none;
          padding: 0;
          margin: 18px 0 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .checks li {
          display: flex;
          gap: 10px;
          font-size: 0.90625rem;
          color: #4B4B4B;
        }

        .checks li .c {
          flex: 0 0 18px;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #EAF7F0;
          display: grid;
          place-items: center;
          margin-top: 2px;
        }

        .caveat {
          margin-top: 16px;
          font-size: 0.84375rem;
          color: #7C7C7C;
          border-left: 3px solid #D2D6D3;
          padding-left: 12px;
        }

        /* ── Preview panels ── */
        .prev {
          background: #fff;
          border: 1px solid #E4E7E5;
          border-radius: 18px;
          box-shadow: 0 20px 50px rgba(15,107,62,.10);
          padding: 16px;
        }

        .prev-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 4px 12px;
          border-bottom: 1px solid #E4E7E5;
          margin-bottom: 12px;
        }

        .prev-bar .dot {
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          background: #D2D6D3;
        }

        .prev-bar span {
          margin-left: auto;
          font-size: 0.75rem;
          color: #7C7C7C;
          font-weight: 600;
        }

        .kb {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .kb-col {
          background: #F7F9F8;
          border-radius: 10px;
          padding: 8px;
        }

        .kb-col h5 {
          margin: 0 0 8px;
          font-size: 0.6875rem;
          font-weight: 700;
          color: #7C7C7C;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .chip {
          background: #fff;
          border: 1px solid #E4E7E5;
          border-radius: 8px;
          padding: 7px 8px;
          margin-bottom: 6px;
          font-size: 0.75rem;
        }

        .chip b {
          display: block;
          color: #1E1E1E;
          font-size: 0.75rem;
        }

        .chip span {
          color: #7C7C7C;
          font-size: 0.6875rem;
        }

        .prow {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 6px;
          border-bottom: 1px solid #E4E7E5;
        }

        .prow:last-child {
          border-bottom: 0;
        }

        .av {
          width: 30px;
          height: 30px;
          border-radius: 9999px;
          background: #0F6B3E;
          color: #fff;
          display: grid;
          place-items: center;
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
          font-size: 0.75rem;
          flex: 0 0 30px;
        }

        .prow .rmain {
          flex: 1;
          min-width: 0;
        }

        .prow .rmain b {
          font-size: 0.8125rem;
          color: #1E1E1E;
        }

        .prow .rmain span {
          display: block;
          font-size: 0.71875rem;
          color: #7C7C7C;
        }

        .pill {
          font-size: 0.65625rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
          background: #EAF7F0;
          color: #178C49;
          white-space: nowrap;
        }

        .pill.blue {
          background: rgba(44,142,196,.12);
          color: #2C8EC4;
        }

        .pill.bronze {
          background: #F3E8DD;
          color: #8a6d3b;
        }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .stat {
          background: #F7F9F8;
          border-radius: 10px;
          padding: 10px 12px;
        }

        .stat b {
          font-family: 'Manrope', sans-serif;
          font-size: 1.375rem;
          color: #1E1E1E;
          display: block;
        }

        .stat span {
          font-size: 0.6875rem;
          color: #7C7C7C;
        }

        .bars {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bar {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.71875rem;
          color: #7C7C7C;
        }

        .bar .label {
          width: 64px;
          flex-shrink: 0;
        }

        .bar .track {
          flex: 1;
          height: 8px;
          border-radius: 9999px;
          background: #F7F9F8;
          overflow: hidden;
        }

        .bar .fill {
          height: 100%;
          background: #1FAE5B;
          border-radius: 9999px;
        }

        .medal {
          font-size: 0.875rem;
        }
      `}</style>

      {/* NAV */}
      <MainHeader />

      {/* HERO */}
      <section className="wi-hero">
        <div className="container">
          <span className="wi-eyebrow">
            <span className="wi-eyebrow-dot" />
            What&apos;s Inside
          </span>
          <h1>Five tools that <span className="accent">replace the stack</span>.</h1>
          <p>
            Pipeline management, an embedded inbox, a creator CRM, client-ready reporting, and Brand Partners —
            one workspace, built for how you actually run campaigns.
          </p>
          <div className="anchor-nav">
            {ANCHOR_LINKS.map((link) => (
              <a key={link.id} href={`#${link.id}`}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 01 PIPELINE */}
      <section className="tool" id="pipeline">
        <div className="container">
        <div className="tool-inner">
          <div className="tool-text">
            <span className="tool-num">01 · Pipeline Management</span>
            <h2>Work the way you want. List, board, or both.</h2>
            <p>
              The same data in two views. See everything at a glance in a Kanban board, or scan fast in a
              spreadsheet-style list — and switch between them in a single click.
            </p>
            <p>
              Every campaign comes with pre-built stages: prospect, reached out, negotiating, confirmed, posted,
              paid. Customize them or use them as-is. No more setting up a new tracker for every campaign.
            </p>
            <ul className="checks">
              {[
                "Pre-built pipeline stages per campaign type",
                "Switch between List and Kanban in one click",
                "Drag and drop creators between stages",
                "Custom fields for deliverables, fees, and deadlines",
                "Bulk actions: update, assign, or move in one move",
              ].map((item) => (
                <li key={item}>
                  <span className="c"><Check /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="tool-preview">
            <div className="prev">
              <div className="prev-bar">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span>Board view</span>
              </div>
              <div className="kb">
                <div className="kb-col">
                  <h5>Reached out</h5>
                  <div className="chip"><b>Alex Rivera</b><span>IG · 1.0K · 0.4%</span></div>
                  <div className="chip"><b>Taylor Brooks</b><span>IG · 2.1K · 1.0%</span></div>
                </div>
                <div className="kb-col">
                  <h5>Negotiating</h5>
                  <div className="chip"><b>Devon Cruz</b><span>IG · 3.2K · 1.8%</span></div>
                </div>
                <div className="kb-col">
                  <h5>Confirmed</h5>
                  <div className="chip"><b>Jordan Lee</b><span>IG · 1.8K · 2.7%</span></div>
                  <div className="chip"><b>Sharon Wells</b><span>IG · 3.0K · 1.1%</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* 02 EMAIL */}
      <section className="tool rev" id="email">
        <div className="container">
        <div className="tool-inner">
          <div className="tool-preview">
            <div className="prev">
              <div className="prev-bar">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span>Inbox · Gmail</span>
              </div>
              <div className="prow">
                <span className="av">AR</span>
                <div className="rmain"><b>Alex Rivera</b><span>Loved the brief — sending drafts Friday</span></div>
                <span className="pill">Negotiating</span>
              </div>
              <div className="prow">
                <span className="av">TB</span>
                <div className="rmain"><b>Taylor Brooks</b><span>Following up on the collab rate</span></div>
                <span className="pill blue">Reached out</span>
              </div>
              <div className="prow">
                <span className="av">DC</span>
                <div className="rmain"><b>Devon Cruz</b><span>Can we push the posting date?</span></div>
                <span className="pill">In conversation</span>
              </div>
            </div>
          </div>
          <div className="tool-text">
            <span className="tool-num">02 · Embedded Email</span>
            <h2>Reach out, reply, and track without leaving Instroom.</h2>
            <p>
              Your inbox lives inside the workspace. Every email is auto-tagged to the right campaign and
              pipeline stage, so context never gets lost — and replies move the stage forward automatically.
            </p>
            <p>
              When a creator responds at 11pm and a teammate picks it up at 9am, they have the full thread, the
              campaign, and the creator&apos;s history already loaded. No forwarding, no copy-pasting.
            </p>
            <ul className="checks">
              {[
                "Connect Gmail or Outlook in one click",
                "Every email auto-tagged to campaign and stage",
                "Personalized templates with creator variables",
                "Follow-up reminders tied to the conversation",
                "Off-email chats (like IG DMs) still tracked in the pipeline",
              ].map((item) => (
                <li key={item}>
                  <span className="c"><Check /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        </div>
      </section>

      {/* 03 CREATOR CRM */}
      <section className="tool" id="crm">
        <div className="container">
        <div className="tool-inner">
          <div className="tool-text">
            <span className="tool-num">03 · Creator CRM</span>
            <h2>Profiles that remember everything.</h2>
            <p>
              Every campaign, post, payment, and conversation in one place. Come back to a creator six months
              later and the full history is waiting — no rebuilding context every time.
            </p>
            <p>
              Add a creator and their profile auto-fills with engagement rate, follower count, email, and
              location, so you&apos;re not hunting for it by hand. Tags, notes, and custom fields keep your whole
              team seeing the same creator the same way.
            </p>
            <ul className="checks">
              {[
                "Auto-enriched profiles: engagement, followers, email & location",
                "Full campaign, content, and payment history per creator",
                "Tags, custom fields, and internal notes",
                "Shared across your team with role-based access",
                "Quick search across your entire creator database",
              ].map((item) => (
                <li key={item}>
                  <span className="c"><Check /></span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="caveat">
              A creator&apos;s email and location appear only when they&apos;re publicly available on the
              profile — some creators won&apos;t have them listed, and those fields may come up empty.
            </p>
          </div>
          <div className="tool-preview">
            <div className="prev">
              <div className="prev-bar">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span>Creator profile</span>
              </div>
              <div className="prow">
                <span className="av">SW</span>
                <div className="rmain"><b>Sharon Wells</b><span>@liefssharon · Instagram · 128K followers</span></div>
                <span className="pill">Approved</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 2px 10px", fontSize: 11.5, color: "#7C7C7C" }}>
                <span style={{ color: "#178C49", fontWeight: 700, borderBottom: "2px solid #1FAE5B", paddingBottom: 2 }}>Basic</span>
                <span>Order</span>
                <span>Attribution</span>
                <span>Post</span>
                <span>Stats</span>
                <span>History</span>
              </div>
              <div className="chip"><b>Sep · Post approved</b><span>Drove 40 sales</span></div>
              <div className="chip"><b>Jun · Product gifting</b><span>Status: negotiating → agreed</span></div>
              <div className="chip"><b>Mar · Note added</b><span>Prefers reels over static</span></div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* 04 REPORTING */}
      <section className="tool rev" id="reporting">
        <div className="container">
        <div className="tool-inner">
          <div className="tool-preview">
            <div className="prev">
              <div className="prev-bar">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span>Campaign summary</span>
              </div>
              <div className="stat-grid">
                <div className="stat"><b>248</b><span>Total outreach</span></div>
                <div className="stat"><b>61%</b><span>Response rate</span></div>
                <div className="stat"><b>86</b><span>Closed deals</span></div>
              </div>
              <div className="bars">
                <div className="bar"><span className="label">Reached out</span><div className="track"><div className="fill" style={{ width: "100%" }} /></div>248</div>
                <div className="bar"><span className="label">Responded</span><div className="track"><div className="fill" style={{ width: "61%" }} /></div>151</div>
                <div className="bar"><span className="label">Closed</span><div className="track"><div className="fill" style={{ width: "35%" }} /></div>86</div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <span className="pill">Shopify · $18.4K revenue</span>
                <span className="pill blue">GoAffPro · 3.1% CVR</span>
              </div>
            </div>
          </div>
          <div className="tool-text">
            <span className="tool-num">04 · Reporting &amp; Analytics</span>
            <h2>Client-ready reports, one click away.</h2>
            <p>
              Stop building reports the night before a client call. Pull performance by creator, campaign, or
              deliverable, then export a clean PDF or share a live link that updates as the campaign runs.
            </p>
            <p>
              Connect <strong>Shopify</strong> and <strong>GoAffPro</strong> and Instroom pulls sales, revenue,
              and conversion rate straight into your reports — and tracks product shipments automatically as
              orders move from placed to in-transit to delivered.
            </p>
            <ul className="checks">
              {[
                "One-click campaign summaries and per-creator breakdowns",
                "Shopify integration: sales, revenue & conversion rate",
                "Automatic product-shipment tracking",
                "GoAffPro affiliate sales and payout attribution",
                "Live-updating links, PDF exports, and custom date ranges",
              ].map((item) => (
                <li key={item}>
                  <span className="c"><Check /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        </div>
      </section>

      {/* 05 BRAND PARTNERS */}
      <section className="tool" id="brand-partners" style={{ paddingBottom: 78 }}>
        <div className="container">
        <div className="tool-inner">
          <div className="tool-text">
            <span className="tool-num">05 · Brand Partners</span>
            <h2>Creators worth more than a campaign.</h2>
            <p>
              Some creators keep delivering, campaign after campaign. Brand Partners gives those relationships
              structure: tiered status, retainer tracking, and full performance history.
            </p>
            <p>
              Set your revenue thresholds and Instroom assigns Bronze, Silver, and Gold tiers automatically as
              creators hit milestones. When the budget conversation comes up, the answer is already in the
              data — you know exactly who&apos;s making you money and who deserves a retainer.
            </p>
            <ul className="checks">
              {[
                "Automatic Bronze / Silver / Gold tiers by revenue",
                "Retainer tracking per partner",
                "Full performance history in one view",
                "Community status: Invited, Joined, Pending",
              ].map((item) => (
                <li key={item}>
                  <span className="c"><Check /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="tool-preview">
            <div className="prev">
              <div className="prev-bar">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span>Brand Partners · 18 total · 4 Gold</span>
              </div>
              <div className="prow">
                <span className="av">SW</span>
                <div className="rmain"><b>Sharon Wells</b><span>Retainer $1,200/mo</span></div>
                <span className="pill"><span className="medal">🥇</span> Gold · $18.4K</span>
              </div>
              <div className="prow">
                <span className="av">JL</span>
                <div className="rmain"><b>Jordan Lee</b><span>Retainer $600/mo</span></div>
                <span className="pill blue"><span className="medal">🥈</span> Silver · $6.2K</span>
              </div>
              <div className="prow">
                <span className="av">AR</span>
                <div className="rmain"><b>Alex Rivera</b><span>Retainer —</span></div>
                <span className="pill bronze"><span className="medal">🥉</span> Bronze · $2.1K</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <PricingFinalCTA />

      <MainFooter />
    </div>
  );
}

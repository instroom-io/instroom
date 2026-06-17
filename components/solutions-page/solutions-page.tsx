"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

type PageId = "hub" | "freelancer" | "agency" | "dtc"

// ─── Shared styles ────────────────────────────────────────────────────────────

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Manrope:wght@400;600;700;800;900&display=swap');

  :root {
    --green: #1FAE5B;
    --green-dark: #178a47;
    --green-light: #f0faf5;
    --green-mid: #d6f0e3;
    --ink: #1E1E1E;
    --ink2: #444;
    --ink3: #888;
    --border: rgba(0,0,0,0.09);
    --white: #fff;
    --bg: #f7f9f8;
    --radius: 12px;
  }

  /* Hub cards */
  .hub-card { background: var(--bg); border: 0.5px solid var(--border); border-radius: 16px; padding: 28px; cursor: pointer; text-decoration: none; transition: all 0.2s; position: relative; overflow: hidden; display: block; }
  .hub-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, var(--green-light), transparent 60%); opacity: 0; transition: opacity 0.2s; }
  .hub-card:hover { border-color: var(--green); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(31,174,91,0.12); }
  .hub-card:hover::before { opacity: 1; }
  .hub-card:hover .hub-card-arrow { opacity: 1; }
  .hub-card:hover .hub-card-photo-wrap img { transform: scale(1.04); }

  .hub-card-photo-wrap { position: relative; z-index: 1; border-radius: 10px; overflow: hidden; margin-bottom: 20px; height: 160px; }
  .hub-card-photo-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
  .hub-card-photo-wrap::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.25)); }

  .hub-card-title { font-size: 17px; font-weight: 700; color: var(--ink); margin-bottom: 6px; position: relative; z-index: 1; }
  .hub-card-desc { font-size: 13px; color: var(--ink2); line-height: 1.5; position: relative; z-index: 1; }
  .hub-card-arrow { font-size: 13px; color: var(--green); margin-top: 14px; display: flex; align-items: center; gap: 4px; font-weight: 600; position: relative; z-index: 1; opacity: 0; transition: opacity 0.2s; }

  /* Pain photo banner */
  .pain-photo-banner { width: 100%; height: 260px; border-radius: 16px; margin-bottom: 40px; position: relative; overflow: hidden; }
  .pain-photo-banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pain-photo-banner::after { content: ''; position: absolute; inset: 0; border-radius: 16px; background: linear-gradient(to right, rgba(31,174,91,0.08), transparent); }

  /* Help rows */
  .help-row { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; padding: 52px 0; border-bottom: 0.5px solid var(--border); }
  .help-row:last-child { border-bottom: none; }
  .help-row.reverse .help-text { order: 2; }
  .help-row.reverse .help-visual { order: 1; }

  /* Bullet check SVG */
  .help-bullet-dot { width: 18px; height: 18px; border-radius: 6px; background: var(--green-light); border: 0.5px solid var(--green-mid); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .help-bullet-dot svg { width: 10px; height: 10px; }

  /* Mock UI elements */
  .mock-bar { height: 8px; border-radius: 4px; background: var(--green-mid); }
  .mock-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #fff; border-radius: 10px; border: 0.5px solid var(--border); }
  .mock-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--green-mid); flex-shrink: 0; }
  .mock-lines { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .mock-line { height: 7px; border-radius: 3px; background: var(--bg); }
  .mock-badge { font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 6px; }
  .mock-kpi-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .mock-kpi { background: #fff; border: 0.5px solid var(--border); border-radius: 10px; padding: 12px; text-align: center; }
  .mock-kpi-val { font-size: 18px; font-weight: 700; color: var(--ink); }
  .mock-kpi-lbl { font-size: 10px; color: var(--ink3); margin-top: 2px; }

  /* Features grid */
  .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 48px; }
  .feature-card { background: #fff; border: 0.5px solid var(--border); border-radius: 14px; padding: 24px; }

  /* Animations */
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: fadeUp 0.5s ease forwards; }
  .delay-1 { animation-delay: 0.1s; opacity: 0; }
  .delay-2 { animation-delay: 0.2s; opacity: 0; }
  .delay-3 { animation-delay: 0.3s; opacity: 0; }

  /* Sol-hero eyebrow pill — matches landing page */
  .sol-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(31,174,91,0.1);
    border: 1px solid rgba(31,174,91,0.28);
    border-radius: 100px;
    padding: 5px 14px 5px 10px;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #0F6B3E;
    margin-bottom: 28px;
    width: fit-content;
  }
  .sol-eyebrow-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #1FAE5B;
    flex-shrink: 0;
    animation: heroPulse 1.6s ease-in-out infinite;
  }
  @keyframes heroPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.7); }
  }

  /* Responsive */
  @media (max-width: 900px) {
    .hub-cards-grid, .pains-grid, .features-grid { grid-template-columns: 1fr 1fr !important; }
    .help-row { grid-template-columns: 1fr !important; }
    .help-row.reverse .help-text, .help-row.reverse .help-visual { order: unset !important; }
    .sol-hero-grid { grid-template-columns: 1fr !important; }
    .mock-kpi-row { grid-template-columns: 1fr 1fr !important; }
  }
  @media (max-width: 600px) {
    .hub-cards-grid, .pains-grid, .features-grid { grid-template-columns: 1fr !important; }
  }
`

// ─── Shared sub-components ────────────────────────────────────────────────────

const CheckSVG = () => (
  <svg viewBox="0 0 10 10" fill="none">
    <path d="M2 5l2.5 2.5L8 3" stroke="#1FAE5B" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

function HelpBullet({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--ink2)", lineHeight: 1.5 }}>
      <div className="help-bullet-dot"><CheckSVG /></div>
      {text}
    </div>
  )
}

function HelpVisual({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="help-visual" style={{ background: "var(--bg)", border: "0.5px solid var(--border)", borderRadius: 16, padding: 24, minHeight: 200, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)", marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 12 }}>{children}</div>
}

function CtaBand({ headline, sub }: { headline: string; sub: string }) {
  return (
    <div style={{ background: "linear-gradient(135deg,#0f5c2e 0%,#1a8a46 50%,#1FAE5B 100%)", padding: "80px 40px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,4vw,44px)", color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>{headline}</h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, marginBottom: 36 }}>{sub}</p>
        <Link href="/signup">
          <button style={{ fontSize: 15, fontWeight: 700, padding: "14px 36px", borderRadius: 10, border: "none", background: "#fff", color: "var(--green)", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--green-light)")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
          >
            Start free trial
          </button>
        </Link>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 14 }}>No credit card required · 30-day free trial</p>
      </div>
    </div>
  )
}

// ─── Hub Page ─────────────────────────────────────────────────────────────────

function HubPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const cards = [
    {
      id: "freelancer" as PageId,
      img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80&fit=crop&crop=top",
      title: "Freelancers",
      desc: "You're the strategist, the outreach rep, and the account manager. Instroom gives you the professional infrastructure to look — and operate — like a team of five.",
    },
    {
      id: "agency" as PageId,
      img: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80&fit=crop&crop=top",
      title: "Agency Owners",
      desc: "Multiple clients, multiple campaigns, one platform. Stop duplicating effort across spreadsheets. Deliver results that speak for themselves and keep clients coming back.",
    },
    {
      id: "dtc" as PageId,
      img: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80&fit=crop&crop=top",
      title: "DTC Founders",
      desc: "Influencer marketing works when it's run like a system, not a side task. Take full control of your creator relationships without hiring a full team to manage them.",
    },
  ]

  return (
    <>
      <div style={{ background: "#fff", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 40px 64px" }}>
          <div className="fade-up" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: 16 }}>Solutions</div>
          <h1 className="fade-up delay-1" style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 800, fontSize: "clamp(36px,5vw,58px)", lineHeight: 1.05, color: "var(--ink)", maxWidth: 700, marginBottom: 20, letterSpacing: "-0.02em" }}>
            Instroom works differently<br />for <em style={{ color: "var(--green)", fontStyle: "italic" }}>different kinds</em> of operators.
          </h1>
          <p className="fade-up delay-2" style={{ fontSize: 16, color: "var(--ink2)", lineHeight: 1.6, maxWidth: 520, marginBottom: 48 }}>
            Whether you're running campaigns solo, managing clients, or growing your own brand — Instroom fits the way you actually work. Pick your situation.
          </p>

          <div className="hub-cards-grid fade-up delay-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {cards.map(card => (
              <button key={card.id} onClick={() => onNavigate(card.id)} className="hub-card" style={{ textAlign: "left", width: "100%", fontFamily: "inherit" }}>
                <div className="hub-card-photo-wrap">
                  <img src={card.img} alt="" loading="lazy" />
                </div>
                <div className="hub-card-title">{card.title}</div>
                <div className="hub-card-desc">{card.desc}</div>
                <div className="hub-card-arrow">See how it works →</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <CtaBand
        headline="Not sure which plan fits your setup?"
        sub="Try the full platform free for 30 days. No credit card. No onboarding call. Just sign up and see what fits."
      />
    </>
  )
}

// ─── Freelancer Page ──────────────────────────────────────────────────────────

function FreelancerPage({ onBack }: { onBack: () => void }) {
  return (
    <>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "var(--ink3)", cursor: "pointer", padding: "20px 40px 0", textDecoration: "none", background: "none", border: "none", fontFamily: "'Inter',sans-serif", transition: "color 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--green)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--ink3)")}
      >
        ← All Solutions
      </button>

      {/* Hero */}
      <div style={{ background: "#F4F7F5", backgroundImage: "radial-gradient(circle, rgba(31,174,91,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px", borderBottom: "0.5px solid var(--border)" }}>
        <div className="sol-hero-grid" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 40px 72px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <div className="sol-eyebrow">
              <span className="sol-eyebrow-dot" />
              For Freelancers
            </div>
            <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900, fontSize: "clamp(1.875rem, 3.2vw, 2.875rem)", lineHeight: 1.1, letterSpacing: "-0.025em", color: "#1E1E1E", marginBottom: 20 }}>
              Run <em style={{ color: "#1FAE5B", fontStyle: "normal" }}>client campaigns</em> that look like an agency built them.
            </h1>
            <p style={{ fontSize: "1.0625rem", color: "#444", lineHeight: 1.7, maxWidth: 480, marginBottom: 32 }}>
              You're doing the work of three people. Instroom gives you the structure, the templates, and the reporting to deliver professional results — and win the next client while you're at it.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Link href="/signup">
                <button style={{ fontSize: 14, fontWeight: 600, padding: "12px 28px", borderRadius: 10, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--green-dark)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--green)")}
                >Start free trial</button>
              </Link>
              <button style={{ fontSize: 14, fontWeight: 500, padding: "11px 22px", borderRadius: 10, border: "0.5px solid var(--border)", background: "transparent", color: "var(--ink2)", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ink2)"; e.currentTarget.style.color = "var(--ink)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--ink2)"; }}
              >See the platform</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink3)" }}>No credit card required · 30-day free trial</p>
          </div>
          <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", minHeight: 420, boxShadow: "0 12px 40px rgba(0,0,0,0.1)" }}>
            <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&q=85&fit=crop&crop=faces,center" alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", bottom: 24, left: 24, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)", fontFamily: "'Manrope',sans-serif" }}>200+</div>
              <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>Campaigns managed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pains */}
      <div style={{ background: "#fff", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
          <SectionLabel>The freelancer problem</SectionLabel>
          <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,3.5vw,42px)", lineHeight: 1.15, color: "var(--ink)", marginBottom: 16 }}>
            You're not disorganized.<br />Your tools <em style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 800 }}>just weren't built for this.</em>
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink2)", lineHeight: 1.7, maxWidth: 560, marginBottom: 52 }}>
            Generic project tools don't understand influencer workflows. And enterprise platforms charge agency prices for features you don't need yet.
          </p>
          <div className="pain-photo-banner">
            <img src="https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200&q=80&fit=crop&crop=center" alt="" loading="lazy" />
          </div>
          <div className="pains-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {[
              { n: "01", title: "You rebuild a tracker for every single client.", body: "New client, new spreadsheet. You're formatting columns, writing formulas, and copying templates — before you've even sent an email." },
              { n: "02", title: "Your reporting takes longer than the campaign.", body: "Pulling data from four places, formatting a PDF, double-checking numbers the night before the client call. That's not strategy — that's admin." },
              { n: "03", title: "Clients can't see what you're doing for them.", body: "You're doing real work. But if you can't show it clearly, you look like an expense — not a partner. And upselling becomes an uphill battle." },
            ].map(p => (
              <div key={p.n} style={{ border: "0.5px solid var(--border)", borderRadius: 16, padding: 28, background: "var(--bg)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", marginBottom: 12, letterSpacing: "0.06em" }}>{p.n}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.3 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it helps */}
      <div style={{ background: "var(--bg)", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
          <SectionLabel>How Instroom helps</SectionLabel>
          <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,3.5vw,42px)", lineHeight: 1.15, color: "var(--ink)", marginBottom: 52 }}>
            Everything you need to<br /><em style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 800 }}>deliver and impress.</em>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

            <div className="help-row">
              <div className="help-text">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: 10 }}>Campaign Setup</div>
                <h3 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(22px,2.5vw,30px)", lineHeight: 1.2, color: "var(--ink)", marginBottom: 12 }}>Pre-built structure. Start outreach in minutes.</h3>
                <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7, marginBottom: 20 }}>Campaign scaffolding, pipeline stages, and creator fields are set up for you. Import your creators from a spreadsheet and you're running — not building.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HelpBullet text="Ready-to-use pipeline stages per campaign" />
                  <HelpBullet text="Import creators from CSV in one click" />
                  <HelpBullet text="One workspace per client, always separate" />
                </div>
              </div>
              <HelpVisual label="Client A — Campaign Setup">
                <div className="mock-row"><div className="mock-avatar"></div><div className="mock-lines"><div className="mock-line" style={{ width: "65%" }}></div><div className="mock-line" style={{ width: "40%" }}></div></div><div className="mock-badge" style={{ background: "var(--green-light)", color: "var(--green)" }}>For Outreach</div></div>
                <div className="mock-row"><div className="mock-avatar" style={{ background: "#fde8d8" }}></div><div className="mock-lines"><div className="mock-line" style={{ width: "55%" }}></div><div className="mock-line" style={{ width: "35%" }}></div></div><div className="mock-badge" style={{ background: "#fff8e6", color: "#b07800" }}>In Conversation</div></div>
                <div className="mock-row"><div className="mock-avatar" style={{ background: "#d4eaff" }}></div><div className="mock-lines"><div className="mock-line" style={{ width: "60%" }}></div><div className="mock-line" style={{ width: "38%" }}></div></div><div className="mock-badge" style={{ background: "var(--green-light)", color: "var(--green)" }}>Agreed</div></div>
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#fff", borderRadius: 10, border: "0.5px solid var(--border)", fontSize: 11, color: "var(--green)", fontWeight: 600 }}>✓ Campaign created · 3 creators imported</div>
              </HelpVisual>
            </div>

            <div className="help-row reverse">
              <div className="help-text">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: 10 }}>Reporting</div>
                <h3 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(22px,2.5vw,30px)", lineHeight: 1.2, color: "var(--ink)", marginBottom: 12 }}>Client-ready reports in one click.</h3>
                <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7, marginBottom: 20 }}>Stop building reports from scratch. Generate a clean campaign summary, export a PDF, or share a live link. The kind of output that makes clients feel like they're working with an agency — not a freelancer with a spreadsheet.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HelpBullet text="One-click campaign summaries" />
                  <HelpBullet text="Per-creator performance breakdown" />
                  <HelpBullet text="Export as PDF or share a live link" />
                </div>
              </div>
              <HelpVisual label="Campaign Report — Client A">
                <div className="mock-kpi-row">
                  <div className="mock-kpi"><div className="mock-kpi-val" style={{ color: "var(--green)" }}>12</div><div className="mock-kpi-lbl">Creators</div></div>
                  <div className="mock-kpi"><div className="mock-kpi-val">84%</div><div className="mock-kpi-lbl">Posted</div></div>
                  <div className="mock-kpi"><div className="mock-kpi-val">3.2x</div><div className="mock-kpi-lbl">Avg ROAS</div></div>
                </div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="mock-bar" style={{ width: "100%", height: 6 }}></div>
                  <div className="mock-bar" style={{ width: "80%", height: 6 }}></div>
                  <div className="mock-bar" style={{ width: "60%", height: 6 }}></div>
                </div>
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#fff", borderRadius: 10, border: "0.5px solid var(--border)", fontSize: 11, color: "var(--green)", fontWeight: 600 }}>↗ Export PDF · Share live link</div>
              </HelpVisual>
            </div>

            <div className="help-row">
              <div className="help-text">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: 10 }}>Creator CRM</div>
                <h3 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(22px,2.5vw,30px)", lineHeight: 1.2, color: "var(--ink)", marginBottom: 12 }}>Your creator relationships are your best asset. Treat them like it.</h3>
                <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7, marginBottom: 20 }}>Every creator you've ever worked with — their history, their rates, their performance — saved and searchable. When a client asks "have you worked with anyone in fitness?" you have the answer in seconds.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HelpBullet text="Full history across all campaigns" />
                  <HelpBullet text="Tags, notes, and custom fields" />
                  <HelpBullet text="Rates and deal records always attached" />
                </div>
              </div>
              <HelpVisual label="Creator Profile">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--green-mid)" }}></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>@creator_handle</div>
                    <div style={{ fontSize: 11, color: "var(--ink3)" }}>Fashion · 48K followers</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                  {["3 campaigns", "Paid", "High performer"].map(t => (
                    <span key={t} style={{ fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 20, background: "var(--green-light)", color: "var(--green)", border: "0.5px solid var(--green-mid)" }}>{t}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink3)" }}>Last rate: <strong style={{ color: "var(--ink)" }}>$350 / post</strong> · Last campaign: 14 days ago</div>
              </HelpVisual>
            </div>

          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ background: "var(--bg)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
          <SectionLabel>Built for solo operators</SectionLabel>
          <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,3.5vw,42px)", lineHeight: 1.15, color: "var(--ink)" }}>
            The features that matter<br />when it's just <em style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 800 }}>you.</em>
          </h2>
          <div className="features-grid">
            {[
              { icon: "📬", title: "Embedded Email", body: "Reach out to creators without switching tabs. Auto-tagged to the right campaign and stage so nothing gets lost." },
              { icon: "📋", title: "Pre-built Templates", body: "Email templates, pipeline stages, report layouts — all set up for you. Customise as needed, never start from zero." },
              { icon: "📁", title: "Separate Workspaces Per Client", body: "Each client lives in their own workspace. Clean, contained, no crossover — and easy to hand over if you ever need to." },
              { icon: "📊", title: "One-Click Reports", body: "Pull a professional campaign summary and send it before the client even asks. PDF or live link, your choice." },
              { icon: "💳", title: "Affordable Solo Plan", body: "Start on the Solo plan and pay only for what you use. No seat fees. Add tools as your client roster grows." },
              { icon: "🔄", title: "CSV Import", body: "Already have creators in a spreadsheet? Import them in seconds. No manual re-entry, no lost data." },
            ].map(f => (
              <div key={f.title} className="feature-card">
                <div style={{ fontSize: 22, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CtaBand
        headline="Start looking like the professional you already are."
        sub="30 days free. Full platform. No credit card, no onboarding call — just sign up and run your first campaign."
      />
    </>
  )
}

// ─── Agency Page ──────────────────────────────────────────────────────────────

function AgencyPage({ onBack }: { onBack: () => void }) {
  return (
    <>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "var(--ink3)", cursor: "pointer", padding: "20px 40px 0", background: "none", border: "none", fontFamily: "'Inter',sans-serif", transition: "color 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--green)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--ink3)")}
      >
        ← All Solutions
      </button>

      {/* Hero */}
      <div style={{ background: "#F4F7F5", backgroundImage: "radial-gradient(circle, rgba(31,174,91,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px", borderBottom: "0.5px solid var(--border)" }}>
        <div className="sol-hero-grid" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 40px 72px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <div className="sol-eyebrow">
              <span className="sol-eyebrow-dot" />
              For Agency Owners
            </div>
            <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900, fontSize: "clamp(1.875rem, 3.2vw, 2.875rem)", lineHeight: 1.1, letterSpacing: "-0.025em", color: "#1E1E1E", marginBottom: 20 }}>
              Run every client campaign<br />from <em style={{ color: "#1FAE5B", fontStyle: "normal" }}>one place.</em>
            </h1>
            <p style={{ fontSize: "1.0625rem", color: "#444", lineHeight: 1.7, maxWidth: 480, marginBottom: 32 }}>
              Spreadsheet chaos across clients. Time wasted switching tools. Difficulty proving ROI. Instroom is the single workspace your team actually sticks to — because it was built for exactly this work.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Link href="/signup">
                <button style={{ fontSize: 14, fontWeight: 600, padding: "12px 28px", borderRadius: 10, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--green-dark)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--green)")}
                >Start free trial</button>
              </Link>
              <button style={{ fontSize: 14, fontWeight: 500, padding: "11px 22px", borderRadius: 10, border: "0.5px solid var(--border)", background: "transparent", color: "var(--ink2)", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ink2)"; e.currentTarget.style.color = "var(--ink)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--ink2)"; }}
              >Book a demo</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink3)" }}>No credit card required · 30-day free trial</p>
          </div>
          <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", minHeight: 420, boxShadow: "0 12px 40px rgba(0,0,0,0.1)" }}>
            <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&q=85&fit=crop&crop=top" alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", bottom: 24, left: 24, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)", fontFamily: "'Manrope',sans-serif" }}>47+</div>
              <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>Creators per client</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pains */}
      <div style={{ background: "#fff", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
          <SectionLabel>The agency problem</SectionLabel>
          <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,3.5vw,42px)", lineHeight: 1.15, color: "var(--ink)", marginBottom: 16 }}>
            You're good at campaigns.<br />The tools are <em style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 800 }}>working against you.</em>
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink2)", lineHeight: 1.7, maxWidth: 560, marginBottom: 52 }}>
            Running multiple clients in spreadsheets isn't an organizational quirk — it's a structural problem that caps how much you can grow.
          </p>
          <div className="pain-photo-banner">
            <img src="https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=1200&q=80&fit=crop&crop=top" alt="" loading="lazy" />
          </div>
          <div className="pains-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {[
              { n: "01", title: "Every client is a different system.", body: "Client A has their own tracker. Client B wants it their way. You spend more time maintaining systems than running campaigns." },
              { n: "02", title: "Your team can't see what each other is doing.", body: "Outreach is in one tool, tracking in another, content saved somewhere else. No one has the full picture without interrupting three people." },
              { n: "03", title: "Proving ROI is still a manual job.", body: "Every client call requires building a fresh report. Data pulled from everywhere. Formatted the night before. There has to be a better way." },
            ].map(p => (
              <div key={p.n} style={{ border: "0.5px solid var(--border)", borderRadius: 16, padding: 28, background: "var(--bg)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", marginBottom: 12, letterSpacing: "0.06em" }}>{p.n}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.3 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it helps */}
      <div style={{ background: "var(--bg)", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
          <SectionLabel>How Instroom helps</SectionLabel>
          <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,3.5vw,42px)", lineHeight: 1.15, color: "var(--ink)", marginBottom: 52 }}>
            One platform.<br /><em style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 800 }}>Every client. Every campaign.</em>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

            <div className="help-row">
              <div className="help-text">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: 10 }}>Multi-Client Workspaces</div>
                <h3 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(22px,2.5vw,30px)", lineHeight: 1.2, color: "var(--ink)", marginBottom: 12 }}>A dedicated workspace for every client. One login for your whole team.</h3>
                <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7, marginBottom: 20 }}>Each client lives in their own clean workspace — separate data, separate pipeline, separate reporting. Your team accesses all of them from one admin dashboard with no seat fees.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HelpBullet text="3 workspaces included on the Team plan" />
                  <HelpBullet text="Unlimited users — no seat charges" />
                  <HelpBullet text="Add more workspaces as you grow clients" />
                </div>
              </div>
              <HelpVisual label="Admin dashboard">
                <div className="mock-row" style={{ background: "var(--green-light)", borderColor: "var(--green-mid)" }}><div className="mock-avatar" style={{ background: "var(--green-mid)" }}></div><div className="mock-lines"><div className="mock-line" style={{ width: "55%", background: "var(--green-mid)" }}></div><div className="mock-line" style={{ width: "35%", background: "var(--green-mid)" }}></div></div><div className="mock-badge" style={{ background: "var(--green-light)", color: "var(--green)" }}>Active</div></div>
                <div className="mock-row"><div className="mock-avatar" style={{ background: "#d4eaff" }}></div><div className="mock-lines"><div className="mock-line" style={{ width: "65%" }}></div><div className="mock-line" style={{ width: "40%" }}></div></div><div className="mock-badge" style={{ background: "#fff8e6", color: "#b07800" }}>Active</div></div>
                <div className="mock-row"><div className="mock-avatar" style={{ background: "#fde8d8" }}></div><div className="mock-lines"><div className="mock-line" style={{ width: "50%" }}></div><div className="mock-line" style={{ width: "30%" }}></div></div><div className="mock-badge" style={{ background: "var(--bg)", color: "var(--ink3)" }}>Setup</div></div>
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#fff", borderRadius: 10, border: "0.5px solid var(--border)", fontSize: 11, color: "var(--ink3)" }}>4 team members · All workspaces visible</div>
              </HelpVisual>
            </div>

            <div className="help-row reverse">
              <div className="help-text">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: 10 }}>Team Collaboration</div>
                <h3 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(22px,2.5vw,30px)", lineHeight: 1.2, color: "var(--ink)", marginBottom: 12 }}>Your whole team works from the same source of truth.</h3>
                <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7, marginBottom: 20 }}>Campaign manager, account lead, and ops all see the same pipeline. Assign roles, leave notes, track progress — without anyone needing to ask for an update.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HelpBullet text="Role-based access (Admin, Manager, Viewer)" />
                  <HelpBullet text="Shared creator notes and campaign history" />
                  <HelpBullet text="Bulk actions for faster campaign management" />
                </div>
              </div>
              <HelpVisual label="Creator — Team view">
                <div className="mock-row"><div className="mock-avatar"></div><div className="mock-lines"><div className="mock-line" style={{ width: "70%" }}></div><div className="mock-line" style={{ width: "45%" }}></div></div><div className="mock-badge" style={{ background: "var(--green-light)", color: "var(--green)" }}>Agreed</div></div>
                <div style={{ padding: "10px 12px", background: "#fff", borderRadius: 10, border: "0.5px solid var(--border)", marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: "var(--ink3)" }}>Note from Campaign Manager</div>
                  <div className="mock-line" style={{ width: "90%", marginTop: 4 }}></div>
                  <div className="mock-line" style={{ width: "60%", marginTop: 4 }}></div>
                </div>
                <div style={{ padding: "10px 12px", background: "var(--green-light)", borderRadius: 10, border: "0.5px solid var(--green-mid)", marginTop: 6, fontSize: 11, color: "var(--green)", fontWeight: 600 }}>Fee agreed · Brief sent · Post scheduled</div>
              </HelpVisual>
            </div>

            <div className="help-row">
              <div className="help-text">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: 10 }}>Client Reporting</div>
                <h3 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(22px,2.5vw,30px)", lineHeight: 1.2, color: "var(--ink)", marginBottom: 12 }}>Reports that make clients renew, not just nod.</h3>
                <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7, marginBottom: 20 }}>Pull a per-creator breakdown, campaign summary, or full-funnel report and share it as a live link or clean PDF. No more spreadsheet exports dressed up as strategy.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HelpBullet text="Per-creator and per-campaign breakdowns" />
                  <HelpBullet text="Live-updating shareable report links" />
                  <HelpBullet text="PDF exports for client deliverables" />
                </div>
              </div>
              <HelpVisual label="Client A — Monthly Report">
                <div className="mock-kpi-row">
                  <div className="mock-kpi"><div className="mock-kpi-val" style={{ color: "var(--green)" }}>24</div><div className="mock-kpi-lbl">Creators</div></div>
                  <div className="mock-kpi"><div className="mock-kpi-val">91%</div><div className="mock-kpi-lbl">Post rate</div></div>
                  <div className="mock-kpi"><div className="mock-kpi-val">4.1x</div><div className="mock-kpi-lbl">ROAS</div></div>
                </div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div className="mock-bar" style={{ width: "100%", height: 6 }}></div>
                  <div className="mock-bar" style={{ width: "91%", height: 6 }}></div>
                  <div className="mock-bar" style={{ width: "60%", height: 6 }}></div>
                </div>
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#fff", borderRadius: 10, border: "0.5px solid var(--border)", fontSize: 11, color: "var(--green)", fontWeight: 600 }}>↗ Share link · Export PDF</div>
              </HelpVisual>
            </div>

          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ background: "var(--bg)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
          <SectionLabel>Built for teams at scale</SectionLabel>
          <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,3.5vw,42px)", lineHeight: 1.15, color: "var(--ink)" }}>
            Every feature your team<br />needs to <em style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 800 }}>deliver at scale.</em>
          </h2>
          <div className="features-grid">
            {[
              { icon: "🗂️", title: "Multi-Client Workspaces", body: "Every client in their own contained workspace. Separate pipelines, separate data — one login for your whole team." },
              { icon: "👥", title: "Unlimited Team Members", body: "No seat charges. Add your whole team — campaign managers, account leads, ops — with role-based access." },
              { icon: "📊", title: "Client-Ready Reporting", body: "Share live report links or export clean PDFs. The kind of output that makes clients feel their retainer is justified." },
              { icon: "📬", title: "Shared Inbox", body: "Team-wide email visibility. Every outreach thread tagged to the right creator, campaign, and stage." },
              { icon: "🔁", title: "Shared Workspace Access", body: "Grant clients view access to their own workspace. Transparent, professional, no extra cost to you." },
              { icon: "⚙️", title: "Admin Dashboard", body: "See all your client workspaces in one place. Monitor activity, manage access, and stay across every account." },
            ].map(f => (
              <div key={f.title} className="feature-card">
                <div style={{ fontSize: 22, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CtaBand
        headline="Your clients deserve better than a spreadsheet export."
        sub="Try Instroom free for 30 days. Bring your whole team. No seat fees, no onboarding call — just sign up and run a campaign the right way."
      />
    </>
  )
}

// ─── DTC Page ─────────────────────────────────────────────────────────────────

function DtcPage({ onBack }: { onBack: () => void }) {
  return (
    <>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "var(--ink3)", cursor: "pointer", padding: "20px 40px 0", background: "none", border: "none", fontFamily: "'Inter',sans-serif", transition: "color 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--green)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--ink3)")}
      >
        ← All Solutions
      </button>

      {/* Hero */}
      <div style={{ background: "#F4F7F5", backgroundImage: "radial-gradient(circle, rgba(31,174,91,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px", borderBottom: "0.5px solid var(--border)" }}>
        <div className="sol-hero-grid" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 40px 72px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <div className="sol-eyebrow">
              <span className="sol-eyebrow-dot" />
              For DTC Founders
            </div>
            <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900, fontSize: "clamp(1.875rem, 3.2vw, 2.875rem)", lineHeight: 1.1, letterSpacing: "-0.025em", color: "#1E1E1E", marginBottom: 20 }}>
              Your influencer program,<br />run like a <em style={{ color: "#1FAE5B", fontStyle: "normal" }}>real system.</em>
            </h1>
            <p style={{ fontSize: "1.0625rem", color: "#444", lineHeight: 1.7, maxWidth: 480, marginBottom: 32 }}>
              Influencer marketing works when it's built on structure — not a gut feel and a spreadsheet. Instroom gives you the operational backbone to scale your creator program without scaling your headcount.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Link href="/signup">
                <button style={{ fontSize: 14, fontWeight: 600, padding: "12px 28px", borderRadius: 10, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--green-dark)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--green)")}
                >Start free trial</button>
              </Link>
              <button style={{ fontSize: 14, fontWeight: 500, padding: "11px 22px", borderRadius: 10, border: "0.5px solid var(--border)", background: "transparent", color: "var(--ink2)", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ink2)"; e.currentTarget.style.color = "var(--ink)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--ink2)"; }}
              >See how it works</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink3)" }}>No credit card required · 30-day free trial</p>
          </div>
          <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", minHeight: 420, boxShadow: "0 12px 40px rgba(0,0,0,0.1)" }}>
            <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&q=85&fit=crop&crop=top" alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", bottom: 24, left: 24, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)", fontFamily: "'Manrope',sans-serif" }}>$10M+</div>
              <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>In creator-driven sales</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pains */}
      <div style={{ background: "#fff", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
          <SectionLabel>The DTC founder problem</SectionLabel>
          <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,3.5vw,42px)", lineHeight: 1.15, color: "var(--ink)", marginBottom: 16 }}>
            You know influencer marketing works.<br /><em style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 800 }}>Making it systematic is the hard part.</em>
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink2)", lineHeight: 1.7, maxWidth: 560, marginBottom: 52 }}>
            Most DTC brands run influencer programs that depend on one person's memory, a chaotic spreadsheet, and a lot of manually sent follow-ups. It works — until it doesn't.
          </p>
          <div className="pain-photo-banner">
            <img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&q=80&fit=crop&crop=center" alt="" loading="lazy" />
          </div>
          <div className="pains-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {[
              { n: "01", title: "Your program lives in someone's head.", body: "One person knows which creators are active, who owes posts, and who's worth re-engaging. That knowledge isn't captured anywhere — and it disappears when they do." },
              { n: "02", title: "You're paying creators and hoping for the best.", body: "No clear way to track who's actually driving revenue. No way to see which creators are worth scaling. Your influencer budget is a line item, not a strategy." },
              { n: "03", title: "Your best creators don't know they're your best creators.", body: "There's no tier system, no formal relationship structure. Every creator gets treated the same — even the ones driving 80% of your results." },
            ].map(p => (
              <div key={p.n} style={{ border: "0.5px solid var(--border)", borderRadius: 16, padding: 28, background: "var(--bg)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", marginBottom: 12, letterSpacing: "0.06em" }}>{p.n}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.3 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it helps */}
      <div style={{ background: "var(--bg)", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
          <SectionLabel>How Instroom helps</SectionLabel>
          <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,3.5vw,42px)", lineHeight: 1.15, color: "var(--ink)", marginBottom: 52 }}>
            Turn your creator relationships<br />into a <em style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 800 }}>scalable program.</em>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

            <div className="help-row">
              <div className="help-text">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: 10 }}>Campaign Management</div>
                <h3 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(22px,2.5vw,30px)", lineHeight: 1.2, color: "var(--ink)", marginBottom: 12 }}>Every campaign structured from day one.</h3>
                <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7, marginBottom: 20 }}>Stop building trackers from scratch. Instroom gives you a ready-to-run campaign workspace — pipeline stages, creator fields, and tracking built in. Whether you're running gifting, paid, or affiliate campaigns.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HelpBullet text="Gifting, paid, and affiliate campaigns supported" />
                  <HelpBullet text="List and Kanban view — switch in one click" />
                  <HelpBullet text="Track deliverables, fees, and post status per creator" />
                </div>
              </div>
              <HelpVisual label="Summer Campaign">
                <div className="mock-row"><div className="mock-avatar"></div><div className="mock-lines"><div className="mock-line" style={{ width: "70%" }}></div><div className="mock-line" style={{ width: "45%" }}></div></div><div className="mock-badge" style={{ background: "var(--green-light)", color: "var(--green)" }}>Posted ✓</div></div>
                <div className="mock-row"><div className="mock-avatar" style={{ background: "#fde8d8" }}></div><div className="mock-lines"><div className="mock-line" style={{ width: "60%" }}></div><div className="mock-line" style={{ width: "38%" }}></div></div><div className="mock-badge" style={{ background: "#fff8e6", color: "#b07800" }}>Brief sent</div></div>
                <div className="mock-row"><div className="mock-avatar" style={{ background: "#d4eaff" }}></div><div className="mock-lines"><div className="mock-line" style={{ width: "55%" }}></div><div className="mock-line" style={{ width: "35%" }}></div></div><div className="mock-badge" style={{ background: "var(--bg)", color: "var(--ink3)" }}>Outreach</div></div>
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#fff", borderRadius: 10, border: "0.5px solid var(--border)", fontSize: 11, color: "var(--ink3)" }}>Fee: <strong style={{ color: "var(--ink)" }}>$450</strong> · Deliverable: <strong style={{ color: "var(--ink)" }}>1x Reel</strong></div>
              </HelpVisual>
            </div>

            <div className="help-row reverse">
              <div className="help-text">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: 10 }}>Performance Tracking</div>
                <h3 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(22px,2.5vw,30px)", lineHeight: 1.2, color: "var(--ink)", marginBottom: 12 }}>Know exactly which creators are worth scaling.</h3>
                <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7, marginBottom: 20 }}>Track revenue, post rate, and ROAS per creator across campaigns. When it's time to decide who gets a bigger budget, you're making a data call — not a gut call.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HelpBullet text="Revenue and ROAS tracked per creator" />
                  <HelpBullet text="Cross-campaign performance history" />
                  <HelpBullet text="One-click campaign summaries for your team" />
                </div>
              </div>
              <HelpVisual label="Creator performance">
                <div className="mock-kpi-row">
                  <div className="mock-kpi"><div className="mock-kpi-val" style={{ color: "var(--green)" }}>$4.2k</div><div className="mock-kpi-lbl">Revenue</div></div>
                  <div className="mock-kpi"><div className="mock-kpi-val">4.8x</div><div className="mock-kpi-lbl">ROAS</div></div>
                  <div className="mock-kpi"><div className="mock-kpi-val">92%</div><div className="mock-kpi-lbl">Post rate</div></div>
                </div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="mock-bar" style={{ flex: 1, height: 6, width: "92%" }}></div><span style={{ fontSize: 10, color: "var(--green)", fontWeight: 600 }}>↑ Top 10%</span></div>
                  <div className="mock-bar" style={{ width: "80%", height: 6, background: "#d4eaff" }}></div>
                  <div className="mock-bar" style={{ width: "60%", height: 6, background: "#fde8d8" }}></div>
                </div>
              </HelpVisual>
            </div>

            <div className="help-row">
              <div className="help-text">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: 10 }}>Brand Partners</div>
                <h3 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(22px,2.5vw,30px)", lineHeight: 1.2, color: "var(--ink)", marginBottom: 12 }}>Give your top creators the structure they deserve.</h3>
                <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7, marginBottom: 20 }}>Brand Partners turns your best creator relationships into a formal program — tiers, retainers, performance history. Creators who deliver consistently get recognized for it. And they stick around longer because of it.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HelpBullet text="Auto tier assignment based on revenue" />
                  <HelpBullet text="Retainer and recurring deal tracking" />
                  <HelpBullet text="Full history across all campaigns" />
                </div>
              </div>
              <HelpVisual label="Brand Partners — Tier view">
                <div className="mock-row" style={{ background: "linear-gradient(90deg,#fff8e6,#fff)", borderColor: "#f0d882" }}>
                  <div className="mock-avatar" style={{ background: "#fde8a0" }}></div>
                  <div className="mock-lines"><div className="mock-line" style={{ width: "60%", background: "#f5e9b0" }}></div><div className="mock-line" style={{ width: "40%", background: "#f5e9b0" }}></div></div>
                  <div className="mock-badge" style={{ background: "#fff8e6", color: "#b07800" }}>Gold</div>
                </div>
                <div className="mock-row">
                  <div className="mock-avatar" style={{ background: "#e8e8e8" }}></div>
                  <div className="mock-lines"><div className="mock-line" style={{ width: "65%" }}></div><div className="mock-line" style={{ width: "42%" }}></div></div>
                  <div className="mock-badge" style={{ background: "#f5f5f5", color: "#666" }}>Silver</div>
                </div>
                <div className="mock-row">
                  <div className="mock-avatar" style={{ background: "#f8dcc8" }}></div>
                  <div className="mock-lines"><div className="mock-line" style={{ width: "55%" }}></div><div className="mock-line" style={{ width: "35%" }}></div></div>
                  <div className="mock-badge" style={{ background: "#fef3ee", color: "#b05020" }}>Bronze</div>
                </div>
              </HelpVisual>
            </div>

          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ background: "var(--bg)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 40px" }}>
          <SectionLabel>Built for brand operators</SectionLabel>
          <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,3.5vw,42px)", lineHeight: 1.15, color: "var(--ink)" }}>
            The full system to run your<br />program like a <em style={{ color: "var(--green)", fontStyle: "normal", fontWeight: 800 }}>pro.</em>
          </h2>
          <div className="features-grid">
            {[
              { icon: "📦", title: "Gifting, Paid & Affiliate", body: "All three campaign types supported in one workspace. Track deliverables, fees, and deal types per creator." },
              { icon: "⭐", title: "Brand Partners Program", body: "Structure your top creators into tiers. Retainers, recurring deals, full history — all in one place." },
              { icon: "📈", title: "ROAS & Revenue Tracking", body: "Track which creators actually drive sales. Make budget decisions based on data, not feelings." },
              { icon: "👤", title: "Creator CRM", body: "Every creator's history, rates, and posts — stored and searchable. Never lose context when re-engaging." },
              { icon: "📬", title: "Embedded Outreach", body: "Email creators directly from Instroom. Auto-tagged to campaign and stage. No tab switching required." },
              { icon: "💳", title: "Pay Only for What You Use", body: "Start with the core platform. Add the Chrome Extension or Post Tracker only when you need them." },
            ].map(f => (
              <div key={f.title} className="feature-card">
                <div style={{ fontSize: 22, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CtaBand
        headline="Your best creators deserve a program, not a spreadsheet."
        sub="Try Instroom free for 30 days. No credit card, no onboarding call. Just build the program your brand actually needs."
      />
    </>
  )
}

// ─── Root Export ──────────────────────────────────────────────────────────────

export function SolutionsPage() {
  const searchParams = useSearchParams()
  const [currentPage, setCurrentPage] = useState<PageId>("hub")

  useEffect(() => {
    const type = searchParams.get("type")
    if (type === "freelancer" || type === "agency" || type === "dtc") {
      setCurrentPage(type)
    }
  }, [searchParams])

  function navigate(page: PageId) {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function goBack() {
    navigate("hub")
  }

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: "var(--bg)", color: "var(--ink)" }}>
      <style>{GLOBAL_STYLES}</style>
      <MainHeader />

      {currentPage === "hub" && <HubPage onNavigate={navigate} />}
      {currentPage === "freelancer" && <FreelancerPage onBack={goBack} />}
      {currentPage === "agency" && <AgencyPage onBack={goBack} />}
      {currentPage === "dtc" && <DtcPage onBack={goBack} />}

      <MainFooter />
    </div>
  )
}
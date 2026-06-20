import Link from "next/link"
import { CtaBand, HelpBullet, HelpVisual, SectionLabel } from "./shared"

export function Dtc({ onBack }: { onBack: () => void }) {
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
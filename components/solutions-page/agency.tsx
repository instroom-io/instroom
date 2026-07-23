"use client"

import Link from "next/link"
import { useState } from "react"
import { CtaBand, HelpBullet, HelpVisual, SectionLabel } from "./shared"
import { BookDemoModal } from "@/components/shared/book-demo-modal"

export function Agency({ onBack }: { onBack: () => void }) {
  const [showBookDemo, setShowBookDemo] = useState(false)
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
              <button
                onClick={() => setShowBookDemo(true)}
                style={{ fontSize: 14, fontWeight: 500, padding: "11px 22px", borderRadius: 10, border: "0.5px solid var(--border)", background: "transparent", color: "var(--ink2)", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
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
      <BookDemoModal open={showBookDemo} onClose={() => setShowBookDemo(false)} />
    </>
  )
}
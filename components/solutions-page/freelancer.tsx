import Link from "next/link"
import { CtaBand, HelpBullet, HelpVisual, SectionLabel } from "./shared"

export function Freelancer({ onBack }: { onBack: () => void }) {
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
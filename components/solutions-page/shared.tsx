import Link from "next/link"

export const CheckSVG = () => (
  <svg viewBox="0 0 10 10" fill="none">
    <path d="M2 5l2.5 2.5L8 3" stroke="#1FAE5B" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export function HelpBullet({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--ink2)", lineHeight: 1.5 }}>
      <div className="help-bullet-dot"><CheckSVG /></div>
      {text}
    </div>
  )
}

export function HelpVisual({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="help-visual" style={{ background: "var(--bg)", border: "0.5px solid var(--border)", borderRadius: 16, padding: 24, minHeight: 200, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)", marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 12 }}>{children}</div>
}

export function CtaBand({ headline, sub }: { headline: string; sub: string }) {
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
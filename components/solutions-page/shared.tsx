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
    <section style={{ background: "#1E1E1E", position: "relative", overflow: "hidden", padding: "100px 32px" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 70% 50%, rgba(31,174,91,0.15) 0%, transparent 70%)",
        }}
      />
      <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1FAE5B", marginBottom: 16 }}>
          Ready to Simplify?
        </p>
        <h2 style={{ fontFamily: "'Manrope',sans-serif", fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>{headline}</h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 32 }}>{sub}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <Link href="/signup">
            <button style={{ fontSize: 15, fontWeight: 700, padding: "14px 32px", borderRadius: 10, border: "none", background: "#fff", color: "#1FAE5B", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f0fdf4")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            >
              Start free trial
            </button>
          </Link>
          <button style={{ fontSize: 15, fontWeight: 600, padding: "14px 32px", borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.35)", background: "transparent", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            Book a Demo
          </button>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>No credit card required · 30-day free trial</p>
      </div>
    </section>
  )
}
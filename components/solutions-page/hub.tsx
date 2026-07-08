import { CtaBand } from "./shared"
import type { PageId } from "./types"

export function Hub({ onNavigate }: { onNavigate: (page: PageId) => void }) {
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
            Instroom works differently<br />for <span style={{ color: "var(--green)" }}>different kinds</span> of operators.
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
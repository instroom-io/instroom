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
      <div style={{ background: "#F4F7F5", backgroundImage: "radial-gradient(circle, rgba(31,174,91,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 40px 0", textAlign: "center" }}>
          <div className="sol-eyebrow fade-up" style={{ margin: "0 auto 16px" }}>
            <span className="sol-eyebrow-dot" />
            Solutions
          </div>
          <h1 className="fade-up delay-1" style={{ fontFamily: "'Manrope',sans-serif", fontWeight: 800, fontSize: "clamp(2.25rem, 5vw, 3.5rem)", lineHeight: 1.12, color: "var(--ink)", margin: "0 auto 20px", letterSpacing: "-0.02em" }}>
            <span style={{ whiteSpace: "nowrap" }}>Instroom works differently</span><br />
            <span style={{ whiteSpace: "nowrap" }}>for <span style={{ color: "var(--green)" }}>different kinds</span> of operators.</span>
          </h1>
          <p className="fade-up delay-2" style={{ fontSize: 18, color: "var(--ink2)", lineHeight: 1.625, maxWidth: 620, margin: "0 auto 48px" }}>
            Whether you're running campaigns solo, managing clients, or growing your own brand — Instroom fits the way you actually work. Pick your situation.
          </p>
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: "0.5px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 40px 64px" }}>
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
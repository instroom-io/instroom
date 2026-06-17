const missionCards = [
  {
    icon: "🎯",
    title: "Practical Over Theoretical",
    desc: "Every feature in Instroom was shaped by real campaigns, real friction points, and real results from the field.",
  },
  {
    icon: "📈",
    title: "Built for Scale",
    desc: "Whether you're running 5 or 500 campaigns, Instroom scales with your growth — not against it.",
  },
  {
    icon: "⚡",
    title: "Speed of Execution",
    desc: "Reduce friction, increase clarity. Instroom exists to keep your team moving fast without sacrificing structure.",
  },
]

export function AboutMission() {
  return (
    <section style={{ background: "#F7F9F8", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(31,174,91,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div className="max-w-6xl mx-auto px-8 py-20 grid grid-cols-2 gap-20 relative z-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-4">Our Mission</p>
          <h2
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: "40px",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
            className="text-zinc-900 mb-6"
          >
            Influencer marketing solutions rooted in practical experience.
          </h2>
          <p className="text-base leading-relaxed text-zinc-600">
            We help businesses achieve scalable growth — without unnecessary tools, bloated software, or the
            complexity that slows teams down.
          </p>
        </div>
        <div className="space-y-4">
          {missionCards.map((card, idx) => (
            <div
              key={idx}
              className="bg-white border border-zinc-200 rounded-2xl p-6 hover:shadow-lg hover:border-emerald-600/20 transition-all"
            >
              <div className="text-2xl mb-3">{card.icon}</div>
              <h3
                style={{ fontFamily: "'Manrope', sans-serif", fontSize: "15px", fontWeight: 700 }}
                className="text-zinc-900 mb-2"
              >
                {card.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
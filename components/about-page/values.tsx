const values = [
  {
    icon: "🔬",
    name: "Expertise",
    desc: "We prioritize knowledge and experience, delivering solutions backed by data and results — not guesswork.",
  },
  {
    icon: "🤝",
    name: "Collaboration",
    desc: "We work in partnership with our clients, sharing insights and fostering mutual success at every stage.",
  },
  {
    icon: "⚡",
    name: "Agility",
    desc: "We stay adaptable, responding to market changes quickly to deliver the best solutions in real time.",
  },
  {
    icon: "🚀",
    name: "Innovation",
    desc: "We continuously improve, integrating new technologies and streamlining workflows to stay ahead.",
  },
]

export function AboutValues() {
  return (
    <section style={{ background: "#F7F9F8", padding: "100px 32px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-4">What We Stand For</p>
          <h2
            style={{ fontFamily: "'Manrope', sans-serif", fontSize: "36px", fontWeight: 800, letterSpacing: "-0.02em" }}
            className="text-zinc-900"
          >
            Our Brand Values
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-5">
          {values.map((value, idx) => (
            <div
              key={idx}
              className="bg-white border border-zinc-200 rounded-2xl p-7 hover:shadow-lg hover:border-emerald-600/20 transition-all group"
            >
              <div className="text-3xl mb-4">{value.icon}</div>
              <h3
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: "14px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                className="text-zinc-900 mb-3"
              >
                {value.name}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600">{value.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
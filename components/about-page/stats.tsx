const stats = [
  { number: "200", label: "Campaigns Successfully Managed", suffix: "+" },
  { number: "100K", label: "Influencers in Our Network", suffix: "+" },
  { number: "$10M", label: "Revenue Generated for Clients", suffix: "+" },
  { number: "5", label: "Years of Industry Experience", suffix: "+" },
]

export function AboutStats() {
  return (
    <section style={{ background: "#F7F9F8", padding: "100px 32px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-4">By The Numbers</p>
          <h2
            style={{ fontFamily: "'Manrope', sans-serif", fontSize: "36px", fontWeight: 800, letterSpacing: "-0.02em" }}
            className="text-zinc-900 mb-3"
          >
            Proven experience, not just promises.
          </h2>
          <p className="text-base text-zinc-600">
            The numbers behind Instroom aren't projections — they're the track record that inspired it.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-px bg-zinc-300 rounded-2xl overflow-hidden border border-zinc-300">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white p-12 text-center">
              <div
                style={{ fontFamily: "'Manrope', sans-serif", fontSize: "44px", fontWeight: 900, letterSpacing: "-0.03em" }}
                className="text-zinc-900 mb-2"
              >
                {stat.number}
                <span style={{ color: "#1FAE5B" }}>{stat.suffix}</span>
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
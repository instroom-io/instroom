export function AboutStory() {
  return (
    <section
      style={{
        background: "#FFFFFF",
        borderTop: "1px solid rgba(0,0,0,0.08)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <div className="max-w-6xl mx-auto px-8 py-20 grid grid-cols-2 gap-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-4">The Origin</p>
          <h2
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: "36px",
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
            className="text-zinc-900"
          >
            From scattered spreadsheets to structured success.
          </h2>
        </div>
        <div className="space-y-6">
          <p className="text-base leading-relaxed text-zinc-600">
            Instroom was founded by <strong>Armful Media</strong>, a leading influencer marketing agency with
            over five years of hands-on experience managing campaigns for eCommerce brands. After running 200+
            campaigns and working with 100,000+ influencers, we saw firsthand how brands struggled with
            scattered tools, rigid CRMs, and messy spreadsheets.
          </p>
          <p className="text-base leading-relaxed text-zinc-600">
            So, we built Instroom — the influencer marketing workspace we always needed.{" "}
            <strong>Seamless, intuitive, and flexible</strong>, Instroom integrates with your existing tools,
            simplifies campaign management, and eliminates inefficiencies without the cost and complexity of
            traditional platforms.
          </p>
          <p className="text-base leading-relaxed text-zinc-600">
            Today, Instroom is the operating system for eCommerce brands and agencies who are serious about
            scaling influencer marketing the right way — with data, structure, and clarity.
          </p>
        </div>
      </div>
    </section>
  )
}
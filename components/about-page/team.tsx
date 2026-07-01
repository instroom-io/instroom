import Image from "next/image"

const founders = [
  {
    name: "Armand Mañibo",
    role: "CEO & Co-Founder",
    bio: "Co-founder and CEO of Instroom. With deep roots in influencer marketing and eCommerce, Armand built the strategies that generated over $10M in revenue for Armful Media clients — and then built Instroom to systematize that playbook for every brand.",
  },
  {
    name: "Harold Royce Añonuevo",
    role: "CTO & Co-Founder",
    bio: "Co-founder and CTO of Instroom. Harold translates operational experience into clean, powerful product architecture — ensuring Instroom is as technically sound as it is intuitive, so teams spend less time in the tool and more time on results.",
  },
]

export function AboutTeam() {
  return (
    <section style={{ background: "#FFFFFF", padding: "100px 32px" }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-4">The Team Behind It</p>
          <h2
            style={{ fontFamily: "'Manrope', sans-serif", fontSize: "36px", fontWeight: 800, letterSpacing: "-0.02em" }}
            className="text-zinc-900 mb-3"
          >
            Meet Our Founders
          </h2>
          <p className="text-base text-zinc-600">
            Instroom was created by industry experts who have helped brands scale their influencer marketing
            efforts with data-driven, results-focused strategies.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8">
          {founders.map((founder, idx) => (
            <div
              key={idx}
              className="bg-white border border-zinc-200 rounded-2xl overflow-hidden flex hover:shadow-lg transition-all"
            >
              {idx === 0 ? (
                <div className="relative w-48 flex-shrink-0">
                  <Image src="/images/CEO.jpg" alt={founder.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-48 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center flex-shrink-0 text-5xl text-white/10">
                  👤
                </div>
              )}
              <div className="p-8 flex flex-col justify-center flex-1">
                <div className="inline-block bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 mb-3 w-fit">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                    {founder.role}
                  </span>
                </div>
                <h3
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: "20px",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                  className="text-zinc-900 mb-2"
                >
                  {founder.name}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-600">{founder.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
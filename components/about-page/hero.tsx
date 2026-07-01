import Image from "next/image";

export function AboutHero() {
  return (
    <section style={{ paddingTop: "32px", background: "#F7F9F8" }}>
      <div className="max-w-7xl mx-auto px-8 py-16 grid grid-cols-[1fr_1.3fr] gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              Our Story
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: "52px",
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
            }}
            className="text-zinc-900 mb-6"
          >
            Built from the{" "}
            <em style={{ fontStyle: "normal", color: "#1FAE5B" }}>
              inside
            </em>{" "}
            of influencer marketing.
          </h1>

          <p className="text-lg text-zinc-600 mb-8 leading-relaxed max-w-md">
            Instroom was born from 200+ campaigns, 100,000+ influencers, and
            the hard-won lessons of building what the industry actually needed —
            not another bloated platform.
          </p>

          <div className="flex gap-12">
            <div>
              <div
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "#1E1E1E",
                }}
              >
                200<span style={{ color: "#1FAE5B" }}>+</span>
              </div>
              <div className="text-xs text-zinc-600 font-medium mt-1">
                Campaigns run
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "#1E1E1E",
                }}
              >
                100K<span style={{ color: "#1FAE5B" }}>+</span>
              </div>
              <div className="text-xs text-zinc-600 font-medium mt-1">
                Influencers managed
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "#1E1E1E",
                }}
              >
                $10M<span style={{ color: "#1FAE5B" }}>+</span>
              </div>
              <div className="text-xs text-zinc-600 font-medium mt-1">
                Revenue generated
              </div>
            </div>
          </div>
        </div>

        {/* Visual column — matches the "team-card" treatment from the About page */}
        <div className="relative">
          {/* floating accent circles, sit behind the card */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              top: "-20px",
              right: "-20px",
              width: "120px",
              height: "120px",
              background: "#E8F9EE",
              zIndex: -1,
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              bottom: "-10px",
              left: "-10px",
              width: "60px",
              height: "60px",
              background: "#E8F9EE",
              zIndex: -1,
            }}
          />

          <div
            className="bg-white overflow-hidden"
            style={{
              borderRadius: "20px",
              border: "0.5px solid rgba(0,0,0,0.08)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
            }}
          >
            <div className="relative" style={{ height: "360px" }}>
              <Image
                src="/images/team-photo.jpg"
                alt="Instroom Team"
                fill
                priority
                className="object-cover"
                style={{ objectPosition: "center 25%" }}
              />
            </div>

            <div
              className="flex items-center justify-between"
              style={{ padding: "20px 24px" }}
            >
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#1E1E1E",
                  }}
                >
                  Armful Media
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6B7280",
                    marginTop: "2px",
                  }}
                >
                  The agency behind Instroom
                </div>
              </div>
              <div
                style={{
                  background: "#E8F9EE",
                  borderRadius: "100px",
                  padding: "4px 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#1FAE5B",
                }}
              >
                5+ Years
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
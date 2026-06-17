export function AboutVision() {
  return (
    <section style={{ background: "#1E1E1E", position: "relative", overflow: "hidden", padding: "60px 32px" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 30% 50%, rgba(31,174,91,0.18) 0%, transparent 70%)",
        }}
      />
      <div className="max-w-6xl mx-auto flex items-center gap-12 relative z-10">
        <div
          style={{ background: "rgba(31,174,91,0.15)", border: "1px solid rgba(31,174,91,0.3)" }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl"
        >
          🌐
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-2">Our Vision</p>
          <p
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: "22px",
              fontWeight: 700,
              color: "white",
              lineHeight: 1.4,
              letterSpacing: "-0.01em",
            }}
          >
            To become the go-to influencer marketing tool for eCommerce businesses and marketing agencies
            seeking global reach and scalable campaign results.
          </p>
        </div>
      </div>
    </section>
  )
}
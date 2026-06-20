import Link from "next/link"
import { Button } from "@/components/ui/button"

export function AboutCTA() {
  return (
    <section style={{ background: "#1E1E1E", position: "relative", overflow: "hidden", padding: "100px 32px" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 70% 50%, rgba(31,174,91,0.15) 0%, transparent 70%)",
        }}
      />
      <div className="max-w-2xl mx-auto text-center relative z-10">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-4">Ready to Simplify?</p>
        <h2
          style={{ fontFamily: "'Manrope', sans-serif", fontSize: "44px", fontWeight: 900, letterSpacing: "-0.03em" }}
          className="text-white mb-6 leading-tight"
        >
          Start building your influencer workflow today.
        </h2>
        <p className="text-base leading-relaxed text-white/60 mb-8">
          Join brands and agencies who've moved from messy spreadsheets to structured, scalable influencer
          marketing — with Instroom.
        </p>
        <div className="flex gap-3 justify-center mb-4">
          <Link href="/signup">
            <Button
              style={{ background: "#fff", color: "#1FAE5B", fontWeight: 700 }}
              className="h-12 px-8 rounded-xl hover:bg-emerald-50"
            >
              Get Started for Free
            </Button>
          </Link>
          <Button
            style={{ background: "transparent", border: "0.5px solid rgba(255,255,255,0.35)", color: "rgba(255,255,255,0.8)" }}
            className="h-12 px-8 rounded-xl hover:bg-white/10 font-medium"
          >
            Book a Demo
          </Button>
        </div>
        <p className="text-xs text-white/30">Free Forever. No Credit Card.</p>
      </div>
    </section>
  )
}
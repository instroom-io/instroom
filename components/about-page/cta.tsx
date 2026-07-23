"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BookDemoModal } from "@/components/shared/book-demo-modal"

export function AboutCTA() {
  const [showBookDemo, setShowBookDemo] = useState(false)
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
        <div className="flex gap-3 justify-center mb-4 flex-wrap">
          <Link href="/signup">
            <Button className="bg-[#1FAE5B] text-white font-bold h-13 px-9 rounded-xl hover:bg-[#158a48] shadow-lg shadow-emerald-500/40 text-base transition-all duration-150" style={{ height: "52px", fontSize: "1rem" }}>
              Try it for Free
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => setShowBookDemo(true)}
            className="h-13 px-9 rounded-xl border-2 border-white/40 text-white bg-transparent hover:bg-white/10 hover:border-white/60 font-semibold text-base transition-all duration-150" style={{ height: "52px", fontSize: "1rem" }}
          >
            Book a Demo
          </Button>
        </div>
        <p className="text-xs text-white/30">Free Forever. No Credit Card.</p>
      </div>
      <BookDemoModal open={showBookDemo} onClose={() => setShowBookDemo(false)} />
    </section>
  )
}
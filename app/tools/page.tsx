import Link from "next/link"
import { MainHeader } from "@/components/shared/main-header"
import { MainFooter } from "@/components/shared/main-footer"

export const metadata = {
  title: "Free Tools | Instroom",
  description: "Free tools for creators and brands — TikTok video downloader, transcription, and rate calculator.",
}

const TOOLS = [
  {
    title: "TikTok Downloader Without Watermark",
    desc: "Save TikTok videos in HD, no watermark.",
    href: "/tools/tiktok-downloader",
    soon: false,
  },
  {
    title: "Transcribe TikTok & Instagram to Text",
    desc: "Turn videos into text captions instantly.",
    href: "#",
    soon: true,
  },
  {
    title: "Influencer Rate Calculator",
    desc: "Estimate fair rates for sponsored content.",
    href: "#",
    soon: true,
  },
]

export default function FreeToolsPage() {
  return (
    <div className="font-sans bg-white text-zinc-900">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&display=swap');`}</style>
      <MainHeader />

      <section style={{ background: "#F7F9F8", padding: "64px 24px" }}>
        <div className="max-w-4xl mx-auto text-center">
          <h1
            style={{ fontFamily: "'Manrope', sans-serif", fontSize: "40px", fontWeight: 900, letterSpacing: "-0.02em", color: "#1E1E1E" }}
          >
            Free <span style={{ color: "#1FAE5B" }}>Tools</span>
          </h1>
          <p className="mt-4 text-base text-zinc-600 max-w-xl mx-auto">
            Handy, free tools for creators and brands — no login required.
          </p>
        </div>
      </section>

      <section style={{ padding: "56px 24px 96px" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5">
          {TOOLS.map((tool) => {
            const card = (
              <div
                style={{
                  borderRadius: 16,
                  padding: "26px 22px",
                  border: "1px solid #eef1ef",
                  boxShadow: tool.soon ? "none" : "0 4px 16px rgba(0,0,0,0.04)",
                  height: "100%",
                  opacity: tool.soon ? 0.6 : 1,
                  background: "#fff",
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <h2 style={{ fontFamily: "'Manrope', sans-serif", fontSize: "1.0625rem", fontWeight: 700, color: "#1E1E1E" }}>
                    {tool.title}
                  </h2>
                  {tool.soon && (
                    <span style={{ fontSize: 9.5, background: "#f0f0f0", color: "#6b7280", borderRadius: 4, padding: "2px 6px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", flexShrink: 0 }}>
                      Soon
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "0.8125rem", color: "#6b7280", lineHeight: 1.55 }}>{tool.desc}</p>
              </div>
            )

            return tool.soon ? (
              <div key={tool.title} style={{ cursor: "default" }}>{card}</div>
            ) : (
              <Link key={tool.title} href={tool.href} style={{ textDecoration: "none" }}>{card}</Link>
            )
          })}
        </div>
      </section>

      <MainFooter />
    </div>
  )
}

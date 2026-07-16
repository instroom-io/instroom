"use client"

import Link from "next/link"

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
    soon: true,
  },
  {
    title: "Influencer Rate Calculator",
    desc: "Estimate fair rates for sponsored content.",
    soon: true,
  },
]

export function FreeToolsTooltip({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 10px)",
        left: 0,
        width: 260,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
        padding: 8,
        zIndex: 50,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", padding: "4px 8px 6px" }}>
        Free Tools
      </div>
      {TOOLS.map((tool) =>
        tool.soon ? (
          <div key={tool.title} style={{ padding: "8px 8px", borderRadius: 8, opacity: 0.55, cursor: "default" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1E1E1E" }}>{tool.title}</span>
              <span style={{ fontSize: 8.5, background: "#f0f0f0", color: "#6b7280", borderRadius: 4, padding: "1px 5px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", flexShrink: 0 }}>
                Soon
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{tool.desc}</div>
          </div>
        ) : (
          <Link
            key={tool.title}
            href={tool.href!}
            onClick={onClose}
            style={{ display: "block", padding: "8px 8px", borderRadius: 8, textDecoration: "none", transition: "background 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f4faf7")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{tool.title}</span>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{tool.desc}</div>
          </Link>
        )
      )}
    </div>
  )
}

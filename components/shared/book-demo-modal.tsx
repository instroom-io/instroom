"use client"

import { useEffect } from "react"

const BOOKING_URL = "https://api.leadconnectorhq.com/widget/booking/fYhRA8Yxw2jlk8pwd79B"
const EMBED_SCRIPT_SRC = "https://link.msgsndr.com/js/form_embed.js"
const TOP_CROP = 72

export function BookDemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    if (!document.querySelector(`script[src="${EMBED_SCRIPT_SRC}"]`)) {
      const script = document.createElement("script")
      script.src = EMBED_SCRIPT_SRC
      script.async = true
      document.body.appendChild(script)
    }

    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Book a demo"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 1024,
          maxHeight: "90vh",
          background: "#fff",
          borderRadius: 16,
          overflow: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.08)",
            color: "#1E1E1E",
            fontSize: 18,
            lineHeight: 1,
            cursor: "pointer",
            zIndex: 1,
          }}
        >
          ×
        </button>
        <div style={{ overflow: "hidden", borderRadius: 16 }}>
          <iframe
            src={BOOKING_URL}
            style={{
              width: "100%",
              minHeight: 650 + TOP_CROP,
              border: "none",
              display: "block",
              marginTop: -TOP_CROP,
            }}
            scrolling="no"
            id="book-demo-widget"
            title="Book a demo"
          />
        </div>
      </div>
    </div>
  )
}

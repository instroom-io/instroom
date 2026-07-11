"use client"

import { useState } from "react"

type Result = {
  id: string
  title: string
  cover: string
  downloadUrl: string
  duration: number | null
  likes: number
  comments: number
  shares: number
  author: string | null
  authorAvatar: string | null
}

const CHECKLIST = ["Free", "No login", "No watermark", "Fast and Secure", "MP4 Format"]

function formatNum(n: number) {
  if (!n) return "0"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return String(n)
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, "0")}`
}

const proxied = (src: string) => `/api/proxy-image?url=${encodeURIComponent(src)}`

const fileUrl = (result: Result) =>
  `/api/tools/tiktok-downloader/file?url=${encodeURIComponent(result.downloadUrl)}&filename=${encodeURIComponent(`tiktok_${result.id}.mp4`)}`

function triggerBrowserDownload(href: string) {
  const link = document.createElement("a")
  link.href = href
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function TikTokDownloaderHero() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const handleDownload = async (value?: string) => {
    const target = (value ?? url).trim()
    if (!target) {
      setError("Please paste a TikTok video link.")
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/tools/tiktok-downloader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.")
        return
      }
      setResult(data)
      triggerBrowserDownload(fileUrl(data))
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setUrl("")
    setResult(null)
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleDownload()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").trim()
    if (!pasted) return
    setUrl(pasted)
    handleDownload(pasted)
  }

  return (
    <section style={{ background: "linear-gradient(180deg, #0B2A1D 0%, #0F3D28 100%)", padding: "72px 24px 64px" }}>
      <div className="max-w-2xl mx-auto text-center">
        <h1
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: "44px",
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#fff",
          }}
        >
          Download <span style={{ color: "#1FAE5B" }}>TikTok Videos</span> Without Watermark
        </h1>
        <p className="mt-4 text-base" style={{ color: "rgba(255,255,255,0.65)" }}>
          Paste a TikTok link below to save the video instantly, without logos or branding.
        </p>

        <div className="tiktok-dl-input-row mt-8 flex flex-col sm:flex-row gap-3 items-stretch">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Paste TikTok video link here..."
            style={{
              flex: 1,
              height: 56,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "0 22px",
              fontSize: "0.95rem",
              outline: "none",
              background: "#fff",
              color: "#1E1E1E",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            }}
          />
          <button
            onClick={() => handleDownload()}
            disabled={loading}
            style={{
              height: 56,
              borderRadius: 999,
              border: "none",
              padding: "0 32px",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#fff",
              background: loading ? "#1c4a37" : "#1FAE5B",
              cursor: loading ? "default" : "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {loading ? "Fetching..." : "Download"}
          </button>
        </div>
        <style jsx>{`
          .tiktok-dl-input-row input::placeholder {
            color: #9ca3af;
          }
        `}</style>

        {error && (
          <p className="mt-4 text-sm" style={{ color: "#ff8a8a" }}>
            {error}
          </p>
        )}

        {result && (
          <div
            className="mt-6 text-left"
            style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 12px 32px rgba(0,0,0,0.25)" }}
          >
            {/* Cover banner */}
            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#f0f0f0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxied(result.cover)}
                alt={result.title || "TikTok video"}
                style={{ width: "100%", height: 220, objectFit: "cover", objectPosition: "top", display: "block" }}
              />
              {result.duration && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 10,
                    background: "rgba(0,0,0,0.7)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 8,
                  }}
                >
                  {formatDuration(result.duration)}
                </span>
              )}
            </div>

            {/* Author + stats */}
            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {result.authorAvatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxied(result.authorAvatar)}
                    alt={result.author || ""}
                    style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                )}
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0F6B3E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  @{result.author || "unknown"}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0" style={{ fontSize: "0.78rem", color: "#6b7280", fontWeight: 600 }}>
                <span>❤ {formatNum(result.likes)}</span>
                <span>💬 {formatNum(result.comments)}</span>
                <span>↗ {formatNum(result.shares)}</span>
              </div>
            </div>

            {result.title && (
              <p style={{ marginTop: 10, fontSize: "0.8125rem", color: "#4b5563", lineHeight: 1.5 }}>{result.title}</p>
            )}

            {/* Download */}
            <div className="mt-4">
              <a
                href={fileUrl(result)}
                className="flex items-center gap-3"
                style={{ borderRadius: 12, padding: "12px 14px", background: "#0F6B3E", color: "#fff", textDecoration: "none" }}
              >
                <span style={{ fontSize: "1.1rem" }}>⬇</span>
                <span className="flex-1">
                  <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 700 }}>Download Video</span>
                  <span style={{ display: "block", fontSize: "0.7rem", opacity: 0.8 }}>No watermark · MP4</span>
                </span>
              </a>
            </div>

            <button
              onClick={reset}
              style={{ marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 10, border: "1px solid #e5e7eb", background: "transparent", color: "#6b7280", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}
            >
              Download another
            </button>
          </div>
        )}

        {!result && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {CHECKLIST.map((label) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="7.5" r="6.5" stroke="#1FAE5B" strokeWidth="1.4" />
                  <path d="M4.8 7.6l1.8 1.8L10.4 5.6" stroke="#1FAE5B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {label}
              </span>
            ))}
          </div>
        )}

        <p className="mt-8 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          Please only download videos you own or have permission to use.
        </p>
      </div>
    </section>
  )
}

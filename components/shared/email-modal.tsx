"use client"

import { useState, useEffect } from "react"

// Sends from whichever email account the user is logged in / connected
// with — no manual provider picker. Tries Gmail (tied to Google login)
// first, then falls back to Outlook if Gmail isn't connected.
export function EmailModal({
  partnerName,
  handle,
  platform,
  brandId,
  defaultTo,
  onClose,
}: {
  partnerName: string
  handle:      string
  platform?:   string
  brandId?:    string
  defaultTo:   string
  onClose:     () => void
}) {
  const [to,        setTo]      = useState(defaultTo)
  const [subject,   setSubject] = useState("")
  const [body,      setBody]    = useState("")
  const [error,     setError]   = useState<string | null>(null)
  const [sending,   setSending] = useState(false)
  const [sent,      setSent]    = useState(false)
  const [lookupState, setLookupState] = useState<"idle" | "looking" | "found" | "not_found">(
    defaultTo ? "found" : "idle"
  )

  // ── Fallback: if no email came with the profile, look the influencer up directly ──
  useEffect(() => {
    if (defaultTo || !handle || !platform || !brandId) return
    let cancelled = false
    setLookupState("looking")
    fetch(`/api/brand/${brandId}/influencers/find?handle=${encodeURIComponent(handle.replace(/^@/, ""))}&platform=${encodeURIComponent(platform)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.email) {
          setTo(data.email)
          setLookupState("found")
        } else {
          setLookupState("not_found")
        }
      })
      .catch(() => { if (!cancelled) setLookupState("not_found") })
    return () => { cancelled = true }
  }, [defaultTo, handle, platform, brandId])

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) return
    setSending(true)
    setError(null)
    const payload = { to: to.trim(), subject: subject.trim() || "(No subject)", body: body.trim() }
    try {
      const gmailRes = await fetch("/api/gmail/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      if (gmailRes.ok) {
        setSent(true)
        setTimeout(onClose, 1400)
        return
      }

      const gmailData = await gmailRes.json()
      if (!gmailData?.reauth) {
        setError(gmailData?.error || "Failed to send email")
        return
      }

      const outlookRes = await fetch("/api/outlook/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      const outlookData = await outlookRes.json()
      if (!outlookRes.ok) {
        setError(outlookData?.reauth ? "Connect your email account in Settings to send messages." : (outlookData?.error || "Failed to send email"))
        return
      }
      setSent(true)
      setTimeout(onClose, 1400)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: 480, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", fontFamily: "'Inter',system-ui,sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid #f3f4f6" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Send email</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>To {partnerName || handle}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9ca3af", lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>
              {error}
            </div>
          )}
          {sent && (
            <div style={{ fontSize: 12, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px" }}>
              Email sent ✓
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280" }}>To</label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={lookupState === "looking" ? "Looking up email…" : "influencer@email.com"}
              disabled={lookupState === "looking"}
              style={{ fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#f9fafb", outline: "none" }}
            />
            {lookupState === "found" && (
              <span style={{ fontSize: 10, color: "#15803d" }}>✓ Auto-filled from influencer profile</span>
            )}
            {lookupState === "not_found" && (
              <span style={{ fontSize: 10, color: "#d97706" }}>No email on file for this influencer — enter one manually</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280" }}>Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              style={{ fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#f9fafb", outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "#6b7280" }}>Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              style={{ fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#f9fafb", outline: "none", minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 24px", borderTop: "1px solid #f3f4f6" }}>
          <button onClick={onClose}
            style={{ padding: "8px 16px", fontSize: 13, color: "#6b7280", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending || !to.trim() || !body.trim()}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, color: "#fff", background: sending || !to.trim() || !body.trim() ? "#9ca3af" : "#1fae5b", border: "none", borderRadius: 8, cursor: sending ? "wait" : "pointer", fontFamily: "inherit", transition: "background .15s" }}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}

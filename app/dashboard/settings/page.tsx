"use client"
// app/dashboard/settings/page.tsx

import { useSession } from "next-auth/react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type Toast = { message: string; type: "success" | "error" }

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)
  const show = (message: string, type: Toast["type"]) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }
  return { toast, show }
}

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const { toast, show } = useToast()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null)
  const [uploading, setUploading]       = useState(false)

  const [firstName, setFirstName]   = useState("")
  const [lastName, setLastName]     = useState("")
  const [email, setEmail]           = useState("")
  const [jobTitle, setJobTitle]     = useState("")
  const [timezone, setTimezone]     = useState("Asia/Manila (UTC+8)")
  const [currency, setCurrency]     = useState("USD ($)")
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY")

  const [savingProfile, setSavingProfile]     = useState(false)
  const [savingPrefs, setSavingPrefs]         = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [confirmDelete, setConfirmDelete]     = useState(false)

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??"

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status !== "authenticated") return

    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) {
          const parts = data.name.split(" ")
          setFirstName(parts[0] ?? "")
          setLastName(parts.slice(1).join(" ") ?? "")
        }
        if (data.email)    setEmail(data.email)
        if (data.jobTitle) setJobTitle(data.jobTitle)
        if (data.image)    setAvatarUrl(data.image)
      })
      .catch(() => {
        if (session?.user?.name) {
          const parts = session.user.name.split(" ")
          setFirstName(parts[0] ?? "")
          setLastName(parts.slice(1).join(" ") ?? "")
        }
        if (session?.user?.email) setEmail(session.user.email)
        if (session?.user?.image) setAvatarUrl(session.user.image)
      })

    fetch("/api/settings/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.timezone)   setTimezone(data.timezone)
        if (data.currency)   setCurrency(data.currency)
        if (data.dateFormat) setDateFormat(data.dateFormat)
      })
      .catch(() => {})
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      show("Please select an image file.", "error")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      show("Image must be under 5 MB.", "error")
      return
    }

    setAvatarUrl(URL.createObjectURL(file))
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      // ← updated from /api/user/update-avatar
      const res = await fetch("/api/settings/profile", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error("Upload failed")

      const data = await res.json()
      setAvatarUrl(data.avatarUrl)
      updateSession({ image: data.avatarUrl })
      show("Photo updated", "success")
    } catch {
      show("Upload failed. Please try again.", "error")
      setAvatarUrl(session?.user?.image ?? null)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true)
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, jobTitle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save profile")
      show("Profile saved successfully", "success")
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Something went wrong", "error")
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSavePrefs() {
    setSavingPrefs(true)
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, currency, dateFormat }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save preferences")
      show("Preferences saved", "success")
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Something went wrong", "error")
    } finally {
      setSavingPrefs(false)
    }
  }

  async function handleDeleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeletingAccount(true)
    try {
      const res = await fetch("/api/settings/account", { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete account")
      router.push("/login")
    } catch (err: unknown) {
      show(err instanceof Error ? err.message : "Something went wrong", "error")
      setDeletingAccount(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div style={{ padding: "28px 36px", maxWidth: 780 }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 24,
            zIndex: 9999,
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            background: toast.type === "success" ? "#1FAE5B" : "#E24B4A",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ fontSize: 18, fontWeight: 600, color: "#1E1E1E", marginBottom: 4 }}>Profile</div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 24 }}>Manage your personal account information</div>

      {/* Personal Information Card */}
      <div style={card}>
        <div style={cardHeader}>
          <div style={cardIcon}>
            <svg viewBox="0 0 16 16" fill="none" stroke="#1FAE5B" strokeWidth="1.5" width={16} height={16}>
              <circle cx="8" cy="5" r="3" />
              <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            </svg>
          </div>
          <div>
            <div style={cardTitle}>Personal Information</div>
            <div style={cardDesc}>Your name and email visible across the workspace</div>
          </div>
        </div>
        <div style={cardBody}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                style={{ ...avatar, objectFit: "cover" } as React.CSSProperties}
              />
            ) : (
              <div style={avatar}>{initials}</div>
            )}

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                style={auBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading…" : "Change photo"}
              </button>
              <div style={hint}>PNG, JPG or WebP · max 5MB</div>
            </div>
          </div>

          <div style={fGrid}>
            <div style={fGroup}>
              <label style={fLabel}>First name</label>
              <input
                style={fInput}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div style={fGroup}>
              <label style={fLabel}>Last name</label>
              <input
                style={fInput}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
            <div style={{ ...fGroup, gridColumn: "1 / -1" }}>
              <label style={fLabel}>Email address</label>
              <input
                style={fInput}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div style={{ ...fGroup, gridColumn: "1 / -1" }}>
              <label style={fLabel}>
                Job title <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                style={fInput}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Marketing Manager"
              />
            </div>
          </div>

          <div style={btnRow}>
            <button style={btnPrimary} onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Preferences Card */}
      <div style={card}>
        <div style={cardHeader}>
          <div style={cardIcon}>
            <svg viewBox="0 0 16 16" fill="none" stroke="#1FAE5B" strokeWidth="1.5" width={16} height={16}>
              <rect x="1" y="4" width="14" height="9" rx="2" />
              <path d="M1 8h14" />
            </svg>
          </div>
          <div>
            <div style={cardTitle}>Preferences</div>
            <div style={cardDesc}>Language, timezone and display settings</div>
          </div>
        </div>
        <div style={cardBody}>
          <div style={fGrid}>
            <div style={fGroup}>
              <label style={fLabel}>Timezone</label>
              <select style={fInput} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option>Asia/Manila (UTC+8)</option>
                <option>Asia/Singapore (UTC+8)</option>
                <option>America/New_York (UTC-5)</option>
                <option>Europe/London (UTC+0)</option>
              </select>
            </div>
            <div style={fGroup}>
              <label style={fLabel}>Currency display</label>
              <select style={fInput} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option>USD ($)</option>
                <option>PHP (₱)</option>
                <option>SGD (S$)</option>
                <option>EUR (€)</option>
              </select>
            </div>
            <div style={fGroup}>
              <label style={fLabel}>Date format</label>
              <select style={fInput} value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                <option>MM/DD/YYYY</option>
                <option>DD/MM/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </div>
          </div>
          <div style={btnRow}>
            <button style={btnPrimary} onClick={handleSavePrefs} disabled={savingPrefs}>
              {savingPrefs ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={dangerZone}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#a32d2d", marginBottom: 4 }}>Danger zone</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
          {confirmDelete
            ? "Are you sure? This permanently deletes your account and all data. Click again to confirm."
            : "Permanently delete your account and all associated data. This action cannot be undone."}
        </div>
        <button
          style={{
            ...btnDanger,
            ...(confirmDelete ? { background: "#E24B4A", color: "#fff" } : {}),
          }}
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete account"}
        </button>
        {confirmDelete && (
          <button
            style={{ ...auBtn, marginLeft: 8 }}
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  marginBottom: 16,
  overflow: "hidden",
}
const cardHeader: React.CSSProperties = {
  padding: "16px 20px",
  borderBottom: "0.5px solid rgba(0,0,0,0.07)",
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
}
const cardIcon: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 9,
  background: "#f0faf5",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
}
const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#1E1E1E" }
const cardDesc: React.CSSProperties  = { fontSize: 11, color: "#888", marginTop: 2 }
const cardBody: React.CSSProperties  = { padding: 20 }
const fGrid: React.CSSProperties     = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }
const fGroup: React.CSSProperties    = { display: "flex", flexDirection: "column", gap: 4 }
const fLabel: React.CSSProperties    = { fontSize: 11, fontWeight: 600, color: "#555", letterSpacing: "0.02em" }
const fInput: React.CSSProperties    = {
  width: "100%",
  fontSize: 12,
  padding: "9px 12px",
  borderRadius: 8,
  border: "0.5px solid rgba(0,0,0,0.15)",
  background: "#fff",
  color: "#1E1E1E",
  fontFamily: "inherit",
}
const hint: React.CSSProperties   = { fontSize: 10, color: "#aaa", marginTop: 2 }
const avatar: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: "#1FAE5B",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  fontWeight: 700,
  color: "#fff",
  flexShrink: 0,
}
const auBtn: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  padding: "6px 14px",
  borderRadius: 8,
  border: "0.5px solid rgba(0,0,0,0.15)",
  background: "#fff",
  color: "#555",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "inline-block",
  marginBottom: 4,
}
const btnRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 16,
  paddingTop: 14,
  borderTop: "0.5px solid rgba(0,0,0,0.06)",
}
const btnPrimary: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  padding: "8px 18px",
  borderRadius: 9,
  border: "none",
  background: "#1FAE5B",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  opacity: 1,
}
const btnDanger: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  padding: "8px 14px",
  borderRadius: 9,
  border: "0.5px solid #E24B4A",
  background: "#fff",
  color: "#E24B4A",
  cursor: "pointer",
  fontFamily: "inherit",
}
const dangerZone: React.CSSProperties = {
  border: "0.5px solid rgba(226,75,74,0.25)",
  borderRadius: 10,
  padding: "16px 18px",
  background: "#fdf5f5",
}
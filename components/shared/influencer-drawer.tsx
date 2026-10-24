"use client"

import { useState, type ReactNode } from "react"
import { ProfilePicture, PlatformIcon } from "@/components/table-sheet/ui-atoms"
import { getProfileUrl, getPlatformLabel } from "@/components/table-sheet/utils"

/** Drawer chrome shared by the Influencers List, Pipeline and Post Tracker drawers. */

/** Instagram's "message me" link opens a DM directly; other platforms open the profile. */
function getDmUrl(platform: string, handle: string): string {
  const clean = handle.replace(/^@/, "")
  if (platform === "instagram") return `https://ig.me/m/${clean}`
  return getProfileUrl(platform, handle)
}

export function DrawerShell({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="dr-backdrop" onClick={onClose} />
      {/* .pp / data-profile-panel let globals.css move notices aside. */}
      <div className="pp" data-profile-panel>
        <button onClick={onClose} title="Close" className="dr-close">✕</button>
        {children}
      </div>
      <style jsx>{`
        .dr-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.3); z-index:400; cursor:pointer; }
        .pp { position:fixed; top:0; right:0; width:560px; max-width:100vw; height:100%; background:#fff; box-shadow:-8px 0 40px rgba(0,0,0,0.14); z-index:500; display:flex; flex-direction:column; font-family:"Inter",system-ui,sans-serif; }
        .dr-close { position:absolute; top:16px; right:16px; z-index:1; width:30px; height:30px; border-radius:50%; border:1.5px solid #e5e7eb; background:#f9fafb; color:#374151; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; line-height:1; transition:background .15s,border-color .15s,color .15s; }
        .dr-close:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
      `}</style>
    </>
  )
}

export function DrawerHeader({
  name, handle, platform, avatarUrl, handleExtra, controls, notice, onSendEmail, onNotify,
}: {
  name?: string | null
  handle: string
  platform?: string | null
  avatarUrl?: string | null
  /** Small element shown after the @handle (e.g. the research-guide button). */
  handleExtra?: ReactNode
  /** Right-hand dropdowns (Stage, Status / Collaboration type). */
  controls?: ReactNode
  /** Banner under the name row (e.g. "Marked as Not Interested"). */
  notice?: ReactNode
  onSendEmail: () => void
  /** Copy Link feedback as a toast; without it the button label changes instead. */
  onNotify?: (message: string, type: "success" | "error") => void
}) {
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null)
  const plat = (platform ?? "").toLowerCase()
  const cleanHandle = handle.replace(/^@/, "")
  const displayName = name?.trim() || cleanHandle
  const profileUrl = getProfileUrl(plat, cleanHandle)
  const open = (url: string) => { if (url) window.open(url, "_blank", "noopener,noreferrer") }

  const copyLink = async () => {
    if (!profileUrl) return
    let ok = true
    try { await navigator.clipboard.writeText(profileUrl) } catch { ok = false }
    if (onNotify) {
      onNotify(ok ? "Profile link copied" : "Couldn't copy link", ok ? "success" : "error")
    } else {
      setCopied(ok ? "copied" : "failed")
      setTimeout(() => setCopied(null), 2000)
    }
  }

  return (
    <div className="dh">
      <div className="dh-title">Influencer Profile</div>
      <div className="dh-row">
        <div className="dh-avatar">
          {avatarUrl
            ? <ProfilePicture src={avatarUrl} socialLink={profileUrl} name={displayName} handle={cleanHandle} size={44} />
            : displayName.charAt(0).toUpperCase()}
        </div>
        <div className="dh-names">
          <div className="dh-name">{displayName}</div>
          <div className="dh-handle">@{cleanHandle}{handleExtra}</div>
        </div>
        {controls && <div className="dh-controls">{controls}</div>}
      </div>
      {notice}
      <div className="dh-actions">
        <button className="atag plat" onClick={() => open(profileUrl)}>
          <PlatformIcon platform={plat} size={14} className="shrink-0" />
          <span className="truncate">{getPlatformLabel(plat) || "—"}</span>
        </button>
        <button className="atag" onClick={onSendEmail}>Send Email</button>
        <button className="atag" onClick={() => open(getDmUrl(plat, cleanHandle))}>Send DM</button>
        <button className="atag" onClick={copyLink}>
          {copied === "copied" ? "Copied ✓" : copied === "failed" ? "Couldn't copy" : "Copy Link"}
        </button>
      </div>
      <style jsx>{`
        .dh { padding:16px; border-bottom:1px solid #f0f0f0; }
        .dh-title { font-size:11px; font-weight:600; color:#9ca3af; letter-spacing:.1em; text-transform:uppercase; margin-bottom:12px; padding-right:40px; }
        .dh-row { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-bottom:12px; padding-right:40px; }
        .dh-avatar { width:44px; height:44px; border-radius:50%; background:#1fae5b; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; color:#fff; flex-shrink:0; box-shadow:0 0 0 3px #dcfce7; overflow:hidden; }
        .dh-names { flex:1 0 auto; min-width:0; }
        .dh-name { font-size:15px; font-weight:700; color:#111827; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dh-handle { font-size:12px; color:#6b7280; margin-top:2px; display:flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dh-controls { display:flex; gap:6px; flex-wrap:wrap; align-items:flex-start; }
        .dh-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .atag { font-size:12px; font-weight:500; padding:6px 14px; border-radius:20px; cursor:pointer; border:1px solid #e5e7eb; background:#f9fafb; color:#555; font-family:inherit; transition:background .15s,border-color .15s,color .15s; }
        .atag:not(.plat):hover { background:#eafaf1; border-color:#1fae5b; color:#1fae5b; }
        .atag.plat { background:#1fae5b; color:#fff; border-color:#1fae5b; display:inline-flex; align-items:center; gap:6px; min-width:0; line-height:1; }
      `}</style>
    </div>
  )
}

/** Labelled dropdown wrapper for the header's Stage / Status / Collaboration type. */
export function DrawerControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </div>
  )
}

export type DrawerTab = {
  id: number
  label: string
  /** Shown greyed with this hover note; the tab can't be opened. */
  disabledReason?: string | null
  hidden?: boolean
}

export function DrawerTabs({ tabs, active, onSelect }: { tabs: DrawerTab[]; active: number; onSelect: (id: number) => void }) {
  return (
    <div className="dt-bar thin-scroll">
      {tabs.filter(t => !t.hidden).map(t => (
        <div
          key={t.id}
          title={t.disabledReason ?? undefined}
          className={`dt ${active === t.id ? "active" : ""} ${t.disabledReason ? "disabled" : ""}`}
          onClick={() => { if (!t.disabledReason) onSelect(t.id) }}
        >
          {t.label}
        </div>
      ))}
      <style jsx>{`
        .dt-bar { display:flex; gap:0; padding:0 16px; border-bottom:1px solid #f0f0f0; overflow-x:auto; }
        .dt { font-size:12px; font-weight:600; padding:11px 12px; cursor:pointer; color:#9ca3af; border-bottom:2px solid transparent; white-space:nowrap; transition:color .15s; flex-shrink:0; }
        .dt.active { color:#1fae5b; border-bottom-color:#1fae5b; }
        .dt.disabled { color:#d1d5db; cursor:not-allowed; }
      `}</style>
    </div>
  )
}

/** The tab to show: the requested one, or the first usable tab if it's hidden or disabled. */
export function resolveActiveTab(tabs: DrawerTab[], requested: number): number {
  const ok = (t?: DrawerTab) => t && !t.hidden && !t.disabledReason
  return ok(tabs.find(t => t.id === requested)) ? requested : tabs.find(t => ok(t))?.id ?? requested
}

export function DrawerBody({ children }: { children: ReactNode }) {
  return (
    <div className="db thin-scroll">
      {children}
      <style jsx>{`
        .db { flex:1; overflow-y:auto; padding:18px 16px; }
      `}</style>
    </div>
  )
}

/** Save/Cancel bar pinned to the bottom of DrawerBody while its tab scrolls. */
export function DrawerActionBar({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
      position: "sticky", bottom: -18, margin: "8px -16px -18px",
      padding: "10px 16px", background: "#fff", borderTop: "1px solid #eee", zIndex: 2,
    }}>
      {children}
    </div>
  )
}

"use client"
// table-sheet/ui-atoms.tsx
// Tiny presentational components with no state: badges, icons, avatars

import React, { useState } from "react"
import { IconWorld } from "@tabler/icons-react"
import { platforms } from "./constants"
import { APPROVAL_STYLE, STATUS_STYLE, STATUS_LABEL } from "./constants"
import { getInitials, stringToColor, isValidUrl, normalizeUrl } from "./utils"

// ── Platform icon ─────────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, React.ReactNode> = {}
platforms.forEach(p => { PLATFORM_ICONS[p.value] = p.icon })

export function PlatformIcon({ platform, size = 16, className = "" }: { platform: string; size?: number; className?: string }) {
  const icon = PLATFORM_ICONS[platform]
  if (!icon) return <IconWorld size={size} className={className} />
  return (
    <span className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {React.cloneElement(icon as React.ReactElement, { className: "w-full h-full", style: { width: size, height: size } } as any)}
    </span>
  )
}

// ── Profile picture / avatar ──────────────────────────────────────────────────

export function ProfilePicture({
  src, socialLink, name, handle, size = 22, onExpired,
}: {
  src?: string; socialLink?: string; name?: string; handle?: string; size?: number; onExpired?: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const needsProxy = src && !src.startsWith("data:") && (
    src.includes("cdninstagram.com") || src.includes("scontent-") ||
    src.includes("tiktokcdn") || src.includes("tiktokcdn-eu") ||
    src.includes("p16-common") || src.includes("p19-common") ||
    src.includes("muscdn.com") || src.includes("tiktok.com/aweme")
  )
  const proxySrc = src ? (needsProxy ? `/api/proxy-image?url=${encodeURIComponent(src)}` : src) : null
  const hasSrc = proxySrc && !imgError

  const handleError = () => { setImgError(true); if (needsProxy && onExpired) onExpired() }

  const initials = getInitials(name, handle)
  const colorKey = name?.trim() || handle?.trim().replace(/^@/, "") || "?"
  const { bg, text } = stringToColor(colorKey)
  const fontSize = size <= 24 ? size * 0.38 : size * 0.36

  const content = hasSrc ? (
    <img src={proxySrc} alt={name || "Profile"} onError={handleError}
      className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold select-none"
      style={{ width: size, height: size, background: bg, color: text, fontSize }}>
      {initials}
    </div>
  )

  if (socialLink) {
    return (
      <a href={socialLink.startsWith("http") ? socialLink : `https://${socialLink}`}
        target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 rounded-full hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer"
        title={`Open profile${name ? ` (${name})` : ""}`}>
        {content}
      </a>
    )
  }
  return <span className="flex-shrink-0">{content}</span>
}

// ── Badges ────────────────────────────────────────────────────────────────────

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-block truncate max-w-full px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[value] ?? "bg-gray-100 text-gray-500"}`}>
      {STATUS_LABEL[value] || value || "—"}
    </span>
  )
}

export function ApprovalBadge({ value }: { value: string }) {
  return (
    <span className={`inline-block truncate max-w-full px-1.5 py-0.5 rounded text-[10px] font-medium ${APPROVAL_STYLE[value] ?? "bg-gray-100 text-gray-500"}`}>
      {value || "Pending"}
    </span>
  )
}

// ── Multi-select display ──────────────────────────────────────────────────────

export function MultiSelectDisplay({ value }: { value: string }) {
  const tags = value ? value.split(",").map(s => s.trim()).filter(Boolean) : []
  if (!tags.length) return <span className="text-gray-300">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(t => (
        <span key={t} className="inline-flex items-center px-1 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] font-medium leading-none">{t}</span>
      ))}
    </div>
  )
}
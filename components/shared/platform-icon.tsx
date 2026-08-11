"use client"
// components/shared/platform-icon.tsx
// The one platform-logo implementation. Instagram, TikTok and YouTube always
// render the real brand mark from @tabler/icons-react — the project's icon
// library, already used for exactly this purpose in the post tracker
// (app/dashboard/post-tracker/DetectedPostsList.tsx). No emoji, no generic
// camera/music/play stand-ins, and no remote asset: the marks are inlined SVG,
// so they can't fail to load or be blocked.
//
// Platform keys are matched case-insensitively, because different parts of the
// app store them differently ("Instagram" in analytics and the kanban board,
// "instagram" in the table sheet).

import {
  IconBrandInstagram, IconBrandTiktok, IconBrandYoutube, IconWorld,
} from "@tabler/icons-react"

type PlatformEntry = {
  Icon: typeof IconWorld
  label: string
  /** Brand colour for the mark itself. */
  color: string
  /** Faint tint for the rounded container behind it. */
  tint: string
}

/* Colours: Instagram and TikTok reuse the values already established in
   DetectedPostsList so the two screens agree; YouTube follows its own brand
   red at the same weight. */
const PLATFORMS: Record<string, PlatformEntry> = {
  instagram: { Icon: IconBrandInstagram, label: "Instagram", color: "#C13584", tint: "rgba(225, 48, 108, 0.10)" },
  tiktok:    { Icon: IconBrandTiktok,    label: "TikTok",    color: "#1F1F1F", tint: "rgba(17, 17, 17, 0.08)" },
  youtube:   { Icon: IconBrandYoutube,   label: "YouTube",   color: "#FF0000", tint: "rgba(255, 0, 0, 0.10)" },
}

/** Look up a platform's presentation, or null when it isn't one we know. */
export function getPlatformMeta(platform: string) {
  return PLATFORMS[platform?.trim().toLowerCase()] ?? null
}

/**
 * The bare brand mark.
 *
 * Decorative by default: every current call site prints the platform name as
 * text right beside it, so the icon is hidden from screen readers rather than
 * read out twice. Pass `labelled` where the mark stands alone.
 */
export function PlatformIcon({
  platform,
  size = 16,
  stroke = 1.9,
  color,
  className = "",
  labelled = false,
}: {
  platform: string
  size?: number
  stroke?: number
  /** Override the brand colour — e.g. to inherit the surrounding text colour. */
  color?: string
  className?: string
  labelled?: boolean
}) {
  const meta = getPlatformMeta(platform)
  const Icon = meta?.Icon ?? IconWorld
  const label = meta?.label ?? platform

  return (
    <Icon
      size={size}
      stroke={stroke}
      color={color ?? meta?.color ?? "currentColor"}
      className={className}
      {...(labelled ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  )
}

/**
 * The brand mark inside the small rounded container used by the analytics
 * rows. `tint` overrides the default background so existing per-screen
 * treatments can be preserved exactly.
 */
export function PlatformBadge({
  platform,
  size = 24,
  iconSize = 15,
  tint,
  className = "",
}: {
  platform: string
  /** Container edge length in px. */
  size?: number
  iconSize?: number
  tint?: string
  className?: string
}) {
  const meta = getPlatformMeta(platform)

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md ${className}`}
      style={{ width: size, height: size, backgroundColor: tint ?? meta?.tint ?? "#f3f4f6" }}
    >
      <PlatformIcon platform={platform} size={iconSize} />
    </span>
  )
}

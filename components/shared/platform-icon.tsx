"use client"
// components/shared/platform-icon.tsx
// The one platform-logo implementation. Instagram, TikTok and YouTube render
// their official brand marks as inlined SVG (the glyphs published by each
// brand), so they can't fail to load or be blocked, and unknown platforms fall
// back to @tabler/icons-react's IconWorld — the project's icon library.
//
// Platform keys are matched case-insensitively, because different parts of the
// app store them differently ("Instagram" in analytics and the kanban board,
// "instagram" in the table sheet).

import type { ReactElement, SVGProps } from "react"
import { IconWorld } from "@tabler/icons-react"

type MarkProps = SVGProps<SVGSVGElement> & { size: number; color: string }

/* Official brand glyphs, drawn on the brands' own 24x24 grid. */
function InstagramMark({ size, color, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} {...rest}>
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.9.422.421.682.819.9 1.381.163.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.9 1.382-.419.422-.824.682-1.38.9-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.9-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
    </svg>
  )
}

function TiktokMark({ size, color, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} {...rest}>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

function YoutubeMark({ size, color, ...rest }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} {...rest}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
    </svg>
  )
}

type PlatformEntry = {
  Mark: (props: MarkProps) => ReactElement
  label: string
  /** Brand colour for the mark itself. */
  color: string
  /** Faint tint for the rounded container behind it. */
  tint: string
}

/* Colours: each platform's own brand colour, at the weight already used across
   the dashboard. */
const PLATFORMS: Record<string, PlatformEntry> = {
  instagram: { Mark: InstagramMark, label: "Instagram", color: "#E1306C", tint: "rgba(225, 48, 108, 0.10)" },
  tiktok:    { Mark: TiktokMark,    label: "TikTok",    color: "#1F1F1F", tint: "rgba(17, 17, 17, 0.08)" },
  youtube:   { Mark: YoutubeMark,   label: "YouTube",   color: "#FF0000", tint: "rgba(255, 0, 0, 0.10)" },
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
  color,
  className = "",
  labelled = false,
}: {
  platform: string
  size?: number
  /** Override the brand colour — e.g. to inherit the surrounding text colour. */
  color?: string
  className?: string
  labelled?: boolean
}) {
  const meta = getPlatformMeta(platform)
  const label = meta?.label ?? platform
  const a11y = labelled ? { role: "img", "aria-label": label } : { "aria-hidden": true }

  if (!meta) {
    return <IconWorld size={size} stroke={1.9} color={color ?? "currentColor"} className={className} {...a11y} />
  }

  const Mark = meta.Mark
  return <Mark size={size} color={color ?? meta.color} className={className} {...a11y} />
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

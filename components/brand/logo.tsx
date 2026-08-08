// The one Instroom logo.
//
// Before this component the logo was pasted into eleven places with eleven
// different sets of numbers, and most of them were wrong in the same way:
//
//   width={140} height={140}
//
// on an asset that is 3706×2021 — an aspect ratio of 1.834, not 1.0. next/image
// uses those two numbers to reserve space before the file loads, so every one of
// those pages reserved a square, painted a wide logo into it, and shifted its
// neighbours when the real dimensions arrived. That is the overflow-and-overlap:
// not a styling mistake in any single page, but the same wrong ratio repeated.
//
// A second, subtler version of the same problem lived in the asset itself: the
// source PNGs carried 42% transparent padding vertically, so even a correct
// height reserved far more space than the artwork filled and the logo read as
// small and weak. The cropped copies below fix that — see LOGO_ASSETS.
//
// So the intrinsic dimensions here are the file's real ones, declared once and
// derived from the asset rather than typed by hand at each call site. Size is
// chosen by height token; width follows from the ratio automatically. It is not
// possible to ask this component for a distorted logo.

import Image from "next/image"
import { cn } from "@/lib/utils"

/* ── Assets ───────────────────────────────────────────────────────────────── */

/**
 * Intrinsic pixel dimensions are the actual file dimensions. Changing an asset
 * means updating its numbers here, and nowhere else.
 */
const LOGO_ASSETS = {
  // Tight-cropped copies of "INSTROOM LOGO 1.png" / "INSTROOM WHITE.png".
  //
  // The originals are 3706x2021 canvases holding 3277x1180 of actual artwork —
  // 516px of transparent padding above it and 325px below. That padding is why
  // the logo kept looking undersized: a height token reserved a box, and only
  // 58% of that box was ever ink, so `size="lg"` painted 23px of logo inside a
  // 40px space. Cropping makes the token mean what it says. The originals are
  // untouched on disk.
  /** Full wordmark, dark ink. For light backgrounds. */
  full: { src: "/instroom-wordmark.png", width: 3277, height: 1180 },
  /** Full wordmark, white ink. For dark backgrounds (sidebar, mockups). */
  fullWhite: { src: "/instroom-wordmark-white.png", width: 3277, height: 1180 },
  /** Wider white lockup used in the site footer. Different ratio (2.707). */
  footer: { src: "/images/instroomLogoWhiteFooter.png", width: 3321, height: 1227 },
  /** Square app mark, for tight lockups beside the word "Instroom". */
  mark: { src: "/images/instroomLogo.png", width: 128, height: 128 },
} as const

export type LogoVariant = keyof typeof LOGO_ASSETS

/* ── Sizes ────────────────────────────────────────────────────────────────── */

/**
 * Height tokens, because height is what has to line up: a logo sits in a header
 * row or a sidebar rail next to text and icons, and it is its height that
 * decides whether that row looks level. Width is always `auto`, so no token can
 * squash the artwork.
 *
 * `sizes` tells Next how wide the image will actually paint, so it serves a
 * ~200px file instead of the 3706px original. Generous — it only needs to be
 * the right order of magnitude for the srcset pick.
 */
const LOGO_SIZES = {
  /** Inline product mockups. */
  xs: { className: "h-[9px]", sizes: "32px" },
  /** Compact lockups, onboarding. */
  sm: { className: "h-6", sizes: "96px" },
  /** App headers. */
  md: { className: "h-8", sizes: "128px" },
  /** Marketing navbar lockup. */
  lg: { className: "h-10", sizes: "192px" },
  /**
   * Sidebar brand block. 44px of actual wordmark, ~122px wide at the 2.777
   * ratio — the proportions in the reference screenshot. Its own token rather
   * than reusing `lg`, which the marketing header's lockup also consumes.
   */
  brand: { className: "h-11", sizes: "256px" },
  /** Site footer. */
  xl: { className: "h-12", sizes: "256px" },
  /**
   * The large logo on auth, pricing and onboarding pages.
   *
   * 41/56px rather than the 70/96px this used to say: those numbers were box
   * heights against the padded asset and only ever painted 41/56px of ink.
   * Now that the asset is cropped the token states the real size, so these
   * pages render exactly as before.
   */
  page: { className: "h-[41px] sm:h-14", sizes: "(max-width: 640px) 128px, 192px" },
} as const

export type LogoSize = keyof typeof LOGO_SIZES

/* ── Component ────────────────────────────────────────────────────────────── */

export function Logo({
  variant = "full",
  size = "md",
  alt = "Instroom",
  priority = false,
  className,
}: {
  variant?: LogoVariant
  size?: LogoSize
  /**
   * Empty string when the logo sits next to the word "Instroom" or inside a
   * link that is already labelled — announcing it twice is noise for a screen
   * reader, and an empty alt is the correct way to say "decorative here".
   */
  alt?: string
  /** Set on above-the-fold logos only. */
  priority?: boolean
  className?: string
}) {
  const asset = LOGO_ASSETS[variant]
  const { className: sizeClass, sizes } = LOGO_SIZES[size]

  return (
    <Image
      src={asset.src}
      alt={alt}
      width={asset.width}
      height={asset.height}
      sizes={sizes}
      priority={priority}
      className={cn(
        // w-auto + object-contain: the height token drives the box and the
        // artwork keeps its ratio inside it, whatever the caller does.
        "w-auto object-contain",
        // Never wider than the parent, and never the thing that gets squeezed
        // when a flex row runs out of room — that job belongs to the text.
        "max-w-full shrink-0",
        sizeClass,
        className
      )}
    />
  )
}

/* ── Lockup ───────────────────────────────────────────────────────────────── */

/**
 * The square mark plus the word "Instroom".
 *
 * Exists because the two places that build this lockup by hand both got the
 * flexbox wrong in the same way: no `min-w-0` on the row, so the wordmark could
 * not shrink and instead pushed the mark out of the container. Here the mark is
 * `shrink-0` and the text truncates, which is the only arrangement that cannot
 * overflow.
 */
export function LogoLockup({
  size = "md",
  textClassName,
  className,
  priority = false,
}: {
  size?: LogoSize
  textClassName?: string
  className?: string
  priority?: boolean
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Logo variant="mark" size={size} alt="" priority={priority} className="rounded-lg" />
      <span className={cn("min-w-0 truncate font-bold text-gray-900", textClassName)}>
        Instroom
      </span>
    </span>
  )
}

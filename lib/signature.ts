import "server-only"
import { prisma } from "@/lib/prisma"
import type { Signature } from "@prisma/client"

const colors = {
  name:  "#1F2937",
  link:  "#1155CC",
  ink:   "#111827",
  muted: "#6B7280",
}

type SocialLinks = {
  facebook?:  string
  instagram?: string
  tiktok?:    string
  twitter?:   string
  linkedin?:  string
}

const SOCIAL_LABELS: Record<keyof SocialLinks, string> = {
  facebook:  "Facebook",
  instagram: "Instagram",
  tiktok:    "TikTok",
  twitter:   "X",
  linkedin:  "LinkedIn",
}

// Pinned to a specific simple-icons release (CC0-licensed) so the icon set
// can't shift shape/slugs under us later — only bump this deliberately.
// NOTE: stuck on 13.x on purpose — simple-icons removed linkedin.svg in a
// later breaking release (PR #11380, licensing-related) with no replacement
// slug, and this is the last verified version (checked against jsdelivr's
// actual file listing, not just a live fetch) where all five platforms
// used here still exist as real files.
const SIMPLE_ICONS_VERSION = "13.20.0"
const SOCIAL_ICON_SLUGS: Record<keyof SocialLinks, string> = {
  facebook:  "facebook",
  instagram: "instagram",
  tiktok:    "tiktok",
  twitter:   "x",
  linkedin:  "linkedin",
}

function socialIconUrl(key: keyof SocialLinks): string {
  return `https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS_VERSION}/icons/${SOCIAL_ICON_SLUGS[key]}.svg`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Converts plain compose text into an HTML fragment so it can share a
 *  text/html message with the signature block. */
export function plainTextBodyToHtml(body: string): string {
  return escapeHtml(body).replace(/\r\n|\r|\n/g, "<br>")
}

/** Renders a Signature row into an inline-styled HTML table fragment.
 *  Returns null when the signature is disabled or has no content to show —
 *  callers should skip appending anything in that case. */
export function renderSignatureHtml(sig: Signature): string | null {
  if (!sig.is_enabled) return null

  const socials = (sig.social_links as SocialLinks | null) ?? {}
  const hasContent =
    sig.full_name || sig.title || sig.company || sig.phone || sig.email || sig.website ||
    Object.values(socials).some(Boolean)
  if (!hasContent) return null

  const rows: string[] = []

  // Standard signature delimiter ("-- " on its own line) — mail clients that
  // support it (Gmail, Thunderbird, Apple Mail) use this to auto-trim the
  // signature out of quoted replies.
  rows.push(`<div>-- </div>`)

  if (sig.full_name || sig.title) {
    const nameHtml = sig.full_name
      ? `<span style="font-weight:700;color:${colors.name};">${escapeHtml(sig.full_name)}</span>`
      : ""
    const titleHtml = sig.title
      ? `<span style="font-weight:400;color:${colors.ink};">${sig.full_name ? " | " : ""}${escapeHtml(sig.title)}</span>`
      : ""
    rows.push(`<div style="font-size:14px;">${nameHtml}${titleHtml}</div>`)
  }

  if (sig.company) {
    rows.push(`<div style="font-size:13px;color:${colors.ink};">${escapeHtml(sig.company)}</div>`)
  }

  const contactLines: string[] = []
  if (sig.phone) {
    contactLines.push(
      `<div style="font-size:12px;color:${colors.muted};">mobile: ` +
        `<a href="tel:${escapeHtml(sig.phone)}" style="color:${colors.link};text-decoration:underline;">${escapeHtml(sig.phone)}</a></div>`
    )
  }
  if (sig.email) {
    contactLines.push(
      `<div style="font-size:12px;color:${colors.muted};">email: ` +
        `<a href="mailto:${escapeHtml(sig.email)}" style="color:${colors.link};text-decoration:underline;">${escapeHtml(sig.email)}</a></div>`
    )
  }
  if (sig.website) {
    contactLines.push(
      `<div style="font-size:12px;color:${colors.muted};">website: ` +
        `<a href="${escapeHtml(sig.website)}" style="color:${colors.link};text-decoration:underline;">${escapeHtml(sig.website)}</a></div>`
    )
  }
  if (contactLines.length) rows.push(contactLines.join(""))

  const socialLinks = (Object.keys(SOCIAL_LABELS) as (keyof SocialLinks)[])
    .filter((key) => socials[key])
    .map(
      (key) =>
        `<a href="${escapeHtml(socials[key]!)}" style="margin-right:8px;text-decoration:none;">` +
          `<img src="${socialIconUrl(key)}" width="16" height="16" alt="${SOCIAL_LABELS[key]}" ` +
          `style="display:inline-block;vertical-align:middle;border:0;" /></a>`
    )
  if (socialLinks.length) {
    rows.push(`<div style="font-size:12px;margin-top:4px;">${socialLinks.join("")}</div>`)
  }

  return (
    `<div style="border-top:1px solid #E5E7EB;margin-top:16px;padding-top:12px;font-family:Arial,Helvetica,sans-serif;">` +
      rows.join("") +
    `</div>`
  )
}

/** Fetches the current user's signature and renders it, or returns null if
 *  none exists, it's disabled, or it has no content. */
export async function getUserSignatureHtml(userId: string): Promise<string | null> {
  const signature = await prisma.signature.findUnique({ where: { user_id: userId } })
  if (!signature) return null
  return renderSignatureHtml(signature)
}

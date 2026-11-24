// lib/extension-auth.ts
//
// Authentication for the Instroom Chrome extension.
//
// The extension cannot rely on the app's session cookie: it is httpOnly,
// SameSite=lax and dies 7 days after sign-in, and whether Chrome attaches it to
// a request from an extension service worker is not something to build on. So
// the extension holds its own bearer token, minted on /extension/connect while
// the user is signed in to the app.
//
// The token says WHO the caller is, nothing more. Which workspace they may act
// in is checked per request against Brand.owner_id / BrandMember (see
// getExtensionBrandAccess), so a teammate removed from a workspace loses access
// to it at once, even though their token keeps working for their other ones.

import "server-only"
import crypto from "crypto"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** Tokens live 90 days; the extension asks the user to reconnect after that. */
export const EXTENSION_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000

/** Live tokens kept per user; minting one more revokes the oldest. */
const MAX_ACTIVE_TOKENS_PER_USER = 10

/** last_used_at is refreshed at most this often, to avoid a write per call. */
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000

/** Prefix makes a leaked token recognisable in logs and secret scanners. */
const TOKEN_PREFIX = "inst_ext_"

export function hashExtensionToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex")
}

/**
 * Mint a new token for `userId`. Returns the RAW token, which is the only time
 * it exists anywhere — the database keeps its hash.
 */
export async function createExtensionToken(userId: string, label?: string | null) {
  const raw = TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + EXTENSION_TOKEN_TTL_MS)

  const record = await prisma.extensionToken.create({
    data: {
      user_id: userId,
      token_hash: hashExtensionToken(raw),
      label: label?.trim().slice(0, 100) || null,
      expires_at: expiresAt,
    },
    select: { id: true, label: true, expires_at: true, created_at: true },
  })

  // Cap live tokens per user so repeated "Connect" clicks cannot pile up
  // credentials forever. Oldest beyond the cap are revoked, not deleted, so
  // Settings can still show them as revoked.
  const active = await prisma.extensionToken.findMany({
    where: { user_id: userId, revoked_at: null, expires_at: { gt: now } },
    orderBy: { created_at: "desc" },
    select: { id: true },
  })
  const excess = active.slice(MAX_ACTIVE_TOKENS_PER_USER).map((t) => t.id)
  if (excess.length) {
    await prisma.extensionToken.updateMany({
      where: { id: { in: excess } },
      data: { revoked_at: now },
    })
  }

  return { token: raw, ...record }
}

export type ExtensionUser = {
  id: string
  email: string
  name: string | null
  image: string | null
  tokenId: string
}

/**
 * Resolve the caller from `Authorization: Bearer <token>`.
 * Returns null for a missing, unknown, revoked or expired token, or a user who
 * no longer exists or is deactivated.
 */
export async function getExtensionUser(req: NextRequest | Request): Promise<ExtensionUser | null> {
  const header = req.headers.get("authorization") || ""
  const match = header.match(/^Bearer\s+(\S+)$/i)
  if (!match) return null
  const raw = match[1]
  if (!raw.startsWith(TOKEN_PREFIX) || raw.length > 200) return null

  const record = await prisma.extensionToken.findUnique({
    where: { token_hash: hashExtensionToken(raw) },
    select: { id: true, user_id: true, revoked_at: true, expires_at: true, last_used_at: true },
  })
  const now = new Date()
  if (!record || record.revoked_at || record.expires_at <= now) return null

  // No real FK onto User (MyISAM) — the user is re-read every time, so a
  // deleted or deactivated account cannot keep acting through its token.
  const user = await prisma.user.findUnique({
    where: { id: record.user_id },
    select: { id: true, email: true, name: true, image: true, is_active: true },
  })
  if (!user || !user.is_active) return null

  if (!record.last_used_at || now.getTime() - record.last_used_at.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
    prisma.extensionToken
      .update({ where: { id: record.id }, data: { last_used_at: now } })
      .catch((err) => console.error("extension token last_used_at update failed:", err))
  }

  return { id: user.id, email: user.email, name: user.name, image: user.image, tokenId: record.id }
}

/** The 401 every extension route returns; the extension clears its token on it. */
export function extensionUnauthorized() {
  return NextResponse.json(
    { error: "Your Instroom extension is not connected. Please reconnect.", code: "extension_unauthorized" },
    { status: 401 }
  )
}

export type ExtensionBrandAccess = {
  brandId: string
  role: string // "owner" | BrandMember.role
  isOwner: boolean
}

/**
 * Can `userId` act in `brandId`? Owner, or a BrandMember row. Returns null
 * when they cannot (or the brand does not exist) — callers answer 403 without
 * revealing which.
 */
export async function getExtensionBrandAccess(
  userId: string,
  brandId: string
): Promise<ExtensionBrandAccess | null> {
  if (!brandId) return null
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, owner_id: true, is_active: true },
  })
  if (!brand) return null
  if (brand.owner_id === userId) return { brandId, role: "owner", isOwner: true }

  // A member of an inactive workspace cannot use it — same rule as the app's
  // own brand routes. The owner still gets through so the subscription check
  // can tell them to renew.
  if (!brand.is_active) return null
  const member = await prisma.brandMember.findUnique({
    where: { brand_id_user_id: { brand_id: brandId, user_id: userId } },
    select: { role: true },
  })
  return member ? { brandId, role: member.role, isOwner: false } : null
}

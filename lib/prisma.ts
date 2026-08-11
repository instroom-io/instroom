// lib/prisma.ts
// ─────────────────────────────────────────────────────────────────────────────
// Prisma singleton for Next.js (App Router + Turbopack compatible).
//
// THE CORE RULES:
//   1. ONE PrismaClient instance for the entire process lifetime.
//   2. NEVER call prisma.$disconnect() in API routes — it kills the pool.
//   3. The global trick prevents re-instantiation on every hot-reload in dev.
//   4. No process.on() shutdown handlers here — they cause problems in
//      serverless/edge environments and fight with Next.js's own lifecycle.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client"

// Extend NodeJS.Global so TypeScript knows about our custom property
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]  // remove 'query' unless you need SQL logging — it's very noisy
        : ["error"],
    // Connection pool sizing.
    // Default is 5 in dev. Keep it small to stay under max_user_connections.
    // For staging/prod on a shared host, set DATABASE_CONNECTION_LIMIT in .env.
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// In development, Next.js hot-reloads modules frequently.
// Without the global, each reload would create a new PrismaClient,
// rapidly exhausting the connection pool.
//
// In production, module-level variables are stable — the global is just
// for dev safety.
export const prisma: PrismaClient =
  globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma
}

// ─────────────────────────────────────────────────────────────────────────────
// 4-byte UTF-8 (emoji) writes — utf8mb4 on a server that forces utf8mb3
// ─────────────────────────────────────────────────────────────────────────────
// Every text column in this database is already utf8mb4/utf8mb4_unicode_ci and
// so is the database default. The problem is the CONNECTION:
//
//   @@character_set_server = utf8mb3
//   @@collation_server     = utf8mb3_unicode_ci
//   @@init_connect         = "SET NAMES utf8"      ← the cause
//
// This MySQL host (8.0.46-cll-lve — cPanel/CloudLinux) runs `SET NAMES utf8`
// via the global init_connect on EVERY new connection, and "utf8" is an alias
// for utf8mb3. Any 4-byte character then arrives as a utf8mb3 parameter that
// MySQL refuses to convert into a utf8mb4_unicode_ci column:
//
//   Error 3988: Conversion from collation utf8mb3_general_ci into
//               utf8mb4_unicode_ci impossible for parameter
//
// Which is why an Instagram/TikTok caption containing an emoji cannot be
// inserted, and why Automatic Post Detection reported posts_found > 0 with
// posts_imported = 0.
//
// Things that do NOT fix it, verified against this server rather than assumed:
//   • `?charset=utf8mb4` on DATABASE_URL — Prisma's MySQL driver ignores it;
//     the connection stays utf8mb3.
//   • `?connection_charset=utf8mb4` — likewise ignored.
//   • Changing init_connect or the server defaults — this account holds only
//     USAGE on *.* (no SUPER), so neither is grantable to us.
//
// What does work, measured: issuing `SET NAMES utf8mb4` AFTER connecting, which
// overrides init_connect for that session.
//
// The catch is pooling: a bare `prisma.$executeRaw("SET NAMES …")` applies to
// whichever pooled connection happens to serve it, not necessarily the one that
// serves the following INSERT. An interactive transaction is the one construct
// that pins a single connection for a sequence of statements, so the SET NAMES
// and the write provably share a session.
//
// NOTE: this does not sanitise, strip or re-encode anything — the caption is
// stored exactly as received.

/** Session charset that matches the column definitions. */
const UTF8MB4_SESSION = "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"

/**
 * Run `fn` on a connection whose session charset is utf8mb4, so writes
 * containing 4-byte characters (emoji) succeed on this host.
 *
 * Use it for writes whose text originates outside the app — social captions,
 * hashtags, display names. Ordinary ASCII-only writes need nothing special and
 * should keep using `prisma` directly rather than paying for a transaction.
 *
 *   await withUtf8mb4((tx) => tx.detectedPost.create({ data }))
 *
 * The callback receives the transaction client and must use it (not the global
 * `prisma`) — a statement issued on `prisma` inside here would take a different
 * pooled connection and land back on utf8mb3.
 */
export async function withUtf8mb4<T>(
  fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(UTF8MB4_SESSION)
      return fn(tx)
    },
    // Prisma's defaults (maxWait 2s, timeout 5s) are too tight for this
    // deployment: DATABASE_URL caps the pool at connection_limit=3 on a shared
    // host, so a transaction that also has to wait for a free connection was
    // being closed mid-flight — "Transaction API error: Transaction not found".
    // These bounds stay well inside the route's maxDuration (300s) and the
    // MonitoringLock lease (10 min), so a stuck write still cannot wedge a pass.
    { maxWait: 10_000, timeout: 15_000 }
  )
}

export default prisma
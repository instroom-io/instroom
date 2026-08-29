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
import { PrismaClient as PrismaClientEdge } from "@prisma/client/edge"
import { withAccelerate } from "@prisma/extension-accelerate"

// @prisma/extension-accelerate is pinned to exactly 1.3.0 in package.json —
// NOT a mistake, don't bump it casually. Versions 2.x and 3.x (current
// latest, as of this writing) silently strip relation/aggregate types from
// every `include`/`_count`/`_sum`/etc. query across the ENTIRE app the moment
// `.$extends(withAccelerate())` is applied — confirmed by testing directly
// against this exact @prisma/client version (6.19.2): 2.x/3.x broke ~40
// files' worth of type-checking project-wide, 1.3.0 does not. This matches
// multiple known upstream reports (prisma/prisma issues #28758, #28703,
// #29627, and a reported "v2.0.1 breaks types" regression) of the same
// class of bug recurring across versions. Re-test the full `npx tsc --noEmit`
// before ever bumping this.

// ─────────────────────────────────────────────────────────────────────────────
// Prisma Accelerate — why two clients, not one
// ─────────────────────────────────────────────────────────────────────────────
// This host caps us at max_user_connections=30. Vercel serverless functions
// each get their OWN connection pool on cold start — the globalThis singleton
// below only holds within one warm instance, not across concurrently-invoked
// ones — so a handful of concurrent instances × even a small per-instance
// pool blew past 30 on its own. Accelerate pools many logical clients down to
// a small number of real connections, which is what actually fixes this.
//
// The one thing Accelerate can't safely carry is `withUtf8mb4`'s interactive
// transaction below: Accelerate hard-caps interactive transactions at 15s
// with a documented history of "Transaction not found" failures, and that
// helper already runs right at a 15s timeout because of a DIFFERENT
// connection-starvation issue on the direct connection. Every other
// `$transaction` call site in this codebase uses the sequential array form,
// which Prisma's own docs say performs BETTER on Accelerate — only
// `withUtf8mb4` uses the interactive callback form, so it alone keeps using
// a small direct connection instead, sidestepping that risk entirely rather
// than gambling on it for the one narrow, already-fragile path that needs it.

// Extend NodeJS.Global so TypeScript knows about our custom properties
declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof createAcceleratedClient> | undefined
  // eslint-disable-next-line no-var
  var __directPrisma: PrismaClient | undefined
}

function createAcceleratedClient() {
  return new PrismaClientEdge({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]  // remove 'query' unless you need SQL logging — it's very noisy
        : ["error"],
    // `accelerateUrl` (the console's own snippet) isn't a recognized
    // constructor option on this installed @prisma/client version — that
    // instruction assumed a newer version than what's actually installed
    // here. The version-compatible way to point this client at Accelerate
    // is the datasource override below, same shape as any other client.
    datasources: {
      db: {
        url: process.env.PRISMA_ACCELERATE_URL,
      },
    },
  }).$extends(withAccelerate())
}

function createDirectPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
    // Connection pool sizing.
    // Default is 5 in dev. Keep it small to stay under max_user_connections —
    // this client is only ever used by withUtf8mb4, a low-frequency
    // background path, not general app traffic (that goes through the
    // Accelerate-backed `prisma` export above).
    datasources: {
      db: {
        url: process.env.DIRECT_DATABASE_URL,
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
export const prisma = globalThis.__prisma ?? createAcceleratedClient()

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma
}

const directPrisma: PrismaClient =
  globalThis.__directPrisma ?? createDirectPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalThis.__directPrisma = directPrisma
}

// ─────────────────────────────────────────────────────────────────────────────
// Transient connection failures
// ─────────────────────────────────────────────────────────────────────────────
// This deployment's MySQL is a shared cPanel host with max_user_connections=30
// on a server whose Max_used_connections has already touched its 500 ceiling
// (Aborted_connects is in the hundreds of thousands). When no connection is
// available, Prisma raises P1001 "Can't reach database server" — a request-level
// blip, not a broken query: the same query issued a moment later succeeds.
//
// Left alone, one blip becomes a hard 500 for the user. This retries ONLY the
// connection-level codes, twice, with a short backoff. Nothing is swallowed: if
// the database is genuinely down, the original error is rethrown and the route
// still fails with the real reason.

// ─────────────────────────────────────────────────────────────────────────────
// Save-path timing
// ─────────────────────────────────────────────────────────────────────────────
// Development-only instrumentation for finding which step of a save is slow.
//
// This database is remote and shared: a bare `SELECT 1` costs ~317ms, so the
// cost of a save is dominated by ROUND TRIPS, not by the work itself. That is
// hard to see from a total, which is why steps are timed individually.
//
// Off in production (no logging, no wrapper cost) and off unless explicitly
// enabled, so it cannot become noise:
//
//   DEBUG_SAVE_TIMING=1 npm run dev
//
// Then each step prints as, e.g.
//   [save-timing] pipeline.preflight 614ms
//   [save-timing] pipeline.write      412ms

const SAVE_TIMING =
  process.env.NODE_ENV !== "production" && process.env.DEBUG_SAVE_TIMING === "1"

/**
 * Time one step of a save and log it when instrumentation is on.
 *
 * A pass-through otherwise — same value, same rejection, no timing calls — so
 * leaving these in the request path costs nothing in production.
 */
export async function timeStep<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!SAVE_TIMING) return fn()
  const started = Date.now()
  try {
    return await fn()
  } finally {
    console.log(`[save-timing] ${label} ${Date.now() - started}ms`)
  }
}

/** Prisma codes that mean "no connection", not "bad query". */
const TRANSIENT_DB_CODES = new Set([
  "P1001", // can't reach database server
  "P1017", // server closed the connection
  "P5010", // Accelerate: can't reach the service (network/DNS blip to
           // accelerate.prisma-data.net, not a broken connection string —
           // Prisma's own client already retries this 3x internally with a
           // short backoff; this gives routes that opt into withDbRetry a
           // few more chances beyond that before surfacing a 500).
])

function isTransientDbError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code
  return typeof code === "string" && TRANSIENT_DB_CODES.has(code)
}

/**
 * Run a query, retrying only if the failure was the connection rather than the
 * query. Query, permission and validation errors are rethrown immediately.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      if (!isTransientDbError(error)) throw error
      lastError = error
      if (attempt < attempts - 1) {
        // 150ms, then 300ms — long enough for a pooled connection to free up,
        // short enough to stay well inside a request.
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
      }
    }
  }
  throw lastError
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
  // Deliberately directPrisma, not the Accelerate-backed `prisma` export —
  // see the "why two clients" note near the top of this file.
  return directPrisma.$transaction(
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
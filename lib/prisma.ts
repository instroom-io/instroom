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

export default prisma
// lib/db-capacity.ts
//
// Telling "the database is momentarily out of connections" apart from "this
// request is broken".
//
// The two are not the same failure and must not read the same to the user. A
// capacity failure clears on its own, so the page should offer a retry;
// reported as a 500 it becomes a dead-end "Failed to load" for something that
// would have worked a moment later. A genuine fault must still be a 500 — this
// helper narrows what is treated as transient, it does not swallow anything.
//
// This lived inline in the influencer list route. It is here so the other reads
// that compete for the same three pooled connections — the Pipeline board and
// the Post Tracker — report capacity the same way rather than each inventing
// its own handling.

import { NextResponse } from "next/server"

/**
 * Is this failure the database refusing another connection, rather than a fault
 * in the request?
 *
 * Matched on the message because these do not all arrive as a usable code: the
 * MySQL 1203 comes through as a PrismaClientInitializationError whose
 * `errorCode` is undefined (confirmed against this database), so the text is
 * the only signal.
 *
 * The shapes, and where each comes from:
 *   MySQL 1203  "User ... already has more than 'max_user_connections' active
 *               connections" — the server-side ceiling on the DB user, hit when
 *               a NEW connection is opened. Existing pooled connections keep
 *               working, which is why this comes and goes.
 *   P2024       Prisma's own pool timeout — DATABASE_URL's connection_limit.
 *   P2037       "Too many database connections opened" — the server refusing
 *               the connection outright.
 */
export function isDatabaseCapacityError(error: unknown): boolean {
  const message =
    typeof error === "string" ? error : (error as { message?: string })?.message ?? ""
  return (
    message.includes("max_user_connections") ||
    message.includes("Too many database connections") ||
    message.includes("too many clients") ||
    message.includes("P2024") ||
    message.includes("P2037") ||
    message.includes("Timed out fetching a new connection")
  )
}

/**
 * The response a read should give for a capacity failure.
 *
 * 503 with Retry-After is what lets the client tell "try again" from "this will
 * never work" — the pages render their existing Retry button on it. Deliberately
 * NOT a client-side automatic retry: retrying into an exhausted pool is what
 * makes exhaustion worse.
 */
export function databaseCapacityResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "The database is temporarily out of connections. Please retry in a moment.",
      retryable: true,
    },
    { status: 503, headers: { "Retry-After": "5" } }
  )
}

import { NextRequest, NextResponse } from "next/server"
import { randomUUID, timingSafeEqual } from "crypto"
import {
  runMonitoringPass,
  acquireMonitoringLock,
  releaseMonitoringLock,
} from "@/lib/post-tracker/monitor"

// Background monitoring job for Automatic Post Detection.
//
// ─── DRIVEN BY AN EXTERNAL SCHEDULER ─────────────────────────────────────────
// This is the production entry point for automatic detection:
//
//   external scheduler → POST /api/cron/post-detection (Bearer CRON_SECRET)
//                      → runMonitoringPass()  ← the single source of truth
//                      → existing quota / MonitoringRun / import logic
//
// Vercel Cron is deliberately NOT used (the Hobby plan rejects a */5 schedule,
// and vercel.json carries no crons block). Any scheduler that can send an
// authenticated HTTPS request works, because nothing here depends on Vercel:
// GitHub Actions `schedule`, cron-job.org, EasyCron, Upstash QStash, an uptime
// monitor with a custom header, or a cron line on any always-on box.
//
// Set up (production):
//   1. Set CRON_SECRET in the Vercel project environment — a long random
//      string. Without it this handler fails closed with 401, by design.
//   2. Point the scheduler at it every 5 minutes:
//        curl -X POST https://instroom.io/api/cron/post-detection //             -H "Authorization: Bearer $CRON_SECRET"
//      A GET with the same header works too, for schedulers that only do GETs.
//   3. Nothing else. The secret never reaches the browser: it is read only
//      here, server-side.
//
// Polling faster than every 5 minutes is harmless but pointless —
// runMonitoringPass only picks up settings whose last_synced_at is older than
// MIN_POLL_INTERVAL_MS, so extra calls find nothing due and spend no quota.
//
// This works with zero user traffic and no browser session: the scheduler is
// the only thing that has to be awake.
// ─────────────────────────────────────────────────────────────────────────────
//
// Stateless by design: each invocation picks up whatever is due, so it resumes
// correctly after a deploy, a restart, or a missed run — there is no in-process
// timer to lose.
//
// Concurrency is guarded by a DB lock (MonitoringLock), so an overlapping cron
// tick or a manual trigger cannot double-poll and double-spend quota.

export const dynamic = "force-dynamic"
// Ceiling below Vercel's function limit; the lock TTL (10 min) sits above it so
// a killed run's lock still expires rather than wedging the job.
export const maxDuration = 300

const LOG = "[cron/post-detection]"

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Requests without it
 * are rejected so the endpoint can't be used to burn provider quota.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Fail closed. An unauthenticated job that spends money is worse than one
    // that doesn't run.
    console.error(`${LOG} CRON_SECRET is not configured — refusing to run.`)
    return false
  }
  const header = req.headers.get("authorization")
  if (!header) return false

  // Constant-time comparison so a wrong secret cannot be recovered by timing
  // the responses. Lengths are compared first because timingSafeEqual throws
  // on a length mismatch.
  const expected = Buffer.from(`Bearer ${secret}`)
  const provided = Buffer.from(header)
  if (expected.length !== provided.length) return false
  return timingSafeEqual(expected, provided)
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const holder = randomUUID()

  if (!(await acquireMonitoringLock(holder))) {
    // Not an error: the previous pass is still running.
    console.log(`${LOG} skipped — another pass holds the lock`)
    return NextResponse.json({ skipped: true, reason: "another pass is running" })
  }

  try {
    const brandId = req.nextUrl.searchParams.get("brandId") ?? undefined
    const summary = await runMonitoringPass({ brandId })
    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`${LOG} pass failed: ${message}`)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  } finally {
    // Always released, including on failure — otherwise one crash would stall
    // monitoring until the lease expired.
    await releaseMonitoringLock(holder)
  }
}

export async function GET(req: NextRequest) {
  return handle(req)
}

// POST so the job can also be triggered by an external scheduler.
export async function POST(req: NextRequest) {
  return handle(req)
}

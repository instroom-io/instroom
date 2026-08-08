import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import {
  runMonitoringPass,
  acquireMonitoringLock,
  releaseMonitoringLock,
} from "@/lib/post-tracker/monitor"

// Background monitoring job for Automatic Post Detection.
//
// ─── CURRENTLY UNSCHEDULED ───────────────────────────────────────────────────
// Nothing calls this on a timer today. The Vercel Cron entry was removed from
// vercel.json because the Hobby plan only permits one cron invocation per day,
// at daily-or-coarser granularity — a */5 schedule is rejected at deploy time.
// The handler is kept intact and working; only the schedule was withdrawn.
//
// Until then, detection runs on demand via the "Check now" button, which hits
// POST /api/post-tracker/detection/run (session-authenticated, single brand).
//
// To re-enable on Vercel Pro:
//   1. Restore the crons block in vercel.json:
//        "crons": [{ "path": "/api/cron/post-detection", "schedule": "*/5 * * * *" }]
//   2. Set CRON_SECRET in the Vercel project environment (see .env.example).
//      Without it this handler fails closed with 401 — by design.
//   3. Re-enable the list refresh in DetectedPostsList.tsx (POLL_ENABLED).
// No code change is needed here.
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
  return header === `Bearer ${secret}`
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

import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkBrandAccess } from "@/lib/brand-access"
import { isAddonActive } from "@/lib/post-tracker/addon"
import { getQuota } from "@/lib/post-tracker/quota"
import { isEnsembleConfigured } from "@/lib/ensembledata"
import {
  runMonitoringPass,
  acquireMonitoringLock,
  releaseMonitoringLock,
} from "@/lib/post-tracker/monitor"

// POST /api/post-tracker/detection/run
// Body: { brandId }
//
// Runs a detection pass for one workspace, on demand.
//
// Why this exists: the scheduled job is a Vercel Cron (vercel.json), which only
// fires on a deployment — it never runs against a local dev server. Without a
// manual trigger, detection appears permanently idle in development and there
// is no way to tell "the poller never ran" from "the provider found nothing".
//
// Same guards as the cron path (add-on, quota, lock), but authenticated by user
// session and scoped to a single brand, so it cannot be used to spend another
// workspace's quota.
export const dynamic = "force-dynamic"
export const maxDuration = 300

const LOG = "[post-detection/run]"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await req.json()
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!(await isAddonActive(brandId))) {
      return NextResponse.json(
        { error: "The Post Tracker Add-on is required.", addonRequired: true },
        { status: 402 }
      )
    }

    // Reported rather than silently no-op'd: this is the exact misconfiguration
    // that makes detection look broken.
    if (!isEnsembleConfigured()) {
      console.error(`${LOG} EnsembleData token missing — set ENSEMBLEDATA_TOKEN or ENSEMBLE_TOKEN`)
      return NextResponse.json(
        {
          error: "The EnsembleData API token is not configured on the server.",
          configurationError: true,
        },
        { status: 503 }
      )
    }

    const quota = await getQuota(brandId)
    if (quota.apiExhausted) {
      return NextResponse.json(
        { error: "Daily testing limit reached. Monitoring resumes after the quota resets.", quotaExhausted: true, quota },
        { status: 429 }
      )
    }

    const holder = randomUUID()
    if (!(await acquireMonitoringLock(holder))) {
      return NextResponse.json({ skipped: true, reason: "A detection pass is already running." })
    }

    try {
      // force: bypass the 5-minute poll interval — a manual "check now" that
      // silently did nothing would defeat the point of the button.
      const summary = await runMonitoringPass({ brandId, force: true })
      const after = await getQuota(brandId)
      return NextResponse.json({ ok: true, summary, quota: after })
    } finally {
      await releaseMonitoringLock(holder)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`${LOG} failed: ${message}`, error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

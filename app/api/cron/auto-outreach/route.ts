import { NextRequest, NextResponse } from "next/server"
import { randomUUID, timingSafeEqual } from "crypto"
import { acquireOutreachLock, releaseOutreachLock, runOutreachPass } from "@/lib/auto-outreach-queue"

// Called every minute by the VPS cron.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get("authorization")
  if (!secret || !header) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const provided = Buffer.from(header)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const holder = randomUUID()
  if (!(await acquireOutreachLock(holder))) {
    return NextResponse.json({ skipped: true, reason: "another pass is running" })
  }
  try {
    return NextResponse.json({ ok: true, brands: await runOutreachPass() })
  } catch (error) {
    console.error("[auto-outreach] pass failed:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  } finally {
    await releaseOutreachLock(holder)
  }
}

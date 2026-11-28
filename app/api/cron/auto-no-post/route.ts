import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { runAutoNoPost } from "@/lib/post-tracker/auto-no-post"

// Daily auto No post. VPS crontab:
//   0 5 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$CRON_URL/api/cron/auto-no-post" >> /root/auto-no-post.log

export const dynamic = "force-dynamic"
export const maxDuration = 300

function isAuthorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!expected || !provided || provided.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const summary = await runAutoNoPost()
  return NextResponse.json({ success: true, ...summary })
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasBrandCapability } from "@/lib/permissions"
import { getAutoOutreachConfig } from "@/lib/auto-outreach"
import { checkEligibility, queueOutreach, renderOutreach } from "@/lib/auto-outreach-queue"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"

async function readRequest(req: NextRequest, params: Promise<{ brandId: string }>) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const { brandId } = await params
  if (!(await hasBrandCapability(brandId, session.user.id, "approveInfluencers"))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  const body = await req.json().catch(() => ({}))
  const influencerIds: string[] = Array.isArray(body.influencerIds) ? body.influencerIds.map(String) : []
  if (influencerIds.length === 0) {
    return { error: NextResponse.json({ error: "influencerIds is required" }, { status: 400 }) }
  }
  return { userId: session.user.id, brandId, influencerIds, preview: body.preview === true }
}

// preview: true returns the popup data without queuing.
export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const r = await readRequest(req, params)
    if ("error" in r) return r.error
    const config = await getAutoOutreachConfig(r.brandId)
    const ready = config.enabled && !!config.templateId && !!config.sender
    if (!ready) return NextResponse.json({ enabled: false })

    const { eligible, skipped } = await checkEligibility(r.brandId, r.influencerIds)

    if (r.preview) {
      const sample = eligible[0] ? await renderOutreach(r.brandId, config.templateId!, eligible[0]) : null
      return NextResponse.json({
        enabled: true,
        paused: config.paused,
        sender: config.sender!.email,
        cancelWindowMinutes: config.cancelWindowMinutes,
        intervalMinutes: config.intervalMinutes,
        sample: sample && { ...sample, to: eligible[0].email, handle: eligible[0].handle },
        eligibleCount: eligible.length,
        skipped,
      })
    }

    const sendAfter = eligible.length ? await queueOutreach(r.brandId, eligible, config, r.userId) : null
    return NextResponse.json({ enabled: true, queued: eligible.length, sendAfter, skipped })
  } catch (error) {
    console.error("[auto-outreach queue]", error)
    if (isDatabaseCapacityError(error)) return databaseCapacityResponse()
    return NextResponse.json({ error: "Couldn't schedule the outreach emails." }, { status: 500 })
  }
}

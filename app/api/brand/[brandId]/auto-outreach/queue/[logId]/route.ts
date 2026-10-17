import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasBrandCapability } from "@/lib/permissions"
import { updateQueuedOutreach } from "@/lib/auto-outreach-queue"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ brandId: string; logId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { brandId, logId } = await params
  if (!(await hasBrandCapability(brandId, session.user.id, "approveInfluencers"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { action } = await req.json().catch(() => ({}))
  if (action !== "cancel" && action !== "retry") {
    return NextResponse.json({ error: "action must be cancel or retry" }, { status: 400 })
  }
  const result = await updateQueuedOutreach(brandId, logId, action)
  return result.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: result.error }, { status: 409 })
}

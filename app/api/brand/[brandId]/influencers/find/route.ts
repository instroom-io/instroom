import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"
import { normalizeInfluencerIdentity } from "@/lib/influencer-draft"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET /api/influencers/find?handle=xxx&platform=yyy
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const handle   = searchParams.get("handle")
    const platform = searchParams.get("platform")

    if (!handle || !platform) {
      return NextResponse.json({ error: "handle and platform are required" }, { status: 400 })
    }

    // Normalized to match how the identity is STORED. Raw query params meant a
    // lookup for "@Nike" missed the stored "nike" and the caller concluded the
    // influencer did not exist.
    const identity = normalizeInfluencerIdentity(handle, platform)
    const influencer = await prisma.influencer.findUnique({
      where: {
        handle_platform: identity,
      },
    })

    if (!influencer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(influencer)
  } catch (error: any) {
    // `details` used to carry the raw driver text to the browser. It belongs in
    // the log: it is unreadable to the person adding an influencer and it
    // describes our storage internals.
    console.error("GET /influencers/find:", error?.code, error?.message)

    // Out of connections is transient — the lookup did not run, but retrying
    // will work. The client shows its retry affordance on the 503.
    if (isDatabaseCapacityError(error)) {
      return databaseCapacityResponse()
    }

    return NextResponse.json(
      { error: "Couldn't look up this influencer. Please try again." },
      { status: 500 }
    )
  }
}
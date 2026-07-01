import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
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

    const influencer = await prisma.influencer.findUnique({
      where: {
        handle_platform: { handle, platform },
      },
    })

    if (!influencer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(influencer)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to find influencer", details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
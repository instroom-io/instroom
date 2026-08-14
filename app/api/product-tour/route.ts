import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

function parseSeenScenes(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { product_tour_seen_scenes: true },
    })

    return NextResponse.json(
      { seenScenes: parseSeenScenes(user?.product_tour_seen_scenes) },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve product tour status" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { scene } = await req.json()
    if (!scene || typeof scene !== "string") {
      return NextResponse.json(
        { error: "scene is required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { product_tour_seen_scenes: true },
    })
    const current = parseSeenScenes(user?.product_tour_seen_scenes)

    if (!current.includes(scene)) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { product_tour_seen_scenes: [...current, scene] },
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save product tour status" },
      { status: 500 }
    )
  }
}

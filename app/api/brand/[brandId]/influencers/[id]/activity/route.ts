import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

const ACTION_LABELS: Record<string, string> = {
  "influencer.added":            "Added influencer",
  "influencer.removed":          "Removed influencer",
  "influencer.submitted":        "Submitted for approval",
  "influencer.approval_changed": "Changed approval status",
  "pipeline.stage_changed":      "Moved pipeline stage",
  "pipeline.status_changed":     "Updated contact status",
  "posttracker.stage_changed":   "Updated post tracker stage",
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, id } = await params

    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const isOwner = brand.owner_id === session.user.id
    const isMember = isOwner
      ? true
      : !!(await prisma.brandMember.findFirst({
          where: { brand_id: brandId, user_id: session.user.id },
        }))
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Fetch logs without include to avoid any Prisma type issues
    const logs = await prisma.activityLog.findMany({
      where: {
        brand_id: brandId,
        entity_type: "brand_influencer",
        entity_id: id,
      },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        action: true,
        details: true,
        created_at: true,
        user_id: true,
      },
    })

    // Fetch users separately — avoids all relation type issues
    const userIds = [...new Set(logs.map((l) => l.user_id))]
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, image: true, email: true },
        })
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))

    const formatted = logs.map((log) => {
      let details: Record<string, unknown> = {}
      try {
        details = JSON.parse(log.details ?? "{}")
      } catch {}

      const u = userMap.get(log.user_id)
      const displayName = u?.name ?? u?.email ?? "Unknown user"
      const initials = displayName
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()

      return {
        id: log.id,
        action: log.action,
        label: ACTION_LABELS[log.action] ?? log.action,
        details,
        created_at: log.created_at.toISOString(),
        user: u
          ? {
              id: u.id,
              name: u.name,
              image: u.image,
              initials,
            }
          : null,
      }
    })

    return NextResponse.json({ logs: formatted })
  } catch (err) {
    console.error("GET activity log:", err)
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 })
  }
}
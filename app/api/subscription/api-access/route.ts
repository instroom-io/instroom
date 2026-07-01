import { hasAPIAccess } from "@/lib/subscription-limits"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/subscription/api-access
 * Check if the current user has API access based on their subscription plan
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accessCheck = await hasAPIAccess(session.user.id)

    return NextResponse.json(
      {
        hasAccess: accessCheck.allowed,
        message: accessCheck.message,
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check API access", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/subscription/api-access
 * Check API access status (alternative endpoint for POST requests)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accessCheck = await hasAPIAccess(session.user.id)

    if (!accessCheck.allowed) {
      return NextResponse.json(
        {
          hasAccess: false,
          message: accessCheck.message,
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        hasAccess: true,
        message: "API access is enabled",
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check API access", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// Extension tokens for the signed-in user (app session, not a bearer token).
//
//   POST  mint a token — called by /extension/connect, which hands it to the
//         Chrome extension. The raw token is in this response and nowhere else.
//   GET   list this user's tokens for Settings (never the token itself).

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createExtensionToken } from "@/lib/extension-auth"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const label = typeof body?.label === "string" ? body.label : null

    const created = await createExtensionToken(session.user.id, label)

    return NextResponse.json(
      {
        token: created.token,
        id: created.id,
        expires_at: created.expires_at.toISOString(),
        user: {
          id: session.user.id,
          email: session.user.email ?? null,
          name: session.user.name ?? null,
          image: session.user.image ?? null,
        },
      },
      // The token must never be cached by anything in between.
      { status: 201, headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("POST /api/extension/tokens:", message)
    if (isDatabaseCapacityError(message)) return databaseCapacityResponse()
    return NextResponse.json({ error: "Couldn't connect the extension. Please try again." }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tokens = await prisma.extensionToken.findMany({
      where: { user_id: session.user.id },
      orderBy: { created_at: "desc" },
      take: 50,
      select: {
        id: true,
        label: true,
        created_at: true,
        last_used_at: true,
        expires_at: true,
        revoked_at: true,
      },
    })

    const now = new Date()
    return NextResponse.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        label: t.label,
        created_at: t.created_at.toISOString(),
        last_used_at: t.last_used_at?.toISOString() ?? null,
        expires_at: t.expires_at.toISOString(),
        revoked_at: t.revoked_at?.toISOString() ?? null,
        status: t.revoked_at ? "revoked" : t.expires_at <= now ? "expired" : "active",
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("GET /api/extension/tokens:", message)
    if (isDatabaseCapacityError(message)) return databaseCapacityResponse()
    return NextResponse.json({ error: "Couldn't load connected extensions." }, { status: 500 })
  }
}

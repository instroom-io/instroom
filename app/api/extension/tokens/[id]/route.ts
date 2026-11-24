// DELETE /api/extension/tokens/:id — revoke one of the signed-in user's
// extension tokens (Settings → Chrome extension → Disconnect). The row is kept
// with revoked_at set; the extension gets 401 on its next call and asks the
// user to reconnect.

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Scoped to the caller's own tokens: someone else's id simply matches 0.
    const result = await prisma.extensionToken.updateMany({
      where: { id, user_id: session.user.id, revoked_at: null },
      data: { revoked_at: new Date() },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ revoked: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("DELETE /api/extension/tokens/[id]:", message)
    if (isDatabaseCapacityError(message)) return databaseCapacityResponse()
    return NextResponse.json({ error: "Couldn't disconnect the extension." }, { status: 500 })
  }
}

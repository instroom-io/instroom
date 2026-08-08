import { NextResponse } from "next/server"
import { guardBrand } from "@/lib/discord/route-guard"
import { disconnectBrandDiscord } from "@/lib/discord/connection"

// DELETE /api/brands/:brandId/integrations/discord/disconnect
//
// Deletes the row rather than flagging it inactive, which also releases the
// unique guild_id claim so the server can be connected to a different
// workspace afterwards. Nothing in Discord is modified — the bot stays in the
// server until an admin removes it there.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrand(brandId)
    if (!guard.ok) return guard.response

    await disconnectBrandDiscord(brandId)
    return NextResponse.json({ connected: false })
  } catch (error) {
    console.error("[DELETE discord/disconnect]", error)
    return NextResponse.json({ error: "Failed to disconnect Discord" }, { status: 500 })
  }
}

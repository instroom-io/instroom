import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// DELETE /api/community/discord/account
//
// Unlinks the CALLING user's Discord identity. The mirror image of the OAuth
// callback, which is the only thing that sets these columns.
//
// Scope is deliberately narrow, and the narrowness is the security property:
//
//   • It clears three columns on one row — the session user's. The id comes
//     from the session, never from the request, so there is no id to tamper
//     with and one user can't unlink another.
//   • It does NOT touch BrandDiscordConnection. The brand's server stays
//     connected for everyone else; only this person's ability to see it
//     through Instroom goes away, and only until they reconnect.
//   • It does NOT revoke anything at Discord. No token is stored to revoke —
//     the OAuth callback discards the access token after its single use — and
//     the user's actual Discord account and server membership are theirs, not
//     ours to modify.
//
// After this, guardBrand reports discordUserId: null, so the permission-
// filtered routes return their existing `not_linked` state and the UI falls
// back to the "Connect Discord Account" step. No other code path changes.

const LOG = "[discord:account]"

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Raw SQL for the same reason guardBrand uses it: these columns exist in
    // the database and in schema.prisma, but the generated client can't always
    // be rebuilt in place on Windows while a dev server holds the query-engine
    // DLL open. Real column names, not model field names.
    await prisma.$executeRaw`
      UPDATE User
      SET discord_user_id = NULL, discord_username = NULL, discord_linked_at = NULL
      WHERE id = ${session.user.id}`

    console.log(`${LOG} unlinked Discord from Instroom user ${session.user.id}`)

    return NextResponse.json({ linked: false })
  } catch (error) {
    console.error("[DELETE discord/account]", error)
    return NextResponse.json({ error: "Failed to log out of Discord" }, { status: 500 })
  }
}

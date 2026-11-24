// /api/extension/me — called by the Chrome extension with its bearer token.
//
//   GET     who is connected, and the workspaces they can work in (owner or
//           BrandMember), with their role in each. This feeds the extension's
//           workspace picker; every later write re-checks access server-side,
//           so this list is a convenience, not the permission check.
//   DELETE  the extension's own "Disconnect" — revokes the calling token.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getExtensionUser, extensionUnauthorized } from "@/lib/extension-auth"
import { roleHasCapability } from "@/lib/role-capabilities"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"

export async function GET(req: NextRequest) {
  try {
    const user = await getExtensionUser(req)
    if (!user) return extensionUnauthorized()

    const brands = await prisma.brand.findMany({
      where: {
        OR: [{ owner_id: user.id }, { members: { some: { user_id: user.id } } }],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo_url: true,
        owner_id: true,
        is_active: true,
        members: { where: { user_id: user.id }, select: { role: true } },
      },
      orderBy: { created_at: "desc" },
    })

    const workspaces = brands
      .map((b) => {
        const isOwner = b.owner_id === user.id
        const role = isOwner ? "owner" : b.members[0]?.role ?? null
        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          logo_url: b.logo_url,
          role,
          is_owner: isOwner,
          is_active: b.is_active,
          can_add_influencers: roleHasCapability(role, "manageInfluencers"),
        }
      })
      // A member cannot use an inactive workspace (same rule as the app);
      // the owner still sees theirs so the extension can say "renew".
      .filter((w) => w.is_owner || w.is_active)

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email, name: user.name, image: user.image },
        workspaces,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("GET /api/extension/me:", message)
    if (isDatabaseCapacityError(message)) return databaseCapacityResponse()
    return NextResponse.json({ error: "Couldn't load your workspaces." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getExtensionUser(req)
    if (!user) return extensionUnauthorized()

    await prisma.extensionToken.update({
      where: { id: user.tokenId },
      data: { revoked_at: new Date() },
    })
    return NextResponse.json({ revoked: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("DELETE /api/extension/me:", message)
    if (isDatabaseCapacityError(message)) return databaseCapacityResponse()
    return NextResponse.json({ error: "Couldn't disconnect." }, { status: 500 })
  }
}

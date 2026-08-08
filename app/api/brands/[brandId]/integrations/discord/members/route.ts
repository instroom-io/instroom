import { NextResponse } from "next/server"
import { guardBrandGuild, statusForCode } from "@/lib/discord/route-guard"
import { discordRest } from "@/lib/discord/bot-client"

// GET /api/brands/:brandId/integrations/discord/members
//
// Guild members with their top role. Requires the SERVER MEMBERS privileged
// intent to be enabled in the Discord developer portal — without it Discord
// returns 403 here, which is surfaced as an actionable message rather than a
// generic failure.
//
// Presence (online/offline) is NOT available over REST — it only arrives via
// the Gateway. Members are returned without a status until the Gateway worker
// exists, rather than inventing one.

const CDN = "https://cdn.discordapp.com"

type RawMember = {
  user?: { id: string; username: string; global_name?: string | null; avatar: string | null; bot?: boolean }
  nick?: string | null
  roles?: string[]
}
type RawRole = { id: string; name: string; color: number; position: number }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const [membersRes, rolesRes] = await Promise.all([
      discordRest<RawMember[]>(`/guilds/${guard.guildId}/members?limit=200`),
      discordRest<RawRole[]>(`/guilds/${guard.guildId}/roles`),
    ])

    if (!membersRes.ok) {
      const message =
        membersRes.status === 403
          ? "Enable the Server Members Intent in the Discord developer portal to show the member list."
          : membersRes.error
      return NextResponse.json({ error: message, code: membersRes.code }, { status: statusForCode(membersRes.code) })
    }

    const roles = rolesRes.ok ? rolesRes.data : []
    const roleById = new Map(roles.map((r) => [r.id, r]))

    const members = membersRes.data
      .filter((m) => m.user)
      .map((m) => {
        const u = m.user!
        // Highest positioned role is the one Discord uses for name colour.
        const top = (m.roles ?? [])
          .map((id) => roleById.get(id))
          .filter((r): r is RawRole => Boolean(r) && r!.name !== "@everyone")
          .sort((a, b) => b.position - a.position)[0]

        return {
          id: u.id,
          username: u.username,
          displayName: m.nick || u.global_name || u.username,
          avatarUrl: u.avatar
            ? `${CDN}/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "png"}?size=64`
            : `${CDN}/embed/avatars/${Number((BigInt(u.id) >> BigInt(22)) % BigInt(6))}.png`,
          bot: Boolean(u.bot),
          roleName: top?.name ?? null,
          // Discord encodes "no colour" as 0; treat that as unset.
          roleColor: top?.color ? `#${top.color.toString(16).padStart(6, "0")}` : null,
        }
      })
      .sort((a, b) => Number(a.bot) - Number(b.bot) || a.displayName.localeCompare(b.displayName))

    return NextResponse.json({ members, presenceAvailable: false })
  } catch (error) {
    console.error("[GET discord/members]", error)
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 })
  }
}

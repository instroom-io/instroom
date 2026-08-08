import "server-only"
// lib/discord/route-guard.ts
// One authorisation gate for every Discord route.
//
// Each route needs the same four things, in the same order, and getting the
// order wrong is a tenant-isolation bug rather than a style problem:
//
//   1. authenticated session
//   2. the user actually belongs to :brandId
//   3. the guild ID loaded FROM THE DATABASE for that brand
//   4. the caller's linked Discord identity, for permission filtering
//
// A guildId is never accepted from the client. If a route ever needs one, it
// comes from here — which means it is always the guild that belongs to the
// brand the caller has been verified against.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkBrandAccess } from "@/lib/community-access"
import { getBrandGuildId, getBrandConnection } from "./connection"

export type GuardOk = {
  ok: true
  userId: string
  displayName: string
  /** Null until the user links Discord — permission filtering needs it. */
  discordUserId: string | null
  /** The linked Discord display name, for showing which account is connected. */
  discordUsername: string | null
}

export type GuardFail = { ok: false; response: NextResponse }

/** Steps 1–2: session + brand membership. Every route starts here. */
export async function guardBrand(brandId: string): Promise<GuardOk | GuardFail> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (!brandId) {
    return { ok: false, response: NextResponse.json({ error: "brandId is required" }, { status: 400 }) }
  }

  // The tenant boundary. Without this a member of brand A could pass brand B's
  // id and read brand B's Discord.
  const brand = await checkBrandAccess(brandId, session.user.id)
  if (!brand) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  // Raw query rather than a typed select: the discord_* columns exist in the
  // database and in schema.prisma, but the generated client can't be rebuilt
  // while a dev server holds the query-engine DLL open on Windows. This is
  // correct either way — swap to a typed select after the next
  // `prisma generate` if you prefer.
  // NOTE: raw SQL bypasses Prisma's field mapping, so these must be the real
  // COLUMN names, not the model field names. The model's `name` is mapped to
  // the `full_name` column — querying `name` here fails with
  // "Unknown column 'name' in 'field list'" and 500s the whole status route.
  const rows = await prisma.$queryRaw<
    Array<{
      discord_user_id: string | null
      discord_username: string | null
      full_name: string | null
      email: string | null
    }>
  >`SELECT discord_user_id, discord_username, full_name, email FROM \`User\` WHERE id = ${session.user.id} LIMIT 1`
  const user = rows[0]

  return {
    ok: true,
    userId: session.user.id,
    displayName: user?.full_name || session.user.name || user?.email?.split("@")[0] || "Instroom user",
    discordUserId: user?.discord_user_id ?? null,
    discordUsername: user?.discord_username ?? null,
  }
}

export type GuildGuardOk = GuardOk & { guildId: string }

/** Steps 1–4: everything above, plus a connected guild. */
export async function guardBrandGuild(brandId: string): Promise<GuildGuardOk | GuardFail> {
  const base = await guardBrand(brandId)
  if (!base.ok) return base

  const guildId = await getBrandGuildId(brandId)
  if (!guildId) {
    // Distinguish "never connected" from "connected but the bot is missing",
    // so the UI can offer the right next action instead of a generic error.
    const connection = await getBrandConnection(brandId)
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: connection
            ? connection.statusError ?? "This workspace's Discord connection isn't usable yet."
            : "No Discord server is connected to this workspace.",
          code: connection?.status ?? "not_connected",
          connection,
        },
        { status: 409 }
      ),
    }
  }

  return { ...base, guildId }
}

/** Map a provider error code to an HTTP status the UI can branch on. */
export function statusForCode(code: string): number {
  switch (code) {
    case "not_linked":
    case "not_member":
      return 409
    case "forbidden":
      return 403
    case "not_found":
      return 404
    case "rate_limited":
      return 429
    case "not_configured":
    case "not_connected":
      return 503
    default:
      return 502
  }
}

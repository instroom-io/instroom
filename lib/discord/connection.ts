import "server-only"
// lib/discord/connection.ts
// Per-brand Discord connection: resolve an invite to a permanent guild ID,
// verify the bot is actually in that server, and persist the result.
//
// MULTI-TENANT CONTRACT — the rule the rest of the integration depends on:
//   every Discord call is scoped to a guild ID loaded from the database for the
//   brand in the current request. There is no global guild. The only global is
//   DISCORD_BOT_TOKEN, which is a single bot installed across many servers.
//
// Invites are never the identifier. They expire, get revoked, and can be
// regenerated; the guild ID (a snowflake) is permanent, so it is what we key on.

import { prisma } from "@/lib/prisma"
import { discordRest, isBotTokenConfigured } from "./bot-client"

const LOG = "[discord:connection]"
const CDN = "https://cdn.discordapp.com"

export type ConnectionStatus = "connected" | "bot_missing" | "invalid_invite" | "revoked" | "error"

export type BrandDiscordConnection = {
  brandId: string
  guildId: string
  guildName: string
  guildIconUrl: string | null
  inviteCode: string | null
  inviteUrl: string | null
  status: ConnectionStatus
  statusError: string | null
  connectedAt: string | null
  lastChecked: string | null
}

/** Accepts discord.gg/x, discord.com/invite/x, or a bare code. */
export function parseInviteCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]+)\/?/i
  )
  if (match) return match[1]
  // A bare code, for admins who paste just the suffix.
  if (/^[A-Za-z0-9-]{2,32}$/.test(trimmed)) return trimmed
  return null
}

export function guildIconUrl(guildId: string, icon: string | null | undefined): string | null {
  if (!icon) return null
  const ext = icon.startsWith("a_") ? "gif" : "png"
  return `${CDN}/icons/${guildId}/${icon}.${ext}?size=128`
}

export type ResolveResult =
  | { ok: true; guildId: string; guildName: string; guildIcon: string | null; inviteCode: string }
  | { ok: false; code: "invalid_invite" | "expired_invite" | "rate_limited" | "network" | "unknown"; error: string }

/**
 * Resolve an invite to its guild via Discord's PUBLIC invite endpoint.
 * Unauthenticated on purpose — this has to work before the bot is installed,
 * which is exactly the case where we need to tell the admin what to install.
 */
export async function resolveInvite(inviteInput: string): Promise<ResolveResult> {
  const code = parseInviteCode(inviteInput)
  if (!code) {
    return { ok: false, code: "invalid_invite", error: "That doesn't look like a Discord invite link." }
  }

  let res: Response
  try {
    res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    })
  } catch (err) {
    console.error(`${LOG} invite lookup failed:`, err instanceof Error ? err.message : err)
    return { ok: false, code: "network", error: "Couldn't reach Discord. Try again." }
  }

  if (res.status === 404) {
    // Discord returns 404 for both "never existed" and "expired/revoked".
    return {
      ok: false,
      code: "expired_invite",
      error: "That invite is invalid or has expired. Create a new one that never expires and try again.",
    }
  }
  if (res.status === 429) {
    return { ok: false, code: "rate_limited", error: "Discord is rate limiting invite lookups. Try again shortly." }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.error(`${LOG} invite lookup HTTP ${res.status}: ${body.slice(0, 200)}`)
    return { ok: false, code: "unknown", error: `Discord returned HTTP ${res.status}.` }
  }

  const data = await res.json().catch(() => null)
  const guild = data?.guild
  if (!guild?.id) {
    return { ok: false, code: "invalid_invite", error: "That invite doesn't point to a server." }
  }

  return {
    ok: true,
    guildId: guild.id,
    guildName: guild.name ?? "Discord server",
    guildIcon: guild.icon ?? null,
    inviteCode: code,
  }
}

/**
 * Is the shared bot a member of this guild, and can it see it?
 *
 * GET /guilds/{id} succeeds only for guilds the bot has joined, so a 403/404
 * here means "not installed" rather than "doesn't exist" — which is the
 * distinction the admin needs in order to fix it.
 */
export async function verifyBotAccess(guildId: string): Promise<
  { ok: true; guildName: string; guildIcon: string | null } | { ok: false; code: ConnectionStatus; error: string }
> {
  if (!isBotTokenConfigured()) {
    return { ok: false, code: "error", error: "The Discord bot isn't configured on this server yet." }
  }

  const res = await discordRest<{ id: string; name: string; icon: string | null }>(`/guilds/${guildId}`)

  if (res.ok) return { ok: true, guildName: res.data.name, guildIcon: res.data.icon }

  if (res.status === 403 || res.status === 404) {
    return {
      ok: false,
      code: "bot_missing",
      error: "The Instroom bot hasn't been added to this Discord server yet.",
    }
  }
  if (res.code === "unauthorized") {
    return { ok: false, code: "error", error: "The Discord bot token is invalid or was reset." }
  }
  if (res.code === "rate_limited") {
    return { ok: false, code: "error", error: "Discord is rate limiting. Try again shortly." }
  }
  return { ok: false, code: "error", error: res.error }
}

function toView(row: {
  brand_id: string; guild_id: string; guild_name: string; guild_icon: string | null
  invite_code: string | null; status: string; status_error: string | null
  connected_at: Date | null; last_checked: Date | null
}): BrandDiscordConnection {
  return {
    brandId: row.brand_id,
    guildId: row.guild_id,
    guildName: row.guild_name,
    guildIconUrl: guildIconUrl(row.guild_id, row.guild_icon),
    inviteCode: row.invite_code,
    inviteUrl: row.invite_code ? `https://discord.gg/${row.invite_code}` : null,
    status: row.status as ConnectionStatus,
    statusError: row.status_error,
    connectedAt: row.connected_at?.toISOString() ?? null,
    lastChecked: row.last_checked?.toISOString() ?? null,
  }
}

export async function getBrandConnection(brandId: string): Promise<BrandDiscordConnection | null> {
  const row = await prisma.brandDiscordConnection.findUnique({ where: { brand_id: brandId } })
  return row ? toView(row) : null
}

/**
 * The guild ID for a brand, or null.
 *
 * THIS is the function every Discord call must go through. Anything that
 * hardcodes a guild, or reads one from env, is a multi-tenant bug.
 * Returns null unless the connection is fully usable.
 */
export async function getBrandGuildId(brandId: string): Promise<string | null> {
  const row = await prisma.brandDiscordConnection.findUnique({
    where: { brand_id: brandId },
    select: { guild_id: true, status: true },
  })
  if (!row || row.status !== "connected") return null
  return row.guild_id
}

export type ConnectOutcome =
  | { ok: true; connection: BrandDiscordConnection }
  | { ok: false; code: string; error: string; guildName?: string; guildId?: string }

/**
 * Connect a brand to its own Discord server from an invite link.
 *
 * Order matters: resolve first (works without the bot), then verify the bot is
 * installed. A `bot_missing` result is still persisted — the admin has told us
 * which server they want, and losing that on every failed attempt would make
 * the install loop needlessly painful.
 */
export async function connectBrandDiscord(
  brandId: string,
  inviteInput: string,
  userId: string
): Promise<ConnectOutcome> {
  const resolved = await resolveInvite(inviteInput)
  if (!resolved.ok) return { ok: false, code: resolved.code, error: resolved.error }

  // One guild per brand, and one brand per guild.
  const claimed = await prisma.brandDiscordConnection.findUnique({
    where: { guild_id: resolved.guildId },
    select: { brand_id: true },
  })
  if (claimed && claimed.brand_id !== brandId) {
    return {
      ok: false,
      code: "already_claimed",
      error: "That Discord server is already connected to another workspace.",
    }
  }

  const access = await verifyBotAccess(resolved.guildId)
  const status: ConnectionStatus = access.ok ? "connected" : access.code
  const statusError = access.ok ? null : access.error
  // Prefer the bot's view of the name/icon — the invite payload can be stale.
  const guildName = access.ok ? access.guildName : resolved.guildName
  const guildIcon = access.ok ? access.guildIcon : resolved.guildIcon

  const data = {
    guild_id: resolved.guildId,
    guild_name: guildName.slice(0, 120),
    guild_icon: guildIcon,
    invite_code: resolved.inviteCode,
    status,
    status_error: statusError,
    connected_at: access.ok ? new Date() : null,
    last_checked: new Date(),
    connected_by_user_id: userId,
  }

  const row = await prisma.brandDiscordConnection.upsert({
    where: { brand_id: brandId },
    create: { brand_id: brandId, ...data },
    update: data,
  })

  if (!access.ok) {
    return { ok: false, code: access.code, error: access.error, guildName, guildId: resolved.guildId }
  }
  console.log(`${LOG} brand ${brandId} connected to guild ${resolved.guildId} (${guildName})`)
  return { ok: true, connection: toView(row) }
}

/**
 * Connect a brand using a guild ID obtained directly from Discord's bot
 * authorization flow.
 *
 * This is the primary onboarding path: Discord hands back `guild_id` after the
 * owner picks a server and authorizes the bot, so there is no invite link to
 * resolve and no expiry to worry about. `connectBrandDiscord` (invite-based)
 * remains for admins who prefer pasting a link.
 */
export async function connectBrandByGuildId(
  brandId: string,
  guildId: string,
  userId: string
): Promise<ConnectOutcome> {
  if (!/^\d{17,20}$/.test(guildId)) {
    return { ok: false, code: "invalid_guild", error: "Discord returned an invalid server id." }
  }

  const claimed = await prisma.brandDiscordConnection.findUnique({
    where: { guild_id: guildId },
    select: { brand_id: true },
  })
  if (claimed && claimed.brand_id !== brandId) {
    return {
      ok: false,
      code: "already_claimed",
      error: "That Discord server is already connected to another workspace.",
    }
  }

  // The bot was just authorized, so this should succeed — but Discord's
  // propagation isn't instant, so a failure here is recorded as bot_missing
  // rather than discarded, and "Reconnect" will pick it up.
  const access = await verifyBotAccess(guildId)

  const data = {
    guild_id: guildId,
    guild_name: (access.ok ? access.guildName : "Discord server").slice(0, 120),
    guild_icon: access.ok ? access.guildIcon : null,
    status: access.ok ? ("connected" as ConnectionStatus) : access.code,
    status_error: access.ok ? null : access.error,
    connected_at: access.ok ? new Date() : null,
    last_checked: new Date(),
    connected_by_user_id: userId,
  }

  const row = await prisma.brandDiscordConnection.upsert({
    where: { brand_id: brandId },
    create: { brand_id: brandId, ...data },
    update: data,
  })

  if (!access.ok) return { ok: false, code: access.code, error: access.error, guildId }
  console.log(`${LOG} brand ${brandId} connected to guild ${guildId} via bot authorization`)
  return { ok: true, connection: toView(row) }
}

/** Re-check an existing connection — used by "Reconnect". */
export async function refreshBrandConnection(brandId: string): Promise<ConnectOutcome> {
  const existing = await prisma.brandDiscordConnection.findUnique({ where: { brand_id: brandId } })
  if (!existing) return { ok: false, code: "not_connected", error: "No Discord server is connected." }

  const access = await verifyBotAccess(existing.guild_id)
  const row = await prisma.brandDiscordConnection.update({
    where: { brand_id: brandId },
    data: {
      status: access.ok ? "connected" : access.code,
      status_error: access.ok ? null : access.error,
      last_checked: new Date(),
      ...(access.ok
        ? {
            guild_name: access.guildName.slice(0, 120),
            guild_icon: access.guildIcon,
            connected_at: existing.connected_at ?? new Date(),
          }
        : {}),
    },
  })

  if (!access.ok) return { ok: false, code: access.code, error: access.error }
  return { ok: true, connection: toView(row) }
}

export async function disconnectBrandDiscord(brandId: string): Promise<void> {
  await prisma.brandDiscordConnection.deleteMany({ where: { brand_id: brandId } })
  console.log(`${LOG} brand ${brandId} disconnected`)
}

/** Invite URL for installing the bot into the admin's own server. */
export function botInstallUrl(guildId?: string): string | null {
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) return null
  // View Channels + Send Messages + Read Message History
  const permissions = "68608"
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "bot",
    permissions,
    ...(guildId ? { guild_id: guildId, disable_guild_select: "true" } : {}),
  })
  return `https://discord.com/oauth2/authorize?${params}`
}

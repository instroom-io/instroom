import "server-only"
// lib/discord/permissions.ts
// Discord permission arithmetic, so channel visibility in Instroom matches
// what the user actually sees in Discord.
//
// The bot can read every channel it has access to — which is usually MORE than
// any given member can see. Handing that list straight to the browser would
// leak private channel names and their contents. So every channel is filtered
// against the requesting user's own roles before it leaves the server.
//
// Discord's documented resolution order:
//   1. @everyone base permissions from the guild role
//   2. accumulated permissions from the member's roles
//   3. administrator ⇒ everything, stop
//   4. channel @everyone overwrite (deny then allow)
//   5. channel role overwrites (all denies, then all allows)
//   6. channel member-specific overwrite (deny then allow)

// BigInt(1) rather than 1n: this project's tsconfig targets below ES2020, so
// BigInt literals don't compile. Same values, same semantics.
const bit = (n: number) => BigInt(1) << BigInt(n)
const ZERO = BigInt(0)
/** All bits set — what Administrator effectively grants. */
const ALL = BigInt(-1)

export const PERMISSIONS = {
  VIEW_CHANNEL: bit(10),
  SEND_MESSAGES: bit(11),
  READ_MESSAGE_HISTORY: bit(16),
  ADMINISTRATOR: bit(3),
  ATTACH_FILES: bit(15),
  ADD_REACTIONS: bit(6),
} as const

export type Overwrite = {
  id: string
  /** 0 = role, 1 = member */
  type: number
  allow: string
  deny: string
}

export type GuildRole = { id: string; permissions: string; position: number; name: string; color: number }

export type GuildChannel = {
  id: string
  name: string
  type: number
  position: number
  parent_id?: string | null
  topic?: string | null
  permission_overwrites?: Overwrite[]
  nsfw?: boolean
  /**
   * Newest message id in the channel. Snowflakes sort chronologically, so
   * comparing this against a locally stored "last read" id yields a real unread
   * signal — Discord exposes no read-state endpoint to bots.
   */
  last_message_id?: string | null
}

/** Discord channel type constants we care about. */
export const CHANNEL_TYPE = {
  GUILD_TEXT: 0,
  GUILD_VOICE: 2,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  ANNOUNCEMENT_THREAD: 10,
  PUBLIC_THREAD: 11,
  PRIVATE_THREAD: 12,
  GUILD_FORUM: 15,
} as const

const big = (v: string | undefined) => {
  try { return BigInt(v ?? "0") } catch { return ZERO }
}

/** Steps 1–3: guild-level permissions for a member. */
export function computeBasePermissions(
  guildId: string,
  memberRoleIds: string[],
  roles: GuildRole[]
): bigint {
  const everyone = roles.find((r) => r.id === guildId)
  let permissions = big(everyone?.permissions)

  for (const roleId of memberRoleIds) {
    const role = roles.find((r) => r.id === roleId)
    if (role) permissions |= big(role.permissions)
  }

  // Administrator short-circuits every overwrite below.
  if ((permissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR) {
    return ALL
  }
  return permissions
}

/** Steps 4–6: apply a channel's overwrites on top of base permissions. */
export function computeChannelPermissions(
  base: bigint,
  guildId: string,
  userId: string,
  memberRoleIds: string[],
  channel: GuildChannel
): bigint {
  if ((base & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR) return ALL

  let permissions = base
  const overwrites = channel.permission_overwrites ?? []

  // @everyone overwrite first — it is the widest and everything else layers on.
  const everyoneOverwrite = overwrites.find((o) => o.id === guildId)
  if (everyoneOverwrite) {
    permissions &= ~big(everyoneOverwrite.deny)
    permissions |= big(everyoneOverwrite.allow)
  }

  // All role denies are applied before any role allow, per Discord's spec —
  // an allow on one role beats a deny on another.
  let allow = ZERO
  let deny = ZERO
  for (const o of overwrites) {
    if (o.type === 0 && o.id !== guildId && memberRoleIds.includes(o.id)) {
      deny |= big(o.deny)
      allow |= big(o.allow)
    }
  }
  permissions &= ~deny
  permissions |= allow

  // Member-specific overwrite is the most specific and wins outright.
  const memberOverwrite = overwrites.find((o) => o.type === 1 && o.id === userId)
  if (memberOverwrite) {
    permissions &= ~big(memberOverwrite.deny)
    permissions |= big(memberOverwrite.allow)
  }

  return permissions
}

export const has = (permissions: bigint, flag: bigint) => (permissions & flag) === flag

/**
 * Filter a guild's channels to those the member may actually see.
 *
 * A channel needs BOTH view and read-history to be usable — Discord shows a
 * channel you can view but not read history in, which would render as a
 * permanently empty list. Excluding it is the more honest behaviour.
 */
export function visibleChannels(
  guildId: string,
  userId: string,
  memberRoleIds: string[],
  roles: GuildRole[],
  channels: GuildChannel[]
): Array<GuildChannel & { canSend: boolean }> {
  const base = computeBasePermissions(guildId, memberRoleIds, roles)

  return channels
    .filter((c) => {
      const perms = computeChannelPermissions(base, guildId, userId, memberRoleIds, c)
      // Categories only need view — they're containers, not readable.
      if (c.type === CHANNEL_TYPE.GUILD_CATEGORY) return has(perms, PERMISSIONS.VIEW_CHANNEL)
      return has(perms, PERMISSIONS.VIEW_CHANNEL) && has(perms, PERMISSIONS.READ_MESSAGE_HISTORY)
    })
    .map((c) => {
      const perms = computeChannelPermissions(base, guildId, userId, memberRoleIds, c)
      return { ...c, canSend: has(perms, PERMISSIONS.SEND_MESSAGES) }
    })
}

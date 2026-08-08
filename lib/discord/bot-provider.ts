import "server-only"
// lib/discord/bot-provider.ts
// Bot-backed Community backend: real channels, real message history, real
// sending, filtered to what each user is allowed to see.
//
// Discord stays the source of truth — nothing here is mirrored into our
// database. The only thing we persist is the user↔Discord account link, which
// is what lets us compute per-user channel visibility.

import { discordRest, isBotTokenConfigured } from "./bot-client"
import {
  visibleChannels, CHANNEL_TYPE,
  type GuildRole, type GuildChannel,
} from "./permissions"

export type DiscordAttachment = {
  id: string
  filename: string
  url: string
  proxyUrl: string
  contentType: string | null
  size: number
  width: number | null
  height: number | null
  /** Rendered inline rather than as a download chip. */
  isImage: boolean
}

export type DiscordReaction = { emoji: string; emojiId: string | null; count: number; me: boolean }

export type DiscordMessageView = {
  id: string
  channelId: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorIsBot: boolean
  content: string
  createdAt: string
  editedAt: string | null
  attachments: DiscordAttachment[]
  reactions: DiscordReaction[]
  /** Set when this message replies to another. */
  replyTo: { id: string; authorName: string; excerpt: string } | null
  /** Set when a thread hangs off this message. */
  thread: { id: string; name: string; messageCount: number } | null
  /** Permalink for "Copy message link". */
  link: string
  pinned: boolean
}

export type DiscordChannelView = {
  id: string
  name: string
  type: "text" | "voice" | "announcement" | "forum"
  topic: string | null
  parentId: string | null
  parentName: string | null
  /** Category position, so the sidebar can order categories as Discord does. */
  parentPosition: number
  position: number
  canSend: boolean
  nsfw: boolean
  /**
   * Newest message id, or null for an empty channel. The client compares this
   * against its own stored last-read id to derive unread state — Discord gives
   * bots no access to a user's real read state, so this is the honest signal.
   */
  lastMessageId: string | null
}

const CDN = "https://cdn.discordapp.com"

function avatarUrl(userId: string, avatar: string | null | undefined, discriminator?: string): string | null {
  if (avatar) {
    const ext = avatar.startsWith("a_") ? "gif" : "png"
    return `${CDN}/avatars/${userId}/${avatar}.${ext}?size=64`
  }
  // Default avatar: new usernames shard on the snowflake, legacy on discriminator.
  const index = discriminator && discriminator !== "0"
    ? Number(discriminator) % 5
    : Number((BigInt(userId) >> BigInt(22)) % BigInt(6))
  return `${CDN}/embed/avatars/${index}.png`
}

const IMAGE_TYPES = /^image\/(png|jpe?g|gif|webp|avif)$/i

/* eslint-disable @typescript-eslint/no-explicit-any */
function normaliseMessage(raw: any, guildId: string): DiscordMessageView {
  const author = raw.author ?? {}
  const attachments: DiscordAttachment[] = (raw.attachments ?? []).map((a: any) => ({
    id: a.id,
    filename: a.filename,
    url: a.url,
    proxyUrl: a.proxy_url ?? a.url,
    contentType: a.content_type ?? null,
    size: a.size ?? 0,
    width: a.width ?? null,
    height: a.height ?? null,
    isImage: IMAGE_TYPES.test(a.content_type ?? "") || Boolean(a.width && a.height),
  }))

  // Discord returns animated GIFs/embeds separately from attachments; surface
  // GIF embeds as attachments so the UI has one thing to render.
  for (const e of raw.embeds ?? []) {
    if ((e.type === "gifv" || e.type === "image") && (e.thumbnail?.url || e.image?.url)) {
      const url = e.image?.url ?? e.thumbnail?.url
      attachments.push({
        id: `embed-${attachments.length}`,
        filename: e.type === "gifv" ? "GIF" : "image",
        url,
        proxyUrl: e.thumbnail?.proxy_url ?? url,
        contentType: e.type === "gifv" ? "image/gif" : "image/png",
        size: 0,
        width: e.thumbnail?.width ?? e.image?.width ?? null,
        height: e.thumbnail?.height ?? e.image?.height ?? null,
        isImage: true,
      })
    }
  }

  const reactions: DiscordReaction[] = (raw.reactions ?? []).map((r: any) => ({
    emoji: r.emoji?.name ?? "?",
    emojiId: r.emoji?.id ?? null,
    count: r.count ?? 0,
    me: Boolean(r.me),
  }))

  const ref = raw.referenced_message
  return {
    id: raw.id,
    channelId: raw.channel_id,
    authorId: author.id ?? "0",
    authorName: raw.member?.nick || author.global_name || author.username || "Unknown",
    authorAvatarUrl: avatarUrl(author.id ?? "0", author.avatar, author.discriminator),
    authorIsBot: Boolean(author.bot),
    content: raw.content ?? "",
    createdAt: raw.timestamp,
    editedAt: raw.edited_timestamp ?? null,
    attachments,
    reactions,
    replyTo: ref
      ? {
          id: ref.id,
          authorName: ref.author?.global_name || ref.author?.username || "Unknown",
          excerpt: (ref.content ?? "").slice(0, 120),
        }
      : null,
    thread: raw.thread
      ? { id: raw.thread.id, name: raw.thread.name, messageCount: raw.thread.message_count ?? 0 }
      : null,
    link: `https://discord.com/channels/${guildId}/${raw.channel_id}/${raw.id}`,
    pinned: Boolean(raw.pinned),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const CHANNEL_KIND: Record<number, DiscordChannelView["type"]> = {
  [CHANNEL_TYPE.GUILD_TEXT]: "text",
  [CHANNEL_TYPE.GUILD_VOICE]: "voice",
  [CHANNEL_TYPE.GUILD_ANNOUNCEMENT]: "announcement",
  [CHANNEL_TYPE.GUILD_FORUM]: "forum",
}

/**
 * Channels the given Discord user may see, with category names resolved.
 *
 * `discordUserId` comes from the OAuth link. Without it we cannot compute
 * per-user visibility, and returning the bot's full channel list instead would
 * leak private channels — so that case returns an explicit error.
 */
export async function getChannelsForUser(guildId: string, discordUserId: string | null) {
  if (!isBotTokenConfigured()) {
    return { ok: false as const, error: "Discord bot is not configured.", code: "not_configured" as const }
  }
  if (!guildId) {
    return { ok: false as const, error: "This workspace has no Discord server connected.", code: "not_connected" as const }
  }
  if (!discordUserId) {
    return { ok: false as const, error: "Link your Discord account to see channels.", code: "not_linked" as const }
  }

  const [channelsRes, rolesRes, memberRes] = await Promise.all([
    discordRest<GuildChannel[]>(`/guilds/${guildId}/channels`),
    discordRest<GuildRole[]>(`/guilds/${guildId}/roles`),
    discordRest<{ roles: string[] }>(`/guilds/${guildId}/members/${discordUserId}`),
  ])

  if (!channelsRes.ok) return { ok: false as const, error: channelsRes.error, code: channelsRes.code }
  if (!rolesRes.ok) return { ok: false as const, error: rolesRes.error, code: rolesRes.code }
  if (!memberRes.ok) {
    // 404 here means the linked account isn't in the guild at all.
    if (memberRes.status === 404) {
      return { ok: false as const, error: "Your Discord account isn't a member of this server.", code: "not_member" as const }
    }
    return { ok: false as const, error: memberRes.error, code: memberRes.code }
  }

  const allowed = visibleChannels(
    guildId,
    discordUserId,
    memberRes.data.roles ?? [],
    rolesRes.data,
    channelsRes.data
  )

  const categories = new Map(
    channelsRes.data
      .filter((c) => c.type === CHANNEL_TYPE.GUILD_CATEGORY)
      .map((c) => [c.id, { name: c.name, position: c.position }])
  )

  const views: DiscordChannelView[] = allowed
    .filter((c) => CHANNEL_KIND[c.type])
    .map((c) => {
      const parent = c.parent_id ? categories.get(c.parent_id) : undefined
      return {
        id: c.id,
        name: c.name,
        type: CHANNEL_KIND[c.type],
        topic: c.topic ?? null,
        parentId: c.parent_id ?? null,
        parentName: parent?.name ?? null,
        // Uncategorised channels sit above every category, as in Discord.
        parentPosition: parent?.position ?? -1,
        position: c.position,
        canSend: c.canSend,
        nsfw: Boolean(c.nsfw),
        lastMessageId: c.last_message_id ?? null,
      }
    })
    // Category order first, then position within the category.
    .sort((a, b) => a.parentPosition - b.parentPosition || a.position - b.position)

  return { ok: true as const, channels: views }
}

/** Guard every channel-scoped call: never trust a channelId from the client. */
async function assertChannelAccess(guildId: string, discordUserId: string | null, channelId: string) {
  const result = await getChannelsForUser(guildId, discordUserId)
  if (!result.ok) return result
  const channel = result.channels.find((c) => c.id === channelId)
  if (!channel) {
    // Same response whether the channel doesn't exist or isn't visible —
    // distinguishing them would confirm the existence of private channels.
    return { ok: false as const, error: "Channel not found.", code: "not_found" as const }
  }
  return { ok: true as const, channel }
}

export async function getMessages(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  options: { before?: string; limit?: number } = {}
) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100)
  const params = new URLSearchParams({ limit: String(limit) })
  if (options.before) params.set("before", options.before)

  const res = await discordRest<unknown[]>(`/channels/${channelId}/messages?${params}`)
  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }

  // Discord returns newest-first; the UI renders oldest-first.
  const messages = res.data.map((m) => normaliseMessage(m, guildId)).reverse()
  return { ok: true as const, messages, hasMore: res.data.length === limit }
}

/**
 * Send a message as the bot, attributed to the Instroom user.
 *
 * Discord has no way for a bot to post *as* another user, so the display name
 * is prefixed. A webhook with username/avatar_url override would look better,
 * but needs Manage Webhooks and creates a webhook per channel — worth doing
 * later, deliberately not done implicitly here.
 */
export async function sendMessage(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  content: string,
  displayName: string,
  replyToId?: string,
  files: File[] = []
) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access
  if (!access.channel.canSend) {
    return { ok: false as const, error: "You don't have permission to post in this channel.", code: "forbidden" as const }
  }

  const trimmed = content.trim()
  // With an attachment the text may be empty — the file IS the message.
  if (!trimmed && files.length === 0) {
    return { ok: false as const, error: "Message is empty.", code: "invalid" as const }
  }
  // Discord hard-limits at 2000 characters; the prefix counts toward it.
  const prefix = `**${displayName}**: `
  const body = `${prefix}${trimmed}`.slice(0, 2000)

  const payload = {
    content: body,
    // Never let a message from Instroom ping @everyone or roles.
    allowed_mentions: { parse: ["users"] },
    ...(replyToId ? { message_reference: { message_id: replyToId, fail_if_not_exists: false } } : {}),
    ...(files.length > 0
      ? { attachments: files.map((f, i) => ({ id: i, filename: f.name })) }
      : {}),
  }

  const res = await discordRest<unknown>(
    `/channels/${channelId}/messages`,
    files.length > 0
      ? {
          method: "POST",
          form: (() => {
            const form = new FormData()
            form.append("payload_json", JSON.stringify(payload))
            files.forEach((f, i) => form.append(`files[${i}]`, f, f.name))
            return form
          })(),
        }
      : { method: "POST", json: payload }
  )

  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  return { ok: true as const, message: normaliseMessage(res.data, guildId) }
}

/**
 * Add or remove a reaction on a message.
 *
 * A caveat worth stating plainly: this reacts as the BOT, because a bot token
 * is the only credential we hold. Discord has no way for a bot to react on
 * behalf of a user. So the count moves and `me` flips for everyone viewing
 * through Instroom, but on Discord itself the reaction reads as the Instroom
 * bot — the same trade-off already accepted for sending messages.
 */
export async function toggleReaction(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  messageId: string,
  emoji: string,
  on: boolean
) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access

  // Custom emoji travel as "name:id"; Unicode as the raw character. Both must
  // be percent-encoded, and encodeURIComponent leaves ":" alone as required.
  const target = encodeURIComponent(emoji)
  const res = await discordRest(
    `/channels/${channelId}/messages/${messageId}/reactions/${target}/@me`,
    { method: on ? "PUT" : "DELETE" }
  )

  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error, code: res.code }
}

export async function triggerTyping(guildId: string, discordUserId: string | null, channelId: string) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access
  const res = await discordRest(`/channels/${channelId}/typing`, { method: "POST" })
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error, code: res.code }
}

export { normaliseMessage }

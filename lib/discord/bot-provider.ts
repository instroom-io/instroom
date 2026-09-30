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

export type DiscordPollOption = { answerId: number; text: string; count: number }

export type DiscordPollView = {
  question: string
  options: DiscordPollOption[]
  totalVotes: number
  allowMultiselect: boolean
  /** null = never expires; otherwise an ISO timestamp. */
  expiresAt: string | null
  /** True once Discord (or expirePoll below) has closed it to further votes. */
  isFinalized: boolean
}

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
  /** Set when this message carries a poll. Discord's own tally — see the
   *  route layer for why the UI does not read vote counts from here. */
  poll: DiscordPollView | null
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
    poll: raw.poll
      ? {
          question: raw.poll.question?.text ?? "",
          options: (raw.poll.answers ?? []).map((a: any) => ({
            answerId: a.answer_id,
            text: a.poll_media?.text ?? "",
            // Discord omits `results` until it has tallied the poll at least
            // once — a poll one second old has no results object at all, not
            // an empty one. Zero is the correct read for that, not "unknown".
            count:
              raw.poll.results?.answer_counts?.find((c: any) => c.id === a.answer_id)?.count ?? 0,
          })),
          totalVotes: (raw.poll.results?.answer_counts ?? []).reduce(
            (sum: number, c: any) => sum + (c.count ?? 0),
            0
          ),
          allowMultiselect: Boolean(raw.poll.allow_multiselect),
          expiresAt: raw.poll.expiry ?? null,
          isFinalized: Boolean(raw.poll.results?.is_finalized),
        }
      : null,
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

/**
 * Access check for a THREAD id rather than a regular channel.
 *
 * `GET /guilds/{id}/channels` — what getChannelsForUser lists from — does not
 * return threads at all; Discord treats them as a separate concept with their
 * own listing endpoints. assertChannelAccess would therefore reject every
 * thread id as "not found", including one this very caller just created.
 *
 * A thread's own channel object (fetched directly, one request) carries
 * `parent_id`: the channel it branched from. Checking that the PARENT is one
 * of the caller's visible channels is the same inherited-permission rule
 * Discord itself uses for threads, and reuses the existing visibility list
 * rather than a second permission computation.
 */
async function assertThreadAccess(guildId: string, discordUserId: string | null, threadId: string) {
  const visible = await getChannelsForUser(guildId, discordUserId)
  if (!visible.ok) return visible

  const threadRes = await discordRest<{ id: string; parent_id?: string | null }>(`/channels/${threadId}`)
  if (!threadRes.ok) {
    return { ok: false as const, error: "Thread not found.", code: "not_found" as const }
  }
  const parentId = threadRes.data.parent_id
  if (!parentId || !visible.channels.some((c) => c.id === parentId)) {
    return { ok: false as const, error: "Thread not found.", code: "not_found" as const }
  }
  return { ok: true as const, threadId, parentId }
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
 * Fetch a single message — used before voting, to read its poll's CURRENT
 * finalized/expiry state rather than trusting whatever the client last saw.
 *
 * `channelId` may name either a regular channel OR a thread — a poll message
 * can live inside a thread, and Discord's vote endpoints are scoped to
 * whichever channel the message actually lives in (threads ARE channels in
 * Discord's model). assertChannelAccess alone would reject a thread id, the
 * exact gap assertThreadAccess exists to close (see its own comment), so this
 * tries the regular check first and only falls back to the thread check —
 * cheaper for the overwhelmingly common case of voting in a normal channel.
 */
export async function getMessage(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  messageId: string
) {
  const channelAccess = await assertChannelAccess(guildId, discordUserId, channelId)
  const access = channelAccess.ok
    ? channelAccess
    : await assertThreadAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access

  const res = await discordRest<unknown>(`/channels/${channelId}/messages/${messageId}`)
  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  return { ok: true as const, message: normaliseMessage(res.data, guildId) }
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

/**
 * Is this message the one Instroom sent on behalf of `displayName`?
 *
 * Every message this app posts is attributed by a `**DisplayName**: ` prefix
 * — see sendMessage's own comment on why (the bot is the only Discord identity
 * we hold). That prefix is therefore also the only reliable signal for "did
 * THIS Instroom user send this", so edit/delete check it rather than
 * `authorId`, which is the bot's id on every message regardless of who typed
 * it. `authorIsBot` is checked too: a message a real person posted directly in
 * Discord (not through Instroom) is never editable/deletable from here, no
 * matter what its text happens to start with.
 */
function isOwnMessage(raw: { author?: { bot?: boolean }; content?: string }, displayName: string): boolean {
  return Boolean(raw.author?.bot) && (raw.content ?? "").startsWith(`**${displayName}**: `)
}

/**
 * Fetch one message and confirm it belongs to `displayName` before an
 * edit/delete is allowed to proceed. A single extra request, but the
 * alternative — trusting the client's own idea of which messages are "mine" —
 * would let anyone edit or delete anyone else's message by id.
 */
async function assertOwnMessage(channelId: string, messageId: string, displayName: string) {
  const res = await discordRest<any>(`/channels/${channelId}/messages/${messageId}`) // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  if (!isOwnMessage(res.data, displayName)) {
    return { ok: false as const, error: "You can only edit or delete your own messages.", code: "forbidden" as const }
  }
  return { ok: true as const, raw: res.data }
}

/**
 * Edit a message THIS Instroom user sent.
 *
 * The `**DisplayName**: ` prefix is preserved and re-applied — the caller only
 * ever supplies the text after it, matching what the composer already shows
 * on screen (see DiscordClient's editingMessage state), so a user editing
 * their own message never sees or has to know the attribution prefix exists.
 */
export async function editMessage(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  messageId: string,
  displayName: string,
  content: string
) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access

  const trimmed = content.trim()
  if (!trimmed) {
    return { ok: false as const, error: "Message cannot be empty.", code: "invalid" as const }
  }

  const owns = await assertOwnMessage(channelId, messageId, displayName)
  if (!owns.ok) return owns

  const prefix = `**${displayName}**: `
  const body = `${prefix}${trimmed}`.slice(0, 2000)

  const res = await discordRest<unknown>(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    json: { content: body },
  })
  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  return { ok: true as const, message: normaliseMessage(res.data, guildId) }
}

/** Delete a message THIS Instroom user sent. */
export async function deleteMessage(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  messageId: string,
  displayName: string
) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access

  const owns = await assertOwnMessage(channelId, messageId, displayName)
  if (!owns.ok) return owns

  const res = await discordRest(`/channels/${channelId}/messages/${messageId}`, { method: "DELETE" })
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error, code: res.code }
}

/**
 * Pin or unpin a message.
 *
 * Not restricted to the message's own author — pinning is a channel-curation
 * action about a message, not an edit of it, the same distinction Discord
 * itself draws (Manage Messages, not "message author"). This app has no
 * brand-level moderator role yet (tracked separately under "moderation
 * controls"), so for now it is open to anyone who can already post in the
 * channel — the same access level every other action in this file already
 * uses, and strictly narrower than nothing.
 */
export async function togglePin(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  messageId: string,
  on: boolean
) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access
  const res = await discordRest(`/channels/${channelId}/pins/${messageId}`, { method: on ? "PUT" : "DELETE" })
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error, code: res.code }
}

/** Every currently pinned message in a channel, newest first (Discord's own order). */
export async function getPinnedMessages(guildId: string, discordUserId: string | null, channelId: string) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access
  const res = await discordRest<unknown[]>(`/channels/${channelId}/pins`)
  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  return { ok: true as const, messages: res.data.map((m) => normaliseMessage(m, guildId)) }
}

/**
 * Start a thread off an existing message.
 *
 * Discord requires a name (max 100 chars); this app doesn't collect one from
 * the user, so the first line of the source message stands in for it, the
 * same way email clients derive a subject from a reply.
 */
export async function createThread(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  messageId: string,
  seedName: string
) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access

  const name = seedName.replace(/\s+/g, " ").trim().slice(0, 100) || "Thread"
  const res = await discordRest<any>( // eslint-disable-line @typescript-eslint/no-explicit-any
    `/channels/${channelId}/messages/${messageId}/threads`,
    { method: "POST", json: { name } }
  )
  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  return {
    ok: true as const,
    thread: { id: res.data.id as string, name: res.data.name as string, messageCount: 0 },
  }
}

/** Discord's own hard ceiling on poll answers. */
const MAX_POLL_ANSWERS = 10
/** Discord's own hard ceiling on poll duration, in hours (32 days). */
const MAX_POLL_DURATION_HOURS = 768

/**
 * Post a new poll. Its own function, not a mode of sendMessage: a poll's
 * validation (a question, 2–10 answers, a duration) is unrelated to plain
 * message content, the same reasoning that already keeps createThread
 * separate from sendMessage above.
 *
 * Text-only — no reply/attachments — matching the composer's own poll flow,
 * which is its own dedicated screen rather than a poll bolted onto a message
 * someone is also typing.
 */
export async function sendPoll(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  displayName: string,
  question: string,
  answers: string[],
  allowMultiselect: boolean,
  durationHours: number
) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access
  if (!access.channel.canSend) {
    return { ok: false as const, error: "You don't have permission to post in this channel.", code: "forbidden" as const }
  }

  const q = question.trim().slice(0, 300)
  if (!q) return { ok: false as const, error: "A poll needs a question.", code: "invalid" as const }

  const cleanAnswers = answers.map((a) => a.trim()).filter(Boolean).slice(0, MAX_POLL_ANSWERS)
  if (cleanAnswers.length < 2) {
    return { ok: false as const, error: "A poll needs at least 2 options.", code: "invalid" as const }
  }

  const duration = Math.min(Math.max(Math.round(durationHours) || 24, 1), MAX_POLL_DURATION_HOURS)

  // The attribution prefix goes on the QUESTION, not a separate content field
  // — a poll message has no content of its own, and this is the only place
  // Discord shows text for who started it, matching every other action this
  // app attributes the same way.
  const payload = {
    poll: {
      question: { text: `${q} — via ${displayName}`.slice(0, 300) },
      answers: cleanAnswers.map((text) => ({ poll_media: { text: text.slice(0, 55) } })),
      duration,
      allow_multiselect: allowMultiselect,
    },
  }

  const res = await discordRest<unknown>(`/channels/${channelId}/messages`, { method: "POST", json: payload })
  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  return { ok: true as const, message: normaliseMessage(res.data, guildId) }
}

/**
 * Cast (or move) the bot's OWN vote on a poll, so the live Discord poll stays
 * in sync with what Instroom's UI shows — see CommunityPollVote's schema
 * comment on why the bot's vote is not what the UI counts from.
 *
 * `answerIds` is the caller's FULL current selection after this change (not a
 * single toggle): Discord's vote-add/remove endpoints are per-answer, and a
 * single-select poll's move from one answer to another has to clear the old
 * one and set the new one as two calls. Passing the whole target set here
 * keeps that sequencing in one place instead of the route working it out.
 */
export async function syncPollBotVote(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  messageId: string,
  previousAnswerIds: number[],
  nextAnswerIds: number[]
) {
  // Same channel-then-thread fallback getMessage uses — a poll can live in
  // a thread, whose id assertChannelAccess alone does not recognise.
  const channelAccess = await assertChannelAccess(guildId, discordUserId, channelId)
  const access = channelAccess.ok ? channelAccess : await assertThreadAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access

  const toRemove = previousAnswerIds.filter((id) => !nextAnswerIds.includes(id))
  const toAdd = nextAnswerIds.filter((id) => !previousAnswerIds.includes(id))

  // Sequential, not Promise.all: these are the SAME message's poll, and firing
  // add/remove calls concurrently risks Discord processing them out of order
  // — an add that lands before its matching remove would (briefly, but
  // visibly if polled) show the wrong answer selected.
  for (const id of toRemove) {
    const res = await discordRest(`/channels/${channelId}/polls/${messageId}/answers/${id}/@me`, { method: "DELETE" })
    if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  }
  for (const id of toAdd) {
    const res = await discordRest(`/channels/${channelId}/polls/${messageId}/answers/${id}/@me`, { method: "PUT" })
    if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  }
  return { ok: true as const }
}

/** Close a poll to further votes before its natural expiry. */
export async function expirePoll(
  guildId: string,
  discordUserId: string | null,
  channelId: string,
  messageId: string
) {
  const access = await assertChannelAccess(guildId, discordUserId, channelId)
  if (!access.ok) return access
  const res = await discordRest<unknown>(`/channels/${channelId}/polls/${messageId}/expire`, { method: "POST" })
  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  return { ok: true as const, message: normaliseMessage(res.data, guildId) }
}

/**
 * A thread's own message history — its "own conversation view" while still
 * attached to the message it branched from (that origin message is what the
 * thread's `parent_id`/name already point back to on the client).
 *
 * Deliberately its own function rather than reusing getMessages: the access
 * check is different (assertThreadAccess, not assertChannelAccess — see its
 * own comment on why a thread id is invisible to the normal channel list),
 * and duplicating this much smaller body keeps that difference explicit
 * instead of getMessages growing an "is this a thread?" branch.
 */
export async function getThreadMessages(
  guildId: string,
  discordUserId: string | null,
  threadId: string,
  options: { before?: string; limit?: number } = {}
) {
  const access = await assertThreadAccess(guildId, discordUserId, threadId)
  if (!access.ok) return access

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100)
  const params = new URLSearchParams({ limit: String(limit) })
  if (options.before) params.set("before", options.before)

  const res = await discordRest<unknown[]>(`/channels/${threadId}/messages?${params}`)
  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }

  const messages = res.data.map((m) => normaliseMessage(m, guildId)).reverse()
  return { ok: true as const, messages, hasMore: res.data.length === limit }
}

/**
 * Send a message inside a thread. Text only for this pass — the composer's
 * file-upload path stays scoped to the main channel view until threads need
 * it, matching how this task's own sequencing puts attachments after actions.
 */
export async function sendThreadMessage(
  guildId: string,
  discordUserId: string | null,
  threadId: string,
  content: string,
  displayName: string
) {
  const access = await assertThreadAccess(guildId, discordUserId, threadId)
  if (!access.ok) return access

  const trimmed = content.trim()
  if (!trimmed) {
    return { ok: false as const, error: "Message is empty.", code: "invalid" as const }
  }
  const prefix = `**${displayName}**: `
  const body = `${prefix}${trimmed}`.slice(0, 2000)

  const res = await discordRest<unknown>(`/channels/${threadId}/messages`, {
    method: "POST",
    json: { content: body, allowed_mentions: { parse: ["users"] } },
  })
  if (!res.ok) return { ok: false as const, error: res.error, code: res.code }
  return { ok: true as const, message: normaliseMessage(res.data, guildId) }
}

export { normaliseMessage }

// Shared shapes for the embedded Discord client.
//
// These mirror the JSON returned by /api/brands/:brandId/integrations/discord/*
// exactly. They are duplicated from lib/discord/bot-provider rather than
// imported because that module is `server-only` — importing it into a client
// component would fail the build.

export type ChannelType = "text" | "voice" | "announcement" | "forum"

export type Channel = {
  id: string
  name: string
  type: ChannelType
  topic: string | null
  parentId: string | null
  parentName: string | null
  parentPosition: number
  position: number
  canSend: boolean
  nsfw: boolean
  lastMessageId: string | null
}

export type Attachment = {
  id: string
  filename: string
  url: string
  proxyUrl: string
  contentType: string | null
  size: number
  width: number | null
  height: number | null
  isImage: boolean
}

export type Reaction = {
  emoji: string
  emojiId: string | null
  count: number
  me: boolean
}

export type PollOption = { answerId: number; text: string; count: number }

export type Poll = {
  question: string
  options: PollOption[]
  totalVotes: number
  allowMultiselect: boolean
  /** null = never expires; otherwise an ISO timestamp. */
  expiresAt: string | null
  isFinalized: boolean
}

export type Message = {
  id: string
  channelId: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorIsBot: boolean
  content: string
  createdAt: string
  editedAt: string | null
  attachments: Attachment[]
  reactions: Reaction[]
  replyTo: { id: string; authorName: string; excerpt: string } | null
  thread: { id: string; name: string; messageCount: number } | null
  link: string
  pinned: boolean
  poll: Poll | null
  /** The CURRENT user's own picks on this poll, by answerId. Always present
   *  (empty array) even when `poll` is null, matching the API's own shape. */
  myVotes: number[]
}

export type Member = {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  bot: boolean
  roleName: string | null
  roleColor: string | null
}

/** A category plus the channels inside it, ordered as Discord orders them. */
export type ChannelCategory = {
  id: string
  name: string
  channels: Channel[]
}

/**
 * Consecutive messages from the same author within a short window render as one
 * block: full header on the first, timestamp-on-hover for the rest. This is what
 * gives Discord its density.
 */
export type MessageGroup = {
  key: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorIsBot: boolean
  messages: Message[]
}

export const INSTROOM_GREEN = "#0F6B3E"

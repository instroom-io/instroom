// lib/discord/types.ts
// Provider-agnostic shapes for the Community page's Discord integration.
//
// These types are what the UI consumes. They are deliberately NOT the raw
// Discord payloads, so the backing implementation can change — today the
// public widget endpoint, later a bot token + Gateway — without any UI change.

export type DiscordPresence = "online" | "idle" | "dnd" | "offline"

export interface DiscordMember {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  status: DiscordPresence
  /** Present when the member is in a voice channel. */
  voiceChannelId?: string | null
  /** Bot accounts are grouped separately in the member list. */
  bot?: boolean
}

export interface DiscordChannel {
  id: string
  name: string
  type: "text" | "voice"
  position: number
  /** Members currently connected — voice channels only. */
  members?: DiscordMember[]
}

export interface DiscordGuildSnapshot {
  id: string
  name: string
  iconUrl: string | null
  /** Members Discord reports as online. The widget caps this at 100. */
  onlineCount: number
  members: DiscordMember[]
  channels: DiscordChannel[]
  instantInviteUrl: string | null
  /** When this snapshot was taken, for the UI's freshness indicator. */
  fetchedAt: string
}

/**
 * What a Community backend must provide.
 *
 * `widget` (implemented) needs no credentials and returns presence only.
 * A future `bot` implementation would add message history, sending, text
 * channels and per-user permission filtering behind this same interface.
 */
export interface CommunityProvider {
  readonly kind: "widget" | "bot"
  /** True when this provider can read and send messages in-app. */
  readonly supportsMessages: boolean
  getGuildSnapshot(guildId: string): Promise<DiscordResult<DiscordGuildSnapshot>>
}

export type DiscordResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: DiscordErrorCode; retryAfterMs?: number }

export type DiscordErrorCode =
  /** Server widget is turned off in Discord's server settings. */
  | "widget_disabled"
  /** Guild ID doesn't resolve. */
  | "not_found"
  /** HTTP 429 — includes retryAfterMs. */
  | "rate_limited"
  | "network"
  | "unknown"

import "server-only"
// lib/discord/polls.ts
// The one place Community reaches into Instroom's own database rather than
// Discord's — see CommunityPollVote's schema comment for why a poll's VOTES
// specifically cannot be Discord-backed the way everything else in Community
// is: Discord's poll vote is tracked per Discord account, and the bot is the
// only Discord account this app holds, so more than one Instroom voter cannot
// be represented in Discord's own tally.
//
// A poll's question/options/expiry are never read from here — those still
// come from Discord's own message.poll object (normaliseMessage), unchanged.
// This module only overlays the real per-user vote counts on top.

import { prisma } from "@/lib/prisma"
import type { DiscordMessageView } from "./bot-provider"

/**
 * Replace a batch of messages' poll vote counts with Instroom's own tally, and
 * mark which options THIS user picked.
 *
 * One query for the whole batch (not one per message) — this runs on every
 * channel/thread message fetch, so it has to stay O(1) queries regardless of
 * how many of the messages on screen happen to be polls.
 */
export async function attachPollVotes(
  userId: string,
  messages: DiscordMessageView[]
): Promise<Array<DiscordMessageView & { myVotes: number[] }>> {
  const pollMessageIds = messages.filter((m) => m.poll).map((m) => m.id)
  if (pollMessageIds.length === 0) {
    return messages.map((m) => ({ ...m, myVotes: [] }))
  }

  const votes = await prisma.communityPollVote.findMany({
    where: { message_id: { in: pollMessageIds } },
    select: { message_id: true, user_id: true, answer_id: true },
  })

  // answer_id -> count, per message.
  const countsByMessage = new Map<string, Map<number, number>>()
  // The current user's own picks, per message.
  const myVotesByMessage = new Map<string, number[]>()
  for (const v of votes) {
    const counts = countsByMessage.get(v.message_id) ?? new Map<number, number>()
    counts.set(v.answer_id, (counts.get(v.answer_id) ?? 0) + 1)
    countsByMessage.set(v.message_id, counts)

    if (v.user_id === userId) {
      const mine = myVotesByMessage.get(v.message_id) ?? []
      mine.push(v.answer_id)
      myVotesByMessage.set(v.message_id, mine)
    }
  }

  return messages.map((m) => {
    if (!m.poll) return { ...m, myVotes: [] }
    const counts = countsByMessage.get(m.id)
    const options = m.poll.options.map((o) => ({ ...o, count: counts?.get(o.answerId) ?? 0 }))
    return {
      ...m,
      poll: { ...m.poll, options, totalVotes: options.reduce((sum, o) => sum + o.count, 0) },
      myVotes: myVotesByMessage.get(m.id) ?? [],
    }
  })
}

export type VoteResult =
  | { ok: true; myVotes: number[] }
  | { ok: false; error: string; code: "invalid" | "closed" }

/**
 * Record or withdraw a user's vote on one option.
 *
 * `on: true` adds the vote; for a single-select poll it also clears any OTHER
 * answer this user had picked first, matching Discord's own single-select
 * behaviour (picking a new answer moves your vote, it doesn't add a second
 * one). `on: false` withdraws it — this app's poll UI lets a vote be removed
 * entirely, which Discord's own client also supports.
 *
 * Returns the user's full current selection either way, so the caller can
 * hand the same set to syncPollBotVote without a second read.
 */
export async function setPollVote(
  brandId: string,
  userId: string,
  messageId: string,
  answerId: number,
  on: boolean,
  allowMultiselect: boolean,
  isFinalized: boolean
): Promise<VoteResult> {
  if (isFinalized) {
    return { ok: false, error: "This poll has closed.", code: "closed" }
  }

  const existing = await prisma.communityPollVote.findMany({
    where: { message_id: messageId, user_id: userId },
    select: { answer_id: true },
  })
  const existingIds = existing.map((v) => v.answer_id)

  if (on) {
    // Single-select: any previously-picked answer other than this one is
    // replaced, not added to — the DB row for it is removed first so the
    // unique constraint below never has to reject a legitimate re-pick.
    if (!allowMultiselect) {
      const others = existingIds.filter((id) => id !== answerId)
      if (others.length) {
        await prisma.communityPollVote.deleteMany({
          where: { message_id: messageId, user_id: userId, answer_id: { in: others } },
        })
      }
    }
    await prisma.communityPollVote.upsert({
      where: { message_id_user_id_answer_id: { message_id: messageId, user_id: userId, answer_id: answerId } },
      create: { message_id: messageId, brand_id: brandId, user_id: userId, answer_id: answerId },
      update: {},
    })
  } else {
    await prisma.communityPollVote.deleteMany({
      where: { message_id: messageId, user_id: userId, answer_id: answerId },
    })
  }

  const after = await prisma.communityPollVote.findMany({
    where: { message_id: messageId, user_id: userId },
    select: { answer_id: true },
  })
  return { ok: true, myVotes: after.map((v) => v.answer_id) }
}

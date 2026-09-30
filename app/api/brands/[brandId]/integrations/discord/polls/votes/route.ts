import { NextRequest, NextResponse } from "next/server"
import { guardBrandGuild, statusForCode } from "@/lib/discord/route-guard"
import { getMessage, syncPollBotVote } from "@/lib/discord/bot-provider"
import { setPollVote } from "@/lib/discord/polls"

// POST { channelId, messageId, answerId, on }
//
// The real vote store is CommunityPollVote — see its schema comment and
// lib/discord/polls.ts for why. This route:
//   1. re-reads the message from Discord to get the poll's CURRENT
//      allow_multiselect/is_finalized (never trusts what the client last saw
//      those to be — a poll's own state can have changed since);
//   2. writes the vote to Instroom's own table (the source of truth the UI
//      reads back from on the next fetch);
//   3. best-effort mirrors the bot's own vote on the live Discord poll, so
//      the object still reads correctly if opened directly in Discord.
//
// Step 3 failing does NOT fail the request — the Instroom-side vote (step 2)
// is what the app's own UI depends on, and is already committed by then.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const body = await req.json().catch(() => ({}))
    const { channelId, messageId, answerId, on } = body ?? {}

    if (typeof channelId !== "string" || !channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 })
    }
    if (typeof messageId !== "string" || !messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }
    if (typeof answerId !== "number" || !Number.isInteger(answerId)) {
      return NextResponse.json({ error: "answerId is required" }, { status: 400 })
    }

    const msgResult = await getMessage(guard.guildId, guard.discordUserId, channelId, messageId)
    if (!msgResult.ok) {
      return NextResponse.json({ error: msgResult.error, code: msgResult.code }, { status: statusForCode(msgResult.code) })
    }
    const poll = msgResult.message.poll
    if (!poll) {
      return NextResponse.json({ error: "This message has no poll." }, { status: 400 })
    }
    if (!poll.options.some((o) => o.answerId === answerId)) {
      return NextResponse.json({ error: "That option no longer exists on this poll." }, { status: 400 })
    }
    // A poll past its own expiry is closed even if Discord has not yet
    // flipped is_finalized on it (that flip can lag by a moment).
    const expired = poll.expiresAt ? new Date(poll.expiresAt).getTime() <= Date.now() : false
    if (poll.isFinalized || expired) {
      return NextResponse.json({ error: "This poll has closed.", code: "closed" }, { status: 409 })
    }

    const voteResult = await setPollVote(
      brandId,
      guard.userId,
      messageId,
      answerId,
      Boolean(on),
      poll.allowMultiselect,
      poll.isFinalized
    )
    if (!voteResult.ok) {
      return NextResponse.json({ error: voteResult.error, code: voteResult.code }, { status: 409 })
    }

    // Best-effort mirror of the bot's OWN vote on the live Discord poll — logged,
    // never surfaced as a request failure. The Instroom-side vote above already
    // committed and is what the app's own poll UI is built on and reads back
    // from; this only keeps the object reasonable if someone opens it directly
    // in Discord. It is necessarily approximate: the bot's one Discord vote
    // cannot represent every Instroom voter's individual pick (see
    // CommunityPollVote's schema comment), so this simply applies THIS change
    // — add or remove this one answer — to whatever the bot's vote currently is,
    // rather than attempting to reconstruct a "correct" combined state that
    // cannot exist on Discord's side.
    syncPollBotVote(guard.guildId, guard.discordUserId, channelId, messageId, on ? [] : [answerId], on ? [answerId] : []).then(
      (r) => {
        if (!r.ok) console.error(`[discord/polls/votes] bot vote sync failed for message ${messageId}:`, r.error)
      }
    )

    return NextResponse.json({ myVotes: voteResult.myVotes })
  } catch (error) {
    console.error("[POST discord/polls/votes]", error)
    return NextResponse.json({ error: "Failed to update vote" }, { status: 500 })
  }
}

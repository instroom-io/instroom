import { NextRequest, NextResponse } from "next/server"
import { guardBrandGuild, statusForCode } from "@/lib/discord/route-guard"
import { sendPoll } from "@/lib/discord/bot-provider"
import { attachPollVotes } from "@/lib/discord/polls"

// POST { channelId, question, answers: string[], allowMultiselect?, durationHours? }
//
// A freshly created poll has zero votes either way, so no vote lookup runs
// here — attachPollVotes is still applied so the response shape matches every
// other message the client renders (poll.options + myVotes present).

const MAX_ANSWERS = 10

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const body = await req.json().catch(() => ({}))
    const { channelId, question, answers, allowMultiselect, durationHours } = body ?? {}

    if (typeof channelId !== "string" || !channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 })
    }
    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "A poll needs a question" }, { status: 400 })
    }
    if (!Array.isArray(answers) || answers.filter((a) => typeof a === "string" && a.trim()).length < 2) {
      return NextResponse.json({ error: "A poll needs at least 2 options" }, { status: 400 })
    }
    if (answers.length > MAX_ANSWERS) {
      return NextResponse.json({ error: `Up to ${MAX_ANSWERS} options per poll` }, { status: 400 })
    }

    const result = await sendPoll(
      guard.guildId,
      guard.discordUserId,
      channelId,
      guard.displayName,
      question,
      answers.filter((a): a is string => typeof a === "string"),
      Boolean(allowMultiselect),
      Number(durationHours) || 24
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    const [withVotes] = await attachPollVotes(guard.userId, [result.message])
    return NextResponse.json({ message: withVotes })
  } catch (error) {
    console.error("[POST discord/polls]", error)
    return NextResponse.json({ error: "Failed to create poll" }, { status: 500 })
  }
}

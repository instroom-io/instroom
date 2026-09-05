import { NextRequest, NextResponse } from "next/server"
import { guardBrandGuild, statusForCode } from "@/lib/discord/route-guard"
import { createThread } from "@/lib/discord/bot-provider"

// POST { channelId, messageId, name? } — start a thread off an existing
// message. `name` is optional; the provider derives one from the message's
// own text when omitted, the way an email client derives a subject line.
//
// The thread's own conversation lives at /threads/messages, keyed by the id
// this returns.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const body = await req.json().catch(() => ({}))
    const { channelId, messageId, name } = body ?? {}

    if (typeof channelId !== "string" || !channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 })
    }
    if (typeof messageId !== "string" || !messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }

    const result = await createThread(
      guard.guildId,
      guard.discordUserId,
      channelId,
      messageId,
      typeof name === "string" && name.trim() ? name : ""
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    return NextResponse.json({ thread: result.thread })
  } catch (error) {
    console.error("[POST discord/threads]", error)
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 })
  }
}

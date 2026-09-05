import { NextRequest, NextResponse } from "next/server"
import { guardBrandGuild, statusForCode } from "@/lib/discord/route-guard"
import { getThreadMessages, sendThreadMessage } from "@/lib/discord/bot-provider"
import { attachPollVotes } from "@/lib/discord/polls"

// GET  ?threadId=&before=&limit=   — a thread's own history, oldest last
// POST { threadId, content }        — send inside the thread, attributed
//
// A THREAD id, not a regular channel id — see assertThreadAccess's comment on
// why that needs its own access check rather than the one /messages uses.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const sp = req.nextUrl.searchParams
    const threadId = sp.get("threadId")
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 })
    }

    const result = await getThreadMessages(guard.guildId, guard.discordUserId, threadId, {
      before: sp.get("before") ?? undefined,
      limit: Number(sp.get("limit")) || 50,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    const messages = await attachPollVotes(guard.userId, result.messages)
    return NextResponse.json({ messages, hasMore: result.hasMore })
  } catch (error) {
    console.error("[GET discord/threads/messages]", error)
    return NextResponse.json({ error: "Failed to load thread messages" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const body = await req.json().catch(() => ({}))
    const { threadId, content } = body ?? {}

    if (typeof threadId !== "string" || !threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 })
    }
    const text = typeof content === "string" ? content : ""
    if (!text.trim()) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 })
    }

    const result = await sendThreadMessage(guard.guildId, guard.discordUserId, threadId, text, guard.displayName)

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    const [withVotes] = await attachPollVotes(guard.userId, [result.message])
    return NextResponse.json({ message: withVotes })
  } catch (error) {
    console.error("[POST discord/threads/messages]", error)
    return NextResponse.json({ error: "Failed to send thread message" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { guardBrandGuild, statusForCode } from "@/lib/discord/route-guard"
import { getMessages, sendMessage } from "@/lib/discord/bot-provider"

// GET  ?channelId=&before=&limit=   — history, newest last
// POST { channelId, content, replyToId? } — send as the bot, attributed
//      Also accepts multipart/form-data with the same fields plus `files`.
//
// Both re-derive the caller's channel access inside the provider, so a
// channelId belonging to another brand's guild (or to a private channel the
// caller can't see) resolves to "not found" rather than leaking anything.

/** Discord's own per-file ceiling on an unboosted guild. */
const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_FILES = 10

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const guard = await guardBrandGuild(brandId)
    if (!guard.ok) return guard.response

    const sp = req.nextUrl.searchParams
    const channelId = sp.get("channelId")
    if (!channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 })
    }

    const result = await getMessages(guard.guildId, guard.discordUserId, channelId, {
      before: sp.get("before") ?? undefined,
      limit: Number(sp.get("limit")) || 50,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    return NextResponse.json({ messages: result.messages, hasMore: result.hasMore })
  } catch (error) {
    console.error("[GET discord/messages]", error)
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
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

    // Two encodings: JSON for plain text, multipart when attachments ride
    // along. Anything else is rejected rather than half-parsed.
    let channelId: unknown
    let content: unknown
    let replyToId: unknown
    let files: File[] = []

    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData()
      channelId = form.get("channelId")
      content = form.get("content") ?? ""
      replyToId = form.get("replyToId") ?? undefined
      files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)

      if (files.length > MAX_FILES) {
        return NextResponse.json({ error: `Up to ${MAX_FILES} files per message.` }, { status: 400 })
      }
      const oversized = files.find((f) => f.size > MAX_FILE_BYTES)
      if (oversized) {
        return NextResponse.json(
          { error: `"${oversized.name}" is larger than ${MAX_FILE_BYTES / 1024 / 1024}MB.` },
          { status: 413 }
        )
      }
    } else {
      const body = await req.json().catch(() => ({}))
      channelId = body?.channelId
      content = body?.content
      replyToId = body?.replyToId
    }

    if (typeof channelId !== "string" || !channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 })
    }
    const text = typeof content === "string" ? content : ""
    // A file on its own is a valid message; empty text with no file is not.
    if (!text.trim() && files.length === 0) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 })
    }

    const result = await sendMessage(
      guard.guildId,
      guard.discordUserId,
      channelId,
      text,
      // Server-side identity — the client can't spoof who a message is from.
      guard.displayName,
      typeof replyToId === "string" && replyToId ? replyToId : undefined,
      files
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusForCode(result.code) })
    }

    return NextResponse.json({ message: result.message })
  } catch (error) {
    console.error("[POST discord/messages]", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}

// ============================================================================
// FILE: app/api/mail/accounts/route.ts
// ============================================================================
// The connected-mailbox list behind the Inbox account selector.
//
// The Account rows this reads are the SAME rows /api/gmail/callback and
// /api/outlook/callback already write, and the same rows lib/gmail.ts and
// /api/outlook/threads already resolve a token from. Nothing new is stored and
// no second auth path exists here: this route only lists those rows, moves the
// "selected" marker between them, and deletes one on an explicit disconnect.
//
// Selection is `last_selected_at`, which is already how both providers decide
// which of a user's linked accounts to use ("most recently selected wins" —
// see lib/gmail.ts:getGmailAccessToken). Switching accounts is therefore a
// touch of that column, not a new mechanism.
// ============================================================================

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GMAIL_PROVIDER } from "@/lib/gmail"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"

/** Provider label the Outlook callback writes its rows under. */
const OUTLOOK_PROVIDER = "microsoft"

/** Only mailbox providers — never NextAuth's own "google" login rows, which
 *  carry login-scoped tokens and are not mailboxes the inbox can read. */
const MAIL_PROVIDERS = [GMAIL_PROVIDER, OUTLOOK_PROVIDER]

/** The inbox speaks "gmail" / "outlook"; the Account table stores "microsoft". */
function toClientProvider(provider: string): "gmail" | "outlook" {
  return provider === GMAIL_PROVIDER ? "gmail" : "outlook"
}

async function requireUserId() {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}

/**
 * GET — every mailbox this user has connected, newest selection first.
 *
 * `isSelected` marks the one the thread routes will actually read, per provider,
 * so the client never has to guess or duplicate that rule.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rows = await prisma.account.findMany({
      where: { userId, provider: { in: MAIL_PROVIDERS } },
      // Tokens are deliberately NOT selected — this response reaches the browser.
      select: { id: true, provider: true, email: true, last_selected_at: true },
      orderBy: [{ last_selected_at: "desc" }, { id: "desc" }],
    })

    const seenProvider = new Set<string>()
    const accounts = rows.map((row) => {
      // First row of a provider in this ordering is the one its thread route
      // resolves — the same [last_selected_at desc, id desc] rule.
      const isSelected = !seenProvider.has(row.provider)
      seenProvider.add(row.provider)
      return {
        id: row.id,
        provider: toClientProvider(row.provider),
        email: row.email,
        isSelected,
      }
    })

    return NextResponse.json({ accounts })
  } catch (error: any) {
    console.error("[GET /api/mail/accounts]", error)
    if (isDatabaseCapacityError(error)) return databaseCapacityResponse()
    return NextResponse.json(
      { error: error?.message || "Failed to load connected accounts" },
      { status: 500 }
    )
  }
}

/**
 * POST — make one connected account the selected one for its provider.
 *
 * Touches `last_selected_at` only. The tokens, the grant and the provider's own
 * callback are untouched, so this cannot connect an account that was never
 * authorised — it can only choose between accounts that already were.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const accountId = body?.accountId as string | undefined
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 })
    }

    // Scoped to this user AND to mail providers: an id belonging to someone
    // else, or to a login row, is a 404 rather than a silent no-op.
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId, provider: { in: MAIL_PROVIDERS } },
      select: { id: true, provider: true, email: true },
    })
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    await prisma.account.update({
      where: { id: account.id },
      data: { last_selected_at: new Date() },
    })

    return NextResponse.json({
      account: {
        id: account.id,
        provider: toClientProvider(account.provider),
        email: account.email,
        isSelected: true,
      },
    })
  } catch (error: any) {
    console.error("[POST /api/mail/accounts]", error)
    if (isDatabaseCapacityError(error)) return databaseCapacityResponse()
    return NextResponse.json(
      { error: error?.message || "Failed to switch account" },
      { status: 500 }
    )
  }
}

/**
 * DELETE — disconnect one mailbox.
 *
 * Removes only the Account row, which is exactly what "connected" means for
 * these providers: with the row gone, getGmailAccessToken / the Outlook threads
 * route find nothing and the existing "not connected" path runs. No influencer,
 * brand or thread data is touched, and reconnecting is the normal OAuth flow.
 *
 * `remaining` is what the client uses to fall back to another connected
 * mailbox — or to the connect-email state when there is none left.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accountId = new URL(req.url).searchParams.get("accountId")
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 })
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId, provider: { in: MAIL_PROVIDERS } },
      select: { id: true, provider: true },
    })
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    await prisma.account.delete({ where: { id: account.id } })

    const rows = await prisma.account.findMany({
      where: { userId, provider: { in: MAIL_PROVIDERS } },
      select: { id: true, provider: true, email: true },
      orderBy: [{ last_selected_at: "desc" }, { id: "desc" }],
    })

    const seenProvider = new Set<string>()
    const remaining = rows.map((row) => {
      const isSelected = !seenProvider.has(row.provider)
      seenProvider.add(row.provider)
      return {
        id: row.id,
        provider: toClientProvider(row.provider),
        email: row.email,
        isSelected,
      }
    })

    return NextResponse.json({
      removedProvider: toClientProvider(account.provider),
      remaining,
    })
  } catch (error: any) {
    console.error("[DELETE /api/mail/accounts]", error)
    if (isDatabaseCapacityError(error)) return databaseCapacityResponse()
    return NextResponse.json(
      { error: error?.message || "Failed to remove account" },
      { status: 500 }
    )
  }
}

import { prisma } from "@/lib/prisma"
import { upsertGhlContact } from "@/lib/ghl"
import { NextRequest, NextResponse } from "next/server"

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// Sends the signup to GHL and persists the sync result. Never throws — a
// GHL failure (or any unexpected error in this whole function) is caught
// and recorded on the row, never surfaced to the caller, so the Early
// Access registration itself always succeeds regardless of GHL. This is
// deliberately double-guarded: upsertGhlContact() already catches its own
// errors, but this outer try/catch means even a mistake in THIS function
// can't turn an already-successful DB save into a failed HTTP response.
async function syncToGhl(signup: { id: string; email: string; name: string | null; role: string | null; phone: string | null }) {
  try {
    const result = await upsertGhlContact({
      email: signup.email,
      name: signup.name,
      phone: signup.phone,
      role: signup.role,
      source: "Instroom Website",
    })

    await prisma.earlyAccessSignup.update({
      where: { id: signup.id },
      data: result.success
        ? {
            ghl_contact_id: result.contactId,
            ghl_sync_status: "synced",
            ghl_synced_at: new Date(),
            ghl_sync_error: null,
          }
        : {
            ghl_sync_status: "failed",
            ghl_sync_error: result.error,
          },
    })

    // Record the outcome either way. A failure here is invisible to the user
    // by design (their signup still succeeds), so the log is the only signal
    // that contacts have stopped reaching GoHighLevel.
    if (result.success) {
      console.log(`[ghl] synced ${signup.email} -> contact ${result.contactId}`)
    } else {
      console.error(`[ghl] sync FAILED for ${signup.email}, recorded on signup ${signup.id}: ${result.error}`)
    }
  } catch (err) {
    console.error("[ghl] sync failed unexpectedly:", err instanceof Error ? err.message : String(err))
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const role = typeof body.role === "string" ? body.role.trim() : ""

    if (!email || !validEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: "Enter your name." }, { status: 400 })
    }
    if (!role) {
      return NextResponse.json({ error: "Let us know what you're running." }, { status: 400 })
    }

    // If an Instroom account already exists with this email, connect this
    // signup to it and prefer the account's own name — avoids sending GHL
    // an incomplete/duplicate-looking contact when we already know who they
    // are, instead of only trusting the raw form input.
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    })

    const existing = await prisma.earlyAccessSignup.findUnique({ where: { email } })

    let signup: { id: string; email: string; name: string | null; role: string | null; phone: string | null }

    if (existing) {
      // Already on the list — link the account if it wasn't linked before
      // (e.g. they signed up for early access first, made an account
      // later), and retry the GHL sync if it previously failed or is
      // still pending. Re-submitting the form is the retry mechanism.
      signup = await prisma.earlyAccessSignup.update({
        where: { id: existing.id },
        data: {
          user_id: existing.user_id ?? existingUser?.id ?? null,
          name: existing.name || existingUser?.name || name,
        },
        select: { id: true, email: true, name: true, role: true, phone: true },
      })

      // Always re-sync on a re-submit, including rows already marked "synced".
      // The GHL endpoint is an upsert keyed by email, so this can't create a
      // duplicate contact — but it does repair rows whose stored status is
      // stale (e.g. marked synced against a different GHL location, or a
      // contact since deleted in GHL), which the old `!== "synced"` guard
      // would silently skip forever.
      await syncToGhl(signup)

      return NextResponse.json({ success: true, alreadyOnList: true })
    }

    signup = await prisma.earlyAccessSignup.create({
      data: {
        email,
        name: existingUser?.name || name,
        role,
        user_id: existingUser?.id ?? null,
      },
      select: { id: true, email: true, name: true, role: true, phone: true },
    })

    // Fire the GHL sync only after the DB save above has already succeeded.
    // Awaited (not queued) to match this app's existing style of direct
    // synchronous calls, but its own errors are fully contained in
    // syncToGhl and can never fail this response.
    await syncToGhl(signup)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Early access signup error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}

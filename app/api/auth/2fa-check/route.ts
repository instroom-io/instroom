import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma, withDbRetry, isDatabaseUnreachableError } from "@/lib/prisma"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"

export async function POST(req: NextRequest) {
  // Every path below returns JSON. This route had no handler at all, so a
  // database blip escaped as Next's HTML error page; login-form.tsx then threw
  // parsing it as JSON and showed "An error occurred. Please try again." —
  // hiding both the real cause and the fact that it was transient.
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Retried for the same reason the dashboard reads are: this host refuses
    // connections under load and the next attempt usually succeeds.
    const user = await withDbRetry(() => prisma.user.findUnique({ where: { email } }))

    if (!user?.password_hash) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // bcryptjs REJECTS (not returns false) on a stored value that isn't a
    // bcrypt hash — "Invalid salt version". That is a broken account record,
    // not a wrong password, so it must not become a bare 500.
    let isValid = false
    try {
      isValid = await bcrypt.compare(password, user.password_hash)
    } catch (hashError) {
      console.error("2fa-check: unusable password_hash for user", user.id, hashError)
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    return NextResponse.json({ requiresTwoFactor: user.two_factor_enabled })
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string }
    console.error("2fa-check error:", e?.code, e?.message)

    if (isDatabaseCapacityError(error)) {
      return databaseCapacityResponse()
    }

    // "Can't reach database server" is an outage, not a bad credential. A 500
    // told the user to fix their password; a 503 tells them to try again.
    if (isDatabaseUnreachableError(error)) {
      return NextResponse.json(
        { error: "Can't reach the server right now. Please try again in a moment.", retryable: true },
        { status: 503, headers: { "Retry-After": "5" } }
      )
    }

    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
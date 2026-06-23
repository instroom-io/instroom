import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import {
  generateTwoFactorSecret,
  generateQrCodeDataUrl,
  verifyTwoFactorCode,
  generateBackupCodes,
  hashBackupCodes,
} from "@/lib/two-factor"

// GET — current 2FA status (used on page load)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { two_factor_enabled: true },
  })

  return NextResponse.json({
    totp: user?.two_factor_enabled ?? false,
    sms: false, // SMS 2FA not implemented yet
  })
}

// POST — start TOTP setup: generates secret + QR code (not yet enabled)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  // action: "setup" → generate QR. action: "confirm" → verify code and enable.
  if (body.action === "confirm") {
    const { code } = body
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { two_factor_secret_pending: true },
    })

    if (!user?.two_factor_secret_pending) {
      return NextResponse.json({ error: "No pending setup found. Start setup again." }, { status: 400 })
    }

    const valid = verifyTwoFactorCode(code, user.two_factor_secret_pending)
    if (!valid) {
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 })
    }

    const backupCodes = generateBackupCodes()
    const hashedCodes = await hashBackupCodes(backupCodes)

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        two_factor_secret: user.two_factor_secret_pending,
        two_factor_secret_pending: null,
        two_factor_enabled: true,
        two_factor_backup_codes: hashedCodes,
      },
    })

    return NextResponse.json({ success: true, backupCodes })
  }

  // default action = "setup"
  const session_user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  })
  if (!session_user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const { secret, otpauthUrl } = generateTwoFactorSecret(session_user.email)
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUrl)

  await prisma.user.update({
    where: { id: session.user.id },
    data: { two_factor_secret_pending: secret },
  })

  return NextResponse.json({ qrCodeDataUrl })
}

// PATCH — disable TOTP (requires password confirmation)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { method, enabled, password } = await req.json()

  if (method === "sms") {
    return NextResponse.json({ error: "SMS 2FA is not available yet" }, { status: 400 })
  }

  if (method === "totp") {
    if (enabled) {
      // Turning TOTP on goes through POST (setup) + confirm instead.
      return NextResponse.json(
        { error: "Use the setup flow to enable TOTP" },
        { status: 400 }
      )
    }

    // Disabling — require password confirmation first
    if (!password) {
      return NextResponse.json({ error: "Password is required to disable 2FA" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password_hash: true },
    })

    if (!user?.password_hash) {
      return NextResponse.json({ error: "Unable to verify password" }, { status: 400 })
    }

    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_secret_pending: null,
        two_factor_backup_codes: Prisma.JsonNull,
      },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid method" }, { status: 400 })
}
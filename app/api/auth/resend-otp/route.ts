import { prisma } from "@/lib/prisma"
import { sendOTPEmail } from "@/lib/email"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, name } = body

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      )
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Delete existing OTP for this email
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `otp:${email}`,
      },
    })

    // Create new OTP record
    await prisma.verificationToken.create({
      data: {
        identifier: `otp:${email}`,
        token: otp,
        expires: otpExpiry,
      },
    })

    // Send OTP email
    const emailSent = await sendOTPEmail(email, name, otp)

    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send OTP email" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "New OTP sent to email",
      email: email,
    })
  } catch (error) {
    console.error("Resend OTP error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: "Failed to resend OTP" },
      { status: 500 }
    )
  }
}

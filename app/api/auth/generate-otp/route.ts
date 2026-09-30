import { prisma } from "@/lib/prisma"
import { sendOTPEmail } from "@/lib/email"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, name, password } = body

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Email, name, and password are required" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      )
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000)

    // Generate signup token
    const signupToken = crypto.randomBytes(32).toString("hex")

    // Delete any existing OTP for this email
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `otp:${email}`,
      },
    })

    // Store OTP
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
      message: "OTP sent to email",
      email: email,
      signupToken: signupToken,
    })
  } catch (error) {
    console.error("OTP generation error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: "Failed to generate OTP" },
      { status: 500 }
    )
  }
}

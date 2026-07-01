import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { sendWelcomeEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, otp, name, password } = body

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP are required" },
        { status: 400 }
      )
    }

    // Verify OTP from database
    const otpRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: `otp:${email}`,
        token: otp,
      },
    })

    if (!otpRecord) {
      return NextResponse.json(
        { error: "Invalid OTP" },
        { status: 401 }
      )
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expires) {
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: `otp:${email}`,
            token: otp,
          },
        },
      })

      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 401 }
      )
    }

    // Create user account
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email: email,
        name: name,
        password_hash: hashedPassword,
        platform_role: "user",
        is_active: true,
      },
    })

    // Send welcome email
    await sendWelcomeEmail(user.email, user.name || "User")

    // Clean up OTP and signup verification tokens
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `otp:${email}`,
      },
    })

    await prisma.verificationToken.deleteMany({
      where: {
        identifier: email,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      userId: user.id,
      email: user.email,
    })
  } catch (error: any) {
    console.error("OTP verification error:", error instanceof Error ? error.message : String(error))

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Failed to verify OTP" },
      { status: 500 }
    )
  }
}

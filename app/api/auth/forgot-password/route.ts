import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetEmail } from "@/lib/email"
import { createPasswordSetToken } from "@/lib/auth-tokens"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Always return success to prevent email enumeration
    const successResponse = {
      message: "If an account exists with that email, a password reset link has been sent.",
    }

    if (!user) {
      // Don't reveal that email doesn't exist
      return NextResponse.json(successResponse, { status: 200 })
    }

    if (!user.password_hash) {
      // Account was created via Google — there's no password to reset
      return NextResponse.json(
        { error: "This account uses Google sign-in. Please log in using the \"Sign in with Google\" button instead." },
        { status: 400 }
      )
    }

    // Generate reset token (1-hour expiry)
    const resetToken = await createPasswordSetToken(email)

    // Send password reset email
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`
    await sendPasswordResetEmail(email, user.name || "User", resetUrl)

    return NextResponse.json(successResponse, { status: 200 })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}

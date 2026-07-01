import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * Check what signup method was used for an email
 * Returns: 'google', 'email-password', or 'not-found'
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({
        exists: false,
        method: "not-found",
      })
    }

    // Determine signup method based on password_hash
    const method: "google" | "email-password" = user.password_hash ? "email-password" : "google"

    return NextResponse.json({
      exists: true,
      email: user.email,
      method,
    })
  } catch (error) {
    console.error("Error checking signup method:", error)
    return NextResponse.json(
      { error: "Failed to check signup method" },
      { status: 500 }
    )
  }
}

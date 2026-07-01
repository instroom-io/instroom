import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * Check if an email already exists before allowing Google signup
 * This prevents "Account already exists" surprise redirects
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

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true }
    })

    if (existingUser) {
      return NextResponse.json(
        { 
          error: "Account already exists. Please log in using Google instead.",
          accountExists: true
        },
        { status: 409 }
      )
    }

    // Email is available for new Google signup
    return NextResponse.json({
      accountExists: false,
      message: "Email is available for signup"
    })
  } catch (error) {
    console.error("Error checking Google signup:", error)
    return NextResponse.json(
      { error: "Failed to check email availability" },
      { status: 500 }
    )
  }
}

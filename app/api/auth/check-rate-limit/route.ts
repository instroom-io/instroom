import { NextRequest, NextResponse } from "next/server"
import { checkLoginRateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const result = checkLoginRateLimit(ip)

    if (!result.success && result.blocked) {
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
          blocked: true,
          retryAfter: result.retryAfter,
        },
        { status: 429 } // Too Many Requests
      )
    }

    return NextResponse.json({
      allowed: result.success,
      remainingAttempts: result.remainingAttempts,
    })
  } catch (error) {
    console.error("Rate limit check error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

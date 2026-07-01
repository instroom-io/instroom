import { NextResponse } from "next/server"

// This endpoint is deprecated - use /api/subscription/activate instead
// which handles subscription creation only AFTER PayPal payment confirmation

export async function POST(req: Request) {
  return NextResponse.json(
    { error: "Direct subscription creation is not allowed. Please use PayPal checkout." },
    { status: 403 }
  )
}
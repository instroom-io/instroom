import { NextResponse } from "next/server"

// Deprecated. Plans are activated only by the verified Lemon Squeezy webhook
// (app/api/lemon-squeezy/webhook) after payment confirmation.

export async function POST(req: Request) {
  return NextResponse.json(
    { error: "Direct subscription creation is not allowed. Please use PayPal checkout." },
    { status: 403 }
  )
}
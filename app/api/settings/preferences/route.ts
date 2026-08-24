import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true, currency_display: true, date_format: true },
  })

  // Return saved prefs or defaults if the user hasn't set any yet
  return NextResponse.json({
    timezone: user?.timezone ?? "Asia/Manila (UTC+8)",
    currency: user?.currency_display ?? "USD ($)",
    dateFormat: user?.date_format ?? "MM/DD/YYYY",
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { timezone, currency, dateFormat } = body

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(timezone   && { timezone }),
      ...(currency   && { currency_display: currency }),
      ...(dateFormat && { date_format: dateFormat }),
    },
    select: { timezone: true, currency_display: true, date_format: true },
  })

  return NextResponse.json({
    timezone: user.timezone,
    currency: user.currency_display,
    dateFormat: user.date_format,
  })
}

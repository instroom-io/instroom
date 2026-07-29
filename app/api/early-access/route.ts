import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const name = typeof body.name === "string" ? body.name.trim() : null
    const role = typeof body.role === "string" ? body.role.trim() : null

    if (!email || !validEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }

    const existing = await prisma.earlyAccessSignup.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ success: true, alreadyOnList: true })
    }

    await prisma.earlyAccessSignup.create({
      data: { email, name: name || null, role: role || null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Early access signup error:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}

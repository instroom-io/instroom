import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user?.password_hash) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  const isValid = await bcrypt.compare(password, user.password_hash)
  if (!isValid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  return NextResponse.json({ requiresTwoFactor: user.two_factor_enabled })
}
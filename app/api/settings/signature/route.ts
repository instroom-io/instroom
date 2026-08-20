import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const signature = await prisma.signature.findUnique({
    where: { user_id: session.user.id },
  })

  return NextResponse.json({
    is_enabled:   signature?.is_enabled ?? true,
    full_name:    signature?.full_name ?? "",
    title:        signature?.title ?? "",
    company:      signature?.company ?? "",
    phone:        signature?.phone ?? "",
    email:        signature?.email ?? "",
    website:      signature?.website ?? "",
    social_links: signature?.social_links ?? {},
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const {
    is_enabled,
    full_name,
    title,
    company,
    phone,
    email,
    website,
    social_links,
  } = body

  const data = {
    is_enabled:   Boolean(is_enabled),
    full_name:    full_name?.trim() || null,
    title:        title?.trim() || null,
    company:      company?.trim() || null,
    phone:        phone?.trim() || null,
    email:        email?.trim() || null,
    website:      website?.trim() || null,
    social_links: social_links ?? {},
  }

  const signature = await prisma.signature.upsert({
    where: { user_id: session.user.id },
    update: data,
    create: { user_id: session.user.id, ...data },
  })

  return NextResponse.json(signature)
}

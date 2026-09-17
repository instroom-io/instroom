import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const ALLOWED_PHOTO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024

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
    photo_url:    signature?.photo_url ?? null,
    accent_color: signature?.accent_color ?? null,
    use_gmail_signature:  signature?.use_gmail_signature ?? false,
    gmail_signature_html: signature?.gmail_signature_html ?? null,
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
    accent_color,
    use_gmail_signature,
    gmail_signature_html,
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
    accent_color: /^#[0-9a-fA-F]{6}$/.test(accent_color || "") ? accent_color : null,
    use_gmail_signature: Boolean(use_gmail_signature),
    ...(use_gmail_signature ? { gmail_signature_html: gmail_signature_html || null } : {}),
  }

  const signature = await prisma.signature.upsert({
    where: { user_id: session.user.id },
    update: data,
    create: { user_id: session.user.id, ...data },
  })

  return NextResponse.json(signature)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const photo = formData.get("photo") as File | null
  if (!photo) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (photo.size > MAX_PHOTO_SIZE_BYTES) {
    return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
  }
  if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
    return NextResponse.json({ error: "Only PNG, JPG, SVG, and WebP files are allowed" }, { status: 400 })
  }

  const arrayBuffer = await photo.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")
  const dataUri = `data:${photo.type};base64,${base64}`

  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder: "signatures",
    public_id: `signature_${session.user.id}`,
    overwrite: true,
    transformation: [{ width: 400, height: 400, crop: "limit" }],
  })

  await prisma.signature.upsert({
    where: { user_id: session.user.id },
    update: { photo_url: uploaded.secure_url },
    create: { user_id: session.user.id, photo_url: uploaded.secure_url },
  })

  return NextResponse.json({ photo_url: uploaded.secure_url })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.signature.updateMany({
    where: { user_id: session.user.id },
    data: { photo_url: null },
  })

  return NextResponse.json({ success: true })
}

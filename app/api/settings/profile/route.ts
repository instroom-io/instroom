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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true },
  })

  return NextResponse.json({
    name: user?.name,
    email: user?.email,
    image: user?.image,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { firstName, lastName, name, email } = body

  const resolvedName = name?.trim() || [firstName, lastName].filter(Boolean).join(" ").trim()

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(resolvedName && { name: resolvedName }),
      ...(email        && { email }),
    },
  })

  return NextResponse.json({
    name: user.name,
    email: user.email,
    image: user.image,
  })
}


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")
  const dataUri = `data:${file.type};base64,${base64}`

  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder: "avatars",
    public_id: `user_${session.user.id}`,
    overwrite: true,
    transformation: [{ width: 256, height: 256, crop: "fill", gravity: "face" }],
  })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: uploaded.secure_url },
  })

  return NextResponse.json({ avatarUrl: uploaded.secure_url })
}
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const brandId = formData.get("brandId") as string
    const brandName = formData.get("brandName") as string
    const brandWebsite = formData.get("brandWebsite") as string | null
    const logo = formData.get("logo") as File | null

    if (!brandId) {
      return NextResponse.json({ error: "Brand ID is required" }, { status: 400 })
    }

    // Verify user owns this brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand || brand.owner_id !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Check branding access
    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: session.user.id },
      include: { plan: true },
    })

    // Trial users cannot customize branding
    if (subscription?.status === "trialing") {
      return NextResponse.json(
        { error: "Custom branding is not available during trial. Upgrade to Solo or Team plan." },
        { status: 403 }
      )
    }

    // Only Solo and Team plans have branding
    const allowedPlans = ["solo", "team"]
    if (!subscription || !allowedPlans.includes(subscription.plan.name.toLowerCase())) {
      return NextResponse.json(
        { error: "Custom branding is not included in your plan" },
        { status: 403 }
      )
    }

    let logoUrl = brand.logo_url

    // Handle file upload
    if (logo && logo.size > 0) {
      // Validate file size (5MB max)
      if (logo.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File size must be less than 5MB" },
          { status: 400 }
        )
      }

      // Validate file type
      const allowedMimes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]
      if (!allowedMimes.includes(logo.type)) {
        return NextResponse.json(
          { error: "Only PNG, JPG, SVG, and WebP files are allowed" },
          { status: 400 }
        )
      }

      // Create brands directory if it doesn't exist
      const brandsDir = join(process.cwd(), "public", "brands")
      if (!existsSync(brandsDir)) {
        await mkdir(brandsDir, { recursive: true })
      }

      // Generate unique filename
      const timestamp = Date.now()
      const ext = logo.name.split(".").pop()
      const filename = `${brandId}-${timestamp}.${ext}`
      const filepath = join(brandsDir, filename)

      // Save file
      const bytes = await logo.arrayBuffer()
      await writeFile(filepath, Buffer.from(bytes))

      // Set logo URL
      logoUrl = `/brands/${filename}`
    }

    // Update brand
    const updated = await prisma.brand.update({
      where: { id: brandId },
      data: {
        name: brandName || brand.name,
        website_url: brandWebsite || null,
        logo_url: logoUrl,
        updated_at: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      brand: updated,
      logoUrl,
    })
  } catch (error) {
    console.error("Error updating branding:", error)
    return NextResponse.json(
      { error: "Failed to update branding" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await req.json()

    if (!brandId) {
      return NextResponse.json({ error: "Brand ID is required" }, { status: 400 })
    }

    // Verify user owns this brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand || brand.owner_id !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Remove logo
    const updated = await prisma.brand.update({
      where: { id: brandId },
      data: {
        logo_url: null,
        updated_at: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      brand: updated,
    })
  } catch (error) {
    console.error("Error removing logo:", error)
    return NextResponse.json(
      { error: "Failed to remove logo" },
      { status: 500 }
    )
  }
}
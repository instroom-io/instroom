import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ brandId: string; userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, userId } = await params
    const { role } = await req.json()

    if (!["owner", "collaborator", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      )
    }

    // Verify user owns the brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand || brand.owner_id !== session.user.id) {
      return NextResponse.json(
        { error: "Brand not found or unauthorized" },
        { status: 403 }
      )
    }

    // Update member role
    const member = await prisma.brandMember.update({
      where: { brand_id_user_id: { brand_id: brandId, user_id: userId } },
      data: { role },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      member: {
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
        role: member.role,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update collaborator" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ brandId: string; userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, userId } = await params

    // Verify user owns the brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand || brand.owner_id !== session.user.id) {
      return NextResponse.json(
        { error: "Brand not found or unauthorized" },
        { status: 403 }
      )
    }

    // Can't remove self as owner - need to transfer ownership first
    if (userId === session.user.id) {
      return NextResponse.json(
        {
          error:
            "You cannot remove yourself. Transfer ownership to another user first.",
        },
        { status: 400 }
      )
    }

    // Remove collaborator
    await prisma.brandMember.delete({
      where: { brand_id_user_id: { brand_id: brandId, user_id: userId } },
    })

    return NextResponse.json({
      success: true,
      message: "Collaborator removed",
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove collaborator" },
      { status: 500 }
    )
  }
}

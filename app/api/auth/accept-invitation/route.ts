import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      )
    }

    // Find the invitation
    const invitation = await prisma.brandInvitation.findFirst({
      where: { token },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      )
    }

    // Check if invitation has expired
    if (new Date() > invitation.expires_at) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 410 }
      )
    }

    // Get the current session
    const session = await getServerSession(authOptions)

    // If user is not logged in, return info to redirect to login
    if (!session?.user?.id) {
      return NextResponse.json({
        requiresLogin: true,
        invitationEmail: invitation.email,
        brandId: invitation.brand_id,
        message: "Please log in to accept this invitation",
      })
    }

    // Verify the logged-in user's email matches the invitation email
    if (session.user.email !== invitation.email) {
      return NextResponse.json(
        {
          error: `This invitation was sent to ${invitation.email}, but you're logged in as ${session.user.email}. Please log in with the correct email.`,
          requiresLogout: true,
        },
        { status: 403 }
      )
    }

    // Check if user is already a member
    const existingMember = await prisma.brandMember.findUnique({
      where: {
        brand_id_user_id: {
          brand_id: invitation.brand_id,
          user_id: session.user.id,
        },
      },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: "You're already a member of this workspace" },
        { status: 409 }
      )
    }

    // Add user as brand member
    const member = await prisma.brandMember.create({
      data: {
        brand_id: invitation.brand_id,
        user_id: session.user.id,
        role: invitation.role as "owner" | "collaborator" | "viewer" | "manager" | "researcher",
      },
    })

    // Delete the invitation
    await prisma.brandInvitation.delete({
      where: { id: invitation.id },
    })

    // Get brand name for redirect info
    const brand = await prisma.brand.findUnique({
      where: { id: invitation.brand_id },
      select: { name: true },
    })

    return NextResponse.json({
      success: true,
      message: `Welcome to ${brand?.name}!`,
      brandId: invitation.brand_id,
      brandName: brand?.name,
      role: invitation.role,
    })
  } catch (error) {
    console.error("Accept invitation error:", error)
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    )
  }
}

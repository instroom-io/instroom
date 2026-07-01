import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAddCollaborator } from "@/lib/subscription-limits"
import { sendBrandInvitationEmail } from "@/lib/email"
import { NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await params
    const { email, role = "collaborator" } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
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

    // Check if user can add collaborator
    const canAdd = await canAddCollaborator(session.user.id, brandId)
    if (!canAdd.allowed) {
      return NextResponse.json(
        {
          error: canAdd.message || "Cannot add collaborator",
          current: canAdd.current,
          max: canAdd.max,
        },
        { status: 403 }
      )
    }

    // Check if email is already a member
    const invitee = await prisma.user.findUnique({
      where: { email },
    })

    if (invitee) {
      const existingMember = await prisma.brandMember.findUnique({
        where: { brand_id_user_id: { brand_id: brandId, user_id: invitee.id } },
      })

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a collaborator" },
          { status: 400 }
        )
      }

      // Add existing user as member
      const member = await prisma.brandMember.create({
        data: {
          brand_id: brandId,
          user_id: invitee.id,
          role,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Collaborator added successfully",
        member: {
          id: invitee.id,
          email: invitee.email,
          name: invitee.name,
          role: member.role,
        },
      })
    }

    // User doesn't exist - create invitation
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invitation = await prisma.brandInvitation.create({
      data: {
        brand_id: brandId,
        email,
        invited_by_id: session.user.id,
        token,
        role,
        expires_at: expiresAt,
      },
    })

    // Send invitation email
    try {
      const invitationLink = `${process.env.NEXTAUTH_URL}/auth/accept-invitation?token=${token}`
      const inviterName = session.user.name || session.user.email || "A team member"
      await sendBrandInvitationEmail(email, brand.name, inviterName, invitationLink, role)
    } catch (emailError) {
      // Don't fail the request if email fails - invitation was created
    }

    return NextResponse.json({
      success: true,
      message: "Invitation sent",
      invitation: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expires_at,
      },
    })
  } catch (error) {
    console.error("POST /api/brand/[brandId]/collaborators/invite:", error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: "Failed to invite collaborator", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

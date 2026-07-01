import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { canAddCollaborator } from "@/lib/subscription-limits"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendBrandInvitationEmail } from "@/lib/email"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, email, role = "collaborator" } = await req.json()

    if (!brandId || !email) {
      return NextResponse.json(
        { error: "Brand ID and email are required" },
        { status: 400 }
      )
    }

    // Check if user can add collaborators
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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      // Check if already a member
      const existingMember = await prisma.brandMember.findUnique({
        where: {
          brand_id_user_id: {
            brand_id: brandId,
            user_id: existingUser.id,
          },
        },
      })

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a member of this brand" },
          { status: 400 }
        )
      }

      // Add as direct member if user exists
      const member = await prisma.brandMember.create({
        data: {
          brand_id: brandId,
          user_id: existingUser.id,
          role: role as "owner" | "collaborator" | "viewer",
        },
      })

      // Log activity in parallel with member creation (fire-and-forget)
      prisma.activityLog.create({
        data: {
          brand_id: brandId,
          user_id: session.user.id,
          action: "created",
          entity_type: "brand_member",
          entity_id: member.id,
          details: `Added ${existingUser.email} as ${role}`,
        },
      }).catch((err) => {
        console.error("Failed to log brand member activity:", err)
      })

      return NextResponse.json({
        success: true,
        type: "direct_member",
        member,
        remaining: (canAdd.max ?? 0) - canAdd.current - 1,
      })
    } else {
      // Create invitation for non-existing user
      const token = crypto.randomBytes(32).toString("hex")
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const invitation = await prisma.brandInvitation.create({
        data: {
          brand_id: brandId,
          email,
          invited_by_id: session.user.id,
          role: role as "owner" | "collaborator" | "viewer",
          token,
          expires_at: expiresAt,
        },
      })

      // Log activity in parallel with invitation (fire-and-forget)
      prisma.activityLog.create({
        data: {
          brand_id: brandId,
          user_id: session.user.id,
          action: "created",
          entity_type: "brand_invitation",
          entity_id: invitation.id,
          details: `Sent invitation to ${email}`,
        },
      }).catch((err) => {
        console.error("Failed to log brand invitation activity:", err)
      })

      // Send invitation email
      try {
        // Get brand name
        const brand = await prisma.brand.findUnique({
          where: { id: brandId },
          select: { name: true },
        })

        if (!brand) {
          console.error("Brand not found for invitation email")
        } else {
          // Build invitation link
          const invitationLink = `${process.env.NEXTAUTH_URL}/auth/accept-invitation?token=${token}`
          
          console.log("📧 Sending invitation email to:", email)
          console.log("🔗 Invitation link:", invitationLink)
          console.log("⚙️  NEXTAUTH_URL:", process.env.NEXTAUTH_URL)
          
          // Get inviter name from session
          const inviterName = session.user.name || session.user.email || "A team member"

          // Send email
          const emailSent = await sendBrandInvitationEmail(email, brand.name, inviterName, invitationLink, role)
          console.log("✅ Email sent result:", emailSent)
        }
      } catch (emailError) {
        console.error("❌ Failed to send invitation email:", emailError instanceof Error ? emailError.message : String(emailError))
        console.error("📋 Full error:", emailError)
        // Don't fail the entire request if email fails - invitation was created
      }

      return NextResponse.json({
        success: true,
        type: "invitation_sent",
        invitation,
        remaining: (canAdd.max ?? 0) - canAdd.current - 1,
      })
    }
  } catch (error) {
    console.error("Error adding collaborator:", error)
    return NextResponse.json(
      { error: "Failed to add collaborator" },
      { status: 500 }
    )
  }
}

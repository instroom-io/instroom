import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, getAdminSession, ADMIN_EMAIL } from "@/lib/admin-auth"
import { logAdminAction } from "@/lib/admin-audit-log"
import { sendEarlyAccessApprovedEmail } from "@/lib/email"

const APP_URL = process.env.NEXTAUTH_URL ?? "https://instroom.io"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (gate) return gate
  const session = await getAdminSession()
  const { id } = await params

  const { action } = (await req.json()) as { action?: "approve" }
  if (action !== "approve") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const signup = await prisma.earlyAccessSignup.findUnique({ where: { id } })
  if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Idempotent — approving an already-approved signup just returns it as-is,
  // without re-sending the email or re-logging the action.
  if (signup.invited_at) {
    return NextResponse.json({ signup })
  }

  const updated = await prisma.earlyAccessSignup.update({
    where: { id },
    data: { invited_at: new Date() },
  })

  const signupUrl = `${APP_URL}/signup?email=${encodeURIComponent(updated.email)}`
  await sendEarlyAccessApprovedEmail(updated.email, updated.name || "there", signupUrl)

  await logAdminAction({
    adminEmail: session?.user.email || ADMIN_EMAIL,
    action: "approved_early_access",
    targetType: "early_access_signup",
    targetId: updated.id,
    targetLabel: updated.email,
  })

  return NextResponse.json({ signup: updated })
}

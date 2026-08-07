import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, getAdminSession, ADMIN_EMAIL } from "@/lib/admin-auth"
import { logAdminAction } from "@/lib/admin-audit-log"
import { sendEarlyAccessApprovedEmail } from "@/lib/email"
import { upsertGhlContact } from "@/lib/ghl"
import { appUrl } from "@/lib/app-url"

// Resolved per request so a preview deployment links to itself, not to prod.

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (gate) return gate
  const session = await getAdminSession()
  const { id } = await params

  const { action } = (await req.json()) as { action?: "approve" | "retry_ghl_sync" }

  const signup = await prisma.earlyAccessSignup.findUnique({ where: { id } })
  if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (action === "retry_ghl_sync") {
    const result = await upsertGhlContact({
      email: signup.email,
      name: signup.name,
      phone: signup.phone,
      role: signup.role,
      source: "Instroom Website",
    })

    const updated = await prisma.earlyAccessSignup.update({
      where: { id },
      data: result.success
        ? { ghl_contact_id: result.contactId, ghl_sync_status: "synced", ghl_synced_at: new Date(), ghl_sync_error: null }
        : { ghl_sync_status: "failed", ghl_sync_error: result.error },
    })

    await logAdminAction({
      adminEmail: session?.user.email || ADMIN_EMAIL,
      action: result.success ? "retried_ghl_sync_succeeded" : "retried_ghl_sync_failed",
      targetType: "early_access_signup",
      targetId: updated.id,
      targetLabel: updated.email,
      details: result.success ? undefined : { error: result.error },
    })

    return NextResponse.json({ signup: updated })
  }

  if (action !== "approve") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  // Idempotent — approving an already-approved signup just returns it as-is,
  // without re-sending the email or re-logging the action.
  if (signup.invited_at) {
    return NextResponse.json({ signup })
  }

  const updated = await prisma.earlyAccessSignup.update({
    where: { id },
    data: { invited_at: new Date() },
  })

  const signupUrl = appUrl(`/signup?email=${encodeURIComponent(updated.email)}`, req)
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (gate) return gate
  const session = await getAdminSession()
  const { id } = await params

  const signup = await prisma.earlyAccessSignup.findUnique({ where: { id }, select: { id: true, email: true, name: true } })
  if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.earlyAccessSignup.delete({ where: { id } })

  await logAdminAction({
    adminEmail: session?.user.email || ADMIN_EMAIL,
    action: "deleted_early_access_signup",
    targetType: "early_access_signup",
    targetId: signup.id,
    targetLabel: signup.name || signup.email,
  })

  return NextResponse.json({ success: true })
}

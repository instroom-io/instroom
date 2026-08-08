import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, getAdminSession, ADMIN_EMAIL } from "@/lib/admin-auth"
import { logAdminAction } from "@/lib/admin-audit-log"
import { sendEarlyAccessApprovedEmail } from "@/lib/email"
import { upsertGhlContact } from "@/lib/ghl"
import { createPasswordSetToken } from "@/lib/auth-tokens"
import { appBaseUrl } from "@/lib/app-url"
import bcrypt from "bcryptjs"
import crypto from "crypto"

// Resolved per request so a preview deployment links to itself, not to prod.

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin()
  if (gate) return gate
  const session = await getAdminSession()
  const { id } = await params
  // Absolute origin for the invite links in the approval email. Request-derived
  // so preview deployments email a working host; env still takes precedence.
  const APP_URL = appBaseUrl(req)

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

  // Auto-provision the account so the user has working access immediately —
  // unless one already exists (e.g. they signed up via Google while waiting
  // on approval), in which case we never touch their existing credentials.
  const existingUser = await prisma.user.findUnique({ where: { email: updated.email } })

  let actionUrl: string
  const hasExistingAccount = !!existingUser

  if (!existingUser) {
    const throwawayPassword = crypto.randomBytes(32).toString("hex")
    const passwordHash = await bcrypt.hash(throwawayPassword, 12)

    const newUser = await prisma.user.create({
      data: {
        email: updated.email,
        name: updated.name,
        password_hash: passwordHash,
        platform_role: "user",
        is_active: true,
      },
    })

    await prisma.earlyAccessSignup.update({
      where: { id },
      data: { user_id: newUser.id },
    })

    // Grant the 3-month Solo trial promised in the approval email up front —
    // otherwise the user would still need to visit pricing and click "start
    // trial" themselves, same as api/subscription/start-trial does manually.
    const soloPlan = await prisma.subscriptionPlan.findUnique({ where: { name: "solo" } })
    if (soloPlan) {
      const trialEndDate = new Date()
      trialEndDate.setMonth(trialEndDate.getMonth() + 3)

      await prisma.userSubscription.create({
        data: {
          user_id: newUser.id,
          plan_id: soloPlan.id,
          billing_cycle: "monthly",
          status: "trialing",
          started_at: new Date(),
          current_period_start: new Date(),
          current_period_end: trialEndDate,
        },
      })
    }

    // 7-day expiry — an invite link should survive sitting in an inbox
    // longer than a security-sensitive password-reset link would.
    const rawToken = await createPasswordSetToken(updated.email, 7 * 24 * 60 * 60 * 1000)
    actionUrl = `${APP_URL}/auth/reset-password?token=${rawToken}&welcome=1`
  } else {
    actionUrl = `${APP_URL}/login`
  }

  await sendEarlyAccessApprovedEmail(updated.email, updated.name || "there", actionUrl, hasExistingAccount)

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

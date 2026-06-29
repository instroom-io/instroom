import { prisma } from "@/lib/prisma"
import { sendNotificationEmail } from "@/lib/email"
import type { NotifType } from "@/emails/notification"

export type { NotifType }

interface SendNotifOptions {
  userId:    string
  type:      NotifType
  title:     string
  message:   string
  actionUrl?: string
}

export async function sendNotification({
  userId,
  type,
  title,
  message,
  actionUrl,
}: SendNotifOptions): Promise<void> {
  console.log(`[Notification] Starting for user=${userId} type=${type}`)

  // 1. Persist in-app notification
  try {
    await prisma.notification.create({
      data: {
        user_id:           userId,
        title,
        message,
        action_url:        actionUrl ?? null,
        notification_type: type,
      },
    })
    console.log(`[Notification] In-app record created`)
  } catch (err) {
    console.error(`[Notification] Failed to create in-app record:`, err)
    return
  }

  // 2. Check preference
  let prefs
  try {
    prefs = await prisma.notificationPreference.findUnique({
      where: { user_id: userId },
    })
    console.log(`[Notification] Prefs found:`, prefs)
  } catch (err) {
    console.error(`[Notification] Failed to fetch prefs:`, err)
    return
  }

  const defaults: Record<NotifType, boolean> = {
    influencer_reply: true,
    stage_change:     false,
    deal_agreed:      true,
  }

  const wantsEmail = prefs ? prefs[type] : defaults[type]
  console.log(`[Notification] wantsEmail=${wantsEmail} for type=${type}`)

  if (!wantsEmail) {
    console.log(`[Notification] Email skipped — preference is off`)
    return
  }

  // 3. Fetch user
  let user
  try {
    user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, name: true },
    })
    console.log(`[Notification] User found: email=${user?.email} name=${user?.name}`)
  } catch (err) {
    console.error(`[Notification] Failed to fetch user:`, err)
    return
  }

  if (!user?.email) {
    console.log(`[Notification] No email found for user ${userId} — skipping`)
    return
  }

  // 4. Send email
  console.log(`[Notification] Sending email to ${user.email}...`)
  try {
    const result = await sendNotificationEmail({
      to:       user.email,
      name:     user.name ?? "there",
      type,
      title,
      message,
      actionUrl,
    })
    console.log(`[Notification] Email sent — result=${result}`)
  } catch (err) {
    console.error(`[Notification] Email send failed:`, err)
  }
}
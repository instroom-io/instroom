import "server-only"
import { prisma } from "@/lib/prisma"
import { sendNotification } from "@/lib/notifications"

async function notifyStageChange(brandId: string, message: string): Promise<void> {
  const appUrl = process.env.NEXTAUTH_URL ?? ""
  const members = await prisma.brandMember.findMany({ where: { brand_id: brandId }, select: { user_id: true } })
  await Promise.allSettled(
    members.map((m) =>
      sendNotification({
        userId: m.user_id,
        type: "stage_change",
        title: "Pipeline stage updated",
        message,
        actionUrl: `${appUrl}/dashboard/inbox?brandId=${brandId}`,
      }),
    ),
  )
}

/** Called after a successful send from the inbox. For each recipient address
 *  that matches a known, not-yet-contacted influencer on this brand, advances
 *  them to "Contacted" and notifies the brand team — the same fields the
 *  kanban board's own manual "Contacted" move sets (see
 *  pipelineStatusToFields() in app/api/brand/[brandId]/pipeline/[brandInfluencerId]/route.ts),
 *  so the pipeline board (which buckets cards by `stage`, not contact_status —
 *  see derivePipelineStatus() in app/api/brand/[brandId]/pipeline/route.ts)
 *  reflects the change immediately. Never regresses an influencer who's
 *  already further along or explicitly marked not interested, and silently
 *  no-ops for non-influencer addresses. */
export async function autoMarkContactedOnSend(
  brandId: string | null | undefined,
  to: string,
): Promise<void> {
  if (!brandId) return
  const addresses = to.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean)
  for (const email of addresses) {
    await markOneContacted(brandId, email)
  }
}

async function markOneContacted(brandId: string, email: string): Promise<void> {
  const influencer = await prisma.influencer.findFirst({
    where: { email },
    select: { id: true, full_name: true, handle: true },
  })
  if (!influencer) return

  const brandInfluencer = await prisma.brandInfluencer.findFirst({
    where: { brand_id: brandId, influencer_id: influencer.id },
    select: { id: true, contact_status: true, stage: true, approval_status: true },
  })
  if (!brandInfluencer) return
  if (brandInfluencer.contact_status === "not_interested") return
  if (brandInfluencer.approval_status === "Declined") return
  if (brandInfluencer.stage !== null && brandInfluencer.stage >= 2) return

  await prisma.brandInfluencer.update({
    where: { id: brandInfluencer.id },
    data: { contact_status: "contacted", stage: 2, approval_status: "Approved" },
  })

  const influencerName = influencer.full_name ?? influencer.handle ?? email
  await notifyStageChange(brandId, `${influencerName} was marked as Contacted after being emailed.`)
}

/** Called after fetching inbox threads. Given the brand and the set of
 *  BrandInfluencer ids whose thread contains a real inbound message, advances
 *  each one still below "In Conversation" to it — same fields the kanban
 *  board's manual move sets (pipelineStatusToFields("In Conversation")).
 *  Guarded on stage < 3, not_interested/Declined, so repeated calls on
 *  already-seen replies (page reload, manual refresh) are harmless no-ops —
 *  this is what makes it safe to call on every thread-sync, with no separate
 *  "already processed this message" tracking needed. */
export async function autoAdvanceRepliedToInConversation(
  brandId: string | null | undefined,
  brandInfluencerIds: string[],
): Promise<void> {
  if (!brandId || !brandInfluencerIds.length) return
  const ids = [...new Set(brandInfluencerIds)]

  const eligible = await prisma.brandInfluencer.findMany({
    where: {
      id: { in: ids },
      stage: { lt: 3 },
      contact_status: { not: "not_interested" },
      approval_status: { not: "Declined" },
    },
    select: { id: true, influencer: { select: { full_name: true, handle: true, email: true } } },
  })
  if (!eligible.length) return

  await prisma.brandInfluencer.updateMany({
    where: { id: { in: eligible.map((e) => e.id) } },
    data: { contact_status: "negotiating", stage: 3, approval_status: "Approved" },
  })

  for (const row of eligible) {
    const name = row.influencer.full_name ?? row.influencer.handle ?? row.influencer.email ?? "An influencer"
    await notifyStageChange(brandId, `${name} replied and was moved to In Conversation.`)
  }
}

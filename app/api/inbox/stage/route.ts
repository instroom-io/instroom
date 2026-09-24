import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendNotification } from "@/lib/notifications"
import { logActivity } from "@/lib/activity-log"
import { provisionGoAffProAffiliate } from "@/lib/goaffpro-provision"
import {
  derivePipelineStage,
  isTransitionAllowed,
  pipelineStatusToFields,
  transitionRefusalReason,
} from "@/lib/pipeline-transitions"
import {
  clearPostTrackerState,
  mapClosedToPipelineFields,
  type ClosedColumn,
} from "@/lib/post-tracker-status"

// Each inbox stage belongs to the Pipeline or Post Tracker, and a move here
// writes what that board writes, under its rules.
const PIPELINE_TARGET: Record<string, string> = {
  PROSPECT:        "For Outreach",
  REACHED_OUT:     "Contacted",
  IN_CONVERSATION: "In Conversation",
  ONBOARDED:       "Deal Agreed",
  REJECTED:        "Not Interested",
}

// COMPLETED has no Post Tracker column; it maps to Posted.
const POST_TRACKER_TARGET: Record<string, ClosedColumn> = {
  FOR_ORDER_CREATION: "For Order Creation",
  IN_TRANSIT:         "In-Transit",
  DELIVERED:          "Delivered",
  POSTED:             "Posted",
  COMPLETED:          "Posted",
}

const stageLabel: Record<string, string> = {
  REACHED_OUT:        "Contacted",
  IN_CONVERSATION:    "In Conversation",
  FOR_ORDER_CREATION: "For Order Creation",
  IN_TRANSIT:         "In Transit",
  DELIVERED:          "Delivered",
  POSTED:             "Posted",
  COMPLETED:          "Completed",
  REJECTED:           "Rejected",
}

function safeParse(json: string | null | undefined): Record<string, any> {
  try {
    const parsed = json ? JSON.parse(json) : {}
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as any

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userId = session.user?.id
  if (!userId) {
    return NextResponse.json({ error: "No user in session" }, { status: 403 })
  }

  const { senderEmail, stage, brandId, brandInfluencerId, niReason, declineNotes } = await req.json()

  if ((!senderEmail && !brandInfluencerId) || !stage) {
    return NextResponse.json({ error: "Missing senderEmail or stage" }, { status: 400 })
  }

  const pipelineTarget    = PIPELINE_TARGET[stage]
  const postTrackerTarget = POST_TRACKER_TARGET[stage]
  if (!pipelineTarget && !postTrackerTarget) {
    return NextResponse.json({ error: `Invalid stage: ${stage}` }, { status: 400 })
  }

  let brand_id = brandId
  if (!brand_id) {
    const brandMember = await prisma.brandMember.findFirst({
      where:   { user_id: userId },
      select:  { brand_id: true },
      orderBy: { created_at: "desc" },
    })
    brand_id = brandMember?.brand_id
  }

  if (!brand_id) {
    return NextResponse.json({ error: "No brand found for user" }, { status: 404 })
  }

  const biSelect = {
    id:              true,
    stage:           true,
    contact_status:  true,
    approval_status: true,
    product_details: true,
    shipped_at:      true,
    delivered_at:    true,
    posted_at:       true,
    post_url:        true,
  } as const

  // Prefer a resolved brandInfluencerId; fall back to email lookup for older clients.
  let existingBi: NonNullable<Awaited<ReturnType<typeof findBi>>>
  let influencerName: string

  function findBi(where: { id: string; brand_id: string } | { brand_id: string; influencer_id: string }) {
    return prisma.brandInfluencer.findFirst({ where, select: biSelect })
  }

  if (brandInfluencerId) {
    const bi = await prisma.brandInfluencer.findFirst({
      where:  { id: brandInfluencerId, brand_id },
      select: { ...biSelect, influencer: { select: { full_name: true, handle: true } } },
    })
    if (!bi) {
      return NextResponse.json({ error: "Influencer not found in this brand" }, { status: 404 })
    }
    existingBi = bi
    influencerName = bi.influencer.full_name ?? bi.influencer.handle ?? "This influencer"
  } else {
    const normalizedEmail = senderEmail.toLowerCase().trim()

    // MySQL's default collation (utf8mb4_general_ci/unicode_ci) is case-insensitive
    // for String columns, so a single findFirst covers case-insensitive matching
    // without ever pulling the entire influencer table into memory.
    const influencer = await prisma.influencer.findFirst({
      where:  { email: normalizedEmail },
      select: { id: true, full_name: true, handle: true },
    })

    if (!influencer) {
      return NextResponse.json({ error: "Influencer not registered" }, { status: 404 })
    }

    const bi = await findBi({ brand_id, influencer_id: influencer.id })

    if (!bi) {
      return NextResponse.json(
        { error: "Influencer not found in this brand" },
        { status: 404 },
      )
    }

    existingBi = bi
    influencerName = influencer.full_name ?? influencer.handle ?? senderEmail
  }

  const currentStage = derivePipelineStage(
    existingBi.contact_status,
    existingBi.stage,
    existingBi.approval_status,
  )
  const productDetails = safeParse(existingBi.product_details)

  let dbFields: Record<string, any>

  if (pipelineTarget) {
    // Pipeline stage. Rows already in Post Tracker are refused, as on the board.
    if (!isTransitionAllowed(currentStage, pipelineTarget)) {
      return NextResponse.json(
        { error: transitionRefusalReason(currentStage, pipelineTarget), currentStage },
        { status: 409 },
      )
    }

    dbFields = { ...pipelineStatusToFields(pipelineTarget) }

    if (pipelineTarget === "Not Interested") {
      // Stored as the pipeline route does; Analytics matches approval_notes exactly.
      dbFields.approval_notes = typeof niReason === "string" && niReason.trim() ? niReason.trim() : "Not interested"
      dbFields.decline_notes  = typeof declineNotes === "string" && declineNotes.trim() ? declineNotes.trim() : null
    } else {
      // Reopening a declined row clears its reason.
      if (currentStage === "Not Interested") {
        dbFields.approval_notes = null
        dbFields.decline_notes  = null
      }
      Object.assign(dbFields, clearPostTrackerState(existingBi.product_details))
    }
  } else {
    // Post Tracker stage: only for rows already handed to Post Tracker.
    if (currentStage !== "For Order Creation") {
      return NextResponse.json(
        { error: transitionRefusalReason(currentStage, "For Order Creation"), currentStage },
        { status: 409 },
      )
    }

    // Posted is terminal; resetting it happens in Post Tracker.
    if (productDetails.closedStatus === "Posted" && postTrackerTarget !== "Posted") {
      return NextResponse.json(
        { error: "This influencer has already Posted. Reset the workflow from Post Tracker to move it back.", currentStage },
        { status: 409 },
      )
    }

    // Posted needs a post URL or a detected post.
    if (postTrackerTarget === "Posted" && productDetails.closedStatus !== "Posted") {
      const hasUrl = Boolean(existingBi.post_url && existingBi.post_url.trim())
      const detected = hasUrl
        ? 0
        : await prisma.detectedPost.count({ where: { brand_influencer_id: existingBi.id, brand_id } })
      if (!hasUrl && detected === 0) {
        return NextResponse.json(
          { error: "This influencer has no post yet. Add a Post URL in Post Tracker before moving to Posted." },
          { status: 409 },
        )
      }
    }

    productDetails.closedStatus = postTrackerTarget
    dbFields = {
      ...mapClosedToPipelineFields(postTrackerTarget, existingBi),
      product_details: JSON.stringify(productDetails),
    }
  }

  const updated = await prisma.brandInfluencer.update({
    where:  { id: existingBi.id },
    data:   dbFields,
    select: {
      id:             true,
      contact_status: true,
      stage:          true,
      order_status:   true,
      content_posted: true,
    },
  })

  if (existingBi.stage !== null && existingBi.stage < 4 && updated.stage !== null && updated.stage >= 4) {
    provisionGoAffProAffiliate({ brandId: brand_id, brandInfluencerId: existingBi.id }).then((result) => {
      if (!result.success && !result.skipped) {
        console.error("GoAffPro provisioning failed:", result.reason)
      }
    }).catch(console.error)
  }
  if (existingBi.contact_status !== updated.contact_status) {
    logActivity({
      brandId:    brand_id,
      userId,
      action:     "pipeline.status_changed",
      entityType: "brand_influencer",
      entityId:   existingBi.id,
      details: {
        from: existingBi.contact_status,
        to:   updated.contact_status,
        ...(pipelineTarget === "Not Interested" && dbFields.approval_notes ? { ni_reason: dbFields.approval_notes } : {}),
        ...(pipelineTarget === "Not Interested" && dbFields.decline_notes ? { decline_notes: dbFields.decline_notes } : {}),
      },
    }).catch(console.error)
  }

  const appUrl   = process.env.NEXTAUTH_URL ?? ""
  const inboxUrl = `${appUrl}/dashboard/inbox?brandId=${brand_id}`

  prisma.brandMember
    .findMany({
      where:  { brand_id },
      select: { user_id: true },
    })
    .then(async (members) => {
      await Promise.allSettled(
        members.map(async ({ user_id }) => {
          if (stage === "ONBOARDED") {
            // Triggers the "deal_agreed" notification
            await sendNotification({
              userId:    user_id,
              type:      "deal_agreed",
              title:     `Deal agreed with ${influencerName}`,
              message:   `${influencerName} has confirmed the collaboration. Head to the inbox to move them to the next step.`,
              actionUrl: inboxUrl,
            })
          } else if (stageLabel[stage]) {
            // Triggers "stage_change" for every other stage move
            await sendNotification({
              userId:    user_id,
              type:      "stage_change",
              title:     "Pipeline stage updated",
              message:   `${influencerName} has been moved to "${stageLabel[stage]}".`,
              actionUrl: inboxUrl,
            })
          }
        }),
      )
    })
    .catch((err) => console.error("Notification dispatch failed:", err))

  return NextResponse.json({ success: true, data: updated })
}

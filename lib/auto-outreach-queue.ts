import "server-only"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import { sendNotification } from "@/lib/notifications"
import { fillTemplate } from "@/lib/template-placeholders"
import { sendFromMailbox, hasReplyFrom, type MailThread } from "@/lib/mail-send"
import { autoAdvanceRepliedToInConversation } from "@/lib/pipeline"
import { getAutoOutreachConfig, saveAutoOutreachConfig, AUTO_OUTREACH_KEY, type AutoOutreachConfig } from "@/lib/auto-outreach"

// Queue in OutreachLog: outreach_type = state, response_text = meta JSON, response_date = sent time.
export const OUTREACH_STATE = {
  queued: "auto_queued",
  sending: "auto_sending",
  sent: "auto_sent",
  failed: "auto_failed",
  cancelled: "auto_cancelled",
} as const
const ACTIVE_STATES: string[] = [OUTREACH_STATE.queued, OUTREACH_STATE.sending, OUTREACH_STATE.sent]

type QueueMeta = {
  sendAfter: string
  attempts: number
  error?: string
  queuedBy?: string
  /** 0 = first email, 1+ = follow-up. */
  step?: number
  /** Follow-up row: its first email. */
  parentId?: string
  /** First email: its thread. */
  thread?: MailThread
  /** First email: why follow-ups stopped, and failures. */
  followUpsStopped?: string
  followUpAttempts?: number
  followUpError?: string
}

const RETRY_DELAY_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 2
const STUCK_SENDING_MS = 10 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const parseMeta = (text: string | null): QueueMeta => {
  try {
    return { sendAfter: new Date(0).toISOString(), attempts: 0, ...JSON.parse(text || "{}") }
  } catch {
    return { sendAfter: new Date(0).toISOString(), attempts: 0 }
  }
}
export const isValidEmail = (value: string | null | undefined) => EMAIL_RE.test((value ?? "").trim())

export type Candidate = {
  influencerId: string
  brandInfluencerId: string
  handle: string
  name: string | null
  platform: string
  email: string
}
export type Skipped = { influencerId: string; handle: string; reason: string }

/** Who gets the email, and who's skipped and why. */
export async function checkEligibility(brandId: string, influencerIds: string[]) {
  const rows = await prisma.brandInfluencer.findMany({
    where: { brand_id: brandId, influencer_id: { in: influencerIds }, influencer: { is_draft: false } },
    select: {
      id: true,
      influencer_id: true,
      stage: true,
      contact_status: true,
      influencer: { select: { handle: true, full_name: true, platform: true, email: true } },
    },
  })
  const already = await prisma.outreachLog.findMany({
    where: { brand_influencer_id: { in: rows.map((r) => r.id) }, outreach_type: { in: ACTIVE_STATES } },
    select: { brand_influencer_id: true },
  })
  const alreadySet = new Set(already.map((a) => a.brand_influencer_id))

  const eligible: Candidate[] = []
  const skipped: Skipped[] = []
  for (const r of rows) {
    const handle = r.influencer.handle
    const skip = (reason: string) => skipped.push({ influencerId: r.influencer_id, handle, reason })
    // Approval keeps stage 1; later stages were already contacted.
    if ((r.stage ?? 1) > 1) skip("already contacted")
    else if (r.contact_status === "not_interested") skip("marked not interested")
    else if (alreadySet.has(r.id)) skip("already emailed or scheduled")
    else if (!isValidEmail(r.influencer.email)) skip("no valid email address")
    else
      eligible.push({
        influencerId: r.influencer_id,
        brandInfluencerId: r.id,
        handle,
        name: r.influencer.full_name,
        platform: r.influencer.platform,
        email: r.influencer.email!.trim(),
      })
  }
  return { eligible, skipped }
}

export async function renderOutreach(brandId: string, templateId: string, c: Pick<Candidate, "name" | "handle" | "platform">) {
  const [template, brand] = await Promise.all([
    prisma.emailTemplate.findFirst({ where: { id: templateId, brand_id: brandId }, select: { subject: true, body: true } }),
    prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } }),
  ])
  if (!template) return null
  const values = { name: c.name, handle: c.handle, platform: c.platform, brand: brand?.name }
  return { subject: fillTemplate(template.subject, values), body: fillTemplate(template.body, values) }
}

export async function queueOutreach(brandId: string, eligible: Candidate[], config: AutoOutreachConfig, userId: string) {
  const sendAfter = new Date(Date.now() + config.cancelWindowMinutes * 60 * 1000).toISOString()
  await prisma.outreachLog.createMany({
    data: eligible.map((c) => ({
      brand_influencer_id: c.brandInfluencerId,
      outreach_type: OUTREACH_STATE.queued,
      response_text: JSON.stringify({ sendAfter, attempts: 0, queuedBy: userId } satisfies QueueMeta),
    })),
  })
  return sendAfter
}

export type OutreachStatus = {
  logId: string
  state: "scheduled" | "failed" | "followup" | "followup_failed"
  sendAfter: string
  error?: string
  step?: number
}

/** Adds n weekdays (UTC). */
export function addWeekdays(from: Date, n: number): Date {
  const d = new Date(from)
  let left = n
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) left--
  }
  return d
}
const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6

type SentRow = { id: string; brand_influencer_id: string; response_text: string | null; response_date: Date | null; subject: string | null }

/** Per first email: follow-ups sent, last send time, next step. */
function followUpChains(sent: SentRow[], steps: AutoOutreachConfig["followUps"]["steps"]) {
  const firsts = new Map<string, { row: SentRow; meta: QueueMeta; done: number; lastAt: Date }>()
  for (const r of sent) {
    const meta = parseMeta(r.response_text)
    if (!meta.step && meta.thread && r.response_date) firsts.set(r.id, { row: r, meta, done: 0, lastAt: r.response_date })
  }
  for (const r of sent) {
    const meta = parseMeta(r.response_text)
    const chain = meta.parentId ? firsts.get(meta.parentId) : undefined
    if (chain && meta.step && r.response_date) {
      chain.done = Math.max(chain.done, meta.step)
      if (r.response_date > chain.lastAt) chain.lastAt = r.response_date
    }
  }
  return [...firsts.values()].map((c) => {
    const next = c.meta.followUpsStopped ? undefined : steps[c.done]
    return {
      ...c,
      nextStep: next ? c.done + 1 : null,
      dueAt: next ? addWeekdays(c.lastAt, next.waitDays) : null,
      templateId: next?.templateId ?? null,
    }
  })
}

/** Pipeline card status for first emails and follow-ups. */
export async function getOutreachStatuses(brandId: string, brandInfluencerIds: string[]) {
  if (brandInfluencerIds.length === 0) return new Map<string, OutreachStatus>()
  const rows = await prisma.outreachLog.findMany({
    where: {
      brand_influencer_id: { in: brandInfluencerIds },
      outreach_type: { in: [OUTREACH_STATE.queued, OUTREACH_STATE.sending, OUTREACH_STATE.failed] },
    },
    select: { id: true, brand_influencer_id: true, outreach_type: true, response_text: true },
    orderBy: { created_at: "desc" },
  })
  const map = new Map<string, OutreachStatus>()
  for (const r of rows) {
    if (map.has(r.brand_influencer_id)) continue
    const meta = parseMeta(r.response_text)
    map.set(r.brand_influencer_id, {
      logId: r.id,
      state: r.outreach_type === OUTREACH_STATE.failed ? "failed" : "scheduled",
      sendAfter: meta.sendAfter,
      error: meta.error,
    })
  }

  const config = await getAutoOutreachConfig(brandId)
  if (!config.followUps.enabled) return map
  const sent = await prisma.outreachLog.findMany({
    where: { brand_influencer_id: { in: brandInfluencerIds }, outreach_type: OUTREACH_STATE.sent },
    select: { id: true, brand_influencer_id: true, response_text: true, response_date: true, subject: true },
  })
  for (const c of followUpChains(sent, config.followUps.steps)) {
    if (map.has(c.row.brand_influencer_id)) continue
    if (c.meta.followUpsStopped?.startsWith("failed")) {
      map.set(c.row.brand_influencer_id, { logId: c.row.id, state: "followup_failed", sendAfter: "", error: c.meta.followUpError, step: c.done + 1 })
    } else if (c.dueAt && c.nextStep) {
      map.set(c.row.brand_influencer_id, { logId: c.row.id, state: "followup", sendAfter: c.dueAt.toISOString(), step: c.nextStep })
    }
  }
  return map
}

export async function updateQueuedOutreach(
  brandId: string,
  logId: string,
  action: "cancel" | "retry" | "cancel_followups" | "retry_followups"
) {
  const row = await prisma.outreachLog.findUnique({ where: { id: logId } })
  if (!row) return { ok: false as const, error: "Not found" }
  const bi = await prisma.brandInfluencer.findFirst({ where: { id: row.brand_influencer_id, brand_id: brandId }, select: { id: true } })
  if (!bi) return { ok: false as const, error: "Not found" }

  if (action === "cancel_followups" || action === "retry_followups") {
    if (row.outreach_type !== OUTREACH_STATE.sent) return { ok: false as const, error: "Not found" }
    const meta = parseMeta(row.response_text)
    const next =
      action === "cancel_followups"
        ? { ...meta, followUpsStopped: "cancelled" }
        : { ...meta, followUpsStopped: undefined, followUpAttempts: 0, followUpError: undefined }
    await prisma.outreachLog.update({ where: { id: logId }, data: { response_text: JSON.stringify(next) } })
    return { ok: true as const }
  }

  if (action === "cancel") {
    const res = await prisma.outreachLog.updateMany({
      where: { id: logId, outreach_type: OUTREACH_STATE.queued },
      data: { outreach_type: OUTREACH_STATE.cancelled },
    })
    return res.count ? { ok: true as const } : { ok: false as const, error: "It's already being sent." }
  }
  const res = await prisma.outreachLog.updateMany({
    where: { id: logId, outreach_type: OUTREACH_STATE.failed },
    data: {
      outreach_type: OUTREACH_STATE.queued,
      response_text: JSON.stringify({ sendAfter: new Date().toISOString(), attempts: 0 } satisfies QueueMeta),
    },
  })
  return res.count ? { ok: true as const } : { ok: false as const, error: "Only a failed email can be retried." }
}

const LOCK_KEY = "auto-outreach"
const LOCK_TTL_MS = 5 * 60 * 1000

export async function acquireOutreachLock(holder: string) {
  const now = new Date()
  const expires_at = new Date(now.getTime() + LOCK_TTL_MS)
  try {
    await prisma.monitoringLock.create({ data: { key: LOCK_KEY, locked_at: now, expires_at, holder } })
    return true
  } catch {
    const res = await prisma.monitoringLock.updateMany({
      where: { key: LOCK_KEY, expires_at: { lt: now } },
      data: { locked_at: now, expires_at, holder },
    })
    return res.count > 0
  }
}
export async function releaseOutreachLock(holder: string) {
  await prisma.monitoringLock.deleteMany({ where: { key: LOCK_KEY, holder } }).catch(() => {})
}

/** One email per brand per run, within spacing, daily limit and pauses. */
export async function runOutreachPass() {
  const brands = await prisma.integrationConnection.findMany({
    where: { integration_key: AUTO_OUTREACH_KEY, connected: true },
    select: { brand_id: true },
  })
  const results: Record<string, string> = {}
  for (const { brand_id } of brands) {
    try {
      results[brand_id] = await processBrand(brand_id)
    } catch (err) {
      console.error(`[auto-outreach] brand ${brand_id} failed:`, err)
      results[brand_id] = "error"
    }
  }
  return results
}

async function pause(brandId: string, config: AutoOutreachConfig, reason: string) {
  await saveAutoOutreachConfig(brandId, { ...config, paused: true, pausedReason: reason })
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { owner_id: true } })
  const notify = new Set([brand?.owner_id, config.sender?.userId].filter(Boolean) as string[])
  for (const userId of notify) {
    await sendNotification({
      userId,
      type: "stage_change",
      title: "Auto outreach paused",
      message: reason,
      actionUrl: `/dashboard/settings/outreach?brandId=${brandId}`,
    }).catch(console.error)
  }
}

async function processBrand(brandId: string): Promise<string> {
  const config = await getAutoOutreachConfig(brandId)
  if (!config.enabled) return "off"
  if (config.paused) return "paused"
  if (!config.sender || !config.templateId) return "not set up"

  const biIds = (await prisma.brandInfluencer.findMany({ where: { brand_id: brandId }, select: { id: true } })).map((b) => b.id)
  if (biIds.length === 0) return "empty"
  const now = Date.now()

  // An interrupted send can't be safely repeated; flag it for a person.
  const stuck = await prisma.outreachLog.findMany({
    where: { brand_influencer_id: { in: biIds }, outreach_type: OUTREACH_STATE.sending },
    select: { id: true, response_text: true, response_date: true },
  })
  for (const s of stuck) {
    if (s.response_date && now - s.response_date.getTime() > STUCK_SENDING_MS) {
      await prisma.outreachLog.update({
        where: { id: s.id },
        data: {
          outreach_type: OUTREACH_STATE.failed,
          response_text: JSON.stringify({ ...parseMeta(s.response_text), error: "Interrupted while sending. Check the Sent folder before retrying." }),
        },
      })
    }
  }

  const [sentToday, lastSent] = await Promise.all([
    prisma.outreachLog.count({
      where: { brand_influencer_id: { in: biIds }, outreach_type: OUTREACH_STATE.sent, response_date: { gte: new Date(now - 24 * 3600 * 1000) } },
    }),
    prisma.outreachLog.findFirst({
      where: { brand_influencer_id: { in: biIds }, outreach_type: OUTREACH_STATE.sent },
      orderBy: { response_date: "desc" },
      select: { response_date: true },
    }),
  ])
  if (sentToday >= config.dailyCap) return "daily limit reached"
  if (lastSent?.response_date && now - lastSent.response_date.getTime() < config.intervalMinutes * 60 * 1000) return "spacing"

  const queued = await prisma.outreachLog.findMany({
    where: { brand_influencer_id: { in: biIds }, outreach_type: OUTREACH_STATE.queued },
    select: { id: true, brand_influencer_id: true, response_text: true },
    orderBy: { created_at: "asc" },
  })
  const due = queued.find((q) => new Date(parseMeta(q.response_text).sendAfter).getTime() <= now)
  if (!due) return processFollowUp(brandId, config, biIds, now)

  // Claim it so overlapping runs can't double-send.
  const claimed = await prisma.outreachLog.updateMany({
    where: { id: due.id, outreach_type: OUTREACH_STATE.queued },
    data: { outreach_type: OUTREACH_STATE.sending, response_date: new Date() },
  })
  if (!claimed.count) return "claimed elsewhere"
  const meta = parseMeta(due.response_text)

  const bi = await prisma.brandInfluencer.findUnique({
    where: { id: due.brand_influencer_id },
    select: {
      id: true,
      stage: true,
      approval_status: true,
      contact_status: true,
      influencer: { select: { handle: true, full_name: true, platform: true, email: true } },
    },
  })
  const cancel = async (reason: string) => {
    await prisma.outreachLog.update({
      where: { id: due.id },
      data: { outreach_type: OUTREACH_STATE.cancelled, response_text: JSON.stringify({ ...meta, error: reason }) },
    })
    return `cancelled: ${reason}`
  }
  if (!bi) return cancel("influencer removed")
  if (bi.approval_status !== "Approved") return cancel("no longer approved")
  if ((bi.stage ?? 1) > 1) return cancel("already contacted")
  if (bi.contact_status === "not_interested") return cancel("marked not interested")
  if (!isValidEmail(bi.influencer.email)) return cancel("no valid email address")

  const content = await renderOutreach(brandId, config.templateId, {
    name: bi.influencer.full_name,
    handle: bi.influencer.handle,
    platform: bi.influencer.platform,
  })
  if (!content) {
    await prisma.outreachLog.update({ where: { id: due.id }, data: { outreach_type: OUTREACH_STATE.queued, response_date: null } })
    await pause(brandId, config, "The outreach template was deleted. Pick another one to resume.")
    return "paused: template missing"
  }

  const to = bi.influencer.email!.trim()
  const result = await sendFromMailbox(config.sender, { to, subject: content.subject, text: content.body })

  if (result.ok) {
    await prisma.outreachLog.update({
      where: { id: due.id },
      data: {
        outreach_type: OUTREACH_STATE.sent,
        subject: content.subject,
        message: content.body,
        response_date: new Date(),
        response_text: JSON.stringify({ ...meta, step: 0, thread: result.thread ?? undefined, attempts: meta.attempts + 1, error: undefined }),
      },
    })
    // Same as a manual send: move to Contacted.
    await prisma.brandInfluencer.updateMany({
      where: { id: bi.id, stage: { lt: 2 } },
      data: { contact_status: "contacted", stage: 2 },
    })
    await logActivity({
      brandId,
      userId: config.sender.userId,
      action: "outreach.auto_sent",
      entityType: "brand_influencer",
      entityId: bi.id,
      details: { to, subject: content.subject },
    })
    return `sent to @${bi.influencer.handle}`
  }

  if (result.kind === "auth") {
    // Mailbox problem: keep it queued and pause the brand.
    await prisma.outreachLog.update({ where: { id: due.id }, data: { outreach_type: OUTREACH_STATE.queued, response_date: null } })
    await pause(brandId, config, `${result.message} Reconnect ${config.sender.email ?? "the sender mailbox"} and resume.`)
    return "paused: mailbox"
  }

  const attempts = meta.attempts + 1
  await prisma.outreachLog.update({
    where: { id: due.id },
    data:
      attempts < MAX_ATTEMPTS
        ? {
            outreach_type: OUTREACH_STATE.queued,
            response_date: null,
            response_text: JSON.stringify({ ...meta, attempts, error: result.message, sendAfter: new Date(now + RETRY_DELAY_MS).toISOString() }),
          }
        : { outreach_type: OUTREACH_STATE.failed, response_text: JSON.stringify({ ...meta, attempts, error: result.message }) },
  })
  return attempts < MAX_ATTEMPTS ? "retry scheduled" : "failed"
}

/** Sends the oldest due follow-up in its thread (weekdays only). */
async function processFollowUp(brandId: string, config: AutoOutreachConfig, biIds: string[], now: number): Promise<string> {
  if (!config.followUps.enabled || !config.sender) return "nothing due"
  if (isWeekend(new Date(now))) return "weekend"

  const sent = await prisma.outreachLog.findMany({
    where: { brand_influencer_id: { in: biIds }, outreach_type: OUTREACH_STATE.sent },
    select: { id: true, brand_influencer_id: true, response_text: true, response_date: true, subject: true },
  })
  const due = followUpChains(sent, config.followUps.steps)
    .filter((c) => c.dueAt && c.dueAt.getTime() <= now && c.templateId)
    .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0]
  if (!due) return "nothing due"

  const first = due.row
  const stop = async (reason: string, extra: Partial<QueueMeta> = {}) => {
    await prisma.outreachLog.update({
      where: { id: first.id },
      data: { response_text: JSON.stringify({ ...due.meta, ...extra, followUpsStopped: reason }) },
    })
    return `follow-ups stopped: ${reason}`
  }

  const bi = await prisma.brandInfluencer.findUnique({
    where: { id: first.brand_influencer_id },
    select: { id: true, stage: true, contact_status: true, influencer: { select: { handle: true, full_name: true, platform: true, email: true } } },
  })
  if (!bi) return stop("influencer removed")
  if (bi.stage !== 2 || bi.contact_status === "not_interested") return stop("moved on from Contacted")
  if (!isValidEmail(bi.influencer.email)) return stop("no valid email address")
  const to = bi.influencer.email!.trim()

  const reply = await hasReplyFrom(config.sender, to, first.response_date!)
  if (!reply.ok) {
    if (reply.kind === "auth") {
      await pause(brandId, config, `${reply.message} Reconnect ${config.sender.email ?? "the sender mailbox"} and resume.`)
      return "paused: mailbox"
    }
    return "reply check failed; will retry"
  }
  if (reply.replied) {
    await autoAdvanceRepliedToInConversation(brandId, [bi.id])
    return stop("replied")
  }

  const content = await renderOutreach(brandId, due.templateId!, {
    name: bi.influencer.full_name,
    handle: bi.influencer.handle,
    platform: bi.influencer.platform,
  })
  if (!content) {
    await pause(brandId, config, `The template for follow-up ${due.nextStep} was deleted. Pick another one to resume.`)
    return "paused: template missing"
  }

  const result = await sendFromMailbox(config.sender, { to, subject: content.subject, text: content.body, replyTo: due.meta.thread })
  if (result.ok) {
    await prisma.outreachLog.create({
      data: {
        brand_influencer_id: bi.id,
        outreach_type: OUTREACH_STATE.sent,
        subject: `Re: ${due.meta.thread!.subject}`,
        message: content.body,
        response_date: new Date(),
        response_text: JSON.stringify({ sendAfter: new Date().toISOString(), attempts: 1, step: due.nextStep!, parentId: first.id } satisfies QueueMeta),
      },
    })
    if (due.meta.followUpAttempts) {
      await prisma.outreachLog.update({
        where: { id: first.id },
        data: { response_text: JSON.stringify({ ...due.meta, followUpAttempts: 0, followUpError: undefined }) },
      })
    }
    await logActivity({
      brandId,
      userId: config.sender.userId,
      action: "outreach.auto_followup_sent",
      entityType: "brand_influencer",
      entityId: bi.id,
      details: { to, step: due.nextStep },
    })
    return `follow-up ${due.nextStep} sent to @${bi.influencer.handle}`
  }

  if (result.kind === "auth") {
    await pause(brandId, config, `${result.message} Reconnect ${config.sender.email ?? "the sender mailbox"} and resume.`)
    return "paused: mailbox"
  }
  const attempts = (due.meta.followUpAttempts ?? 0) + 1
  if (attempts >= MAX_ATTEMPTS) return stop(`failed: ${result.message}`, { followUpAttempts: attempts, followUpError: result.message })
  await prisma.outreachLog.update({
    where: { id: first.id },
    data: { response_text: JSON.stringify({ ...due.meta, followUpAttempts: attempts, followUpError: result.message }) },
  })
  return "follow-up retry next run"
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GMAIL_PROVIDER } from "@/lib/gmail"
import { hasBrandCapability } from "@/lib/permissions"
import { isDatabaseCapacityError, databaseCapacityResponse } from "@/lib/db-capacity"
import {
  getAutoOutreachConfig,
  saveAutoOutreachConfig,
  CANCEL_WINDOW_RANGE,
  INTERVAL_RANGE,
  DAILY_CAP_RANGE,
  type AutoOutreachConfig,
} from "@/lib/auto-outreach"

const OUTLOOK_PROVIDER = "microsoft"

async function isBrandMember(brandId: string, userId: string) {
  return !!(await prisma.brand.findFirst({
    where: { id: brandId, OR: [{ owner_id: userId }, { members: { some: { user_id: userId } } }] },
    select: { id: true },
  }))
}

const clampInt = (v: unknown, { min, max }: { min: number; max: number }) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

// canEdit: the same people who can approve.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { brandId } = await params
    if (!(await isBrandMember(brandId, session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const [config, canEdit] = await Promise.all([
      getAutoOutreachConfig(brandId),
      hasBrandCapability(brandId, session.user.id, "approveInfluencers"),
    ])
    return NextResponse.json({ config, canEdit })
  } catch (error) {
    console.error("[GET auto-outreach]", error)
    if (isDatabaseCapacityError(error)) return databaseCapacityResponse()
    return NextResponse.json({ error: "Couldn't load auto outreach settings." }, { status: 500 })
  }
}

// Changes only the fields sent; the sender must be the caller's own mailbox.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id
    const { brandId } = await params
    if (!(await hasBrandCapability(brandId, userId, "approveInfluencers"))) {
      return NextResponse.json({ error: "Only Owners and Managers can change auto outreach." }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const next: AutoOutreachConfig = { ...(await getAutoOutreachConfig(brandId)) }

    if (body.templateId !== undefined) {
      if (body.templateId === null) next.templateId = null
      else {
        const template = await prisma.emailTemplate.findFirst({
          where: { id: String(body.templateId), brand_id: brandId },
          select: { id: true },
        })
        if (!template) return NextResponse.json({ error: "That template no longer exists." }, { status: 400 })
        next.templateId = template.id
      }
    }

    if (body.senderAccountId !== undefined) {
      if (body.senderAccountId === null) next.sender = null
      else {
        const account = await prisma.account.findFirst({
          where: { id: String(body.senderAccountId), userId, provider: { in: [GMAIL_PROVIDER, OUTLOOK_PROVIDER] } },
          select: { id: true, provider: true, email: true },
        })
        if (!account) return NextResponse.json({ error: "Pick one of your connected mailboxes." }, { status: 400 })
        next.sender = {
          userId,
          accountId: account.id,
          provider: account.provider === GMAIL_PROVIDER ? "gmail" : "outlook",
          email: account.email,
        }
        next.paused = false
        next.pausedReason = null
      }
    }

    if (body.cancelWindowMinutes !== undefined) {
      const v = clampInt(body.cancelWindowMinutes, CANCEL_WINDOW_RANGE)
      if (v === null) {
        return NextResponse.json({ error: `Cancel window must be ${CANCEL_WINDOW_RANGE.min}–${CANCEL_WINDOW_RANGE.max} minutes.` }, { status: 400 })
      }
      next.cancelWindowMinutes = v
    }
    if (body.intervalMinutes !== undefined) {
      const v = clampInt(body.intervalMinutes, INTERVAL_RANGE)
      if (v === null) {
        return NextResponse.json({ error: `Spacing must be ${INTERVAL_RANGE.min}–${INTERVAL_RANGE.max} minutes.` }, { status: 400 })
      }
      next.intervalMinutes = v
    }
    if (body.dailyCap !== undefined) {
      const v = clampInt(body.dailyCap, DAILY_CAP_RANGE)
      if (v === null) {
        return NextResponse.json({ error: `Daily limit must be ${DAILY_CAP_RANGE.min}–${DAILY_CAP_RANGE.max}.` }, { status: 400 })
      }
      next.dailyCap = v
    }
    if (body.resume === true) {
      next.paused = false
      next.pausedReason = null
    }
    if (body.enabled !== undefined) next.enabled = body.enabled === true

    if (next.enabled && (!next.templateId || !next.sender)) {
      return NextResponse.json({ error: "Pick a template and a sender mailbox before turning it on." }, { status: 400 })
    }

    await saveAutoOutreachConfig(brandId, next)
    return NextResponse.json({ config: next })
  } catch (error) {
    console.error("[PUT auto-outreach]", error)
    if (isDatabaseCapacityError(error)) return databaseCapacityResponse()
    return NextResponse.json({ error: "Couldn't save auto outreach settings." }, { status: 500 })
  }
}

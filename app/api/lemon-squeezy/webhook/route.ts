import { prisma } from "@/lib/prisma"
import { syncBrandActivityWithSubscription } from "@/lib/subscription-limits"
import { NextResponse } from "next/server"
import crypto from "crypto"

interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string
    custom_data?: {
      userId?: string
      planKey?: string
      cycle?: string
    }
  }
  data: {
    id: string
    type: string
    attributes: {
      order_number?: number
      user_email?: string
      total?: number
      currency?: string
      status?: string
      subscription_id?: number
      [key: string]: any
    }
  }
}

const planMapping: Record<string, { included_brands: number; max_brands: number | null; price_per_extra_brand: number }> = {
  solo: { included_brands: 1, max_brands: 1, price_per_extra_brand: 0 },
  team: { included_brands: 3, max_brands: 10, price_per_extra_brand: 10 },
  agency: { included_brands: 10, max_brands: null, price_per_extra_brand: 5 },
}

function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    return false
  }

  const hash = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex")

  return hash === signature
}

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = req.headers.get("x-signature")

    if (!signature || !verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const jsonBody = JSON.parse(body) as LemonSqueezyWebhookEvent
    const eventName = jsonBody.meta.event_name
    const customData = jsonBody.meta.custom_data
    const userId = customData?.userId

    if (!userId) {
      return NextResponse.json({ error: "No user ID in webhook" }, { status: 400 })
    }

    if (
      eventName === "order:created" ||
      eventName === "order:finished" ||
      eventName === "subscription_created" ||
      eventName === "subscription_payment_success"
    ) {
      const planKey = customData?.planKey as keyof typeof planMapping
      const cycle = customData?.cycle

      if (!planKey || !planMapping[planKey]) {
        return NextResponse.json({ error: "Invalid plan key" }, { status: 400 })
      }

      const planConfig = planMapping[planKey]

      let plan = await prisma.subscriptionPlan.findFirst({
        where: { name: planKey },
      })

      if (!plan) {
        plan = await prisma.subscriptionPlan.create({
          data: {
            name: planKey,
            display_name: planKey.charAt(0).toUpperCase() + planKey.slice(1),
            included_brands: planConfig.included_brands,
            max_brands: planConfig.max_brands,
            price_per_extra_brand: planConfig.price_per_extra_brand,
            is_active: true,
            price_monthly: 0,
            price_yearly: 0,
          },
        })
      }

      const existingSubscription = await prisma.userSubscription.findUnique({
        where: { user_id: userId },
      })

      // Calculate period dates
      const now = new Date()
      const periodStart = jsonBody.data.attributes.renews_at 
        ? new Date(jsonBody.data.attributes.renews_at)
        : now
      
      const periodEnd = jsonBody.data.attributes.expires_at
        ? new Date(jsonBody.data.attributes.expires_at)
        : new Date(now.getTime() + (cycle === "yearly" ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000))

      let subscription
      if (existingSubscription) {
        subscription = await prisma.userSubscription.update({
          where: { user_id: userId },
          data: {
            plan_id: plan.id,
            status: "active",
            billing_cycle: cycle as "monthly" | "yearly",
            payment_subscription_id: jsonBody.data.attributes.subscription_id?.toString(),
            current_period_start: periodStart,
            current_period_end: periodEnd,
          },
        })
      } else {
        subscription = await prisma.userSubscription.create({
          data: {
            user_id: userId,
            plan_id: plan.id,
            status: "active",
            billing_cycle: cycle as "monthly" | "yearly",
            extra_brands: 0,
            payment_subscription_id: jsonBody.data.attributes.subscription_id?.toString(),
            current_period_start: periodStart,
            current_period_end: periodEnd,
          },
        })
      }

      await prisma.paymentHistory.create({
        data: {
          user_id: userId,
          subscription_id: subscription.id,
          amount: (jsonBody.data.attributes.total as number) / 100 || 0,
          status: "completed",
          description: `${planKey} plan subscription (${cycle})`,
          stripe_payment_id: jsonBody.data.id,
        },
      }).catch(() => void 0)

      // Sync brand activity with new subscription status
      await syncBrandActivityWithSubscription(userId)

      return NextResponse.json({ success: true })
    }

    if (eventName === "subscription:cancelled" || eventName === "subscription_cancelled") {
      await prisma.userSubscription.updateMany({
        where: { user_id: userId },
        data: { status: "cancelled" },
      })
      
      // Sync brand activity when subscription is cancelled
      await syncBrandActivityWithSubscription(userId)
      
      return NextResponse.json({ success: true })
    }

    if (eventName === "subscription:paused" || eventName === "subscription_paused") {
      await prisma.userSubscription.updateMany({
        where: { user_id: userId },
        data: { status: "paused" },
      })
      
      // Sync brand activity when subscription is paused
      await syncBrandActivityWithSubscription(userId)
      
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

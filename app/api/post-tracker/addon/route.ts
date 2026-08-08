import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkBrandAccess } from "@/lib/brand-access"
import { prisma } from "@/lib/prisma"
import {
  activateAddon,
  getAddonStatus,
  getSubscriptionEligibility,
  ADDON_PRICE,
  ADDON_KEY,
} from "@/lib/post-tracker/addon"
import { getQuota } from "@/lib/post-tracker/quota"

// Post Tracker Add-on: status and purchase activation.
// Scoped to the Post Tracker only — no other module reads these endpoints.

// GET /api/post-tracker/addon?brandId=...
// Returns entitlement + today's testing quota for the workspace.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const brandId = req.nextUrl.searchParams.get("brandId")
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [addon, quota] = await Promise.all([getAddonStatus(brandId), getQuota(brandId)])

    return NextResponse.json({
      addon: {
        key: ADDON_KEY,
        active: addon.active,
        status: addon.status,
        activatedAt: addon.activatedAt,
        expiresAt: addon.expiresAt,
        price: ADDON_PRICE,
      },
      quota: {
        apiRequests: quota.apiRequests,
        apiLimit: quota.apiLimit,
        postsImported: quota.postsImported,
        postLimit: quota.postLimit,
        exhausted: quota.exhausted,
        apiExhausted: quota.apiExhausted,
        postsExhausted: quota.postsExhausted,
        resetsAt: quota.resetsAt,
      },
    })
  } catch (error) {
    console.error("[GET /post-tracker/addon]", error)
    return NextResponse.json({ error: "Failed to load add-on status" }, { status: 500 })
  }
}

// POST /api/post-tracker/addon
// Body: { brandId }
//
// Claims the add-on for a workspace off the back of the app's EXISTING
// subscription. There is no payment logic here and no second checkout: the user
// pays through the normal Pricing → Lemon Squeezy flow, and this endpoint only
// asks "does this user hold a paid subscription?" before persisting the
// entitlement.
//
// Called when the user returns to the Post tab after paying, and it is safe to
// call at any time — if the subscription isn't paid, it refuses.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId } = await req.json()
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Already active — idempotent, so a double-submit or a refresh is harmless.
    const existing = await getAddonStatus(brandId)
    if (existing.active) {
      return NextResponse.json({ activated: true, alreadyActive: true, addon: existing })
    }

    // Entitlement comes from the existing subscription record via the shared
    // helper, so granting here and revoking in getAddonStatus use one rule.
    const eligibility = await getSubscriptionEligibility(session.user.id)
    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: "An active paid subscription is required to unlock the Post Tracker Add-on.",
          subscriptionRequired: true,
          reason: eligibility.reason,
        },
        { status: 402 }
      )
    }

    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: session.user.id },
    })

    const addon = await activateAddon({
      brandId,
      userId: session.user.id,
      // Recorded so it is auditable which subscription granted the add-on.
      paymentProvider: "subscription",
      paymentReference: subscription?.payment_subscription_id ?? subscription?.id ?? null,
      amount: ADDON_PRICE,
      currency: "USD",
      // Tied to the billing period. getAddonStatus additionally re-validates the
      // subscription live, so a cancellation revokes access before this date.
      expiresAt: subscription?.current_period_end ?? null,
    })

    return NextResponse.json({ activated: true, addon })
  } catch (error) {
    console.error("[POST /post-tracker/addon]", error)
    return NextResponse.json({ error: "Failed to activate add-on" }, { status: 500 })
  }
}

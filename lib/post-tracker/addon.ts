import "server-only"

// ─── Post Tracker Add-on entitlement ─────────────────────────────────────────
// The single source of truth for "may this workspace use Automatic Post
// Detection?". Everything that gates the feature calls isAddonActive() — the
// API routes and the background job both — so there is one rule, not three.
//
// Deliberately independent of UserSubscription: the add-on is bought per brand
// on top of any plan, so it must survive plan changes and must never be
// inferred from subscription status.

import { prisma } from "@/lib/prisma"

export const ADDON_KEY = "post_tracker_detection"

/** USD, one-off for the testing phase. Replace when real billing lands. */
export const ADDON_PRICE = 19

export type AddonStatus = {
  active: boolean
  status: string
  activatedAt: Date | null
  expiresAt: Date | null
}

/** Subscription states that count as paid. `basic` is the free tier. */
const PAID_STATUSES = new Set(["active", "trialing"])
const FREE_PLAN_NAME = "basic"

export type Eligibility = {
  eligible: boolean
  /** Machine-readable reason when not eligible, for logs and API responses. */
  reason: "ok" | "no_subscription" | "not_paid_status" | "free_plan"
  subscriptionStatus?: string
  planName?: string
}

/**
 * Does this user's existing subscription entitle them to the add-on?
 *
 * The single definition, used by the claim endpoint AND by getAddonStatus, so
 * granting and revoking can never disagree. Reads UserSubscription — the same
 * record /api/subscription/status reads — and never trusts client input.
 */
export async function getSubscriptionEligibility(userId: string): Promise<Eligibility> {
  const subscription = await prisma.userSubscription.findUnique({
    where: { user_id: userId },
    include: { plan: true },
  })

  if (!subscription) return { eligible: false, reason: "no_subscription" }

  const base = { subscriptionStatus: subscription.status, planName: subscription.plan?.name }

  // Covers cancelled, past_due, expired, unpaid — anything not currently paid.
  if (!PAID_STATUSES.has(subscription.status)) {
    return { eligible: false, reason: "not_paid_status", ...base }
  }
  if (!subscription.plan || subscription.plan.name === FREE_PLAN_NAME) {
    return { eligible: false, reason: "free_plan", ...base }
  }
  // A period that has already ended is not a live entitlement, even if the
  // status column hasn't been reconciled by the billing webhook yet.
  if (subscription.current_period_end && subscription.current_period_end.getTime() <= Date.now()) {
    return { eligible: false, reason: "not_paid_status", ...base }
  }

  return { eligible: true, reason: "ok", ...base }
}

export async function getAddonStatus(brandId: string): Promise<AddonStatus> {
  const row = await prisma.postTrackerAddon.findUnique({ where: { brand_id: brandId } })

  if (!row) {
    return { active: false, status: "inactive", activatedAt: null, expiresAt: null }
  }

  // An expired row is reported inactive without being mutated — the historical
  // record of what was bought stays intact.
  const expired = row.expires_at !== null && row.expires_at.getTime() <= Date.now()

  // Subscription-granted entitlements are re-validated live on every gate, so a
  // cancellation or downgrade revokes the add-on immediately rather than
  // lingering until expires_at. Without this, cancelling mid-period would leave
  // the feature unlocked and still burning provider quota.
  if (row.payment_provider === "subscription" && row.activated_by_user_id) {
    const eligibility = await getSubscriptionEligibility(row.activated_by_user_id)
    if (!eligibility.eligible) {
      return {
        active: false,
        status: eligibility.reason === "no_subscription" ? "revoked" : "subscription_inactive",
        activatedAt: row.activated_at,
        expiresAt: row.expires_at,
      }
    }
  }

  return {
    active: row.status === "active" && !expired,
    status: expired ? "expired" : row.status,
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
  }
}

export async function isAddonActive(brandId: string): Promise<boolean> {
  return (await getAddonStatus(brandId)).active
}

/**
 * Mark the add-on active after a verified payment. Idempotent: re-running with
 * the same payment reference will not create a second row, so a duplicated
 * webhook or a double-clicked purchase button cannot double-activate.
 */
export async function activateAddon(params: {
  brandId: string
  userId: string
  paymentProvider: string
  /** Null when the provider gives us nothing stable to reference. */
  paymentReference: string | null
  amount: number
  currency?: string
  expiresAt?: Date | null
}): Promise<AddonStatus> {
  const { brandId, userId, paymentProvider, paymentReference, amount, currency = "USD", expiresAt = null } = params

  const data = {
    status: "active",
    activated_at: new Date(),
    expires_at: expiresAt,
    payment_provider: paymentProvider,
    payment_reference: paymentReference,
    amount,
    currency,
    activated_by_user_id: userId,
  }

  await prisma.postTrackerAddon.upsert({
    where: { brand_id: brandId },
    create: { brand_id: brandId, ...data },
    update: data,
  })

  return getAddonStatus(brandId)
}

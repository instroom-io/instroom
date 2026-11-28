import "server-only"
import { NextResponse } from "next/server"
import type { SubscriptionPlan, UserSubscription } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getShopifyShopInfo } from "@/lib/shopify"
import { getPendingInstallationTokens } from "@/lib/shopify-installation"
import { getBrandIdByShopDomain, getShopifyConnection } from "@/lib/shopify-connection"
import { syncBrandActivityWithSubscription } from "@/lib/subscription-limits"

// Shopify App Pricing (App Store rule 1.2.1): accounts from the Shopify app are
// billed by Shopify, everyone else by Lemon Squeezy, never both. No billing
// webhooks, so the plan is read from the Partner API; no subscription = Basic.

const PARTNER_API_VERSION = "2026-07"

const PLAN_BY_HANDLE: Record<string, string> = { basic: "basic", free: "basic", solo: "solo", team: "team" }

// Grace so a renewal isn't cut off before the next sync.
const PERIOD_GRACE_MS = 2 * 24 * 60 * 60 * 1000

export type BillingSource = {
  provider: "shopify" | "lemonsqueezy" | null
  shopDomain: string | null
  manageUrl: string | null
}

type ActiveSubscription = {
  billingPeriod: string
  cancelAtEndOfCycle: boolean
  trialEndsAt: string | null
  currentBillingCycle: { startTime: string; endTime: string } | null
  items: { handle: string; price: { __typename: string; amount?: string | number | null } | null }[]
}

function partnerConfig() {
  const token = process.env.SHOPIFY_PARTNER_API_TOKEN
  const orgId = process.env.SHOPIFY_PARTNER_ORG_ID
  const appGid = process.env.SHOPIFY_APP_GID
  if (!token || !orgId || !appGid) return null
  return { token, orgId, appGid }
}

export function shopifyPlanSelectionUrl(shopDomain: string): string | null {
  const appHandle = process.env.SHOPIFY_APP_HANDLE
  if (!appHandle) return null
  const store = shopDomain.replace(/\.myshopify\.com$/, "")
  return `https://admin.shopify.com/store/${encodeURIComponent(store)}/charges/${encodeURIComponent(appHandle)}/pricing_plans`
}

/** null = no subscription (Basic). Throws on failure so an outage never downgrades. */
async function fetchActiveSubscription(shopGid: string): Promise<ActiveSubscription | null> {
  const config = partnerConfig()
  if (!config) throw new Error("Shopify Partner API is not configured")

  const res = await fetch(`https://partners.shopify.com/${config.orgId}/api/${PARTNER_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": config.token },
    body: JSON.stringify({
      query: `query ($appId: ID!, $shopId: ID!) {
        activeSubscription(appId: $appId, shopId: $shopId) {
          billingPeriod
          cancelAtEndOfCycle
          trialEndsAt
          currentBillingCycle { startTime endTime }
          items { handle price { __typename ... on FlatRatePrice { amount } } }
        }
      }`,
      variables: { appId: config.appGid, shopId: shopGid },
    }),
    cache: "no-store",
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.errors) {
    throw new Error(`Partner API request failed: ${JSON.stringify(json?.errors ?? res.status)}`)
  }
  return json.data?.activeSubscription ?? null
}

async function planByName(name: string): Promise<SubscriptionPlan> {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { name } })
  if (!plan) throw new Error(`Subscription plan "${name}" is missing`)
  return plan
}

/** Item handle, then the plan_handle hint, then price. */
async function resolvePlanName(active: ActiveSubscription, hint?: string | null): Promise<string> {
  for (const item of active.items) {
    const handle = item.handle?.toLowerCase() ?? ""
    const match = Object.keys(PLAN_BY_HANDLE).find((h) => handle === h || handle.startsWith(`${h}-`) || handle.startsWith(`${h}_`))
    if (match) return PLAN_BY_HANDLE[match]
  }
  if (hint && PLAN_BY_HANDLE[hint.toLowerCase()]) return PLAN_BY_HANDLE[hint.toLowerCase()]

  const total = active.items.reduce((sum, i) => sum + Number(i.price?.amount ?? 0), 0)
  const yearly = /ANNUAL|YEAR/i.test(active.billingPeriod)
  const plans = await prisma.subscriptionPlan.findMany({ where: { is_active: true } })
  // price_yearly is stored per month, billed ×12.
  const byPrice = plans.find((p) => Math.abs((yearly ? Number(p.price_yearly) * 12 : Number(p.price_monthly)) - total) < 0.01)
  if (byPrice) return byPrice.name

  throw new Error(`Unrecognised Shopify plan (items: ${active.items.map((i) => i.handle).join(", ")})`)
}

/** A current non-Shopify paid plan, left alone until it ends. */
function hasOtherActivePlan(sub: UserSubscription & { plan: SubscriptionPlan }) {
  if (sub.billing_provider === "shopify") return false
  if (sub.plan.name === "basic") return false
  if (!["active", "trialing", "paused"].includes(sub.status)) return false
  return !sub.current_period_end || sub.current_period_end.getTime() > Date.now()
}

async function shopAccessToken(shop: string): Promise<string | null> {
  const pending = await getPendingInstallationTokens(shop)
  if (pending) return pending.accessToken
  const brandId = await getBrandIdByShopDomain(shop)
  const connection = brandId ? await getShopifyConnection(brandId) : null
  return connection?.shopDomain === shop ? connection.accessToken : null
}

async function lookupShopGid(shop: string): Promise<string | null> {
  try {
    const token = await shopAccessToken(shop)
    return token ? (await getShopifyShopInfo(shop, token)).shopGid : null
  } catch (error) {
    console.error("[shopify-billing] couldn't look up the shop id", error)
    return null
  }
}

async function setBasic(where: { user_id: string } | { shopify_shop_domain: string }, data: Partial<UserSubscription> = {}) {
  const basic = await planByName("basic")
  const rows = await prisma.userSubscription.findMany({ where, select: { user_id: true } })
  if (rows.length === 0) return
  await prisma.userSubscription.updateMany({
    where,
    data: { plan_id: basic.id, status: "active", current_period_end: null, ended_at: null, shopify_synced_at: new Date(), ...data },
  })
  await Promise.all(rows.map((r) => syncBrandActivityWithSubscription(r.user_id)))
}

/**
 * Makes the account Shopify-billed for `shop`; false if it still has a current
 * non-Shopify paid plan. `takeOver` moves the store from another account (→ Basic).
 */
export async function markShopifyBilled(userId: string, shop: string, opts: { shopGid?: string | null; takeOver?: boolean } = {}) {
  const existing = await prisma.userSubscription.findUnique({ where: { user_id: userId }, include: { plan: true } })
  if (existing && hasOtherActivePlan(existing)) return false

  const holder = await prisma.userSubscription.findFirst({
    where: { shopify_shop_domain: shop, user_id: { not: userId } },
    select: { user_id: true },
  })
  if (holder) {
    if (!opts.takeOver) return false
    await setBasic({ user_id: holder.user_id }, { shopify_shop_domain: null, shopify_shop_gid: null })
  }

  const sameShop = existing?.shopify_shop_domain === shop
  const shopGid = opts.shopGid ?? (sameShop ? existing?.shopify_shop_gid : null) ?? (await lookupShopGid(shop))

  if (existing) {
    const fromBasic = existing.billing_provider !== "shopify" ? { plan_id: (await planByName("basic")).id, status: "active", current_period_end: null, ended_at: null } : {}
    await prisma.userSubscription.update({
      where: { user_id: userId },
      data: { ...fromBasic, billing_provider: "shopify", shopify_shop_domain: shop, shopify_shop_gid: shopGid },
    })
    await syncBrandActivityWithSubscription(userId)
  } else {
    const basic = await planByName("basic")
    await prisma.userSubscription.create({
      data: {
        user_id: userId,
        plan_id: basic.id,
        status: "active",
        billing_cycle: "monthly",
        current_period_end: null,
        billing_provider: "shopify",
        shopify_shop_domain: shop,
        shopify_shop_gid: shopGid,
      },
    })
    await syncBrandActivityWithSubscription(userId)
  }

  await syncShopifyBilling(userId).catch((error) => console.error("[shopify-billing] sync after marking failed", error))
  return true
}

/** Writes the store's Shopify plan to the account; null if not Shopify-billed. */
export async function syncShopifyBilling(userId: string, hint?: string | null): Promise<string | null> {
  const sub = await prisma.userSubscription.findUnique({ where: { user_id: userId } })
  if (!sub || sub.billing_provider !== "shopify" || !sub.shopify_shop_domain) return null

  let shopGid = sub.shopify_shop_gid
  if (!shopGid) {
    shopGid = await lookupShopGid(sub.shopify_shop_domain)
    if (!shopGid) return null
    await prisma.userSubscription.update({ where: { user_id: userId }, data: { shopify_shop_gid: shopGid } })
  }

  const active = await fetchActiveSubscription(shopGid)
  if (!active) {
    await setBasic({ user_id: userId })
    return "basic"
  }

  const planName = await resolvePlanName(active, hint)
  const plan = await planByName(planName)
  const trialing = !!active.trialEndsAt && new Date(active.trialEndsAt).getTime() > Date.now()
  const end = active.currentBillingCycle?.endTime ?? active.trialEndsAt
  await prisma.userSubscription.update({
    where: { user_id: userId },
    data: {
      plan_id: plan.id,
      status: trialing ? "trialing" : "active",
      billing_cycle: /ANNUAL|YEAR/i.test(active.billingPeriod) ? "yearly" : "monthly",
      current_period_start: active.currentBillingCycle ? new Date(active.currentBillingCycle.startTime) : new Date(),
      current_period_end: planName === "basic" || !end ? null : new Date(new Date(end).getTime() + PERIOD_GRACE_MS),
      ended_at: null,
      shopify_synced_at: new Date(),
    },
  })
  await syncBrandActivityWithSubscription(userId)
  return planName
}

export async function syncShopifyBillingForShop(shop: string, hint?: string | null) {
  const sub = await prisma.userSubscription.findFirst({
    where: { shopify_shop_domain: shop, billing_provider: "shopify" },
    select: { user_id: true },
  })
  if (!sub) return null
  const planName = await syncShopifyBilling(sub.user_id, hint)
  return { userId: sub.user_id, planName }
}

/** Throttled sync for request paths; never throws. */
export async function maybeSyncShopifyBilling(userId: string, maxAgeMs = 15 * 60 * 1000) {
  try {
    const sub = await prisma.userSubscription.findUnique({
      where: { user_id: userId },
      select: { billing_provider: true, shopify_synced_at: true },
    })
    if (sub?.billing_provider !== "shopify") return
    if (sub.shopify_synced_at && Date.now() - sub.shopify_synced_at.getTime() < maxAgeMs) return
    await syncShopifyBilling(userId)
  } catch (error) {
    console.error("[shopify-billing] lazy sync failed", error)
  }
}

export async function downgradeShopifyShop(shop: string) {
  await setBasic({ shopify_shop_domain: shop })
}

export async function syncAllShopifyBilling() {
  const subs = await prisma.userSubscription.findMany({
    where: { billing_provider: "shopify", shopify_shop_domain: { not: null } },
    select: { user_id: true },
  })
  const results: Record<string, string> = {}
  for (const { user_id } of subs) {
    try {
      results[user_id] = (await syncShopifyBilling(user_id)) ?? "skipped"
    } catch (error) {
      console.error(`[shopify-billing] sync failed for ${user_id}`, error)
      results[user_id] = "error"
    }
  }
  return results
}

export async function getBillingSource(userId: string): Promise<BillingSource> {
  const sub = await prisma.userSubscription.findUnique({
    where: { user_id: userId },
    select: { billing_provider: true, shopify_shop_domain: true },
  })
  const provider = sub?.billing_provider === "shopify" || sub?.billing_provider === "lemonsqueezy" ? sub.billing_provider : null
  const shopDomain = provider === "shopify" ? sub?.shopify_shop_domain ?? null : null
  return { provider, shopDomain, manageUrl: shopDomain ? shopifyPlanSelectionUrl(shopDomain) : null }
}

export async function isShopifyBilled(userId: string) {
  return (await getBillingSource(userId)).provider === "shopify"
}

/** 403 for Shopify-billed accounts on payment routes, else null. */
export async function shopifyBillingBlock(userId: string): Promise<NextResponse | null> {
  const source = await getBillingSource(userId)
  if (source.provider !== "shopify") return null
  return NextResponse.json(
    {
      error: "Your plan is billed through Shopify. Change it from Instroom in your Shopify admin.",
      billedBy: "shopify",
      manageUrl: source.manageUrl,
    },
    { status: 403 }
  )
}

export function shopifyUpgradeDestination(source: BillingSource) {
  return source.manageUrl ?? "/dashboard/settings/billing"
}

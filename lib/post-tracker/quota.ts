import "server-only"

// ─── Temporary testing quota ─────────────────────────────────────────────────
// Per-brand, per-day caps on provider requests and imported posts while the
// feature is in testing. Everything that spends quota goes through here.
//
// TO REMOVE THE TESTING LIMITS: replace the two constants below with values
// resolved from the brand's plan/add-on entitlement. No caller changes needed —
// consumeApiQuota()/consumePostQuota() keep the same signatures.

import { prisma } from "@/lib/prisma"

export const DAILY_API_REQUEST_LIMIT = 20
export const DAILY_POST_IMPORT_LIMIT = 20

export type QuotaSnapshot = {
  apiRequests: number
  apiLimit: number
  postsImported: number
  postLimit: number
  apiExhausted: boolean
  postsExhausted: boolean
  /** True when neither counter has room left — the UI's "limit reached" state. */
  exhausted: boolean
  /** UTC midnight tomorrow: when both counters reset. */
  resetsAt: Date
}

/** UTC midnight of today. Rows are keyed by this so "per day" is unambiguous
 *  across server timezones and deploy regions. */
function today(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function tomorrow(): Date {
  const d = today()
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

function snapshot(apiRequests: number, postsImported: number): QuotaSnapshot {
  const apiExhausted = apiRequests >= DAILY_API_REQUEST_LIMIT
  const postsExhausted = postsImported >= DAILY_POST_IMPORT_LIMIT
  return {
    apiRequests,
    apiLimit: DAILY_API_REQUEST_LIMIT,
    postsImported,
    postLimit: DAILY_POST_IMPORT_LIMIT,
    apiExhausted,
    postsExhausted,
    exhausted: apiExhausted && postsExhausted,
    resetsAt: tomorrow(),
  }
}

export async function getQuota(brandId: string): Promise<QuotaSnapshot> {
  const row = await prisma.postTrackerUsage.findUnique({
    where: { brand_id_usage_date: { brand_id: brandId, usage_date: today() } },
  })
  return snapshot(row?.api_requests ?? 0, row?.posts_imported ?? 0)
}

/**
 * Reserve `count` provider requests. Returns null when the cap is already hit,
 * which callers must treat as "stop", not "retry".
 *
 * The increment is a single atomic upsert so two concurrent monitor passes
 * cannot both read 19 and both proceed.
 */
export async function consumeApiQuota(brandId: string, count = 1): Promise<QuotaSnapshot | null> {
  const current = await getQuota(brandId)
  if (current.apiRequests + count > DAILY_API_REQUEST_LIMIT) return null

  const row = await prisma.postTrackerUsage.upsert({
    where: { brand_id_usage_date: { brand_id: brandId, usage_date: today() } },
    create: { brand_id: brandId, usage_date: today(), api_requests: count, posts_imported: 0 },
    update: { api_requests: { increment: count } },
  })
  return snapshot(row.api_requests, row.posts_imported)
}

/** Record post imports. Returns the updated snapshot. */
export async function consumePostQuota(brandId: string, count = 1): Promise<QuotaSnapshot> {
  const row = await prisma.postTrackerUsage.upsert({
    where: { brand_id_usage_date: { brand_id: brandId, usage_date: today() } },
    create: { brand_id: brandId, usage_date: today(), api_requests: 0, posts_imported: count },
    update: { posts_imported: { increment: count } },
  })
  return snapshot(row.api_requests, row.posts_imported)
}

/** How many more posts may be imported today. */
export function remainingPostImports(q: QuotaSnapshot): number {
  return Math.max(0, q.postLimit - q.postsImported)
}

/** How many more provider requests may be made today. */
export function remainingApiRequests(q: QuotaSnapshot): number {
  return Math.max(0, q.apiLimit - q.apiRequests)
}

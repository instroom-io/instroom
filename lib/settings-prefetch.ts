// lib/settings-prefetch.ts
//
// Warms every Settings section's cache entry the moment Settings is opened, so
// moving between sections renders from data that is already there instead of
// each section starting its own request on arrival.
//
// Same shape and the same reasoning as lib/dashboard-prefetch.ts: not a second
// cache, no new data layer. Every entry is written through lib/data-cache's own
// `fetchCached`, under the exact key the owning section already reads.
//
// Two properties of `fetchCached` are what remove the need to touch the
// sections themselves:
//
//   * in-flight dedupe — a section opened WHILE its prefetch is still running
//     joins that same promise rather than issuing a second request, which is
//     also what rules out a race between the two;
//   * TTL — a section reading a present, non-stale entry does no request at
//     all, and a stale one still revalidates exactly as it does today.

"use client"

import { fetchCached, hasCachedData, isStale, DEFAULT_TTL } from "@/lib/data-cache"

/** A prefetch entry: the cache key, and how to produce the value it holds. */
type PrefetchTask = { key: string; run: () => Promise<unknown> }

/** Read a JSON endpoint, failing loudly enough for the caller to skip it. */
async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} failed (${res.status})`)
  return await res.json()
}

/**
 * Never overwrite work in progress or a fresh entry.
 *
 * `fetchCached` covers the in-flight case itself; skipping a fresh entry here
 * makes a repeat call (a re-render, or navigating back into Settings) free.
 * A stale entry IS refreshed — the same stale-while-revalidate the sections
 * already rely on.
 */
function shouldFetch(key: string): boolean {
  return !hasCachedData(key) || isStale(key, DEFAULT_TTL)
}

/**
 * Start the fetch for every Settings section at once.
 *
 * `userId` keys the subscription entry (Billing builds its key from the session
 * user); `brandId` keys the brand-scoped sections. Either being absent simply
 * drops the entries that need it — the section still loads for itself, exactly
 * as it did before.
 *
 * Runs in parallel, settles independently, and reports nothing: this is
 * speculative work, and each section keeps its own loading and error state.
 */
export function prefetchSettings(
  userId: string | null | undefined,
  brandId: string | null | undefined
): void {
  const tasks: PrefetchTask[] = [
    // Profile — the two entries app/dashboard/settings/page.tsx reads.
    { key: "/api/settings/profile", run: () => getJson("/api/settings/profile") },
    { key: "/api/settings/preferences", run: () => getJson("/api/settings/preferences") },

    // Security
    { key: "/api/settings/security/2fa", run: () => getJson("/api/settings/security/2fa") },

    // Notifications
    { key: "/api/settings/notifications", run: () => getJson("/api/settings/notifications") },

    // Email Signature
    { key: "/api/settings/signature", run: () => getJson("/api/settings/signature") },

    // Branding — the gate its page checks before rendering the editor.
    { key: "/api/subscription/branding-access", run: () => getJson("/api/subscription/branding-access") },

    // Billing & Subscription
    { key: "/api/user/brand-usage", run: () => getJson("/api/user/brand-usage") },
    { key: "/api/subscription/payment-method", run: () => getJson("/api/subscription/payment-method") },
    { key: "/api/subscription/payment-history", run: () => getJson("/api/subscription/payment-history") },
  ]

  if (userId) {
    // Billing keys its subscription entry by user, so this one cannot be built
    // without the session (app/dashboard/settings/billing/page.tsx).
    const key = `/api/subscription/check?user=${userId}`
    tasks.push({ key, run: () => getJson("/api/subscription/check") })
  }

  if (brandId) {
    // Team & Collaborators — also read by the Branding section.
    tasks.push({
      key: `/api/brand/${brandId}/collaborators`,
      run: () => getJson(`/api/brand/${brandId}/collaborators`),
    })
    // Integrations
    tasks.push({
      key: `/api/settings/integrations?brandId=${brandId}`,
      run: () => getJson(`/api/settings/integrations?brandId=${encodeURIComponent(brandId)}`),
    })
  }

  for (const task of tasks) {
    if (!shouldFetch(task.key)) continue
    // Swallowed on purpose: the section that owns the entry reports its own
    // failure when it is actually opened.
    void fetchCached(task.key, task.run).catch(() => {})
  }
}

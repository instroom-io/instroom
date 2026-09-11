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
 * Which cache keys the section at `pathname` fetches for itself on mount.
 *
 * Prefetching these is worse than useless: the section issues its own request
 * the moment it mounts, so the speculative copy only competes with it for one
 * of the browser's ~6 connections per origin. With every section prefetched at
 * once that is up to 12 requests in flight, and on a remote database where a
 * single round trip is ~500ms, the page's OWN data ends up queued behind
 * speculative work for sections the user may never open.
 *
 * So the active section is skipped here and left to fetch for itself, and
 * everything else is deferred until the browser is idle (see below).
 */
function keysOwnedByRoute(
  pathname: string,
  userId: string | null | undefined,
  brandId: string | null | undefined
): string[] {
  // Longest-prefix first: "/settings" is a prefix of every other route.
  if (pathname.includes("/settings/security"))      return ["/api/settings/security/2fa"]
  if (pathname.includes("/settings/notifications")) return ["/api/settings/notifications"]
  if (pathname.includes("/settings/signature"))     return ["/api/settings/signature"]
  if (pathname.includes("/settings/branding"))      return [
    "/api/subscription/branding-access",
    ...(brandId ? [`/api/brand/${brandId}/collaborators`] : []),
  ]
  if (pathname.includes("/settings/collaborators")) return brandId ? [`/api/brand/${brandId}/collaborators`] : []
  if (pathname.includes("/settings/integrations"))  return brandId ? [`/api/settings/integrations?brandId=${brandId}`] : []
  if (pathname.includes("/settings/billing"))       return [
    "/api/user/brand-usage",
    "/api/subscription/payment-method",
    "/api/subscription/payment-history",
    ...(userId ? [`/api/subscription/check?user=${userId}`] : []),
  ]
  // The Settings index is the Profile section.
  return ["/api/settings/profile", "/api/settings/preferences"]
}

/**
 * Run `fn` once the browser has spare time, so speculative work never competes
 * with the current page's own requests or its first paint.
 *
 * requestIdleCallback where it exists; a short timeout elsewhere (Safari).
 * Returns a canceller so a navigation that happens first can drop the work.
 */
function whenIdle(fn: () => void): () => void {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }
  if (typeof w.requestIdleCallback === "function") {
    const handle = w.requestIdleCallback(fn, { timeout: 3000 })
    return () => w.cancelIdleCallback?.(handle)
  }
  const handle = window.setTimeout(fn, 1200)
  return () => window.clearTimeout(handle)
}

/**
 * Warm the OTHER Settings sections, so moving between them renders from cache.
 *
 * `userId` keys the subscription entry (Billing builds its key from the session
 * user); `brandId` keys the brand-scoped sections. Either being absent simply
 * drops the entries that need it — the section still loads for itself, exactly
 * as it did before.
 *
 * Two rules keep this from slowing down the page it is supposed to help:
 *
 *   * the section the user is actually ON is never prefetched (it fetches for
 *     itself, and a duplicate would only take a connection from it);
 *   * everything else waits for browser idle, so the current page's requests
 *     and first paint go first.
 *
 * Settles independently and reports nothing: this is speculative work, and each
 * section keeps its own loading and error state. Returns a canceller so the
 * caller can drop pending work when the route changes or it unmounts.
 */
export function prefetchSettings(
  userId: string | null | undefined,
  brandId: string | null | undefined,
  pathname: string
): () => void {
  const owned = new Set(keysOwnedByRoute(pathname, userId, brandId))

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
    // without the session (app/dashboard/settings/billing/page.tsx). Unlike
    // every other task here, this endpoint takes POST + a body, not GET —
    // using getJson() (a plain GET) always 405s. Because fetchCached dedupes
    // by key, a real page-load racing this in-flight (failing) request would
    // join it and inherit the 405 instead of firing its own correct POST, so
    // this one MUST mirror the exact request the billing page itself makes.
    const key = `/api/subscription/check?user=${userId}`
    tasks.push({
      key,
      run: async () => {
        const res = await fetch("/api/subscription/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        })
        if (!res.ok) throw new Error(`/api/subscription/check failed (${res.status})`)
        return res.json()
      },
    })
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

  // Decided now (cheap, synchronous) but RUN at idle, so the current section's
  // own requests and first paint are never queued behind speculative ones.
  const pending = tasks.filter((task) => !owned.has(task.key) && shouldFetch(task.key))
  if (pending.length === 0) return () => {}

  return whenIdle(() => {
    for (const task of pending) {
      // Re-checked at run time: the user may have navigated during the idle
      // wait, and that section will have started its own request.
      if (!shouldFetch(task.key)) continue
      // Swallowed on purpose: the section that owns the entry reports its own
      // failure when it is actually opened.
      void fetchCached(task.key, task.run).catch(() => {})
    }
  })
}

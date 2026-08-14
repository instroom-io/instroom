// NOTE: this file must live at the project root (or src/ root) for Next.js
// to actually run it as middleware. It previously lived at app/middleware.ts,
// a location Next.js does not recognize — meaning the /dashboard and
// /onboarding protection below was never executing. Moved here as part of
// wiring up /admin protection, since both rely on the same mechanism.

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"

const ADMIN_EMAIL = "admin@instroom.io"

// ─── In-Memory Cache for Subscription Status ───────────────────────────────
// Prevents database query on every page load. TTL: 5 minutes.
const subscriptionCache = new Map<string, { valid: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedSubscription(userId: string): boolean | null {
  const cached = subscriptionCache.get(userId);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    subscriptionCache.delete(userId);
    return null;
  }

  return cached.valid;
}

function setCachedSubscription(userId: string, valid: boolean) {
  subscriptionCache.set(userId, { valid, timestamp: Date.now() });
}

// ─── Subscription resolution ───────────────────────────────────────────────
// A team member (manager/researcher/viewer) never has a UserSubscription of
// their own — entitlement always flows from the brand owner's plan.
async function checkSubscriptionAccess(userId: string, brandId: string | null): Promise<boolean> {
  // A specific brand is selected in the URL — resolve via that brand's owner.
  if (brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { owner_id: true },
    });

    if (brand) {
      const isOwner = brand.owner_id === userId;
      const isMember = isOwner
        ? true
        : !!(await prisma.brandMember.findFirst({
            where: { brand_id: brandId, user_id: userId },
          }));

      if (isMember) {
        const ownerSub = await prisma.userSubscription.findFirst({
          where: { user_id: brand.owner_id, status: { in: ["active", "trialing"] } },
        });
        return !!ownerSub;
      }
    }
    // Unknown brand or not a member of it — fall through to the general check.
  }

  // No brand selected yet (e.g. right after login, before landing on a
  // specific workspace URL) — allow through if the user has their own active
  // plan, or is a member of ANY brand whose owner does.
  const ownSub = await prisma.userSubscription.findFirst({
    where: { user_id: userId, status: { in: ["active", "trialing"] } },
  });
  if (ownSub) return true;

  const memberships = await prisma.brandMember.findMany({
    where: { user_id: userId },
    select: { brand: { select: { owner_id: true } } },
  });
  const ownerIds = memberships.map((m) => m.brand.owner_id);
  if (ownerIds.length === 0) return false;

  const ownerSub = await prisma.userSubscription.findFirst({
    where: { user_id: { in: ownerIds }, status: { in: ["active", "trialing"] } },
  });
  return !!ownerSub;
}

/**
 * Send an unauthenticated visitor to the login page, remembering where they
 * were going so they can be returned there after signing in.
 *
 * Only the path-and-query is carried, never an absolute URL: echoing a
 * caller-supplied absolute URL back into a redirect is how a login page becomes
 * an open redirect onto someone else's domain.
 */
function redirectToLogin(req: NextRequest) {
  const login = new URL("/login", req.url);
  const intended = req.nextUrl.pathname + req.nextUrl.search;
  if (intended && intended !== "/") login.searchParams.set("callbackUrl", intended);
  return NextResponse.redirect(login);
}

export async function middleware(req: any) {
  const { pathname, searchParams } = req.nextUrl;

  // ─── Admin Dashboard — gated to the mock admin account only ──────────────
  // Checked first and independently of the subscription logic below: the
  // admin account has no brand/subscription of its own and must never be
  // routed through that check.
  if (pathname.startsWith("/admin")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const isAdmin = !!token && (token.platform_role === "admin" || token.email === ADMIN_EMAIL);
    if (!isAdmin) {
      // Signed in but not an admin is a permissions answer, not a login
      // prompt — sending them to /login would loop them straight back here.
      return token ? NextResponse.redirect(new URL("/dashboard", req.url)) : redirectToLogin(req);
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/dashboard") ||
    // /settings/account renders account and billing data and reads the session
    // client-side, but sat outside the matcher entirely — so it was served to
    // anyone who typed the URL, and only failed once its client fetches 401'd.
    pathname.startsWith("/settings")
  ) {
    // getToken verifies the JWT signature AND its exp claim, so a session past
    // the 7-day deadline fails here with no extra check needed.
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !token.sub) {
      return redirectToLogin(req);
    }

    // Onboarding happens BEFORE a subscription necessarily exists — a
    // brand-new signup has no plan yet, and onboarding's own page already
    // checks subscription status itself once setup is done, branching to
    // /pricing or /dashboard from there. Gating it here would intercept
    // every new user before they ever reach onboarding at all.
    if (pathname.startsWith("/onboarding")) {
      return NextResponse.next();
    }

    const brandId = searchParams.get("brandId");
    const cacheKey = brandId ? `${token.sub}:${brandId}` : token.sub;

    // Check cache first to avoid database hit
    const cachedResult = getCachedSubscription(cacheKey);
    if (cachedResult === true) {
      return NextResponse.next();
    }
    if (cachedResult === false) {
      return NextResponse.redirect(new URL("/pricing", req.url));
    }

    // Cache miss - resolve and cache result. Only cache a `true` result —
    // caching `false` for the full TTL would trap someone who just
    // subscribed (webhook delivery can take well over a minute) in a stale
    // denial for up to 5 minutes after their subscription is actually
    // active. A denied check is cheap and rare enough to just re-verify
    // against the DB every time instead.
    const hasValidSubscription = await checkSubscriptionAccess(token.sub, brandId);
    if (hasValidSubscription) {
      setCachedSubscription(cacheKey, true);
    }

    if (!hasValidSubscription) {
      return NextResponse.redirect(new URL("/pricing", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/onboarding/:path*", "/dashboard/:path*", "/admin/:path*", "/settings/:path*"],
  runtime: "nodejs",
};

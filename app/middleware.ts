import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

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

export async function middleware(req: any) {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname.startsWith("/onboarding") || pathname.startsWith("/dashboard")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !token.sub) {
      return NextResponse.redirect(new URL("/signin", req.url));
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

    // Cache miss - resolve and cache result
    const hasValidSubscription = await checkSubscriptionAccess(token.sub, brandId);
    setCachedSubscription(cacheKey, hasValidSubscription);

    if (!hasValidSubscription) {
      return NextResponse.redirect(new URL("/pricing", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/onboarding/:path*", "/dashboard/:path*"],
};
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

export async function middleware(req: any) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/onboarding") || pathname.startsWith("/dashboard")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !token.sub) {
      return NextResponse.redirect(new URL("/signin", req.url));
    }

    // Check cache first to avoid database hit
    const cachedResult = getCachedSubscription(token.sub);
    if (cachedResult === true) {
      return NextResponse.next();
    }
    if (cachedResult === false) {
      return NextResponse.redirect(new URL("/pricing", req.url));
    }

    // Cache miss - query database and cache result
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        user_id: token.sub,
        status: { in: ["active", "trialing"] },
      },
    });

    const hasValidSubscription = !!subscription;
    setCachedSubscription(token.sub, hasValidSubscription);

    if (!hasValidSubscription) {
      return NextResponse.redirect(new URL("/pricing", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/onboarding/:path*", "/dashboard/:path*"],
};
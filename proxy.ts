// Must live at the project root. Next 16 names it proxy.ts exporting proxy()
// (the old middleware.ts / middleware() convention is deprecated).

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { SESSION_COOKIE_NAME } from "@/lib/auth"

const ADMIN_EMAIL = "admin@instroom.io"

// No database here: the proxy runs near the visitor. The subscription check is
// in components/subscription-gate.tsx.

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

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── Admin Dashboard — gated to the mock admin account only ──────────────
  // Checked first and independently of the subscription logic below: the
  // admin account has no brand/subscription of its own and must never be
  // routed through that check.
  if (pathname.startsWith("/admin")) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      // Explicit, because getToken otherwise derives the cookie name from
      // NEXTAUTH_URL while lib/auth.ts writes it from NODE_ENV. When those two
      // disagree it looks for a cookie that does not exist and reports no
      // session — which sent a signed-in user to /login on any full document
      // load, i.e. every new tab. See SESSION_COOKIE_NAME.
      cookieName: SESSION_COOKIE_NAME,
    });
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
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      // Explicit, because getToken otherwise derives the cookie name from
      // NEXTAUTH_URL while lib/auth.ts writes it from NODE_ENV. When those two
      // disagree it looks for a cookie that does not exist and reports no
      // session — which sent a signed-in user to /login on any full document
      // load, i.e. every new tab. See SESSION_COOKIE_NAME.
      cookieName: SESSION_COOKIE_NAME,
    });
    if (!token || !token.sub) {
      return redirectToLogin(req);
    }
  }

  return NextResponse.next();
}

// No `runtime` export: Next 16 rejects route segment config in a Proxy file.
export const config = {
  matcher: ["/onboarding/:path*", "/dashboard/:path*", "/admin/:path*", "/settings/:path*"],
};

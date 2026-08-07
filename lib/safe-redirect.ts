// lib/safe-redirect.ts
//
// One rule, in one place: a redirect target that came from the URL is attacker
// input and may only ever be a path on this origin.
//
// The post-login "send me back where I was going" feature is the classic open
// redirect. `?callbackUrl=https://evil.example/login` renders a convincing
// phishing page on the far side of a real, trusted login — so every value that
// reaches a redirect has to pass through here first.

/** Where to go when the requested target is missing or refused. */
export const DEFAULT_AFTER_LOGIN = "/dashboard"

/**
 * Returns `candidate` if it is a safe same-origin path, else `fallback`.
 *
 * Rejected, and why:
 *   - anything not starting with "/"        — absolute URLs, `javascript:`
 *   - "//host" and "/\host"                 — protocol-relative; browsers read
 *                                             these as another origin
 *   - "/login", "/signup"                   — bouncing back to the login page
 *                                             after logging in is a loop
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN
): string {
  if (!candidate) return fallback

  const value = candidate.trim()
  if (!value.startsWith("/")) return fallback
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback

  // Compare the path alone, so "/login?foo" is caught too.
  const path = value.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/"
  if (path === "/login" || path === "/signup" || path.startsWith("/api/auth")) {
    return fallback
  }

  return value
}

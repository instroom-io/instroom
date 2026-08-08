// lib/app-url.ts
// The single source of truth for "what is this deployment's public base URL".
//
// Every absolute URL the app hands to a third party — OAuth redirect_uri values,
// links in emails, checkout return URLs — has to agree on one origin, or the
// third party rejects it. Building that string ad hoc in each route is how
// deployments end up with `https://localhost:3000` in one place and `undefined/`
// in another.
//
// Nothing here hardcodes an environment. Localhost is not a special case in the
// code; it is simply what `NEXTAUTH_URL=http://localhost:3000` in .env resolves
// to, exactly as it does today. Production resolves to whatever that same
// variable says on the production host (https://instroom.io). The only literal
// in this file is the development fallback used when no variable is set at all.

/** Development fallback, used only when nothing else is configured. */
const DEV_FALLBACK = "http://localhost:3000"

/** Trailing slashes break string comparison against a registered redirect URI. */
function normalise(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "")
  // Bare hosts (VERCEL_URL is given without a scheme) need one added.
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function fromEnv(): string | null {
  // Explicit configuration always wins, in order of specificity. NEXT_PUBLIC_
  // first so the same value can be read on the client when it needs to.
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL
  if (explicit) return normalise(explicit)

  // Vercel injects these. The production-domain variable is preferred so a
  // production deployment doesn't build links to its per-deployment hostname.
  const vercel =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
      : process.env.VERCEL_URL
  if (vercel) return normalise(vercel)

  return null
}

/** What request-derived origin looks like, without depending on Next's types. */
type RequestLike = { nextUrl: { protocol: string; host: string } } | { url: string }

function fromRequest(req: RequestLike | null | undefined): string | null {
  if (!req) return null
  try {
    if ("nextUrl" in req && req.nextUrl?.host) {
      return normalise(`${req.nextUrl.protocol}//${req.nextUrl.host}`)
    }
    if ("url" in req && req.url) return normalise(new URL(req.url).origin)
  } catch {
    /* malformed — fall through to the env/dev answer */
  }
  return null
}

/**
 * This deployment's public base URL, with no trailing slash.
 *
 * Pass the incoming request when one is available: it lets a deployment work
 * correctly on a hostname nobody configured (preview branches, a custom domain
 * added after deploy) instead of silently generating links to the wrong origin.
 * Environment configuration still takes precedence, because the request host is
 * client-controlled and must never be able to redirect an OAuth flow elsewhere.
 */
export function appBaseUrl(req?: RequestLike | null): string {
  const configured = fromEnv()
  if (configured) return configured

  const derived = fromRequest(req)
  if (derived) return derived

  if (process.env.NODE_ENV === "production") {
    // Loud, because every absolute URL this deployment emits will be wrong.
    console.error(
      "[app-url] No base URL configured. Set NEXT_PUBLIC_APP_URL (or APP_URL / NEXTAUTH_URL) " +
        "to this deployment's public origin, e.g. https://instroom.io."
    )
  }
  return DEV_FALLBACK
}

/** Joins a path onto the base URL. `path` must start with "/". */
export function appUrl(path: string, req?: RequestLike | null): string {
  return `${appBaseUrl(req)}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * Which source answered, for diagnostics. Kept separate from appBaseUrl so the
 * hot path stays a plain string return.
 */
export function appBaseUrlSource(req?: RequestLike | null): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return "NEXT_PUBLIC_APP_URL"
  if (process.env.APP_URL) return "APP_URL"
  if (process.env.NEXTAUTH_URL) return "NEXTAUTH_URL"
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return "VERCEL_PROJECT_PRODUCTION_URL"
  }
  if (process.env.VERCEL_URL) return "VERCEL_URL"
  if (fromRequest(req)) return "request host"
  return "development fallback"
}

// lib/microsoft-oauth.ts
// Shared configuration for the Outlook / Microsoft Graph OAuth flow used by
// app/api/outlook/*.
//
// ── Why this exists ──────────────────────────────────────────────────────────
// Every route read `process.env.MICROSOFT_CLIENT_ID!` directly. The `!` only
// silences TypeScript; at runtime an unset variable is `undefined`, and
// URLSearchParams stringifies that into the literal text "undefined". The
// production authorize URL therefore went out as
//
//     ...?client_id=undefined&redirect_uri=https://instroom.io/api/outlook/callback
//
// which Microsoft rejects with "unauthorized_client". Nothing failed loudly on
// our side: the redirect was built and served as if it were valid.
//
// Reading the credentials through one checked function means a missing variable
// is reported as a configuration error before any URL is built, and it is
// reported the same way in all four routes.
//
// The Azure tenant (`common`), the scopes and the callback path are unchanged
// from the original implementation — only how the values are read changed.

import { appUrl } from "@/lib/app-url"

/** Azure AD v2 endpoints. `common` = the multi-tenant authority, as before. */
export const MICROSOFT_AUTHORIZE_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
export const MICROSOFT_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token"

/** The OAuth callback path registered in the Azure App Registration. */
export const OUTLOOK_CALLBACK_PATH = "/api/outlook/callback"

/** Graph scopes requested at connect time. Unchanged. */
export const OUTLOOK_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
  "offline_access",
] as const

export type MicrosoftOAuthConfig = {
  clientId: string
  clientSecret: string
}

export type MicrosoftOAuthConfigResult =
  | { ok: true; config: MicrosoftOAuthConfig }
  | { ok: false; missing: string[] }

/**
 * Read and validate the Microsoft OAuth credentials.
 *
 * Returns the missing variable names rather than throwing, so each route can
 * fail in the way its own flow already fails (a redirect carrying
 * `?outlookError=`, or a JSON error) instead of surfacing a 500 stack trace.
 *
 * Whitespace-only values count as missing: a variable pasted into a dashboard
 * with a stray newline is indistinguishable from an unset one in effect, and it
 * would otherwise produce `client_id=%0A`.
 */
export function readMicrosoftOAuthConfig(): MicrosoftOAuthConfigResult {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim()
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim()

  const missing: string[] = []
  if (!clientId) missing.push("MICROSOFT_CLIENT_ID")
  if (!clientSecret) missing.push("MICROSOFT_CLIENT_SECRET")

  if (missing.length) return { ok: false, missing }
  return { ok: true, config: { clientId: clientId!, clientSecret: clientSecret! } }
}

/**
 * The absolute redirect_uri, which MUST be byte-identical at authorize time and
 * at token-exchange time or Microsoft rejects the exchange.
 *
 * Built through appUrl() — the project's single source of truth for this
 * deployment's public origin, already used by the Discord OAuth routes. It
 * resolves NEXTAUTH_URL first (so local development and any host that sets it
 * behave exactly as before) and can still fall back to the request origin,
 * which is what stops an unset variable from emitting
 * "undefined/api/outlook/callback".
 */
export function outlookRedirectUri(req?: Parameters<typeof appUrl>[1]): string {
  return appUrl(OUTLOOK_CALLBACK_PATH, req)
}

/**
 * One log line for a misconfigured deployment, naming the variables to set.
 * Logged server-side only — never returned to the browser, which has no
 * business knowing our configuration state.
 */
export function logMissingMicrosoftConfig(route: string, missing: string[]): void {
  console.error(
    `[outlook] ${route}: Microsoft OAuth is not configured — missing ${missing.join(", ")}. ` +
      `Set ${missing.join(" and ")} in this deployment's environment ` +
      `(Azure portal → App registrations → your app → Application (client) ID / Certificates & secrets).`
  )
}

/** The error code carried back to the inbox UI. Matches the existing style. */
export const OUTLOOK_NOT_CONFIGURED = "outlook_not_configured"

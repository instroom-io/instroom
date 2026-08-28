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
import { prisma } from "@/lib/prisma"

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

/**
 * Seconds of headroom before `expires_at` at which a token counts as expired.
 *
 * The check used to be `Date.now() > expires_at * 1000` — no margin at all. A
 * token with two seconds left therefore passed as valid, and by the time the
 * request reached Graph it had expired: Graph answered 401, the route reported
 * `reauth: true`, and the user was told to reconnect a mailbox whose grant was
 * perfectly good. Refreshing slightly early costs one token request and removes
 * that whole class of spurious disconnect. It also absorbs modest clock skew
 * between this host and Microsoft.
 */
export const TOKEN_EXPIRY_MARGIN_SECONDS = 60

/**
 * Has this token expired, counting the margin above? `null` means Microsoft did
 * not tell us, in which case it is treated as expired: attempting a refresh is
 * cheap and recoverable, whereas assuming validity guarantees a 401.
 */
export function isAccessTokenExpired(expiresAt: number | null | undefined): boolean {
  if (!expiresAt) return true
  return Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_MARGIN_SECONDS >= expiresAt
}

/**
 * Report WHY Microsoft refused a refresh.
 *
 * This existed nowhere. Both routes did `if (!res.ok || !data.access_token)
 * return null`, so every failure — a revoked grant, a rotated client secret, a
 * restriction on the user's Microsoft account — collapsed into the same silent
 * null and the same "Outlook session expired. Please reconnect your Outlook
 * account." The user reconnects, it fails again for the same unstated reason,
 * and nothing anywhere says what it is.
 *
 * A real example from this project's own data: the refresh was failing with
 *
 *   invalid_grant / error_codes [70000]
 *   AADSTS70000: User account is found to be in service abuse mode
 *
 * which is a restriction Microsoft placed on the END USER's account. No amount
 * of reconnecting fixes that, and no code change can either — but it is
 * actionable the moment somebody can read it.
 *
 * Server-side only; the AADSTS text can name the account and is not for the
 * browser. The user-facing message is unchanged.
 */
export function logMicrosoftRefreshFailure(
  route: string,
  status: number,
  data: unknown
): void {
  const body = (data ?? {}) as {
    error?: string
    error_codes?: number[]
    error_description?: string
  }
  // Kept whole rather than split at the first line break: Microsoft puts the
  // AADSTS code first and the Trace/Correlation IDs immediately after, and those
  // IDs are exactly what Microsoft support asks for. Truncated only so a long
  // response cannot dominate the log.
  const description = (body.error_description ?? "").trim().slice(0, 400)

  console.error(
    `[outlook] ${route}: refresh_token exchange rejected (HTTP ${status}) — ` +
      `${body.error ?? "unknown_error"}` +
      `${body.error_codes?.length ? ` codes=[${body.error_codes.join(",")}]` : ""}` +
      `${description ? ` — ${description}` : ""}`
  )
}

/** The error code carried back to the inbox UI. Matches the existing style. */
export const OUTLOOK_NOT_CONFIGURED = "outlook_not_configured"

// ── One shared token path ────────────────────────────────────────────────────
// /api/outlook/threads and /api/outlook/send each carried their own copy of the
// same refresh-and-persist logic. The copies drifted (the ordering fix and the
// update-by-id fix landed in one and not the other), so the two routes could
// resolve different mailboxes for the same user. Both now call through here, so
// there is exactly one place where an Outlook access token is obtained.
//
// The route-facing shape is a discriminated result rather than `string | null`,
// so a missing account, an expired grant and a misconfigured deployment stay
// distinguishable — each route already responds differently to those.


export type OutlookTokenResult =
  | { ok: true; accessToken: string; accountId: string; email: string | null }
  | { ok: false; reason: "no_account" | "refresh_failed" | "not_configured" }

/**
 * Exchange a refresh token and persist the new access token.
 *
 * Written to the single account row by `id` — never updateMany over
 * (userId, provider), which wrote one account's token onto every linked Outlook
 * account so all of them then authenticated as that one.
 */
export async function refreshOutlookAccessToken(
  refreshToken: string,
  accountId: string,
  route: string
): Promise<{ ok: true; accessToken: string } | { ok: false; reason: "refresh_failed" | "not_configured" }> {
  const configResult = readMicrosoftOAuthConfig()
  if (!configResult.ok) {
    logMissingMicrosoftConfig(`${route} token refresh`, configResult.missing)
    return { ok: false, reason: "not_configured" }
  }

  try {
    const res = await fetch(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configResult.config.clientId,
        client_secret: configResult.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.access_token) {
      logMicrosoftRefreshFailure(`${route} token refresh`, res.status, data)
      return { ok: false, reason: "refresh_failed" }
    }

    await prisma.account.update({
      where: { id: accountId },
      data: {
        access_token: data.access_token,
        expires_at: data.expires_in
          ? Math.floor(Date.now() / 1000) + data.expires_in
          : null,
        // Microsoft rotates the refresh token on most exchanges. The previous
        // code discarded it and kept writing the original, so once Microsoft
        // retired that one the mailbox went dead and only a full reconnect
        // brought it back. Only overwritten when one is actually returned.
        ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
      },
    })

    return { ok: true, accessToken: data.access_token }
  } catch (err) {
    console.error(
      `[outlook] ${route} token refresh: network error contacting Microsoft —`,
      err instanceof Error ? err.message : err
    )
    return { ok: false, reason: "refresh_failed" }
  }
}

/**
 * Resolve the access token for this user's currently selected Outlook account,
 * refreshing it first if it has expired.
 *
 * Ordering is [last_selected_at desc, id desc] — the same rule lib/gmail.ts
 * uses — so the threads route, the send route and the account switcher all
 * agree on which mailbox is "the" mailbox.
 */
export async function getOutlookAccessToken(
  userId: string,
  route: string,
  // Explicit account, as sent by the inbox's account switcher.
  //
  // Without this the route inferred the mailbox from [last_selected_at desc],
  // which is correct only if no other request is racing it. With two Outlook
  // accounts connected, a thread fetch already in flight when the user switched
  // — or a reply composed in a second tab — resolved whichever row happened to
  // be newest at that instant, so the inbox could render or send from the
  // account the user had just switched away from.
  //
  // Always scoped to `userId` and `provider: "microsoft"`, so a caller cannot
  // name someone else's mailbox or a NextAuth login row. An id that does not
  // match is `no_account` rather than a silent fall back to a different
  // mailbox: quietly reading the wrong inbox is worse than an error.
  //
  // Omitted (Gmail-style callers, older clients) keeps the previous ordering
  // behaviour exactly.
  accountId?: string | null
): Promise<OutlookTokenResult> {
  const account = accountId
    ? await prisma.account.findFirst({
        where: { id: accountId, userId, provider: "microsoft" },
        select: {
          id: true,
          email: true,
          access_token: true,
          refresh_token: true,
          expires_at: true,
        },
      })
    : await prisma.account.findFirst({
        where: { userId, provider: "microsoft" },
        select: {
          id: true,
          email: true,
          access_token: true,
          refresh_token: true,
          expires_at: true,
        },
        orderBy: [{ last_selected_at: "desc" }, { id: "desc" }],
      })

  if (accountId && !account) {
    console.error(
      `[outlook] ${route}: requested account ${accountId} is not a Microsoft mailbox belonging to this user.`
    )
    return { ok: false, reason: "no_account" }
  }

  if (!account?.access_token) return { ok: false, reason: "no_account" }

  if (isAccessTokenExpired(account.expires_at)) {
    if (!account.refresh_token) {
      console.error(
        `[outlook] ${route}: access token for account ${account.id} has expired and no ` +
          `refresh_token is stored — the grant was created without offline_access. Reconnect required.`
      )
      return { ok: false, reason: "refresh_failed" }
    }
    const refreshed = await refreshOutlookAccessToken(account.refresh_token, account.id, route)
    if (!refreshed.ok) return { ok: false, reason: refreshed.reason }
    return {
      ok: true,
      accessToken: refreshed.accessToken,
      accountId: account.id,
      email: account.email,
    }
  }

  return {
    ok: true,
    accessToken: account.access_token,
    accountId: account.id,
    email: account.email,
  }
}

/**
 * Force a refresh for an account whose token Graph rejected with 401 even
 * though `expires_at` said it was still valid — which happens when the token
 * was revoked server-side, or when this host's clock is behind Microsoft's.
 * Without this the user was told to reconnect a mailbox that only needed a new
 * access token.
 */
export async function forceRefreshOutlookAccessToken(
  userId: string,
  accountId: string,
  route: string
): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, provider: "microsoft" },
    select: { id: true, refresh_token: true },
  })
  if (!account?.refresh_token) return null
  const refreshed = await refreshOutlookAccessToken(account.refresh_token, account.id, route)
  return refreshed.ok ? refreshed.accessToken : null
}

/**
 * The user-facing message for a failed token resolution. Deliberately says
 * nothing about our configuration state — a browser has no business learning
 * which environment variable a deployment is missing — while the matching
 * server log (above) names it precisely.
 */
export function outlookTokenErrorMessage(
  reason: "no_account" | "refresh_failed" | "not_configured"
): string {
  switch (reason) {
    case "no_account":
      return "No Outlook account linked. Please connect your Outlook account."
    case "not_configured":
      return "Outlook is not available on this deployment. Please contact support."
    case "refresh_failed":
      return "Outlook session expired. Please reconnect your Outlook account."
  }
}

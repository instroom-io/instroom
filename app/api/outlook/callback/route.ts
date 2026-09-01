import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, SESSION_COOKIE_NAME } from "@/lib/auth"
import { appBaseUrl, appBaseUrlSource } from "@/lib/app-url"
import { prisma } from "@/lib/prisma"
import {
  MICROSOFT_TOKEN_URL,
  OUTLOOK_NOT_CONFIGURED,
  logMissingMicrosoftConfig,
  outlookRedirectUri,
  readMicrosoftOAuthConfig,
} from "@/lib/microsoft-oauth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const stateParam = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    console.error(
      `[outlook] callback: Microsoft returned an error — ${error}: ` +
        `${(searchParams.get("error_description") || "").slice(0, 300)}`
    )
    return NextResponse.redirect(
      new URL(`/dashboard/inbox?outlookError=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/dashboard/inbox?outlookError=missing_params", req.url)
    )
  }

  let userId: string
  let returnTo: string = "/dashboard/inbox"

  try {
    const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf-8"))
    userId = decoded.userId
    returnTo = decoded.returnTo || "/dashboard/inbox"
  } catch {
    console.error(
      "[outlook] callback: invalid_state — the state parameter did not decode as " +
        "base64url JSON. It is built by /api/outlook/connect and passed through " +
        "Microsoft untouched, so a failure here means it was truncated or rewritten in transit."
    )
    return NextResponse.redirect(
      new URL("/dashboard/inbox?outlookError=invalid_state", req.url)
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.id !== userId) {
    // The ONLY exit in this route that logged nothing, while collapsing three
    // unrelated failures into one identical URL:
    //
    //   no session   the session cookie did not arrive on this hop at all —
    //                a cross-site top-level GET back from Microsoft. Points at
    //                cookie delivery: a different host than the one that set it
    //                (www vs apex, http vs https), or a browser withholding it.
    //   wrong user   a cookie arrived, but for a DIFFERENT user than the one
    //                who started the flow — a second account signed in, or a
    //                stale tab.
    //   expired      a cookie arrived and could not be decoded or had lapsed.
    //
    // Nothing here is user-controlled output — it is a server log. The session
    // check itself is unchanged: the same condition still fails the same way.
    const cookieHeader = req.headers.get("cookie") ?? ""
    const sessionCookiePresent = cookieHeader.includes(SESSION_COOKIE_NAME)
    const cause = !sessionCookiePresent
      ? "no session cookie was sent on the callback request"
      : !session?.user?.id
        ? "a session cookie was sent but resolved to no session (expired, or signed with a different NEXTAUTH_SECRET)"
        : "the session belongs to a different user than the one who started the flow"

    console.error(
      `[outlook] callback: session_mismatch — ${cause}. ` +
        `callback host=${req.nextUrl.host} proto=${req.nextUrl.protocol.replace(":", "")} ` +
        `configured origin=${appBaseUrl(req)} (from ${appBaseUrlSource(req)}) ` +
        `expected cookie=${SESSION_COOKIE_NAME} present=${sessionCookiePresent} ` +
        `state.userId=${userId} session.userId=${session?.user?.id ?? "none"}. ` +
        `If host differs from the configured origin, the browser is on a different ` +
        `hostname than the one that set the cookie and it can never be sent here.`
    )
    return NextResponse.redirect(
      new URL("/login?outlookError=session_mismatch", req.url)
    )
  }

  // Same guard as /connect: without credentials the exchange would post
  // client_id=undefined and fail with an unrelated-looking error.
  const configResult = readMicrosoftOAuthConfig()
  if (!configResult.ok) {
    logMissingMicrosoftConfig("callback", configResult.missing)
    return NextResponse.redirect(
      new URL(`/dashboard/inbox?outlookError=${OUTLOOK_NOT_CONFIGURED}`, req.url)
    )
  }

  let accessToken: string
  let refreshToken: string | null
  let expiresAt: number | null
  let microsoftAccountId: string
  let microsoftEmail: string | null
  let scope: string

  // Must be byte-identical to the one /connect sent, or Microsoft refuses the
  // exchange with redirect_uri_mismatch. Both come from the same helper.
  const redirectUri = outlookRedirectUri(req)

  try {
    const tokenRes = await fetch(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: configResult.config.clientId,
        client_secret: configResult.config.clientSecret,
        // Built by the same helper /connect used, so the two strings are
        // identical — Microsoft rejects the exchange if they differ at all.
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      // Server-side detail: the AADSTS code names the actual cause
      // (redirect_uri_mismatch, invalid_client after a secret rotation, …),
      // which the redirect below cannot usefully carry. No secret is logged.
      console.error(
        `[outlook] callback: authorization_code exchange rejected (HTTP ${tokenRes.status}) — ` +
          `${tokenData?.error ?? "unknown_error"}` +
          `${tokenData?.error_codes?.length ? ` codes=[${tokenData.error_codes.join(",")}]` : ""} — ` +
          `${String(tokenData?.error_description ?? "").slice(0, 400)}. ` +
          `redirect_uri sent was ${redirectUri} (must be registered verbatim in Microsoft Entra).`
      )
      return NextResponse.redirect(
        new URL(
          `/dashboard/inbox?outlookError=${encodeURIComponent(tokenData.error_description || "token_exchange_failed")}`,
          req.url
        )
      )
    }

    accessToken = tokenData.access_token
    refreshToken = tokenData.refresh_token || null
    scope = tokenData.scope || ""
    if (!refreshToken) {
      // Without one the mailbox dies as soon as the access token expires and
      // only a manual reconnect revives it. Means offline_access was not
      // granted — usually removed from the app registration's permissions.
      console.error(
        "[outlook] callback: Microsoft returned no refresh_token — check that the " +
          "offline_access scope is granted for this app registration."
      )
    }
    expiresAt = tokenData.expires_in
      ? Math.floor(Date.now() / 1000) + tokenData.expires_in
      : null

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const profile = await profileRes.json()
    microsoftAccountId = profile.id
    // Graph returns `mail` for a mailbox-backed account and falls back to
    // userPrincipalName otherwise. No extra request — same response.
    microsoftEmail = profile.mail || profile.userPrincipalName || null
  } catch (err) {
    console.error(
      "[outlook] callback: network error contacting Microsoft/Graph —",
      err instanceof Error ? err.message : err
    )
    return NextResponse.redirect(
      new URL("/dashboard/inbox?outlookError=network_error", req.url)
    )
  }

  try {
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "microsoft",
          providerAccountId: microsoftAccountId,
        },
      },
      create: {
        userId,
        type: "oauth",
        provider: "microsoft",
        providerAccountId: microsoftAccountId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        token_type: "Bearer",
        scope,
        id_token: null,
        email: microsoftEmail,
        last_selected_at: new Date(),
      },
      update: {
        userId,
        access_token: accessToken,
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
        expires_at: expiresAt,
        scope,
        email: microsoftEmail,
        // Same rule the Gmail callback documents: a deliberate connect or
        // reconnect makes THIS account the selected one again.
        last_selected_at: new Date(),
      },
    })
  } catch (err) {
    console.error(
      "[outlook] callback: failed to persist the Outlook account —",
      err instanceof Error ? err.message : err
    )
    return NextResponse.redirect(
      new URL("/dashboard/inbox?outlookError=db_error", req.url)
    )
  }

  // ── Done — redirect back to inbox ─────────────────────────────────────────
  // Built via URL/searchParams rather than string concatenation, for the same
  // reason the Gmail callback documents: returnTo already carries
  // `?brandId=...` once a workspace is selected, so appending
  // `?outlookConnected=1` produced a second `?`
  // (…brandId=X?outlookConnected=1). brandId then parsed as
  // "X?outlookConnected=1" and there was no outlookConnected param at all —
  // the page fell back to "no workspace selected", which also fails the
  // brand-scoped subscription check and renders the locked overlay.
  const successUrl = new URL(returnTo, req.url)
  successUrl.searchParams.set("outlookConnected", "1")
  return NextResponse.redirect(successUrl)
}

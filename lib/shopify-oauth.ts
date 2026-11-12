import crypto from "crypto"
import { encrypt, decrypt } from "@/lib/crypto"

// Must match [access_scopes] in shopify.app.toml.
export const SHOPIFY_SCOPES =
  "read_products,read_orders,write_orders,read_draft_orders,write_draft_orders,read_discounts"

export function getClientId() {
  const id = process.env.SHOPIFY_CLIENT_ID
  if (!id) throw new Error("SHOPIFY_CLIENT_ID is not configured")
  return id
}

export function getClientSecret() {
  const secret = process.env.SHOPIFY_CLIENT_SECRET
  if (!secret) throw new Error("SHOPIFY_CLIENT_SECRET is not configured")
  return secret
}

// Webhooks are signed with the client secret.
export function getShopifyWebhookSecret() {
  return getClientSecret()
}

export function verifyShopifyWebhook(rawBody: string, signature: string | null) {
  if (!signature) return false
  const expected = crypto.createHmac("sha256", getShopifyWebhookSecret()).update(rawBody).digest("base64")
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export function isValidShopDomain(shop: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)
}

/** Access token lasts 1 hour; refresh token 90 days. */
export type ShopifyTokens = {
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: Date | null
  refreshTokenExpiresAt: Date | null
}

const secondsFromNow = (seconds: unknown) => {
  const n = Number(seconds)
  return n > 0 ? new Date(Date.now() + n * 1000) : null
}

function tokensFrom(json: Record<string, unknown>): ShopifyTokens {
  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string | undefined) ?? null,
    accessTokenExpiresAt: secondsFromNow(json.expires_in),
    refreshTokenExpiresAt: secondsFromNow(json.refresh_token_expires_in),
  }
}

/** ID token → expiring offline token. */
export async function exchangeShopifyIdToken(
  shop: string,
  idToken: string
): Promise<{ ok: true; tokens: ShopifyTokens; grantedScope: string } | { ok: false; reason: "invalid_id_token" | "failed" }> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      expiring: "1",
    }),
    signal: AbortSignal.timeout(30_000),
  })
  // 400: stale ID token.
  if (res.status === 400) return { ok: false, reason: "invalid_id_token" }
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.access_token) return { ok: false, reason: "failed" }
  return { ok: true, tokens: tokensFrom(json), grantedScope: (json.scope as string | undefined) ?? "" }
}

const LINK_TICKET_MAX_AGE_MS = 30 * 60 * 1000

export function createShopifyLinkTicket(shop: string) {
  return encrypt(JSON.stringify({ shop, ts: Date.now() }))
}

/** Valid for 30 minutes. */
export function decodeShopifyLinkTicket(ticket: string): string | null {
  try {
    const parsed = JSON.parse(decrypt(ticket)) as { shop?: unknown; ts?: unknown }
    if (typeof parsed.shop !== "string" || !isValidShopDomain(parsed.shop) || typeof parsed.ts !== "number") return null
    if (Date.now() - parsed.ts > LINK_TICKET_MAX_AGE_MS) return null
    return parsed.shop
  } catch {
    return null
  }
}

/** reauthorize: must reconnect. retry: Shopify busy or unreachable. */
export async function refreshShopifyToken(
  shop: string,
  refreshToken: string
): Promise<{ ok: true; tokens: ShopifyTokens } | { ok: false; reason: "reauthorize" | "retry" | "failed" }> {
  let res: Response
  try {
    res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: getClientId(),
        client_secret: getClientSecret(),
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    return { ok: false, reason: "retry" }
  }
  if (res.status === 401) return { ok: false, reason: "reauthorize" }
  if (res.status === 429 || res.status >= 500) return { ok: false, reason: "retry" }
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.access_token) return { ok: false, reason: "failed" }
  return { ok: true, tokens: tokensFrom(json) }
}

/** A granted write_x covers read_x. */
export function missingShopifyScopes(grantedScope: string): string[] {
  const granted = new Set(grantedScope.split(",").map((s) => s.trim()).filter(Boolean))
  return SHOPIFY_SCOPES.split(",").filter(
    (scope) => !granted.has(scope) && !(scope.startsWith("read_") && granted.has(`write_${scope.slice(5)}`))
  )
}

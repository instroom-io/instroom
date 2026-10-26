import crypto from "crypto"
import { encrypt, decrypt } from "@/lib/crypto"

// Kept in sync with the scopes configured on the shared Instroom app in
// Shopify's Dev Dashboard (Settings → API access). Every brand authorizes
// the SAME app via OAuth; only the resulting per-shop access token differs.
// `read_discounts` replaces the legacy `read_price_rules` now that discount
// code lookups go through the GraphQL Admin API's codeDiscountNodeByCode
// instead of the old REST price_rules/discount_codes endpoints — brands
// connected before this change was shipped need to reconnect to pick up
// the new scope (existing tokens don't retroactively gain it).
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

// Also used to verify webhook HMACs — Shopify's newer app model signs both
// OAuth callbacks and webhooks with the app's single Client Secret, there is
// no separate per-install webhook signing secret anymore.
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

export const SHOPIFY_NONCE_COOKIE = "shopify_oauth_nonce"
export const SHOPIFY_STATE_MAX_AGE_SECONDS = 10 * 60

type ShopifyState = { brandId: string; shop: string; userId: string; nonce: string; ts: number }

/** Also returns the nonce for SHOPIFY_NONCE_COOKIE. */
export function buildShopifyInstallUrl(shop: string, redirectUri: string, brandId: string, userId: string) {
  const nonce = crypto.randomBytes(16).toString("hex")
  const state = encrypt(JSON.stringify({ brandId, shop, userId, nonce, ts: Date.now() } satisfies ShopifyState))
  const url = new URL(`https://${shop}/admin/oauth/authorize`)
  url.searchParams.set("client_id", getClientId())
  url.searchParams.set("scope", SHOPIFY_SCOPES)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("state", state)
  return { url: url.toString(), nonce }
}

/** Valid only for this shop, this browser's nonce, within 10 minutes. */
export function decodeShopifyState(state: string, shop: string, cookieNonce: string | undefined): ShopifyState | null {
  try {
    const parsed = JSON.parse(decrypt(state)) as Partial<ShopifyState>
    if (!parsed?.brandId || !parsed.userId || !parsed.nonce || typeof parsed.ts !== "number") return null
    if (parsed.shop !== shop) return null
    if (Date.now() - parsed.ts > SHOPIFY_STATE_MAX_AGE_SECONDS * 1000) return null
    if (!cookieNonce || cookieNonce.length !== parsed.nonce.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(cookieNonce), Buffer.from(parsed.nonce))) return null
    return parsed as ShopifyState
  } catch {
    return null
  }
}

// Verifies the query-string HMAC Shopify signs on every OAuth callback,
// per Shopify's documented algorithm: drop hmac/signature, sort the rest,
// join as key=value pairs with &, HMAC-SHA256 hex digest with the Client
// Secret, timing-safe compare.
export function verifyShopifyOAuthCallback(searchParams: URLSearchParams): boolean {
  const hmac = searchParams.get("hmac")
  if (!hmac) return false

  const params = new URLSearchParams(searchParams)
  params.delete("hmac")
  params.delete("signature")

  const message = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")

  const expected = crypto.createHmac("sha256", getClientSecret()).update(message).digest("hex")
  if (expected.length !== hmac.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmac))
}

export async function exchangeShopifyCodeForToken(shop: string, code: string): Promise<{ accessToken: string; grantedScope: string }> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: getClientId(), client_secret: getClientSecret(), code }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.access_token) {
    throw new Error(json?.error || "Failed to exchange Shopify authorization code")
  }
  return { accessToken: json.access_token as string, grantedScope: (json.scope as string | undefined) ?? "" }
}

/** A granted write_x covers read_x. */
export function missingShopifyScopes(grantedScope: string): string[] {
  const granted = new Set(grantedScope.split(",").map((s) => s.trim()).filter(Boolean))
  return SHOPIFY_SCOPES.split(",").filter(
    (scope) => !granted.has(scope) && !(scope.startsWith("read_") && granted.has(`write_${scope.slice(5)}`))
  )
}

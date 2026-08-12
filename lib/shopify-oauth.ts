import crypto from "crypto"
import { encrypt, decrypt } from "@/lib/crypto"

// Kept in sync with the six scopes configured on the shared Instroom app in
// Shopify's Dev Dashboard (Settings → API access). Every brand authorizes
// the SAME app via OAuth; only the resulting per-shop access token differs.
export const SHOPIFY_SCOPES =
  "read_products,read_orders,write_orders,read_draft_orders,write_draft_orders,read_price_rules"

function getClientId() {
  const id = process.env.SHOPIFY_CLIENT_ID
  if (!id) throw new Error("SHOPIFY_CLIENT_ID is not configured")
  return id
}

function getClientSecret() {
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

export function isValidShopDomain(shop: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)
}

export function buildShopifyInstallUrl(shop: string, redirectUri: string, brandId: string) {
  const state = encrypt(JSON.stringify({ brandId, ts: Date.now() }))
  const url = new URL(`https://${shop}/admin/oauth/authorize`)
  url.searchParams.set("client_id", getClientId())
  url.searchParams.set("scope", SHOPIFY_SCOPES)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("state", state)
  return url.toString()
}

export function decodeShopifyState(state: string): { brandId: string; ts: number } | null {
  try {
    const parsed = JSON.parse(decrypt(state))
    return parsed?.brandId ? parsed : null
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

export async function exchangeShopifyCodeForToken(shop: string, code: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: getClientId(), client_secret: getClientSecret(), code }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.access_token) {
    throw new Error(json?.error || "Failed to exchange Shopify authorization code")
  }
  return json.access_token as string
}

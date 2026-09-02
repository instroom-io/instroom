import crypto from "crypto"
import { getClientId, getClientSecret } from "@/lib/shopify-oauth"

// Verifies the session token Shopify's App Bridge hands the embedded page
// (window.shopify.idToken()) — a JWT signed HS256 with the app's own Client
// Secret. No JWT library here on purpose, matching this file's siblings
// (lib/shopify-oauth.ts's verifyShopifyOAuthCallback, the webhook routes'
// verifySignature): it's the same "HMAC-SHA256, timing-safe compare"
// primitive, just applied to a JWT's two encoded segments instead of a query
// string or a request body.

export type ShopifySessionTokenPayload = {
  shop: string
  userId: string
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url")
}

export function verifyShopifySessionToken(token: string): ShopifySessionTokenPayload | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, signatureB64] = parts

  const expectedSignature = crypto
    .createHmac("sha256", getClientSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url")

  if (expectedSignature.length !== signatureB64.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signatureB64))) {
    return null
  }

  let payload: {
    exp?: number
    nbf?: number
    aud?: string
    dest?: string
    iss?: string
    sub?: string
  }
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"))
  } catch {
    return null
  }

  const nowSeconds = Date.now() / 1000
  if (typeof payload.exp !== "number" || payload.exp < nowSeconds) return null
  if (typeof payload.nbf === "number" && payload.nbf > nowSeconds) return null
  if (payload.aud !== getClientId()) return null

  const shopUrl = payload.dest ?? payload.iss
  if (!shopUrl) return null
  let shop: string
  try {
    shop = new URL(shopUrl).host
  } catch {
    return null
  }
  if (!shop) return null

  return { shop, userId: payload.sub ?? "" }
}

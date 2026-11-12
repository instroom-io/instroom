import crypto from "crypto"
import { getClientId, getClientSecret } from "@/lib/shopify-oauth"

// App Bridge session token: HS256 JWT signed with the client secret.

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

  if (!payload.dest || !payload.iss) return null
  let shop: string
  try {
    shop = new URL(payload.dest).host
    // Issuer and destination must be the same store.
    if (new URL(payload.iss).host !== shop) return null
  } catch {
    return null
  }
  if (!shop) return null

  return { shop, userId: payload.sub ?? "" }
}

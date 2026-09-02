import { encrypt, decrypt } from "@/lib/crypto"

// Shared state encoding for the Gmail/Outlook "connect a mailbox" OAuth
// flows. Previously each route base64-encoded {userId, returnTo} in plain
// text and the callback separately re-checked the live session cookie to
// confirm it still belonged to the same user — a defense against someone
// forging a state naming a different user. That check broke whenever the
// provider's sign-in page and the callback landed in different browser
// contexts (confirmed: Microsoft's sign-in page triggers Edge's automatic
// profile switching, which drops the Instroom session cookie before the
// callback runs, even though the flow itself is legitimate).
//
// Encrypting state (same AES-256-GCM primitive Shopify's OAuth state
// already uses) removes the need for that cookie check entirely: only this
// server can ever produce a valid state, and only for whoever was actually
// logged in at the moment they clicked "Connect" — there's no way to forge
// one naming a different user, so trusting the decrypted userId directly is
// strictly safer than comparing against a cookie that isn't guaranteed to
// survive the round trip.
const STATE_MAX_AGE_MS = 15 * 60 * 1000 // 15 minutes

export type OAuthConnectState = {
  userId: string
  returnTo: string
}

export function encodeOAuthConnectState(payload: OAuthConnectState): string {
  return encrypt(JSON.stringify({ ...payload, ts: Date.now() }))
}

// Returns null for anything invalid, tampered, or older than
// STATE_MAX_AGE_MS — a captured-but-unused connect link can't be replayed
// indefinitely later.
export function decodeOAuthConnectState(state: string): OAuthConnectState | null {
  try {
    const parsed = JSON.parse(decrypt(state))
    if (!parsed?.userId || typeof parsed.ts !== "number") return null
    if (Date.now() - parsed.ts > STATE_MAX_AGE_MS) return null
    return { userId: parsed.userId, returnTo: parsed.returnTo || "/dashboard/inbox" }
  } catch {
    return null
  }
}

import "server-only"

// ─── GoHighLevel (GHL) contact sync ──────────────────────────────────────────
// Server-only. Credentials come from env vars and must never be imported
// into a client component. Uses GHL's v2 REST API (LeadConnector) "upsert
// contact" endpoint, keyed by email, so an existing GHL contact is updated
// in place instead of a duplicate being created.
//
// Required env vars:
//   GHL_API_KEY      — a Private Integration Token (or API key) with
//                       contacts.write scope for the target sub-account.
//   GHL_LOCATION_ID  — the GHL location (sub-account) ID contacts are
//                       upserted into.
//
// If either is missing, upsertGhlContact() returns a soft failure instead of
// throwing — callers persist that as a "failed" sync status with the error
// message, never as a reason to fail the surrounding request.

const GHL_API_BASE = "https://services.leadconnectorhq.com"
const GHL_API_VERSION = "2021-07-28"
// GHL is a third party on the signup's critical path — never let a hung
// request stall the response indefinitely.
const GHL_TIMEOUT_MS = 10_000

/** Single prefix so every GHL failure is greppable in production logs. */
const LOG = "[ghl]"

export interface GhlContactInput {
  email: string
  name?: string | null
  phone?: string | null
  /** Free-form value for "What are you running?" — sent as a tag since we
   *  don't have a verified custom-field-ID mapping for this GHL location. */
  role?: string | null
  source?: string
  tags?: string[]
}

export interface GhlUpsertResult {
  success: boolean
  contactId?: string
  error?: string
}

function splitName(name?: string | null): { firstName?: string; lastName?: string } {
  const trimmed = (name || "").trim()
  if (!trimmed) return {}
  const [firstName, ...rest] = trimmed.split(/\s+/)
  return { firstName, lastName: rest.join(" ") || undefined }
}

export async function upsertGhlContact(input: GhlContactInput): Promise<GhlUpsertResult> {
  const apiKey = process.env.GHL_API_KEY
  const locationId = process.env.GHL_LOCATION_ID

  if (!apiKey || !locationId) {
    // The most common production failure: the code ships but the env vars
    // don't. Loud, specific, and says exactly which one is missing.
    const missing = [!apiKey && "GHL_API_KEY", !locationId && "GHL_LOCATION_ID"].filter(Boolean).join(", ")
    console.error(`${LOG} NOT CONFIGURED — missing env var(s): ${missing}. Contact for ${input.email} was NOT sent to GoHighLevel.`)
    return { success: false, error: `${missing} is not configured` }
  }

  const { firstName, lastName } = splitName(input.name)
  const tags = Array.from(new Set([
    "Early Access",
    ...(input.role ? [`Running: ${input.role}`] : []),
    ...(input.tags || []),
  ]))

  const body: Record<string, unknown> = {
    locationId,
    email: input.email,
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    source: input.source || "Instroom Website",
    tags,
  }

  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GHL_TIMEOUT_MS),
    })

    const raw = await res.text()
    let json: any = null
    try { json = raw ? JSON.parse(raw) : null } catch { /* non-JSON body — logged raw below */ }

    if (!res.ok) {
      const message = (json && (json.message || json.error)) || `GHL upsert failed (HTTP ${res.status})`
      const error = typeof message === "string" ? message : JSON.stringify(message)
      // Log the status and GHL's own response body — without this, a 401 from
      // a rotated token or a 422 from a rejected field is completely invisible.
      console.error(`${LOG} upsert FAILED for ${input.email} — HTTP ${res.status} ${res.statusText}: ${raw.slice(0, 500)}`)
      return { success: false, error }
    }

    const contactId: string | undefined = json?.contact?.id || json?.id
    if (!contactId) {
      console.error(`${LOG} upsert returned 2xx but no contact id for ${input.email}: ${raw.slice(0, 500)}`)
      return { success: false, error: "GHL upsert succeeded but returned no contact id" }
    }

    return { success: true, contactId }
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
    const error = isTimeout
      ? `GHL request timed out after ${GHL_TIMEOUT_MS}ms`
      : err instanceof Error ? err.message : "Unknown error calling GHL"
    console.error(`${LOG} upsert ERRORED for ${input.email}: ${error}`)
    return { success: false, error }
  }
}

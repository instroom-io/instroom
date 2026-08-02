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
    return { success: false, error: "GHL_API_KEY or GHL_LOCATION_ID is not configured" }
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
    })

    const json = await res.json().catch(() => null)

    if (!res.ok) {
      const message = (json && (json.message || json.error)) || `GHL upsert failed (HTTP ${res.status})`
      return { success: false, error: typeof message === "string" ? message : JSON.stringify(message) }
    }

    const contactId: string | undefined = json?.contact?.id || json?.id
    if (!contactId) {
      return { success: false, error: "GHL upsert succeeded but returned no contact id" }
    }

    return { success: true, contactId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error calling GHL" }
  }
}

import "server-only"
// lib/discord/bot-client.ts
// Discord REST client authenticated with the bot token.
//
// The token is read from env and never leaves the server. Nothing in this file
// may be imported from a client component — `server-only` enforces that at
// build time.
//
// Rate limits are Discord's sharpest edge, so they are handled properly rather
// than hopefully:
//   • per-bucket state from X-RateLimit-Bucket / -Remaining / -Reset-After,
//     so a request waits BEFORE it would 429 rather than after
//   • the global limit is a separate gate that blocks every bucket
//   • 429 responses honour retry_after and re-queue, with a retry ceiling
//   • requests to the same bucket are serialised, so parallel callers can't
//     collectively blow a limit each thought it had headroom

const API = "https://discord.com/api/v10"
const TIMEOUT_MS = 10_000
/** Attachment uploads stream a body, so they get a longer ceiling. */
const UPLOAD_TIMEOUT_MS = 60_000
const MAX_RETRIES = 3
const LOG = "[discord:bot]"

export function getBotToken(): string | undefined {
  return process.env.DISCORD_BOT_TOKEN
}

/**
 * The bot token is the ONLY global Discord config.
 *
 * There is deliberately no getGuildId() here. Instroom is multi-tenant: each
 * brand connects its own server, so the guild ID always comes from
 * BrandDiscordConnection via getBrandGuildId(brandId). A global guild would
 * serve one tenant's Discord to every other tenant.
 */
export function isBotTokenConfigured(): boolean {
  return Boolean(getBotToken())
}

export type RestResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; code: DiscordRestErrorCode }

export type DiscordRestErrorCode =
  | "not_configured"
  | "unauthorized"      // bad/revoked bot token
  | "forbidden"         // bot lacks the permission or channel access
  | "not_found"
  | "rate_limited"
  | "network"
  | "unknown"

/** Per-bucket limiter state. */
type Bucket = { remaining: number; resetAt: number; queue: Promise<unknown> }
const buckets = new Map<string, Bucket>()
/** Route → bucket hash, learned from response headers. */
const routeBuckets = new Map<string, string>()
/** Global rate limit gate — blocks every request when Discord sets it. */
let globalResetAt = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)))

/**
 * Discord's buckets are keyed by "major parameter" — the same route on
 * different channels has independent limits, so the channel/guild id has to be
 * part of the key or unrelated channels would throttle each other.
 */
function routeKey(method: string, path: string): string {
  const major = path.match(/^\/(channels|guilds|webhooks)\/(\d+)/)
  return `${method} ${major ? `${major[1]}/${major[2]}` : path.split("?")[0]}`
}

async function waitForCapacity(key: string) {
  const now = Date.now()
  if (globalResetAt > now) await sleep(globalResetAt - now)

  const hash = routeBuckets.get(key)
  if (!hash) return
  const bucket = buckets.get(hash)
  if (!bucket) return
  // No requests left in this window — wait it out rather than earning a 429.
  if (bucket.remaining <= 0 && bucket.resetAt > Date.now()) {
    await sleep(bucket.resetAt - Date.now())
  }
}

function recordHeaders(key: string, res: Response) {
  const hash = res.headers.get("x-ratelimit-bucket")
  if (!hash) return
  routeBuckets.set(key, hash)
  const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "1")
  const resetAfter = Number(res.headers.get("x-ratelimit-reset-after") ?? "0")
  buckets.set(hash, {
    remaining: Number.isFinite(remaining) ? remaining : 1,
    resetAt: Date.now() + resetAfter * 1000,
    queue: Promise.resolve(),
  })
}

/**
 * `json` serialises a JSON body. `form` sends multipart instead — used for
 * attachments, where Discord wants `payload_json` plus `files[n]` parts. The
 * two are mutually exclusive; `form` wins if both are somehow passed.
 */
export async function discordRest<T>(
  path: string,
  init: RequestInit & { json?: unknown; form?: FormData } = {}
): Promise<RestResult<T>> {
  const token = getBotToken()
  if (!token) {
    console.error(`${LOG} DISCORD_BOT_TOKEN is not set — no Discord request was made.`)
    return { ok: false, status: 0, code: "not_configured", error: "Discord bot is not configured." }
  }

  const method = (init.method ?? "GET").toUpperCase()
  const key = routeKey(method, path)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await waitForCapacity(key)

    let res: Response
    try {
      res = await fetch(`${API}${path}`, {
        ...init,
        method,
        headers: {
          Authorization: `Bot ${token}`,
          // Multipart must NOT carry an explicit Content-Type — fetch has to
          // generate it so the boundary matches the body it actually writes.
          ...(init.form ? {} : { "Content-Type": "application/json" }),
          // Discord asks bots to identify themselves.
          "User-Agent": "Instroom (https://instroom.io, 1.0)",
          ...(init.headers ?? {}),
        },
        ...(init.form
          ? { body: init.form }
          : init.json !== undefined
            ? { body: JSON.stringify(init.json) }
            : {}),
        // Uploads need longer than a JSON round-trip.
        signal: AbortSignal.timeout(init.form ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS),
        cache: "no-store",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "network error"
      console.error(`${LOG} ${method} ${path} network failure: ${message}`)
      if (attempt === MAX_RETRIES) {
        return { ok: false, status: 0, code: "network", error: "Couldn't reach Discord." }
      }
      await sleep(500 * attempt)
      continue
    }

    recordHeaders(key, res)

    if (res.status === 429) {
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number; global?: boolean }
      const waitMs = (body.retry_after ?? 1) * 1000
      if (body.global) {
        globalResetAt = Date.now() + waitMs
        console.warn(`${LOG} GLOBAL rate limit — pausing all requests for ${waitMs}ms`)
      } else {
        console.warn(`${LOG} rate limited on ${key} — retrying in ${waitMs}ms (attempt ${attempt})`)
      }
      if (attempt === MAX_RETRIES) {
        return { ok: false, status: 429, code: "rate_limited", error: "Discord is rate limiting. Try again shortly." }
      }
      await sleep(waitMs)
      continue
    }

    if (res.status === 204) return { ok: true, data: undefined as T }

    const raw = await res.text()

    if (!res.ok) {
      // Log Discord's own error body — a bare status hides which permission
      // is missing, which is the usual cause of a 403 here.
      console.error(`${LOG} ${method} ${path} → HTTP ${res.status}: ${raw.slice(0, 400)}`)
      const code: DiscordRestErrorCode =
        res.status === 401 ? "unauthorized"
        : res.status === 403 ? "forbidden"
        : res.status === 404 ? "not_found"
        : "unknown"
      let message = `Discord returned HTTP ${res.status}`
      try { message = JSON.parse(raw)?.message || message } catch { /* keep default */ }
      if (code === "unauthorized") message = "The Discord bot token is invalid or was reset."
      if (code === "forbidden") message = "The bot doesn't have permission for that channel or action."
      return { ok: false, status: res.status, code, error: message }
    }

    try {
      return { ok: true, data: (raw ? JSON.parse(raw) : null) as T }
    } catch {
      return { ok: false, status: res.status, code: "unknown", error: "Discord returned a malformed response." }
    }
  }

  return { ok: false, status: 429, code: "rate_limited", error: "Exhausted retries against Discord." }
}

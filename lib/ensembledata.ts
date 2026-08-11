import "server-only"

// ─── EnsembleData social API client ──────────────────────────────────────────
// Server-only. The token is read from the environment on every call and is
// never returned to a caller, logged, or bundled into client code.
//
// Required env var:
//   ENSEMBLEDATA_TOKEN — API token from the EnsembleData dashboard.
//
// Every function returns a discriminated result rather than throwing, so a
// provider outage degrades the monitor to "no new posts this pass" instead of
// failing the surrounding request. Rate limits (429) and 5xx are retried with
// exponential backoff; 4xx other than 429 are not — they will not succeed on
// a retry and burn quota.

const API_BASE = "https://ensembledata.com/apis"
const TIMEOUT_MS = 15_000
const MAX_ATTEMPTS = 3
/** Base backoff; doubled per attempt. */
const RETRY_BASE_MS = 600

/** Single prefix so every provider failure is greppable in production logs. */
const LOG = "[ensembledata]"

export type EnsemblePlatform = "instagram" | "tiktok"

/** Normalised post shape — provider payloads differ per platform. */
export interface EnsemblePost {
  externalId: string | null
  platform: EnsemblePlatform
  postUrl: string
  author: string | null
  caption: string | null
  publishedAt: Date | null
  hashtags: string[]
  mentions: string[]
  likeCount: number | null
  commentCount: number | null
  viewCount: number | null
  shareCount: number | null
}

export type EnsembleResult<T> =
  | { ok: true; data: T; apiCalls: number }
  | { ok: false; error: string; retryable: boolean; apiCalls: number }

/**
 * Resolve the API token.
 *
 * Accepts both names: this project's .env already used ENSEMBLE_TOKEN, while
 * this module originally read only ENSEMBLEDATA_TOKEN — so the token looked
 * "configured" to the operator and missing to the code. Supporting both removes
 * that whole class of silent failure.
 */
export function getEnsembleToken(): string | undefined {
  return process.env.ENSEMBLEDATA_TOKEN || process.env.ENSEMBLE_TOKEN
}

export function isEnsembleConfigured(): boolean {
  return Boolean(getEnsembleToken())
}

/* ── Caption parsing ──────────────────────────────────────────────────────── */

export function extractHashtags(caption: string | null | undefined): string[] {
  if (!caption) return []
  return Array.from(new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1).toLowerCase())))
}

export function extractMentions(caption: string | null | undefined): string[] {
  if (!caption) return []
  return Array.from(new Set((caption.match(/@[\p{L}\p{N}_.]+/gu) ?? []).map((t) => t.slice(1).toLowerCase())))
}

/* ── Transport ────────────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * One provider request with retries. `apiCalls` counts every HTTP attempt so
 * the caller's quota accounting reflects real provider usage, not just the
 * number of logical requests.
 */
async function request<T>(path: string, params: Record<string, string>): Promise<EnsembleResult<T>> {
  const token = getEnsembleToken()
  if (!token) {
    console.error(
      `${LOG} NOT CONFIGURED — neither ENSEMBLEDATA_TOKEN nor ENSEMBLE_TOKEN is set. No detection requests were made.`
    )
    return { ok: false, error: "EnsembleData API token is not configured", retryable: false, apiCalls: 0 }
  }

  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set("token", token)

  // Query string for logs, with the token redacted — never log the secret.
  const safeQuery = new URLSearchParams({ ...params, token: "***" }).toString()

  let apiCalls = 0
  let lastError = "Unknown error calling EnsembleData"

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    apiCalls++
    const startedAt = Date.now()
    console.log(`${LOG} → REQUEST ${path}?${safeQuery} (attempt ${attempt}/${MAX_ATTEMPTS})`)
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      })
      console.log(`${LOG} ← RESPONSE ${path} HTTP ${res.status} ${res.statusText} in ${Date.now() - startedAt}ms`)

      if (res.status === 429 || res.status >= 500) {
        // Retryable. Respect Retry-After when the provider sends one.
        const retryAfter = Number(res.headers.get("retry-after"))
        lastError = `HTTP ${res.status} ${res.statusText}`
        console.warn(`${LOG} ${path} ${lastError} (attempt ${attempt}/${MAX_ATTEMPTS})`)
        if (attempt < MAX_ATTEMPTS) {
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_BASE_MS * 2 ** (attempt - 1))
          continue
        }
        return { ok: false, error: lastError, retryable: true, apiCalls }
      }

      if (!res.ok) {
        // 4xx other than 429: bad token, bad params, no quota. Retrying wastes
        // requests against the daily cap.
        const body = (await res.text()).slice(0, 300)
        console.error(`${LOG} ${path} HTTP ${res.status} ${res.statusText}: ${body}`)
        return { ok: false, error: `HTTP ${res.status}: ${body || res.statusText}`, retryable: false, apiCalls }
      }

      // Read as text first so the raw body can be logged even when it isn't
      // the JSON shape we expect — that is exactly the case worth debugging.
      const raw = await res.text()
      console.log(`${LOG} ← RAW BODY ${path} (${raw.length} bytes): ${raw.slice(0, 1200)}`)

      try {
        return { ok: true, data: JSON.parse(raw) as T, apiCalls }
      } catch {
        console.error(`${LOG} ${path} returned 2xx with a non-JSON body — treating as failure.`)
        return { ok: false, error: "Provider returned a non-JSON body", retryable: false, apiCalls }
      }
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
      lastError = isTimeout ? `Request timed out after ${TIMEOUT_MS}ms` : err instanceof Error ? err.message : lastError
      console.warn(`${LOG} ${path} ${lastError} (attempt ${attempt}/${MAX_ATTEMPTS})`)
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_MS * 2 ** (attempt - 1))
        continue
      }
    }
  }

  return { ok: false, error: lastError, retryable: true, apiCalls }
}

/* ── Payload normalisation ────────────────────────────────────────────────── */
// Provider payloads are loosely typed and vary by platform and endpoint, so
// every field is read defensively and missing data becomes null rather than
// throwing. `unknown` + narrowing keeps this honest under strict mode.

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
}

/** Provider timestamps arrive as unix seconds, unix ms, or ISO strings. */
function toDate(v: unknown): Date | null {
  const n = num(v)
  if (n !== null) {
    const ms = n > 1e12 ? n : n * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function normaliseInstagram(raw: unknown): EnsemblePost | null {
  const node = obj(obj(raw).node ?? raw)
  const shortcode = str(node.shortcode) ?? str(node.code)
  const externalId = str(node.id) ?? shortcode
  if (!shortcode && !externalId) return null

  // Live Instagram payloads put the caption at
  // edge_media_to_caption.edges[0].node.text. The other two forms appear on
  // different endpoints, so all three are tried.
  const captionEdges = obj(node.edge_media_to_caption).edges
  const firstEdge = Array.isArray(captionEdges) ? obj(captionEdges[0]) : {}
  const caption =
    str(node.caption) ??
    str(obj(node.caption).text) ??
    str(obj(firstEdge.node).text) ??
    null

  const owner = obj(node.owner ?? node.user)

  return {
    externalId,
    platform: "instagram",
    postUrl: shortcode ? `https://www.instagram.com/p/${shortcode}/` : `https://www.instagram.com/p/${externalId}/`,
    author: str(owner.username) ?? str(node.username),
    caption,
    publishedAt: toDate(node.taken_at_timestamp ?? node.taken_at ?? node.device_timestamp),
    hashtags: extractHashtags(caption),
    mentions: extractMentions(caption),
    likeCount: num(node.like_count) ?? num(obj(node.edge_liked_by).count),
    commentCount: num(node.comment_count) ?? num(obj(node.edge_media_to_comment).count),
    viewCount: num(node.view_count) ?? num(node.play_count),
    shareCount: num(node.share_count),
  }
}

function normaliseTikTok(raw: unknown): EnsemblePost | null {
  const node = obj(obj(raw).aweme_info ?? raw)
  const externalId = str(node.aweme_id) ?? str(node.id)
  if (!externalId) return null

  const author = obj(node.author)
  const handle = str(author.unique_id) ?? str(author.nickname)
  const caption = str(node.desc) ?? str(node.description)
  const stats = obj(node.statistics)

  return {
    externalId,
    platform: "tiktok",
    postUrl: handle
      ? `https://www.tiktok.com/@${handle}/video/${externalId}`
      : `https://www.tiktok.com/video/${externalId}`,
    author: handle,
    caption,
    publishedAt: toDate(node.create_time),
    hashtags: extractHashtags(caption),
    mentions: extractMentions(caption),
    likeCount: num(stats.digg_count),
    commentCount: num(stats.comment_count),
    viewCount: num(stats.play_count),
    shareCount: num(stats.share_count),
  }
}

/** Provider responses nest the list under `data`, `data.posts`, or similar. */
/**
 * Instagram hashtag payloads carry TWO lists plus a pagination cursor:
 *
 *   data.recent_posts  chronological, newest first  ← what monitoring wants
 *   data.top_posts     provider's ranking, arbitrary chronology
 *   data.nextCursor    continuation token
 *
 * Verified live for #armfulmedia: recent_posts held 27 items descending from
 * 2025-02-19, while top_posts held 30 spanning 2021–2024 in no useful order.
 *
 * The old extractList() concatenated recent_posts + top_posts and the caller
 * kept the first 10 of that. Pass one therefore took the newest 10, and every
 * later pass — with those deduped away — walked DOWN into progressively older
 * recent_posts and finally into 2021-era top_posts. That is the "keeps
 * importing old posts" behaviour: nothing was sorting by real publish time, and
 * a ranked all-time list was being treated as a recency feed.
 */
function extractHashtagPage(
  payload: unknown,
  context: string
): { recent: unknown[]; top: unknown[]; nextCursor: string | null } {
  const root = obj(payload)
  const data = obj(root.data)

  const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const recent = asArray(data.recent_posts)
  const top = asArray(data.top_posts)

  // Shapes used by the other endpoints (TikTok hashtag: data.data,
  // TikTok user posts: data). Treated as chronological feeds.
  const generic =
    asArray(data.posts).length ? asArray(data.posts)
      : asArray(data.data).length ? asArray(data.data)
        : asArray(root.data).length ? asArray(root.data)
          : asArray(root.posts).length ? asArray(root.posts)
            : asArray(root.results)

  const cursorRaw =
    data.nextCursor ?? data.next_cursor ?? data.cursor ?? root.nextCursor ?? root.next_cursor
  const nextCursor =
    typeof cursorRaw === "string" && cursorRaw.length > 0 ? cursorRaw
      : typeof cursorRaw === "number" ? String(cursorRaw)
        : null

  const chronological = recent.length ? recent : generic

  if (!chronological.length && !top.length) {
    console.warn(
      `${LOG} ${context}: NO ARRAY FOUND in response. Top-level keys: [${Object.keys(root).join(", ") || "none"}]. ` +
        `If the provider nests results under a different key, add it to extractHashtagPage().`
    )
  } else {
    console.log(
      `${LOG} ${context}: ${chronological.length} chronological item(s)` +
        `${top.length ? `, ${top.length} ranked item(s) held back` : ""}` +
        `${nextCursor ? ", cursor available" : ", no further pages"}`
    )
  }

  return { recent: chronological, top, nextCursor }
}

/**
 * Normalise one page of provider items into posts, newest first.
 *
 * The sort is on the real provider timestamp (taken_at_timestamp / create_time),
 * not on array position and not on any database column — a provider page can be
 * chronological, near-chronological, or (for ranked lists) not chronological at
 * all, and only the timestamp is authoritative.
 */
function normalisePage(
  rawList: unknown[],
  platform: EnsemblePlatform,
  context: string
): EnsemblePost[] {
  const normalise = platform === "instagram" ? normaliseInstagram : normaliseTikTok
  const normalised = rawList.map(normalise)
  const posts = normalised.filter((p): p is EnsemblePost => p !== null)

  const dropped = normalised.length - posts.length
  if (dropped > 0) {
    console.warn(`${LOG} ${context}: dropped ${dropped} item(s) — missing the id/shortcode needed to build a post URL.`)
  }
  if (rawList.length > 0 && posts.length === 0) {
    console.warn(`${LOG} ${context}: provider returned ${rawList.length} item(s) but none normalised into posts.`)
  }

  // Undated posts sort last: they cannot be shown to be recent.
  return posts.sort((a, b) => {
    const at = a.publishedAt?.getTime() ?? -Infinity
    const bt = b.publishedAt?.getTime() ?? -Infinity
    return bt - at
  })
}

/* ── Public API ───────────────────────────────────────────────────────────── */

/** Recent posts carrying a hashtag. `tag` may include or omit the leading #. */
export async function searchPostsByHashtag(
  platform: EnsemblePlatform,
  tag: string,
  limit = 10,
  options?: {
    /** Ignore posts published before this instant. */
    notBefore?: Date | null
    /** Hard ceiling on billed requests for this term. Each page is one call. */
    maxPages?: number
  }
): Promise<EnsembleResult<EnsemblePost[]>> {
  // EnsembleData expects the bare tag: no leading '#', lowercase, no spaces.
  const name = tag.replace(/^#/, "").trim().toLowerCase().replace(/\s+/g, "")
  const context = `hashtag "${name}" on ${platform}`

  if (!name) {
    console.warn(`${LOG} skipped an empty hashtag term (input was ${JSON.stringify(tag)})`)
    return { ok: true, data: [], apiCalls: 0 }
  }

  const path = platform === "instagram" ? "/instagram/hashtag/posts" : "/tt/hashtag/posts"
  const notBefore = options?.notBefore ?? null
  const maxPages = Math.max(1, options?.maxPages ?? 1)

  const collected: EnsemblePost[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  let apiCalls = 0
  let rankedFallback: EnsemblePost[] = []
  // "The payload had no chronological list at all" — NOT the same as "the
  // chronological list held nothing recent enough", which is a normal result for
  // a hashtag with no recent activity.
  let sawChronologicalFeed = false

  // Walk the provider's chronological feed page by page. Stops as soon as it
  // has `limit` in-window posts, or the feed drops out of the window, or the
  // page budget is spent — so the newest results are always processed first and
  // pagination cannot silently burn quota.
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> =
      platform === "instagram"
        // Instagram rejects chunk_size <= 8 with HTTP 422, so the floor is 9
        // regardless of how few results the caller wants.
        ? { name, chunk_size: String(Math.max(9, limit)), ...(cursor ? { cursor } : {}) }
        : { name, cursor: cursor ?? "0", period: "1" }

    const res = await request<unknown>(path, params)
    apiCalls += res.apiCalls
    if (!res.ok) {
      console.error(`${LOG} ${context}: request failed — ${res.error}`)
      // Pages already collected are still usable; only report failure if the
      // very first page failed.
      if (page === 0) return { ...res, apiCalls }
      break
    }

    const { recent, top, nextCursor } = extractHashtagPage(res.data, `${context} page ${page + 1}`)
    if (page === 0) rankedFallback = normalisePage(top, platform, `${context} (ranked)`)

    if (recent.length > 0) sawChronologicalFeed = true
    const pagePosts = normalisePage(recent, platform, `${context} page ${page + 1}`)
    let reachedWindowEdge = false

    for (const post of pagePosts) {
      const key = post.externalId || post.postUrl
      if (key && seen.has(key)) continue
      if (notBefore && post.publishedAt && post.publishedAt < notBefore) {
        // The feed is newest-first, so everything after this is older still.
        reachedWindowEdge = true
        break
      }
      if (key) seen.add(key)
      collected.push(post)
    }

    if (collected.length >= limit || reachedWindowEdge || !nextCursor) {
      if (reachedWindowEdge) {
        console.log(`${LOG} ${context}: reached the monitoring window edge — stopping pagination`)
      }
      break
    }
    cursor = nextCursor
  }

  // Ranked ("top") posts are NOT part of the recency selection — mixing them in
  // is what surfaced 2021 posts as if they were new. They are used only when the
  // provider gave no chronological feed at all, and even then the window filter
  // below still applies.
  let out = collected
  if (!sawChronologicalFeed && rankedFallback.length > 0) {
    console.warn(`${LOG} ${context}: no chronological feed in the payload — falling back to ranked posts`)
    out = rankedFallback
  }

  if (notBefore) {
    const before = out.length
    out = out.filter((p) => p.publishedAt && p.publishedAt >= notBefore)
    if (before !== out.length) {
      console.log(`${LOG} ${context}: dropped ${before - out.length} post(s) older than the monitoring window`)
    }
  }

  if (sawChronologicalFeed && out.length === 0) {
    console.log(
      `${LOG} ${context}: the chronological feed held no post inside the monitoring window — ` +
        `this hashtag has no recent activity (older posts are deliberately NOT imported)`
    )
  }

  out = out.sort((a, b) => (b.publishedAt?.getTime() ?? -Infinity) - (a.publishedAt?.getTime() ?? -Infinity))
  const selected = out.slice(0, limit)

  if (selected.length) {
    console.log(
      `${LOG} ${context}: selected ${selected.length} newest post(s) — ` +
        `${selected[0].publishedAt?.toISOString() ?? "undated"} … ` +
        `${selected[selected.length - 1].publishedAt?.toISOString() ?? "undated"} ` +
        `(${apiCalls} api call(s))`
    )
  }
  return { ok: true, data: selected, apiCalls }
}


/**
 * Newest-first selection for a user feed: sort on the provider timestamp, drop
 * anything outside the monitoring window, then take the newest `limit`.
 */
function selectNewest(
  rawPayload: unknown,
  platform: EnsemblePlatform,
  context: string,
  limit: number,
  apiCalls: number,
  notBefore: Date | null
): EnsembleResult<EnsemblePost[]> {
  const { recent, top } = extractHashtagPage(rawPayload, context)
  let posts = normalisePage(recent.length ? recent : top, platform, context)

  if (notBefore) {
    const before = posts.length
    posts = posts.filter((p) => p.publishedAt && p.publishedAt >= notBefore)
    if (before !== posts.length) {
      console.log(`${LOG} ${context}: dropped ${before - posts.length} post(s) older than the monitoring window`)
    }
  }

  const selected = posts.slice(0, limit)
  if (selected.length) {
    console.log(
      `${LOG} ${context}: selected ${selected.length} newest post(s) — ` +
        `${selected[0].publishedAt?.toISOString() ?? "undated"} … ` +
        `${selected[selected.length - 1].publishedAt?.toISOString() ?? "undated"}`
    )
  }
  return { ok: true, data: selected, apiCalls }
}

/** Bare comparable handle: no leading '@', lowercased, no spaces. */
export function normaliseHandle(handle: string | null | undefined): string {
  return (handle ?? "").replace(/^@/, "").trim().toLowerCase().replace(/\s+/g, "")
}

/**
 * Recent posts published BY one account.
 *
 * This is the account-scoped endpoint pair: every post it returns belongs to
 * `handle`, because the request is addressed to that account's feed (Instagram
 * by resolved numeric user_id, TikTok by username). That property is what makes
 * it safe for per-influencer monitoring — unlike a hashtag search, it cannot
 * return a post by anybody else.
 *
 * Previously named searchPostsByMention, which described the caller's intent
 * rather than the request: mention monitoring works by pulling the account's own
 * posts and filtering their captions locally. The name now says what it fetches.
 */
export async function fetchAccountPosts(
  platform: EnsemblePlatform,
  handle: string,
  limit = 10,
  options?: {
    /** Ignore posts published before this instant. */
    notBefore?: Date | null
  }
): Promise<EnsembleResult<EnsemblePost[]>> {
  const name = normaliseHandle(handle)
  const context = `account "@${name}" on ${platform}`

  if (!name) {
    console.warn(`${LOG} skipped an empty account handle (input was ${JSON.stringify(handle)})`)
    return { ok: true, data: [], apiCalls: 0 }
  }

  // TikTok's user endpoint accepts a username directly. Instagram's does not —
  // /instagram/user/posts requires a numeric user_id (verified: passing
  // `username` returns HTTP 422 "user_id field required"), so the handle has to
  // be resolved through /instagram/user/info first. That is two billed calls.
  let apiCalls = 0

  if (platform === "instagram") {
    const info = await request<unknown>("/instagram/user/info", { username: name })
    apiCalls += info.apiCalls
    if (!info.ok) {
      console.error(`${LOG} ${context}: could not resolve handle — ${info.error}`)
      return { ...info, apiCalls }
    }

    const data = obj(obj(info.data).data)
    const userId = str(data.pk) ?? num(data.pk)?.toString() ?? str(data.pk_id) ?? str(data.id)
    if (!userId) {
      // data:null means the handle doesn't exist on Instagram — the single most
      // likely reason a mention silently yields nothing.
      const error = `Instagram handle "@${name}" was not found`
      console.warn(`${LOG} ${context}: ${error}. The influencer's handle must be a real account handle, not a display name.`)
      return { ok: false, error, retryable: false, apiCalls }
    }

    const res = await request<unknown>("/instagram/user/posts", {
      user_id: userId,
      depth: "1",
      chunk_size: String(Math.max(9, limit)),
    })
    apiCalls += res.apiCalls
    if (!res.ok) {
      console.error(`${LOG} ${context}: request failed — ${res.error}`)
      return { ...res, apiCalls }
    }
    return selectNewest(res.data, platform, context, limit, apiCalls, options?.notBefore ?? null)
  }

  const res = await request<unknown>("/tt/user/posts", { username: name, depth: "1" })
  apiCalls += res.apiCalls
  if (!res.ok) {
    console.error(
      `${LOG} ${context}: request failed — ${res.error}. ` +
        `The influencer's handle must be a real account handle, not a display name.`
    )
    return { ...res, apiCalls }
  }

  return selectNewest(res.data, platform, context, limit, apiCalls, options?.notBefore ?? null)
}

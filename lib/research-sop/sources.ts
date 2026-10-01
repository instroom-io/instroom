// lib/research-sop/sources.ts
//
// Server-side public-profile research for one influencer.
//
// Two existing providers, both called from the server:
//   1. Instroom Influencer API — the same endpoints the Influencer List's
//      handle lookup uses (INSTROOM_PROFILE_ENDPOINTS), with the same field
//      mapping as table-sheet.tsx's fetchInfluencerFromAPI.
//   2. EnsembleData — profile info plus recent posts (for engagement and for
//      the caption text niche/location classification reads).
//
// Only Instagram and TikTok are supported, because only those two have a
// source. Anything else returns `unsupported` — never fabricated data.

import { INSTROOM_PROFILE_ENDPOINTS, isInstroomApiConfigured } from "@/components/table-sheet/constants"
import { normalizeApiUsername, isValidApiUsername } from "@/components/table-sheet/utils"
import {
  fetchAccountPosts,
  fetchProfileInfo,
  isEnsembleConfigured,
  type EnsemblePlatform,
} from "@/lib/ensembledata"

const LOOKUP_TIMEOUT_MS = 15_000
const POSTS_FOR_ENGAGEMENT = 12

/** One fact a provider returned, with where it came from. */
export interface SourcedValue<T> {
  value: T
  source: string
}

export interface ResearchData {
  platform: EnsemblePlatform
  handle: string
  followers: SourcedValue<number> | null
  engagementRate: SourcedValue<number> | null
  email: SourcedValue<string> | null
  bio: SourcedValue<string> | null
  /** A location the provider states outright (profile/country field). */
  location: SourcedValue<string> | null
  /** A provider-assigned category (e.g. Instagram business category). */
  category: SourcedValue<string> | null
  fullName: string | null
  /** Recent caption text, for classification only. */
  captions: string[]
  hashtags: string[]
  /** Providers that answered, for the run log. */
  sourcesUsed: string[]
}

export type ResearchLookup =
  | { ok: true; data: ResearchData }
  | { ok: false; unsupported: boolean; error: string }

export function isSupportedPlatform(platform: string | null | undefined): platform is EnsemblePlatform {
  return platform === "instagram" || platform === "tiktok"
}

export async function gatherResearchData(
  rawPlatform: string | null | undefined,
  rawHandle: string | null | undefined,
  needs: { engagement: boolean; content: boolean }
): Promise<ResearchLookup> {
  const platform = (rawPlatform ?? "").trim().toLowerCase()
  if (!isSupportedPlatform(platform)) {
    return {
      ok: false,
      unsupported: true,
      error: `Research is not supported for ${rawPlatform || "this platform"} yet (Instagram and TikTok only).`,
    }
  }

  const handle = normalizeApiUsername(rawHandle ?? "")
  if (!isValidApiUsername(handle)) {
    return { ok: false, unsupported: false, error: "This influencer has no valid handle to research." }
  }

  if (!isInstroomApiConfigured() && !isEnsembleConfigured()) {
    return { ok: false, unsupported: false, error: "No research data source is configured." }
  }

  const data: ResearchData = {
    platform,
    handle,
    followers: null,
    engagementRate: null,
    email: null,
    bio: null,
    location: null,
    category: null,
    fullName: null,
    captions: [],
    hashtags: [],
    sourcesUsed: [],
  }

  // Sequential, not parallel: each provider is rate-limited per account, and a
  // batch already runs several influencers back to back.
  const instroom = await fetchInstroomProfile(platform, handle)
  if (instroom) {
    data.sourcesUsed.push("instroom_api")
    const src = "instroom_api"
    if (instroom.followers !== null) data.followers = { value: instroom.followers, source: src }
    if (instroom.engagementRate !== null) data.engagementRate = { value: instroom.engagementRate, source: src }
    if (instroom.email) data.email = { value: instroom.email, source: `${src}:public_email` }
    if (instroom.bio) data.bio = { value: instroom.bio, source: `${src}:profile_bio` }
    if (instroom.location) data.location = { value: instroom.location, source: `${src}:profile_location` }
    if (instroom.category) data.category = { value: instroom.category, source: `${src}:profile_category` }
    data.fullName = instroom.fullName
  }

  if (isEnsembleConfigured()) {
    const profile = await fetchProfileInfo(platform, handle)
    if (profile.ok) {
      data.sourcesUsed.push("ensembledata")
      const p = profile.data
      const src = "ensembledata"
      if (!data.followers && p.followers !== null) data.followers = { value: p.followers, source: src }
      if (!data.email && p.email) data.email = { value: p.email, source: `${src}:public_email` }
      if (!data.bio && p.bio) data.bio = { value: p.bio, source: `${src}:profile_bio` }
      if (!data.location && p.city) data.location = { value: p.city, source: `${src}:profile_city` }
      if (!data.category && p.category) data.category = { value: p.category, source: `${src}:profile_category` }
      data.fullName ??= p.fullName
    }

    if ((needs.engagement && !data.engagementRate) || needs.content) {
      const posts = await fetchAccountPosts(platform, handle, POSTS_FOR_ENGAGEMENT)
      if (posts.ok && posts.data.length) {
        data.captions = posts.data.map((p) => p.caption ?? "").filter(Boolean).slice(0, POSTS_FOR_ENGAGEMENT)
        data.hashtags = Array.from(new Set(posts.data.flatMap((p) => p.hashtags))).slice(0, 40)
        // Engagement the way the list reports it: average (likes + comments)
        // per post as a percentage of followers. Computed only from real
        // numbers — no follower count, no rate.
        const followers = data.followers?.value ?? 0
        if (!data.engagementRate && followers > 0) {
          const counted = posts.data.filter((p) => p.likeCount !== null || p.commentCount !== null)
          if (counted.length) {
            const avg = counted.reduce((sum, p) => sum + (p.likeCount ?? 0) + (p.commentCount ?? 0), 0) / counted.length
            data.engagementRate = {
              value: Math.round((avg / followers) * 100 * 100) / 100,
              source: `ensembledata:calculated_from_${counted.length}_posts`,
            }
          }
        }
      }
    }
  }

  if (!data.sourcesUsed.length) {
    return { ok: false, unsupported: false, error: "No public profile data could be retrieved for this handle." }
  }
  return { ok: true, data }
}

interface InstroomProfile {
  followers: number | null
  engagementRate: number | null
  email: string | null
  bio: string | null
  location: string | null
  category: string | null
  fullName: string | null
}

/**
 * Server-side twin of the Influencer List's profile lookup. Same endpoints and
 * field mapping; returns null on any failure rather than throwing, since a
 * missing source only means fewer facts, not a failed influencer.
 */
async function fetchInstroomProfile(platform: EnsemblePlatform, handle: string): Promise<InstroomProfile | null> {
  if (!isInstroomApiConfigured()) return null
  const endpoint = INSTROOM_PROFILE_ENDPOINTS[platform]
  if (!endpoint) return null

  try {
    const res = await fetch(endpoint(handle), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) {
      console.warn(`[research-sop] Instroom API ${res.status} for @${handle} on ${platform}`)
      return null
    }
    const json = await res.json()
    const d = json?.data || json?.user || json
    if (!d || typeof d !== "object") return null

    const text = (v: unknown) => (typeof v === "string" && v.trim() && v.trim() !== "Not Available" ? v.trim() : null)
    const number = (v: unknown) => {
      const n = Number(v)
      return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : null
    }
    return {
      followers: number(d.followers ?? d.follower_count),
      engagementRate: number(d.engagement_rate),
      email: text(d.email),
      bio: text(d.biography ?? d.bio),
      location: text(d.location ?? d.country),
      category: text(d.category ?? d.business_category),
      fullName: text(d.full_name ?? d.name),
    }
  } catch (err) {
    const cause = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.warn(`[research-sop] Instroom API lookup failed for @${handle} on ${platform}: ${cause}`)
    return null
  }
}

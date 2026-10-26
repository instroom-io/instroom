import "server-only"

// ─── Archive of detected post media ──────────────────────────────────────────
// Instagram media URLs are signed CDN links that stop resolving within days, so
// a detected post's video / carousel slides / image are copied into Cloudinary
// — the same account lib/avatar-storage.ts and the upload routes use — and the
// permanent URLs are stored on DetectedPost.media.
//
// The source URL is handed to Cloudinary rather than downloaded here: Cloudinary
// fetches it server-side, so a large reel never streams through this function
// (and its time limit). Each item has a deterministic public_id, so re-archiving
// the same post overwrites instead of accumulating copies.
//
// Archiving is best-effort. A failure is logged and reported to the caller but
// never undoes the detection itself — the post is still recorded and the card
// still moves.

import { v2 as cloudinary } from "cloudinary"
import type { InstagramPostMedia } from "@/lib/ensembledata"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const LOG = "[post-media]"

/** Cloudinary's remote fetch of a reel can be slow; don't hang a pass on one. */
const UPLOAD_TIMEOUT_MS = 120_000

export type ArchivedMedia = { url: string; type: "video" | "image" }[]

export function isMediaArchiveConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  )
}

/** Cloudinary public ids: letters, digits, _ and - only. */
function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 80) || "unknown"
}

/** TikTok's video CDN refuses requests without a TikTok referer (as in the n8n flow). */
const TIKTOK_DOWNLOAD_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.tiktok.com/",
  Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
}
const MAX_VIDEO_BYTES = 100_000_000

/**
 * Archive one TikTok video.
 *
 * Unlike Instagram, the URL can't be handed to Cloudinary: its remote fetch
 * sends no TikTok referer and is refused. So the video is downloaded here with
 * the headers the n8n flow used, trying each candidate URL in turn, and the
 * bytes are streamed to Cloudinary.
 */
export async function archiveTikTokVideo(params: {
  brandId: string
  handle: string
  videoId: string
  urls: string[]
}): Promise<{ stored: ArchivedMedia; failed: number } | null> {
  if (!isMediaArchiveConfigured()) {
    console.warn(`${LOG} Cloudinary is not configured — TikTok video ${params.videoId} not archived`)
    return null
  }

  for (const url of params.urls) {
    try {
      const res = await fetch(url, { headers: TIKTOK_DOWNLOAD_HEADERS, signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) })
      if (!res.ok) continue
      const buffer = Buffer.from(await res.arrayBuffer())
      if (!buffer.length || buffer.length > MAX_VIDEO_BYTES) continue

      const uploaded = await new Promise<{ secure_url?: string } | undefined>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `post-tracker/${safeSegment(params.brandId)}/${safeSegment(params.handle)}`,
            public_id: `${safeSegment(params.videoId)}_1`,
            overwrite: true,
            resource_type: "video",
            timeout: UPLOAD_TIMEOUT_MS,
          },
          (err, result) => (err ? reject(err) : resolve(result))
        )
        stream.end(buffer)
      })
      if (uploaded?.secure_url) {
        console.log(`${LOG} TikTok ${params.videoId}: archived (${Math.round(buffer.length / 1024)} KB)`)
        return { stored: [{ url: uploaded.secure_url, type: "video" }], failed: 0 }
      }
    } catch (err) {
      console.warn(`${LOG} TikTok ${params.videoId}: candidate URL failed — ${(err as Error)?.message ?? err}`)
    }
  }

  console.error(`${LOG} TikTok ${params.videoId}: no candidate URL could be archived`)
  return { stored: [], failed: 1 }
}

/**
 * Copy every item of one post into Cloudinary, in slide order.
 *
 * Returns the stored items (possibly fewer than requested when some failed),
 * or null when archiving is not configured at all.
 */
export async function archivePostMedia(params: {
  brandId: string
  handle: string
  shortcode: string
  media: InstagramPostMedia
}): Promise<{ stored: ArchivedMedia; failed: number } | null> {
  if (!isMediaArchiveConfigured()) {
    console.warn(`${LOG} Cloudinary is not configured — media for ${params.shortcode} not archived`)
    return null
  }

  const folder = `post-tracker/${safeSegment(params.brandId)}/${safeSegment(params.handle)}`
  const stored: ArchivedMedia = []
  let failed = 0

  // Sequential: a carousel is at most 20 slides, and parallel remote fetches
  // against one signed CDN host invite throttling.
  for (const [index, item] of params.media.items.entries()) {
    try {
      const uploaded = await cloudinary.uploader.upload(item.url, {
        folder,
        public_id: `${safeSegment(params.shortcode)}_${index + 1}`,
        overwrite: true,
        resource_type: item.kind === "video" ? "video" : "image",
        timeout: UPLOAD_TIMEOUT_MS,
      })
      if (uploaded?.secure_url) {
        stored.push({ url: uploaded.secure_url, type: item.kind })
      } else {
        failed++
      }
    } catch (err) {
      failed++
      const message = (err as { message?: string; error?: { message?: string } })?.message
        ?? (err as { error?: { message?: string } })?.error?.message
        ?? "unknown error"
      console.error(`${LOG} could not archive ${params.shortcode} item ${index + 1}: ${message}`)
    }
  }

  console.log(`${LOG} ${params.shortcode}: archived ${stored.length}/${params.media.items.length} item(s) to ${folder}`)
  return { stored, failed }
}

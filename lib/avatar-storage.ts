// lib/avatar-storage.ts
//
// Permanent storage for influencer avatars.
//
// An Instagram/TikTok profile picture URL is a signed CDN link: it carries
// `x-expires=` (TikTok) or an `_nc_oh`/`oe=` signature (Instagram's fbcdn) and
// stops resolving within hours or days. Storing it meant the avatar rendered
// once and was a broken image on the next visit — which is why the influencer
// PUT route used to discard any expiring URL outright, and why the avatar
// simply disappeared instead.
//
// So the URL is not what gets stored. The image behind it is downloaded once,
// uploaded to Cloudinary — the same account, SDK and configuration the profile
// photo and brand logo uploads already use (app/api/settings/profile,
// app/api/brand/branding) — and the resulting `secure_url` is what the database
// holds. That URL is ours and does not expire.
//
// Repeated uploads are avoided in two ways: a URL already pointing at
// Cloudinary is returned untouched (so an ordinary save, which re-sends the
// stored value, never re-uploads), and each influencer uploads to one
// deterministic `public_id`, so replacing an avatar overwrites that same asset
// rather than accumulating copies.

import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/** Cloudinary's own delivery host — anything here is already permanent. */
export function isStoredAvatarUrl(url: string): boolean {
  return /^https?:\/\/res\.cloudinary\.com\//i.test(url)
}

/** Give up on a slow CDN rather than hold a request (and its DB connection) open. */
const DOWNLOAD_TIMEOUT_MS = 8_000
/** Profile pictures are small; anything larger is not one. */
const MAX_BYTES = 5_000_000

/**
 * Mirror an external avatar URL into Cloudinary and return the permanent URL.
 *
 * Returns:
 *   • the same URL, when it is already a stored Cloudinary URL (no upload)
 *   • the new Cloudinary `secure_url`, once the image is stored
 *   • null when there is nothing to store, or the download/upload failed
 *
 * A null return means "leave whatever is already stored alone" — the caller
 * must not write it over an existing avatar, or a transient CDN failure would
 * erase a working one.
 */
export async function persistAvatarUrl(
  sourceUrl: string | null | undefined,
  influencerId: string
): Promise<string | null> {
  const url = sourceUrl?.trim()
  if (!url) return null
  if (isStoredAvatarUrl(url)) return url
  if (!/^https?:\/\//i.test(url)) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) return null

    const contentType = res.headers.get("content-type") ?? ""
    if (!contentType.startsWith("image/")) return null

    const buffer = Buffer.from(await res.arrayBuffer())
    if (!buffer.length || buffer.length > MAX_BYTES) return null

    // Same data-URI upload the profile photo and brand logo routes use.
    const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`
    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: "influencers",
      public_id: `influencer_${influencerId}`,
      overwrite: true,
      // Same 256px square the user avatar upload stores.
      transformation: [{ width: 256, height: 256, crop: "fill", gravity: "face" }],
    })

    return uploaded.secure_url ?? null
  } catch (err) {
    // Never fails the save it is part of: the influencer's own fields still
    // persist, and the avatar is retried the next time one is supplied.
    console.error("[avatar-storage] could not store avatar:", (err as Error)?.message)
    return null
  }
}

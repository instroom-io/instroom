import { NextRequest, NextResponse } from "next/server"

const TIKTOK_URL_PATTERN = /(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i

export async function POST(req: NextRequest) {
  let url: unknown
  try {
    const body = await req.json()
    url = body?.url
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "Please paste a TikTok video link." }, { status: 400 })
  }

  if (!TIKTOK_URL_PATTERN.test(url)) {
    return NextResponse.json({ error: "That doesn't look like a TikTok link." }, { status: 400 })
  }

  try {
    const apiRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url.trim())}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      cache: "no-store",
    })

    if (!apiRes.ok) {
      return NextResponse.json({ error: "Couldn't reach the video source. Please try again." }, { status: 502 })
    }

    const json = await apiRes.json()
    const data = json?.data

    if (json?.code !== 0 || !data?.play) {
      return NextResponse.json({ error: "Couldn't fetch this video. Double-check the link and try again." }, { status: 422 })
    }

    const resolve = (path: string) => (path.startsWith("http") ? path : `https://www.tikwm.com${path}`)

    return NextResponse.json({
      id: data.id,
      title: data.title || "",
      cover: resolve(data.cover || data.origin_cover || ""),
      // `play` is the standard H.264 encode — widely playable everywhere.
      // `hdplay` is often HEVC/H.265, which many browsers and players can't decode, so we skip it.
      downloadUrl: resolve(data.play),
      duration: data.duration || null,
      likes: data.digg_count || 0,
      comments: data.comment_count || 0,
      shares: data.share_count || 0,
      author: data.author?.nickname || data.author?.unique_id || null,
      authorAvatar: data.author?.avatar ? resolve(data.author.avatar) : null,
    })
  } catch (err) {
    console.error("TikTok downloader error:", err)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}

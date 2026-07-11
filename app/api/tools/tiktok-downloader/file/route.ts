import { NextRequest, NextResponse } from "next/server"

const ALLOWED_HOSTS = [
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "muscdn.com",
  "tikwm.com",
  "p16-",
  "p19-",
  "v16-",
  "v19-",
]

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  const filename = req.nextUrl.searchParams.get("filename") || "tiktok-video.mp4"

  if (!url) return new NextResponse("Missing url", { status: 400 })

  const isAllowed = ALLOWED_HOSTS.some((h) => url.includes(h))
  if (!isAllowed) return new NextResponse("Host not allowed", { status: 403 })

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.tiktok.com/",
      },
      cache: "no-store",
    })

    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Failed to fetch video", { status: upstream.status || 502 })
    }

    const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, "_")

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        ...(upstream.headers.get("content-length") ? { "Content-Length": upstream.headers.get("content-length")! } : {}),
      },
    })
  } catch (err) {
    console.error("TikTok file proxy error:", err)
    return new NextResponse("Something went wrong", { status: 500 })
  }
}

// app/api/proxy-image/route.ts
import { NextRequest, NextResponse } from "next/server"

const ALLOWED_HOSTS = [
  "cdninstagram.com",
  "scontent-",
  "tiktokcdn.com",
  "tiktokcdn-eu.com",
  "p16-common",
  "p19-common",
  "muscdn.com",
]

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return new NextResponse("Missing url", { status: 400 })

  const isAllowed = ALLOWED_HOSTS.some(h => url.includes(h))
  if (!isAllowed) return new NextResponse("Host not allowed", { status: 403 })

  try {
    const isTikTok = url.includes("tiktok") || url.includes("p16-") || url.includes("p19-") || url.includes("muscdn")

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": isTikTok ? "https://www.tiktok.com/" : "https://www.instagram.com/",
        "sec-fetch-dest": "image",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "cross-site",
      },
    })

    if (!response.ok) return new NextResponse("Failed", { status: response.status })

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err) {
    console.error("Proxy error:", err)
    return new NextResponse("Proxy error", { status: 500 })
  }
}
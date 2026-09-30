import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getGmailAccessToken } from "@/lib/gmail"

export async function GET() {
  const session = await getServerSession(authOptions) as any
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const accessToken = await getGmailAccessToken(session.user?.id)
  if (!accessToken) {
    return NextResponse.json(
      { error: "No Google account linked. Please connect your Gmail account.", reauth: true },
      { status: 403 }
    )
  }

  try {
    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (res.status === 403) {
        return NextResponse.json(
          { error: "Instroom needs permission to read your Gmail signature. Please reconnect Gmail.", reauth: true },
          { status: 403 }
        )
      }
      throw new Error(err?.error?.message || "Failed to read Gmail signature")
    }

    const { sendAs = [] } = await res.json()
    const primary = sendAs.find((a: any) => a.isPrimary) || sendAs.find((a: any) => a.isDefault) || sendAs[0]
    const signature: string = primary?.signature || ""

    if (!signature.trim()) {
      return NextResponse.json({ error: "No signature is set in Gmail yet." }, { status: 404 })
    }

    return NextResponse.json({ signature })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to read Gmail signature" }, { status: 500 })
  }
}

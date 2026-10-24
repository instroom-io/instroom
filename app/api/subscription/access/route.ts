import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { withDbRetry } from "@/lib/prisma"
import { checkSubscriptionAccess } from "@/lib/subscription-access"
import { NextResponse } from "next/server"

// allowed: null = couldn't verify; the client lets the user through.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const brandId = new URL(request.url).searchParams.get("brandId")
  try {
    const allowed = await withDbRetry(() => checkSubscriptionAccess(userId, brandId))
    return NextResponse.json({ allowed })
  } catch (err) {
    console.error("Subscription access check failed — failing open:", err)
    return NextResponse.json({ allowed: null })
  }
}

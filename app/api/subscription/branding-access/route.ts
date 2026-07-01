import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return Response.json({ allowed: false, error: "Unauthorized" }, { status: 401 })
    }

    const { hasCustomBranding } = await import("@/lib/subscription-limits")
    const result = await hasCustomBranding(session.user.id)

    return Response.json({
      allowed: result.allowed,
      message: result.message,
    })
  } catch (error) {
    console.error("Error checking branding access:", error)
    return Response.json({ allowed: false, error: "Failed to check access" }, { status: 500 })
  }
}

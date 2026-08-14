import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { safeRedirectPath } from "@/lib/safe-redirect"

// Where a successful OAuth sign-in lands.
//
// Three outcomes, in order: back to the page the user was originally trying to
// reach, or the dashboard if onboarding is done, or onboarding if it isn't.
export async function GET(req: NextRequest) {
  try {
    // getServerSession() with no arguments builds a config-less session and
    // silently loses everything the callbacks add — including user.id and the
    // expiry. Passing authOptions is what makes this the same session every
    // other route sees.
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    // Honour the destination the user was heading to before being bounced to
    // login. Validated: it arrived as a query parameter.
    const requested = req.nextUrl.searchParams.get("callbackUrl")
    if (requested) {
      const target = safeRedirectPath(requested, "")
      if (target) return NextResponse.redirect(new URL(target, req.url))
    }

    const onboarding = await prisma.onboarding.findFirst({
      where: {
        user: { email: session.user.email },
      },
    })

    const isComplete = !!onboarding?.completed_at

    return NextResponse.redirect(
      new URL(isComplete ? "/dashboard/manage-influencers" : "/onboarding", req.url)
    )
  } catch (error) {
    console.error("Auth redirect error:", error)
    return NextResponse.redirect(new URL("/onboarding", req.url))
  }
}

import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"

// Single hardcoded mock admin account for this MVP — see the note in the
// task this shipped with. A real role-based system replaces this later;
// until then, gating checks platform_role (threaded through the JWT/session
// in lib/auth.ts) OR this exact email, so an existing admin row created
// before platform_role was wired up still works.
export const ADMIN_EMAIL = "admin@instroom.io"

export function isAdminSession(session: { user?: { email?: string | null; platform_role?: string } } | null): boolean {
  if (!session?.user) return false
  return session.user.platform_role === "admin" || session.user.email === ADMIN_EMAIL
}

/**
 * Use at the top of every /api/admin/* route handler:
 *   const gate = await requireAdmin()
 *   if (gate) return gate
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/** Returns the session iff it's the admin, otherwise null — for read helpers
 *  that need the admin's email (e.g. for audit logging) without re-checking. */
export async function getAdminSession() {
  const session = await getServerSession(authOptions)
  if (!isAdminSession(session)) return null
  return session
}

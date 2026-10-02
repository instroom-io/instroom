// lib/research-sop/auth.ts
//
// One gate for every research-SOP route, built only from the app's existing
// pieces: the next-auth session, brand membership (lib/brand-access) and role
// capabilities (lib/permissions). No new permission concept is introduced:
//
//   read SOPs (the playbook)      any member of the brand
//   manage SOPs (create/edit/…)   "manageCampaigns"   — Owner + Manager

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasBrandCapability, type BrandCapability } from "@/lib/permissions"

export type SopGate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

export const SOP_MANAGE_CAPABILITY: BrandCapability = "manageCampaigns"

export async function requireSopAccess(
  brandId: string,
  capability?: BrandCapability
): Promise<SopGate> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  // Active brand the user owns or belongs to — the same test the pipeline and
  // attribution routes apply.
  const access = await prisma.brand.count({
    where: {
      id: brandId,
      is_active: true,
      OR: [{ owner_id: userId }, { members: { some: { user_id: userId } } }],
    },
  })
  if (access === 0) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  }

  if (capability && !(await hasBrandCapability(brandId, userId, capability))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, userId }
}

/**
 * The research-SOP tables don't exist yet — the 20261001_add_research_sops
 * migration hasn't been applied to this database. Prisma reports a missing
 * table as P2021 and a missing column as P2022.
 */
export function isSopSchemaMissing(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === "P2021" || code === "P2022"
}

/** A generic 500 that never leaks internals to the browser. */
export function serverError(context: string, error: unknown) {
  if (isSopSchemaMissing(error)) {
    // Not a failure the user can retry — the beta feature isn't set up here yet.
    return NextResponse.json(
      { error: "SOPs aren't enabled on this workspace yet.", notReady: true },
      { status: 503 }
    )
  }
  console.error(`${context}:`, error)
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
}

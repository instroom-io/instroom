import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

function toCsv(rows: {
  name: string | null; email: string; role: string | null
  invited_at: Date | null; created_at: Date
  ghl_sync_status: string; ghl_synced_at: Date | null
}[]): string {
  const header = "Name,Email,Role,Registration Date,Invited,GHL Sync Status,GHL Synced At"
  const lines = rows.map((r) =>
    [
      r.name || "",
      r.email,
      r.role || "",
      r.created_at.toISOString().slice(0, 10),
      r.invited_at ? r.invited_at.toISOString().slice(0, 10) : "",
      r.ghl_sync_status,
      r.ghl_synced_at ? r.ghl_synced_at.toISOString().slice(0, 10) : "",
    ]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(",")
  )
  return [header, ...lines].join("\n")
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  const q = req.nextUrl.searchParams.get("q")?.trim() || ""
  const format = req.nextUrl.searchParams.get("format")

  const signups = await prisma.earlyAccessSignup.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : undefined,
    orderBy: { created_at: "asc" },
    select: {
      id: true, name: true, email: true, role: true, phone: true,
      invited_at: true, created_at: true, user_id: true,
      ghl_contact_id: true, ghl_sync_status: true, ghl_synced_at: true, ghl_sync_error: true,
    },
  })

  if (format === "csv") {
    return new NextResponse(toCsv(signups), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="early-access-signups.csv"`,
      },
    })
  }

  return NextResponse.json({ users: signups })
}

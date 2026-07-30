import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"

function toCsv(rows: { name: string | null; email: string; role: string | null; invited_at: Date | null; created_at: Date }[]): string {
  const header = "Name,Email,Role,Registration Date,Invited"
  const lines = rows.map((r) =>
    [
      r.name || "",
      r.email,
      r.role || "",
      r.created_at.toISOString().slice(0, 10),
      r.invited_at ? r.invited_at.toISOString().slice(0, 10) : "",
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
    select: { id: true, name: true, email: true, role: true, invited_at: true, created_at: true },
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

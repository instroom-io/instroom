import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"
import { EARLY_ACCESS_CUTOFF } from "@/lib/admin-constants"

function toCsv(rows: { name: string | null; email: string; created_at: Date }[]): string {
  const header = "Name,Email,Registration Date"
  const lines = rows.map((r) =>
    [r.name || "", r.email, r.created_at.toISOString().slice(0, 10)]
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

  const users = await prisma.user.findMany({
    where: {
      created_at: { lt: EARLY_ACCESS_CUTOFF },
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
    },
    orderBy: { created_at: "asc" },
    select: { name: true, email: true, created_at: true },
  })

  if (format === "csv") {
    return new NextResponse(toCsv(users), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="early-access-users.csv"`,
      },
    })
  }

  return NextResponse.json({ users })
}

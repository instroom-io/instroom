import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payments = await prisma.paymentHistory.findMany({
      where: { user_id: session.user.id },
      orderBy: { created_at: "desc" },
      take: 12,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        description: true,
        invoice_url: true,
        created_at: true,
      },
    })

    // decimal -> number for the client
    const formatted = payments.map(p => ({
      ...p,
      amount: Number(p.amount),
    }))

    return NextResponse.json({ payments: formatted })
  } catch (error) {
    console.error("Error fetching payment history:", error)
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    )
  }
}
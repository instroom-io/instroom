import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isWithinRefundWindow } from "@/lib/refund-eligibility"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const payments = await prisma.paymentHistory.findMany({
      where: { user_id: userId },
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

    // Refund eligibility needs the user's TRUE earliest payment, which can
    // fall outside this take:12 window for a long-tenured user — but that's
    // fine, since a payment more than 7 days old can never be eligible
    // anyway, so it doesn't matter that it isn't in `payments` here.
    const [earliest, existingRequests] = await Promise.all([
      prisma.paymentHistory.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: "asc" },
        select: { id: true },
      }),
      prisma.refundRequest.findMany({
        where: { payment_history_id: { in: payments.map((p) => p.id) } },
        select: { payment_history_id: true, status: true },
        orderBy: { created_at: "desc" },
      }),
    ])

    const requestStatusByPaymentId = new Map<string, string>()
    for (const r of existingRequests) {
      if (!requestStatusByPaymentId.has(r.payment_history_id)) {
        requestStatusByPaymentId.set(r.payment_history_id, r.status)
      }
    }

    // decimal -> number for the client. stripe_payment_id (the real Lemon
    // Squeezy order id) is deliberately never selected/sent to the client.
    const formatted = payments.map((p) => {
      const refundRequestStatus = requestStatusByPaymentId.get(p.id) ?? null
      const eligibleForRefund =
        p.status === "completed" &&
        p.id === earliest?.id &&
        isWithinRefundWindow(p.created_at) &&
        refundRequestStatus !== "pending" &&
        refundRequestStatus !== "approved"

      return {
        ...p,
        amount: Number(p.amount),
        eligibleForRefund,
        refundRequestStatus,
      }
    })

    return NextResponse.json({ payments: formatted })
  } catch (error) {
    console.error("Error fetching payment history:", error)
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    )
  }
}
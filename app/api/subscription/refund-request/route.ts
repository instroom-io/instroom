import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkRefundEligibility } from "@/lib/refund-eligibility"
import { sendRefundRequestSubmittedEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const paymentHistoryId = typeof body.paymentHistoryId === "string" ? body.paymentHistoryId : ""
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""

    if (!paymentHistoryId) {
      return NextResponse.json({ error: "paymentHistoryId is required" }, { status: 400 })
    }
    if (reason.length < 10 || reason.length > 1000) {
      return NextResponse.json(
        { error: "Please tell us a bit more — between 10 and 1000 characters." },
        { status: 400 }
      )
    }

    const userId = session.user.id
    const eligibility = await checkRefundEligibility(userId, paymentHistoryId)
    if (!eligibility.eligible) {
      const messages: Record<string, string> = {
        not_found: "We couldn't find that charge.",
        not_completed: "That charge isn't eligible for a refund.",
        not_first_payment: "Only your first charge is eligible for a refund under our new-subscriber window.",
        window_expired: "The 7-day refund window for that charge has passed.",
        already_requested: "A refund request for this charge has already been submitted.",
      }
      return NextResponse.json(
        { error: messages[eligibility.reason || ""] || "This charge isn't eligible for a refund.", reason: eligibility.reason },
        { status: 409 }
      )
    }

    const payment = await prisma.paymentHistory.findUnique({
      where: { id: paymentHistoryId },
      select: { amount: true, currency: true },
    })
    if (!payment) {
      return NextResponse.json({ error: "We couldn't find that charge." }, { status: 404 })
    }

    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: userId },
      include: { plan: true },
    })

    const refundRequest = await prisma.refundRequest.create({
      data: {
        user_id: userId,
        payment_history_id: paymentHistoryId,
        amount: payment.amount,
        currency: payment.currency,
        plan_name: subscription?.plan.display_name ?? null,
        reason,
      },
    })

    // Best-effort — a failed notification shouldn't fail the request itself;
    // the admin queue is still the source of truth for pending requests.
    sendRefundRequestSubmittedEmail({
      userEmail: session.user.email || "",
      userName: session.user.name || null,
      amount: Number(payment.amount),
      currency: payment.currency,
      reason,
      refundRequestId: refundRequest.id,
    }).catch(() => void 0)

    return NextResponse.json({ refundRequest }, { status: 201 })
  } catch (error) {
    console.error("POST refund-request error:", error)
    return NextResponse.json({ error: "Failed to submit refund request" }, { status: 500 })
  }
}

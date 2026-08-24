import "server-only"
import { prisma } from "@/lib/prisma"

/** New subscribers get a full refund if they ask within this many days of
 *  their first-ever charge — see app/refund/page.tsx, Section 04. Exported
 *  so the payment-history list route can batch-compute eligibility for
 *  several rows without re-deriving this constant. */
const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function isWithinRefundWindow(date: Date): boolean {
  return Date.now() - date.getTime() <= REFUND_WINDOW_MS
}

export type RefundIneligibleReason =
  | "not_found"
  | "not_completed"
  | "not_first_payment"
  | "window_expired"
  | "already_requested"

export interface RefundEligibilityResult {
  eligible: boolean
  reason?: RefundIneligibleReason
}

/**
 * Authoritative, single-record eligibility check — used by the submission
 * route to re-validate server-side. Never trust a client-supplied
 * eligibility flag; the payment-history list route's batched version of
 * this same logic is for display only.
 */
export async function checkRefundEligibility(
  userId: string,
  paymentHistoryId: string
): Promise<RefundEligibilityResult> {
  const payment = await prisma.paymentHistory.findFirst({
    where: { id: paymentHistoryId, user_id: userId },
    select: { id: true, status: true, created_at: true },
  })
  if (!payment) return { eligible: false, reason: "not_found" }

  if (payment.status !== "completed") {
    return { eligible: false, reason: "not_completed" }
  }

  // First-ever charge only — a renewal payment on an existing subscription
  // never qualifies, even if it happens to be within the last 7 days.
  const earliest = await prisma.paymentHistory.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
    select: { id: true },
  })
  if (earliest?.id !== payment.id) {
    return { eligible: false, reason: "not_first_payment" }
  }

  if (!isWithinRefundWindow(payment.created_at)) {
    return { eligible: false, reason: "window_expired" }
  }

  const existing = await prisma.refundRequest.findFirst({
    where: { payment_history_id: payment.id, status: { in: ["pending", "approved"] } },
    select: { id: true },
  })
  if (existing) {
    return { eligible: false, reason: "already_requested" }
  }

  return { eligible: true }
}

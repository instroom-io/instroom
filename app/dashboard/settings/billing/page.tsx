"use client"
// app/dashboard/settings/billing/page.tsx

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  IconArrowRight,
  IconCreditCard,
  IconAlertCircle,
  IconFileInvoice,
} from "@tabler/icons-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type PaymentMethod = {
  cardBrand: string | null
  cardLastFour: string | null
  customerPortalUrl: string | null
}

type PaymentRecord = {
  id: string
  amount: number
  currency: string
  status: string
  description: string | null
  invoice_url: string | null
  created_at: string
}

export default function BillingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [subscription, setSubscription] = useState<any>(null)
  const [brandCount, setBrandCount] = useState<number>(0)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [paymentMethodLoading, setPaymentMethodLoading] = useState(true)

  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Fetch subscription (same call as settings page) ──────────────────────
  const fetchSubscription = () => {
    if (!session?.user?.id) return
    fetch("/api/subscription/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: session.user.id }),
    })
      .then(r => r.json())
      .then(d => setSubscription(d.subscription))
      .catch(() => {})
  }

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return }
    if (status !== "authenticated" || !session?.user?.id) return
    fetchSubscription()
  }, [status, session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Brand count (same call as settings page) ──────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/user/brand-usage")
      .then(r => r.json())
      .then(d => setBrandCount(d.brandCount || 0))
      .catch(() => {})
  }, [session?.user?.id])

  // ── Payment method (card on file via Lemon Squeezy) ───────────────────────
  useEffect(() => {
    if (!session?.user?.id) return
    setPaymentMethodLoading(true)
    fetch("/api/subscription/payment-method")
      .then(r => r.json())
      .then(d => setPaymentMethod(d.paymentMethod))
      .catch(() => setPaymentMethod(null))
      .finally(() => setPaymentMethodLoading(false))
  }, [session?.user?.id])

  // ── Billing history ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return
    setPaymentsLoading(true)
    fetch("/api/subscription/payment-history")
      .then(r => r.json())
      .then(d => setPayments(d.payments || []))
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false))
  }, [session?.user?.id])

  // ── Subscription display helpers (same as settings page) ─────────────────
  const planColors: Record<string, string> = {
    solo: "bg-stone-100 text-stone-700",
    team: "bg-emerald-50 text-emerald-800",
    agency: "bg-amber-50 text-amber-800",
  }
  const planName = subscription?.plan?.name?.toLowerCase() || "solo"
  const planLabel = ({ solo: "Solo", team: "Team", agency: "Agency" } as Record<string, string>)[planName] || "Solo"
  const planColor = planColors[planName] || planColors.solo

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function openBillingPortal() {
    try {
      const res = await fetch("/api/subscription/billing-portal", { method: "POST" })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else showToast("Could not open billing portal", "error")
    } catch {
      showToast("Could not open billing portal", "error")
    }
  }

  async function handleCancelSubscription() {
    if (!confirmCancel) { setConfirmCancel(true); return }
    setCancelling(true)
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to cancel subscription")
      showToast("Subscription cancelled. You'll retain access until the period ends.", "success")
      setConfirmCancel(false)
      fetchSubscription()
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error")
      setConfirmCancel(false)
    } finally {
      setCancelling(false)
    }
  }

  // ── Usage bar data ─────────────────────────────────────────────────────────
  function usageRows() {
    const maxBrands = subscription?.plan?.max_brands || subscription?.plan?.included_brands
    const maxSeats = subscription?.plan?.max_seats || subscription?.plan?.included_seats
    const seatCount = subscription?.seat_count ?? 1

    const brandsUnlimited = maxBrands === null || maxBrands > 100
    const seatsUnlimited = maxSeats === null || maxSeats > 100

    const rows = [
      {
        label: "Brands",
        used: brandCount,
        max: brandsUnlimited ? null : maxBrands,
      },
      {
        label: "Team members",
        used: seatCount,
        max: seatsUnlimited ? null : maxSeats,
      },
    ]

    return rows
  }

  function formatMoney(amount: number, currency: string) {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)
    } catch {
      return `$${amount.toFixed(2)}`
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const statusColors: Record<string, string> = {
    paid: "bg-emerald-50 text-emerald-700",
    succeeded: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
    refunded: "bg-gray-100 text-gray-600",
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 rounded-full border-2 border-[#1FAE5B] border-t-transparent animate-spin" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 pb-16 space-y-0">

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 right-6 z-50 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg"
          style={{ background: toast.type === "success" ? "#1FAE5B" : "#E24B4A" }}
        >
          {toast.message}
        </div>
      )}

      <section id="billing" className="space-y-6">
        <div className="flex items-center gap-3 pt-2 pb-1">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100">
            <IconCreditCard size={18} className="text-gray-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Billing &amp; Subscription</h2>
            <p className="text-sm text-muted-foreground">Manage your plan, usage, and payment method</p>
          </div>
        </div>

        {!subscription ? (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-sm text-gray-500">No active subscription found.</p>
              <Link href="/pricing?cycle=monthly">
                <Button className="bg-[#1FAE5B] hover:bg-[#0F6B3E] gap-1">
                  View Plans <IconArrowRight size={14} />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">

            {/* Current plan + usage */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Current Plan</CardTitle>
                    <CardDescription>
                      Billed {subscription.billing_cycle || "monthly"}
                      {subscription.current_period_end &&
                        ` · Next renewal ${new Date(subscription.current_period_end).toLocaleDateString()}`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Plan banner */}
                <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md ${planColor}`}>
                      {planLabel}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {subscription.plan?.display_name || `Plan ${planLabel}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{subscription.status}</p>
                    </div>
                  </div>
                  {subscription.plan?.price != null && (
                    <div className="text-right">
                      <span className="text-xl font-bold text-gray-900">
                        ${subscription.plan.price}
                      </span>
                      <span className="text-xs text-gray-500">/{subscription.billing_cycle === "yearly" ? "year" : "month"}</span>
                    </div>
                  )}
                </div>

                {/* Usage this period */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Usage this period</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {usageRows().map(row => {
                      const pct = row.max ? Math.min(100, Math.round((row.used / row.max) * 100)) : 100
                      return (
                        <div key={row.label} className="rounded-lg bg-gray-50 px-4 py-3">
                          <p className="text-xs text-gray-500">{row.label}</p>
                          <p className="text-sm font-semibold text-gray-900 mt-0.5">
                            {row.used} <span className="font-normal text-gray-400">of {row.max ?? "unlimited"}</span>
                          </p>
                          <div className="h-1.5 w-full rounded-full bg-gray-200 mt-2 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#1FAE5B]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {subscription.cancel_at_period_end && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    <IconAlertCircle size={15} className="shrink-0" />
                    Plan cancels on {new Date(subscription.current_period_end).toLocaleDateString()}. Access continues until then.
                  </div>
                )}

                <div className="flex gap-2 flex-wrap pt-1">
                  <Link href="/pricing?cycle=monthly">
                    <Button variant="outline" size="sm" className="text-[#0F6B3E] border-[#1FAE5B] hover:bg-[#1FAE5B] hover:text-white gap-1">
                      Upgrade plan <IconArrowRight size={14} />
                    </Button>
                  </Link>
                  {planName !== "free" && !subscription.cancel_at_period_end && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelSubscription}
                        disabled={cancelling}
                        className={confirmCancel
                          ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
                          : "border-red-300 text-red-600 hover:bg-red-50"}
                      >
                        {cancelling ? "Cancelling…" : confirmCancel ? "Confirm cancel" : "Cancel subscription"}
                      </Button>
                      {confirmCancel && (
                        <Button variant="outline" size="sm" onClick={() => setConfirmCancel(false)}>
                          Keep plan
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment method */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Method</CardTitle>
                <CardDescription>
                  {paymentMethod?.cardLastFour
                    ? `${paymentMethod.cardBrand ? paymentMethod.cardBrand.toUpperCase() : "Card"} ending in ${paymentMethod.cardLastFour}`
                    : "No card on file"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentMethodLoading ? (
                  <div className="h-14 rounded-lg bg-gray-50 animate-pulse" />
                ) : paymentMethod?.cardLastFour ? (
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-6 rounded bg-gray-100 text-[10px] font-bold text-gray-500 uppercase">
                        {paymentMethod.cardBrand?.slice(0, 4) || "Card"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {paymentMethod.cardBrand ? paymentMethod.cardBrand.toUpperCase() : "Card"} •••• {paymentMethod.cardLastFour}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (paymentMethod.customerPortalUrl) window.location.href = paymentMethod.customerPortalUrl
                        else openBillingPortal()
                      }}
                    >
                      Update
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 px-4 py-4">
                    <p className="text-sm text-gray-500">No payment method on file yet.</p>
                    <Button variant="outline" size="sm" onClick={openBillingPortal}>
                      Add payment method
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Billing history */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Billing History</CardTitle>
                <CardDescription>Your past invoices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {paymentsLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="h-10 rounded-lg bg-gray-50 animate-pulse" />
                    ))}
                  </div>
                ) : payments.length === 0 ? (
                  <div className="py-10 text-center">
                    <IconFileInvoice size={22} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No invoices yet.</p>
                  </div>
                ) : (
                  payments.map(p => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-3 border-b border-dashed border-gray-100 last:border-0 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-medium">{formatDate(p.created_at)}</p>
                        <p className="text-gray-500 text-xs mt-0.5 truncate">{p.description || "Subscription payment"}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-gray-900 font-medium">{formatMoney(p.amount, p.currency)}</span>
                        <span className={`text-xs font-medium px-2 py-1 rounded-md capitalize ${statusColors[p.status?.toLowerCase()] || "bg-gray-100 text-gray-600"}`}>
                          {p.status}
                        </span>
                        {p.invoice_url ? (
                          <a
                            href={p.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0F6B3E] hover:underline text-xs font-medium"
                          >
                            View
                          </a>
                        ) : (
                          <span className="w-8" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </section>
    </div>
  )
}
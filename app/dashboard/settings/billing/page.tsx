"use client"
// app/dashboard/settings/billing/page.tsx

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  CreditCard,
  AlertCircle,
  FileText,
  Loader2,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

function LoadingScreen() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Loading</p>
    </div>
  )
}

export default function BillingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [subscription, setSubscription] = useState<any>(null)
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false)
  const [brandCount, setBrandCount] = useState<number>(0)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [paymentMethodLoaded, setPaymentMethodLoaded] = useState(false)

  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [paymentsLoaded, setPaymentsLoaded] = useState(false)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchSubscription = () => {
    if (!session?.user?.id) return
    fetch("/api/subscription/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: session.user.id }),
    })
      .then((r) => r.json())
      .then((d) => setSubscription(d.subscription))
      .catch(() => {})
      .finally(() => setSubscriptionLoaded(true))
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status !== "authenticated" || !session?.user?.id) return
    fetchSubscription()
  }, [status, session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/user/brand-usage")
      .then((r) => r.json())
      .then((d) => setBrandCount(d.brandCount || 0))
      .catch(() => {})
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/subscription/payment-method")
      .then((r) => r.json())
      .then((d) => setPaymentMethod(d.paymentMethod))
      .catch(() => setPaymentMethod(null))
      .finally(() => setPaymentMethodLoaded(true))
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/subscription/payment-history")
      .then((r) => r.json())
      .then((d) => setPayments(d.payments || []))
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoaded(true))
  }, [session?.user?.id])

  const planColors: Record<string, string> = {
    solo: "bg-stone-100 text-stone-700",
    team: "bg-emerald-50 text-emerald-800",
    agency: "bg-amber-50 text-amber-800",
  }
  const planName = subscription?.plan?.name?.toLowerCase() || "solo"
  const planLabel = ({ solo: "Solo", team: "Team", agency: "Agency" } as Record<string, string>)[planName] || "Solo"
  const planColor = planColors[planName] || planColors.solo

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
    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }
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

  function usageRows() {
    const maxBrands = subscription?.plan?.max_brands || subscription?.plan?.included_brands
    const maxSeats = subscription?.plan?.max_seats || subscription?.plan?.included_seats
    const seatCount = subscription?.seat_count ?? 1

    const brandsUnlimited = maxBrands === null || maxBrands > 100
    const seatsUnlimited = maxSeats === null || maxSeats > 100

    return [
      { label: "Brands", used: brandCount, max: brandsUnlimited ? null : maxBrands },
      { label: "Team members", used: seatCount, max: seatsUnlimited ? null : maxSeats },
    ]
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

  // Single gate: wait for session AND every fetch this page depends on
  // before rendering anything, same pattern as the other settings pages.
  const allLoaded = subscriptionLoaded && paymentMethodLoaded && paymentsLoaded

  if (status === "loading" || !allLoaded) {
    return <LoadingScreen />
  }

  return (
    <div className="max-w-3xl px-9 py-7">
      {toast && (
        <div
          className={cn(
            "fixed top-5 right-6 z-[9999] rounded-[10px] px-4.5 py-2.5 text-[13px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]",
            toast.type === "success" ? "bg-emerald-600" : "bg-red-500"
          )}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Billing & Subscription</h1>
        <p className="text-xs text-muted-foreground">Manage your plan, usage, and payment method</p>
      </div>

      {!subscription ? (
        <Card className="mb-4">
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">No active subscription found.</p>
            <Link href="/pricing?cycle=monthly">
              <Button className="gap-1 bg-[#15803d] text-white hover:bg-[#166534]">
                View Plans <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Current Plan */}
          <Card className="mb-4">
            <div className="flex items-center gap-3 border-b px-5 py-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
                <CreditCard className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-foreground">Current Plan</p>
                <p className="text-xs leading-tight text-muted-foreground">
                  Billed {subscription.billing_cycle || "monthly"}
                  {subscription.current_period_end &&
                    ` · Next renewal ${new Date(subscription.current_period_end).toLocaleDateString()}`}
                </p>
              </div>
            </div>

            <CardContent className="space-y-5 pt-5">
              {/* Plan banner */}
              <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${planColor}`}>
                    {planLabel}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {subscription.plan?.display_name || `Plan ${planLabel}`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{subscription.status}</p>
                  </div>
                </div>
                {subscription.plan?.price != null && (
                  <div className="text-right">
                    <span className="text-xl font-bold text-foreground">${subscription.plan.price}</span>
                    <span className="text-xs text-muted-foreground">
                      /{subscription.billing_cycle === "yearly" ? "year" : "month"}
                    </span>
                  </div>
                )}
              </div>

              {/* Usage */}
              <div>
                <p className="mb-3 text-sm font-medium text-foreground">Usage this period</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {usageRows().map((row) => {
                    const pct = row.max ? Math.min(100, Math.round((row.used / row.max) * 100)) : 100
                    return (
                      <div key={row.label} className="rounded-lg bg-muted/50 px-4 py-3">
                        <p className="text-xs text-muted-foreground">{row.label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">
                          {row.used}{" "}
                          <span className="font-normal text-muted-foreground">of {row.max ?? "unlimited"}</span>
                        </p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {subscription.cancel_at_period_end && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Plan cancels on {new Date(subscription.current_period_end).toLocaleDateString()}. Access continues
                  until then.
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Link href="/pricing?cycle=monthly">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 border-emerald-600 text-emerald-800 hover:bg-emerald-600 hover:text-white"
                  >
                    Upgrade plan <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                {planName !== "free" && !subscription.cancel_at_period_end && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelSubscription}
                      disabled={cancelling}
                      className={
                        confirmCancel
                          ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
                          : "border-red-300 text-red-600 hover:bg-red-50"
                      }
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

          {/* Payment Method */}
          <Card className="mb-4">
            <div className="flex items-center gap-3 border-b px-5 py-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
                <CreditCard className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-foreground">Payment Method</p>
                <p className="text-xs leading-tight text-muted-foreground">
                  {paymentMethod?.cardLastFour
                    ? `${paymentMethod.cardBrand ? paymentMethod.cardBrand.toUpperCase() : "Card"} ending in ${paymentMethod.cardLastFour}`
                    : "No card on file"}
                </p>
              </div>
            </div>

            <CardContent className="pt-4">
              {paymentMethod?.cardLastFour ? (
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-9 items-center justify-center rounded bg-muted text-[10px] font-bold uppercase text-muted-foreground">
                      {paymentMethod.cardBrand?.slice(0, 4) || "Card"}
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {paymentMethod.cardBrand ? paymentMethod.cardBrand.toUpperCase() : "Card"} ••••{" "}
                      {paymentMethod.cardLastFour}
                    </p>
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
                <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-4">
                  <p className="text-sm text-muted-foreground">No payment method on file yet.</p>
                  <Button variant="outline" size="sm" onClick={openBillingPortal}>
                    Add payment method
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing History */}
          <Card className="mb-4">
            <div className="flex items-center gap-3 border-b px-5 py-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
                <FileText className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-foreground">Billing History</p>
                <p className="text-xs leading-tight text-muted-foreground">Your past invoices</p>
              </div>
            </div>

            <CardContent className="pt-2">
              {payments.length === 0 ? (
                <div className="py-10 text-center">
                  <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                </div>
              ) : (
                payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border-b border-dashed py-3 text-sm last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{formatDate(p.created_at)}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.description || "Subscription payment"}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-4">
                      <span className="font-medium text-foreground">{formatMoney(p.amount, p.currency)}</span>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium capitalize ${
                          statusColors[p.status?.toLowerCase()] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.invoice_url ? (
                        <a
                          href={p.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-emerald-700 hover:underline"
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
        </>
      )}
    </div>
  )
}
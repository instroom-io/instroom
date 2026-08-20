"use client"
// app/dashboard/settings/integrations/page.tsx

import { useEffect, useState, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Link2, ShoppingCart, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { SettingsSkeleton } from "@/components/shared/skeletons"
import { fetchCached, invalidateCache, getCachedData } from "@/lib/data-cache"

function LoadingScreen() {
  return (
    <SettingsSkeleton
      sections={[{ rows: 5, iconShape: "square", rightShape: "button" }]}
      label="Loading integrations…"
    />
  )
}

type Toast = { message: string; type: "success" | "error" }

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)
  const show = (message: string, type: Toast["type"]) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }
  return { toast, show }
}

type IntegrationId =
  | "uppromote"
  | "goaffpro"
  | "shopify"
  | "woocommerce"
  | "gdrive"

type IntegrationState = {
  connected: boolean
  connectedAs?: string
  unmatchedOrders?: number
}

type IntegrationsMap = Record<IntegrationId, IntegrationState>

const DEFAULT_STATE: IntegrationsMap = {
  uppromote: { connected: false },
  goaffpro: { connected: false },
  shopify: { connected: false },
  woocommerce: { connected: false },
  gdrive: { connected: false },
}

function IntegrationsContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast, show } = useToast()

  const brandId = searchParams.get("brandId")

  // Seeded from the shared cache (the same entry the Post Tracker reads), so a
  // revisit renders the connected integrations immediately.
  const cachedIntegrations = brandId
    ? getCachedData<{ integrations?: IntegrationsMap }>(`/api/settings/integrations?brandId=${brandId}`)
    : undefined

  const [loading, setLoading] = useState(cachedIntegrations === undefined)
  const [integrations, setIntegrations] = useState<IntegrationsMap>(
    cachedIntegrations?.integrations ?? DEFAULT_STATE
  )
  const [pendingId, setPendingId] = useState<IntegrationId | null>(null)
  const [goaffproSyncing, setGoaffproSyncing] = useState(false)

  const [goaffproModalOpen, setGoaffproModalOpen] = useState(false)
  const [goaffproAccessToken, setGoaffproAccessToken] = useState("")
  const [goaffproWebhookSecret, setGoaffproWebhookSecret] = useState("")

  const goaffproWebhookUrl =
    typeof window !== "undefined" && brandId
      ? `${window.location.origin}/api/webhooks/goaffpro/orders/${brandId}`
      : ""

  const [shopifySyncing, setShopifySyncing] = useState(false)
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false)
  const [shopifyShopDomain, setShopifyShopDomain] = useState("")

  // Shopify connects via a full-page OAuth redirect, not a fetch — it lands
  // back here with ?shopify=connected or ?shopify_error=... once done.
  useEffect(() => {
    const shopifyResult = searchParams.get("shopify")
    const shopifyError = searchParams.get("shopify_error")
    if (!shopifyResult && !shopifyError) return

    if (shopifyResult === "connected") {
      show("Shopify connected", "success")
    } else if (shopifyError) {
      show(shopifyError, "error")
    }

    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete("shopify")
    cleanUrl.searchParams.delete("shopify_error")
    router.replace(cleanUrl.pathname + cleanUrl.search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!brandId) {
      setLoading(false)
      return
    }

    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status !== "authenticated") return

    // Shared cache entry — the same key the Post Tracker reads, so switching
    // between them does not repeat the request.
    fetchCached<any>(`/api/settings/integrations?brandId=${brandId}`, async () => {
      const r = await fetch(`/api/settings/integrations?brandId=${encodeURIComponent(brandId)}`)
      if (!r.ok) throw new Error(`Request failed (${r.status})`)
      return r.json()
    })
      .then((data) => {
        if (data.integrations) setIntegrations(data.integrations)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status, brandId, router])

  async function handleConnect(id: IntegrationId, label: string) {
    if (id === "goaffpro") {
      setGoaffproAccessToken("")
      setGoaffproWebhookSecret("")
      setGoaffproModalOpen(true)
      return
    }
    if (id === "shopify") {
      setShopifyShopDomain("")
      setShopifyModalOpen(true)
      return
    }

    setPendingId(id)
    try {
      const res = await fetch("/api/settings/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, brandId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to connect ${label}`)
      invalidateCache(`/api/settings/integrations?brandId=${brandId}`)

      setIntegrations((prev) => ({
        ...prev,
        [id]: { connected: true, connectedAs: data.connectedAs },
      }))
      show(`${label} connected`, "success")
    } catch (err: any) {
      show(err.message || "Something went wrong", "error")
    } finally {
      setPendingId(null)
    }
  }

  async function handleGoAffProConnectSubmit() {
    if (!goaffproAccessToken.trim()) {
      show("GoAffPro access token is required", "error")
      return
    }

    setPendingId("goaffpro")
    try {
      const res = await fetch("/api/settings/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "goaffpro",
          brandId,
          accessToken: goaffproAccessToken.trim(),
          webhookSecret: goaffproWebhookSecret.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to connect GoAffPro")
      invalidateCache(`/api/settings/integrations?brandId=${brandId}`)

      setIntegrations((prev) => ({
        ...prev,
        goaffpro: { connected: true, connectedAs: data.connectedAs },
      }))
      setGoaffproModalOpen(false)
      show("GoAffPro connected", "success")
    } catch (err: any) {
      show(err.message || "Something went wrong", "error")
    } finally {
      setPendingId(null)
    }
  }

  // Shopify connects via OAuth — this navigates the browser away to Shopify's
  // consent screen (not a fetch call), so there's no local success/error
  // handling here; the callback route redirects back with ?shopify=connected
  // or ?shopify_error=..., handled by the effect above.
  function handleShopifyConnectSubmit() {
    if (!shopifyShopDomain.trim()) {
      show("Shop domain is required", "error")
      return
    }

    const url = `/api/settings/integrations/shopify/install?brandId=${encodeURIComponent(
      brandId ?? ""
    )}&shopDomain=${encodeURIComponent(shopifyShopDomain.trim())}`
    window.location.href = url
  }

  async function handleDisconnect(id: IntegrationId, label: string) {
    setPendingId(id)
    try {
      const res = await fetch("/api/settings/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, brandId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to disconnect ${label}`)

      setIntegrations((prev) => ({ ...prev, [id]: { connected: false } }))
      // Other pages (Post Tracker) read the same cached entry.
      invalidateCache(`/api/settings/integrations?brandId=${brandId}`)
      show(`${label} disconnected`, "success")
    } catch (err: any) {
      show(err.message || "Something went wrong", "error")
    } finally {
      setPendingId(null)
    }
  }

  function handleManage(label: string) {
    show(`${label} settings opened`, "success")
  }

  async function handleGoAffProManage() {
    setGoaffproSyncing(true)

    try {
      const res = await fetch(
        `/api/settings/integrations/goaffpro/clicks?days=7&brandId=${encodeURIComponent(brandId ?? "")}`
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to sync GoAffPro clicks")
      }

      const topAffiliate = data?.data?.affiliates?.[0]
      const topLabel = topAffiliate
        ? topAffiliate.name || topAffiliate.email || topAffiliate.ref_code || topAffiliate.id
        : null

      show(
        topLabel
          ? `GoAffPro synced: ${data.data.totalClicks} clicks in the last ${data.data.windowDays} days. Top affiliate: ${topLabel} (${topAffiliate.clicks})`
          : `GoAffPro synced: ${data.data.totalClicks} clicks in the last ${data.data.windowDays} days`,
        "success"
      )
    } catch (err: any) {
      show(err.message || "Failed to sync GoAffPro clicks", "error")
    } finally {
      setGoaffproSyncing(false)
    }
  }

  // "Sync now" — the on-demand backstop for the Shopify pull-sync. Webhooks
  // are the primary path; this exists because Vercel's Hobby plan (this
  // project's current tier) rejects any cron schedule finer than daily, so
  // there's no scheduled job doing this automatically (see the header of
  // app/api/cron/shopify-sync/route.ts for the full explanation).
  async function handleShopifyManage() {
    setShopifySyncing(true)
    try {
      const res = await fetch("/api/settings/integrations/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to sync Shopify orders")

      setIntegrations((prev) => ({
        ...prev,
        shopify: { ...prev.shopify, unmatchedOrders: data.unmatched },
      }))
      show(`Shopify synced: ${data.ordersSynced} orders (${data.matched} matched, ${data.unmatched} unmatched)`, "success")
    } catch (err: any) {
      show(err.message || "Failed to sync Shopify orders", "error")
    } finally {
      setShopifySyncing(false)
    }
  }

  return (
    <div className="max-w-3xl px-4 py-5 sm:px-6 sm:py-6 md:px-9 md:py-7">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-5 right-6 z-[9999] rounded-[10px] px-[18px] py-[10px] text-[13px] font-medium text-white shadow-lg",
            toast.type === "success" ? "bg-[#1FAE5B]" : "bg-[#E24B4A]"
          )}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-1 text-[18px] font-semibold text-[#1E1E1E]">Integrations</div>
      <div className="mb-6 text-xs text-[#888]">
        Connect tools to automate your influencer workflow
      </div>

      {/* Affiliate & commission tools */}
      <SettingsCard
        icon={<Link2 className="h-4 w-4 text-[#1FAE5B]" strokeWidth={1.5} />}
        title="Affiliate & commission tools"
        desc="Auto-generate affiliate links and discount codes per influencer"
      >
        <div className="flex flex-col gap-2.5">
          <IntegrationRow
            logo={<span className="text-[11px] font-bold text-[#185FA5]">GA</span>}
            logoBg="#f0f6fc"
            name="GoAffPro"
            desc="Affiliate program management and commission tracking"
            connected={integrations.goaffpro.connected}
            loading={pendingId === "goaffpro" || loading || goaffproSyncing}
            onConnect={() => handleConnect("goaffpro", "GoAffPro")}
            onDisconnect={() => handleDisconnect("goaffpro", "GoAffPro")}
            onManage={handleGoAffProManage}
          />
          <IntegrationRow
            logo={<span className="text-[13px]">🔗</span>}
            logoBg="#e6f9ee"
            name="UpPromote"
            desc="Affiliate links & discount codes per influencer"
            connected={integrations.uppromote.connected}
            loading={pendingId === "uppromote" || loading}
            comingSoon
            onConnect={() => handleConnect("uppromote", "UpPromote")}
            onDisconnect={() => handleDisconnect("uppromote", "UpPromote")}
            onManage={() => handleManage("UpPromote")}
          />
        </div>
      </SettingsCard>

      {/* E-commerce & revenue */}
      <SettingsCard
        icon={<ShoppingCart className="h-4 w-4 text-[#1FAE5B]" strokeWidth={1.5} />}
        title="E-commerce & revenue"
        desc="Sync sales and revenue data from your store"
      >
        <div className="flex flex-col gap-2.5">
          <IntegrationRow
            logo={<span className="text-[18px]">🛍</span>}
            logoBg="#f0faf5"
            name="Shopify"
            desc="Create orders and auto-advance Post Tracker from Shopify fulfillment"
            connected={integrations.shopify.connected}
            loading={pendingId === "shopify" || loading || shopifySyncing}
            onConnect={() => handleConnect("shopify", "Shopify")}
            onDisconnect={() => handleDisconnect("shopify", "Shopify")}
            onManage={handleShopifyManage}
            manageLabel={shopifySyncing ? "Syncing…" : "Sync now"}
          />
          {integrations.shopify.connected && (integrations.shopify.unmatchedOrders ?? 0) > 0 && (
            <div className="px-1 text-[11px] text-[#888]">
              {integrations.shopify.unmatchedOrders} unmatched Shopify order
              {integrations.shopify.unmatchedOrders === 1 ? "" : "s"} — placed outside Post Tracker with no matching discount code.
            </div>
          )}
          <IntegrationRow
            logo={<span className="text-[18px]">🟡</span>}
            logoBg="#fff8e1"
            name="WooCommerce"
            desc="Connect your WordPress store for order and revenue tracking"
            connected={integrations.woocommerce.connected}
            loading={pendingId === "woocommerce" || loading}
            comingSoon
            onConnect={() => handleConnect("woocommerce", "WooCommerce")}
            onDisconnect={() => handleDisconnect("woocommerce", "WooCommerce")}
            onManage={() => handleManage("WooCommerce")}
          />
        </div>
      </SettingsCard>

      {/* Storage */}
      <SettingsCard
        icon={<FolderOpen className="h-4 w-4 text-[#1FAE5B]" strokeWidth={1.5} />}
        title="Storage"
        desc="Save content files and snapshots from influencer posts"
      >
        <IntegrationRow
          logo={<span className="text-[18px]">📁</span>}
          logoBg="#e8f0fe"
          name="Google Drive"
          desc="Auto-save post content and metrics snapshots to Drive"
          connected={integrations.gdrive.connected}
          loading={pendingId === "gdrive" || loading}
          comingSoon
          onConnect={() => handleConnect("gdrive", "Google Drive")}
          onDisconnect={() => handleDisconnect("gdrive", "Google Drive")}
          onManage={() => handleManage("Google Drive")}
        />
      </SettingsCard>

      <Dialog open={goaffproModalOpen} onOpenChange={setGoaffproModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect GoAffPro</DialogTitle>
            <DialogDescription>
              Paste the Access Token from your own GoAffPro account (Settings → Developer →
              Access Tokens). Each brand connects its own GoAffPro store.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold tracking-wide text-[#555]">
                Access Token
              </Label>
              <Input
                type="password"
                placeholder="Paste your GoAffPro access token"
                value={goaffproAccessToken}
                onChange={(e) => setGoaffproAccessToken(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold tracking-wide text-[#555]">
                Webhook Signature Secret (optional)
              </Label>
              <Input
                type="password"
                placeholder="Only if your GoAffPro plan supports webhooks"
                value={goaffproWebhookSecret}
                onChange={(e) => setGoaffproWebhookSecret(e.target.value)}
              />
              <div className="text-[11px] text-[#888]">
                Leave empty to sync via polling every 15 minutes. If your GoAffPro plan
                supports webhooks, create one in GoAffPro (Settings → Developer → Webhooks)
                pointing to the URL below with topic <code>orders/after</code>, then paste
                the resulting signature secret here for real-time sync.
              </div>
              {goaffproWebhookUrl && (
                <Input readOnly value={goaffproWebhookUrl} className="text-[11px]" />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGoaffproModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#1FAE5B] text-white hover:bg-[#0F6B3E]"
              onClick={handleGoAffProConnectSubmit}
              disabled={pendingId === "goaffpro"}
            >
              {pendingId === "goaffpro" ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shopifyModalOpen} onOpenChange={setShopifyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Shopify</DialogTitle>
            <DialogDescription>
              Enter your store&rsquo;s domain, then you&rsquo;ll be sent to Shopify to review and
              approve access — nothing to set up in your Shopify admin first.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold tracking-wide text-[#555]">
                Shop Domain
              </Label>
              <Input
                placeholder="yourstore.myshopify.com"
                value={shopifyShopDomain}
                onChange={(e) => setShopifyShopDomain(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-[#fff8e1] px-3 py-2 text-[11px] text-[#854F0B]">
              Auto-advancing a card to In-Transit / Delivered depends on Shopify recognizing your
              carrier&rsquo;s tracking info. Fulfilling without a tracked carrier may need a manual
              nudge the rest of the way — this automates the common path, it doesn&rsquo;t replace
              the board.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShopifyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#1FAE5B] text-white hover:bg-[#0F6B3E]"
              onClick={handleShopifyConnectSubmit}
            >
              Continue to Shopify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <IntegrationsContent />
    </Suspense>
  )
}

// ── Shared subcomponents ──────────────────────────────────────────

function SettingsCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4 overflow-hidden rounded-xl border-[0.5px] border-black/[0.08] bg-white">
      <div className="flex items-start gap-3 border-b-[0.5px] border-black/[0.07] px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-[#f0faf5]">
          {icon}
        </div>
        <div>
          <div className="text-[13px] font-semibold text-[#1E1E1E]">{title}</div>
          <div className="mt-0.5 text-[11px] text-[#888]">{desc}</div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function IntegrationRow({
  logo,
  logoBg,
  name,
  tag,
  desc,
  connected,
  connectedLabel = "Connected",
  disconnectedLabel = "Not connected",
  connectLabel = "Connect",
  manageLabel = "Manage",
  loading,
  comingSoon = false,
  onConnect,
  onDisconnect,
  onManage,
}: {
  logo: React.ReactNode
  logoBg: string
  name: string
  tag?: string
  desc: string
  connected: boolean
  connectedLabel?: string
  disconnectedLabel?: string
  connectLabel?: string
  manageLabel?: string
  loading?: boolean
  comingSoon?: boolean
  onConnect: () => void
  onDisconnect: () => void
  onManage: () => void
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3.5 rounded-[10px] border-[0.5px] px-4 py-3.5",
        connected
          ? "border-[#9ed4b8] bg-[#f0faf5]"
          : comingSoon
          ? "border-black/[0.07] bg-[#fafafa]"
          : "border-black/[0.09] bg-white"
      )}
    >
      <div className="flex items-center gap-3.5 sm:contents">
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: comingSoon && !connected ? "#f0f0ee" : logoBg, opacity: comingSoon && !connected ? 0.6 : 1 }}
      >
        {logo}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[#1E1E1E]">
          {name}
          {tag && (
            <Badge
              variant="outline"
              className="ml-1.5 rounded-full border-none bg-[#fff8e1] px-[7px] py-[2px] text-[10px] font-semibold text-[#854F0B]"
            >
              {tag}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-[#888]">{desc}</div>
      </div>
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
        {connected ? (
          <>
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-none bg-[#e6f9ee] px-[9px] py-[3px] text-[10px] font-semibold text-[#0F6B3E]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#1FAE5B]" />
              {connectedLabel}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-auto rounded-lg border-black/15 px-3 py-1.5 text-[11px] font-medium text-[#555] hover:bg-[#f7f9f8]"
              onClick={onManage}
              disabled={loading}
            >
              {manageLabel}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-auto rounded-lg border-[#E24B4A]/30 bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-[#E24B4A] hover:bg-[#fdecea]"
              onClick={onDisconnect}
              disabled={loading}
            >
              {loading ? "…" : "Disconnect"}
            </Button>
          </>
        ) : comingSoon ? (
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full border-none bg-[#f0f0ee] px-[10px] py-[4px] text-[10px] font-semibold text-[#999]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#ccc]" />
            Coming soon
          </Badge>
        ) : (
          <>
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-none bg-[#f0f0ee] px-[9px] py-[3px] text-[10px] font-semibold text-[#888]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#ccc]" />
              {disconnectedLabel}
            </Badge>
            <Button
              size="sm"
              className="h-auto rounded-lg bg-[#1FAE5B] px-3.5 py-1.5 text-[11px] font-medium text-white hover:bg-[#0F6B3E]"
              onClick={onConnect}
              disabled={loading}
            >
              {loading ? "…" : connectLabel}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
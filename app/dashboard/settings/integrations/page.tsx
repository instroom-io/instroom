"use client"
// app/dashboard/settings/integrations/page.tsx

import { useEffect, useState, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Link2, BoxSelect, ShoppingCart, FolderOpen, Radio, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function LoadingScreen() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Loading</p>
    </div>
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
  | "posttracker"
  | "shopify"
  | "woocommerce"
  | "gdrive"

type IntegrationState = {
  connected: boolean
  connectedAs?: string
}

type IntegrationsMap = Record<IntegrationId, IntegrationState>

const DEFAULT_STATE: IntegrationsMap = {
  uppromote: { connected: false },
  goaffpro: { connected: false },
  posttracker: { connected: false },
  shopify: { connected: false },
  woocommerce: { connected: false },
  gdrive: { connected: false },
}

function IntegrationsContent() {
  const { status } = useSession()
  const router = useRouter()
  const { toast, show } = useToast()

  const [loading, setLoading] = useState(true)
  const [integrations, setIntegrations] = useState<IntegrationsMap>(DEFAULT_STATE)
  const [pendingId, setPendingId] = useState<IntegrationId | null>(null)

  const [hashtags, setHashtags] = useState("")
  const [mentions, setMentions] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status !== "authenticated") return

    fetch("/api/settings/integrations")
      .then((r) => r.json())
      .then((data) => {
        if (data.integrations) setIntegrations(data.integrations)
        if (data.hashtags) setHashtags(data.hashtags)
        if (data.mentions) setMentions(data.mentions)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConnect(id: IntegrationId, label: string) {
    setPendingId(id)
    try {
      const res = await fetch("/api/settings/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to connect ${label}`)

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

  async function handleDisconnect(id: IntegrationId, label: string) {
    setPendingId(id)
    try {
      const res = await fetch("/api/settings/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to disconnect ${label}`)

      setIntegrations((prev) => ({ ...prev, [id]: { connected: false } }))
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

  const ptEnabled = integrations.posttracker.connected

  return (
    <div className="max-w-3xl px-9 py-7">
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
            loading={pendingId === "goaffpro" || loading}
            onConnect={() => handleConnect("goaffpro", "GoAffPro")}
            onDisconnect={() => handleDisconnect("goaffpro", "GoAffPro")}
            onManage={() => handleManage("GoAffPro")}
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

      {/* Post Tracker Pro */}
      <SettingsCard
        icon={<BoxSelect className="h-4 w-4 text-[#1FAE5B]" strokeWidth={1.5} />}
        title="Post Tracker Pro"
        desc="Auto-detect influencer posts via hashtag and mention monitoring"
      >
        <div className="mb-3.5">
          <IntegrationRow
            logo={<Radio className="h-[18px] w-[18px] text-[#1E1E1E]" />}
            logoBg="#f7f9f8"
            name="Post Tracker Pro"
            tag="Add-on"
            desc="Monitors Instagram, TikTok, and YouTube for your brand hashtags and mentions"
            connected={ptEnabled}
            connectedLabel="Enabled"
            disconnectedLabel="Not enabled"
            loading={pendingId === "posttracker" || loading}
            comingSoon
            onConnect={() => {}}
            onDisconnect={() => handleDisconnect("posttracker", "Post Tracker Pro")}
            onManage={() => handleManage("Post Tracker Pro")}
          />
        </div>

        <div className="rounded-[9px] bg-[#f7f9f8] px-4 py-3.5">
          <div className="mb-2 flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide text-[#555]">
              Hashtags to monitor
            </Label>
            <Input
              className="text-xs"
              placeholder="e.g. #nonoise, #nonoiseofficial"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              disabled={!ptEnabled}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-semibold tracking-wide text-[#555]">
              Mentions to monitor
            </Label>
            <Input
              className="text-xs"
              placeholder="e.g. @nonoise, @nonoisestore"
              value={mentions}
              onChange={(e) => setMentions(e.target.value)}
              disabled={!ptEnabled}
            />
          </div>
          {!ptEnabled && (
            <div className="mt-2 text-[10px] text-[#aaa]">
              Enable Post Tracker Pro to configure hashtag and mention tracking
            </div>
          )}
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
            desc="Sync orders and revenue per affiliate link or discount code"
            connected={integrations.shopify.connected}
            loading={pendingId === "shopify" || loading}
            comingSoon
            onConnect={() => handleConnect("shopify", "Shopify")}
            onDisconnect={() => handleDisconnect("shopify", "Shopify")}
            onManage={() => handleManage("Shopify")}
          />
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
  loading?: boolean
  comingSoon?: boolean
  onConnect: () => void
  onDisconnect: () => void
  onManage: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-[10px] border-[0.5px] px-4 py-3.5",
        connected
          ? "border-[#9ed4b8] bg-[#f0faf5]"
          : comingSoon
          ? "border-black/[0.07] bg-[#fafafa]"
          : "border-black/[0.09] bg-white"
      )}
    >
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

      <div className="flex flex-shrink-0 items-center gap-1.5">
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
              Manage
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
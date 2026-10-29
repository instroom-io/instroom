"use client"
// Opened from "Link to your Instroom workspace" in Shopify admin.

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { invalidateCache } from "@/lib/data-cache"
import { invalidateInfluencerDerivedCaches } from "@/lib/cache-invalidation"

type LinkInfo = { shop: string; brands: { id: string; name: string }[]; previousBrandId: string | null }

function ShopifyLinkContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Read once; the URL may be rewritten.
  const [ticket] = useState(() => searchParams.get("ticket") ?? "")
  const [info, setInfo] = useState<LinkInfo | null>(null)
  const [brandId, setBrandId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/settings/integrations/shopify/link?ticket=${encodeURIComponent(ticket)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data.error || "Couldn't load this link")
        setInfo(data)
        setBrandId(data.previousBrandId ?? (data.brands.length === 1 ? data.brands[0].id : ""))
      })
      .catch((e: Error) => setError(e.message))
  }, [ticket])

  async function link() {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch("/api/settings/integrations/shopify/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, brandId }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || "Couldn't connect the store")
      invalidateCache(`/api/settings/integrations?brandId=${brandId}`)
      invalidateInfluencerDerivedCaches(brandId)
      router.replace(`/dashboard/settings/integrations?brandId=${encodeURIComponent(brandId)}&shopify=connected`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const integrationsHref = `/dashboard/settings/integrations${searchParams.get("brandId") ? `?brandId=${searchParams.get("brandId")}` : ""}`

  return (
    <div className="max-w-3xl px-4 py-5 sm:px-6 sm:py-6 md:px-9 md:py-7">
      <div className="mb-1 text-[18px] font-semibold text-[#1E1E1E]">Connect Shopify store</div>
      <div className="mb-6 text-xs text-[#888]">Link a Shopify store to one of your brands</div>

      <div className="overflow-hidden rounded-xl border-[0.5px] border-black/[0.08] bg-white">
        <div className="flex items-start gap-3 border-b-[0.5px] border-black/[0.07] px-5 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-[#f0faf5]">
            <ShoppingCart className="h-4 w-4 text-[#1FAE5B]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[#1E1E1E]">{info?.shop ?? "Shopify store"}</div>
            <div className="mt-0.5 text-[11px] text-[#888]">
              Instroom will create influencer orders and track shipments for the brand you choose.
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {error && (
            <div className="rounded-lg bg-[#fcebeb] px-3 py-2 text-[12px] text-[#a32d2d]">{error}</div>
          )}

          {!info && !error && (
            <div className="flex flex-col gap-2" aria-busy="true">
              <Skeleton className="h-3 w-16 bg-gray-100" />
              <Skeleton className="h-9 w-full max-w-sm bg-gray-100" />
            </div>
          )}

          {info && info.brands.length === 0 && (
            <div className="text-[12px] text-[#555]">
              Only a brand&rsquo;s owner can connect a Shopify store, and you don&rsquo;t own a brand. Ask the
              owner to open Instroom in their Shopify admin and click <strong>Link to your Instroom workspace</strong>.
            </div>
          )}

          {info && info.brands.length > 0 && (
            <label className="flex max-w-sm flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-wide text-[#555]">Brand</span>
              <select
                className="h-9 rounded-md border border-input bg-white px-3 text-[13px] text-[#1E1E1E] outline-none focus:border-[#1FAE5B]"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
              >
                <option value="">Choose a brand…</option>
                {info.brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="flex gap-2">
            {info && info.brands.length > 0 && (
              <Button className="bg-[#1FAE5B] text-white hover:bg-[#0F6B3E]" disabled={!brandId || saving} onClick={link}>
                {saving ? "Connecting…" : "Connect store"}
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={integrationsHref}>Back to Integrations</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ShopifyLinkPage() {
  return (
    <Suspense fallback={null}>
      <ShopifyLinkContent />
    </Suspense>
  )
}

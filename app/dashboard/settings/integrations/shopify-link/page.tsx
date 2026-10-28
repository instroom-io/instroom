"use client"
// Opened from "Link to your Instroom workspace" in Shopify admin.

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { invalidateCache } from "@/lib/data-cache"
import { invalidateInfluencerDerivedCaches } from "@/lib/cache-invalidation"

type LinkInfo = { shop: string; brands: { id: string; name: string }[]; previousBrandId: string | null }

function ShopifyLinkContent() {
  const router = useRouter()
  const ticket = useSearchParams().get("ticket") ?? ""
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
      if (!r.ok) throw new Error(data.error || "Couldn't link the store")
      invalidateCache(`/api/settings/integrations?brandId=${brandId}`)
      invalidateInfluencerDerivedCaches(brandId)
      router.replace(`/dashboard/settings/integrations?brandId=${encodeURIComponent(brandId)}&shopify=connected`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-lg font-semibold text-[#111]">Connect your Shopify store</h1>

      {error && <p className="mt-3 rounded-lg bg-[#fdecea] px-3 py-2 text-[13px] text-[#a32d2d]">{error}</p>}

      {!info && !error && <p className="mt-3 text-[13px] text-[#666]">Loading…</p>}

      {info && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-[13px] text-[#444]">
            Choose the brand <strong>{info.shop}</strong> belongs to. Instroom will create orders and track
            shipments for that brand&rsquo;s influencers.
          </p>

          {info.brands.length === 0 ? (
            <p className="text-[13px] text-[#a32d2d]">
              Only a brand&rsquo;s owner can connect a Shopify store, and you don&rsquo;t own any brands. Ask the
              brand&rsquo;s owner to open Instroom in Shopify and link the store.
            </p>
          ) : (
            <>
              <select
                className="rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-[13px]"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
              >
                <option value="">Choose a brand…</option>
                {info.brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <Button className="self-start bg-[#1FAE5B] text-white hover:bg-[#0F6B3E]" disabled={!brandId || saving} onClick={link}>
                {saving ? "Connecting…" : "Connect store"}
              </Button>
            </>
          )}
        </div>
      )}
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

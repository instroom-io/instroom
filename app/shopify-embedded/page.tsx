import type { Metadata } from "next"
import Script from "next/script"
import EmbeddedStatus from "./EmbeddedStatus"

// Minimal, read-only panel Shopify loads inside its own admin (in an
// iframe) for this app — satisfies Shopify's "provide an embedded
// experience" review requirement without duplicating Instroom's full UI
// inside Shopify. Shows connection status and links out to the real
// dashboard for everything else; see the plan doc for what's deliberately
// out of scope (no SSO into Instroom, no Pipeline/Post Tracker here).
//
// Reads process.env directly (not lib/shopify-oauth's getClientId, which
// throws) — this page is statically prerendered, so generateMetadata runs
// at build time, before deploy-time env vars are necessarily configured.
// Missing the tag just means Shopify won't recognize the embed until the
// var is set; it must not fail the whole build.
export function generateMetadata(): Metadata {
  const clientId = process.env.SHOPIFY_CLIENT_ID
  return {
    other: clientId ? { "shopify-api-key": clientId } : {},
  }
}

export default function ShopifyEmbeddedPage() {
  return (
    <>
      {/* Shopify's own docs recommend this as literally the first script on
          the page, achievable in a raw HTML app — next/script's
          beforeInteractive strategy would do that but only works when placed
          in the root layout (Next.js restriction), which would load App
          Bridge globally on every route in this app, not just this one.
          afterInteractive is the closest per-route equivalent; the client
          status component already waits for `window.shopify` to exist
          before using it, so load order here isn't load-bearing. */}
      <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="afterInteractive" />
      <div
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <EmbeddedStatus />
      </div>
    </>
  )
}

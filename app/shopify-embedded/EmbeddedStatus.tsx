"use client"

import { useEffect, useState } from "react"

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>
    }
  }
}

type Status =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "connected"; brandId: string; storeName: string | null; lastOrderSyncAt: string | null }
  | { state: "not-connected" }

// App Bridge doesn't expose a single synchronous "ready" event — the global
// only exists once app-bridge.js has finished evaluating, which can land
// after this component's first render even with the beforeInteractive
// script strategy, so this polls briefly rather than assuming it's there.
function waitForAppBridge(timeoutMs = 5000): Promise<Window["shopify"]> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (window.shopify) {
        resolve(window.shopify)
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("App Bridge did not load"))
        return
      }
      setTimeout(check, 100)
    }
    check()
  })
}

export default function EmbeddedStatus() {
  const [status, setStatus] = useState<Status>({ state: "loading" })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const shopify = await waitForAppBridge()
        const token = await shopify!.idToken()
        const res = await fetch("/api/shopify-embedded/status", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          throw new Error(`Status request failed (${res.status})`)
        }
        const data = await res.json()
        if (cancelled) return
        setStatus(data.connected ? { state: "connected", ...data } : { state: "not-connected" })
      } catch (error) {
        if (cancelled) return
        setStatus({ state: "error", message: error instanceof Error ? error.message : "Something went wrong" })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (status.state === "loading") {
    return <p>Loading Instroom connection status…</p>
  }

  if (status.state === "error") {
    return <p style={{ color: "#b91c1c" }}>Couldn&apos;t load status: {status.message}</p>
  }

  if (status.state === "not-connected") {
    return (
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Not connected</h2>
        <p style={{ color: "#666" }}>
          This store isn&apos;t linked to an Instroom workspace yet. Connect it from Instroom&apos;s Settings →
          Integrations page.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Connected to Instroom</h2>
      <p style={{ color: "#666", marginBottom: "4px" }}>Store: {status.storeName ?? "—"}</p>
      <p style={{ color: "#666", marginBottom: "16px" }}>
        Last synced: {status.lastOrderSyncAt ? new Date(status.lastOrderSyncAt).toLocaleString() : "Never"}
      </p>
      <a
        href={`/dashboard?brandId=${status.brandId}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#16a34a", fontWeight: 500 }}
      >
        Open full dashboard →
      </a>
    </div>
  )
}

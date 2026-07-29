"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function GetEarlyAccessButton({ cycle }: { cycle: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/subscription/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: "solo", cycle }),
      })
      const data = await res.json()

      // Already has a subscription (e.g. clicked this before) — just take them in
      // rather than blocking on an error they can't do anything about.
      if (res.ok || data.error === "User already has an active subscription or ongoing trial") {
        router.push("/dashboard/influencer-discovery")
        return
      }
      setError(data.error || "Something went wrong. Please try again.")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="font-semibold text-[#0F6B3E] underline underline-offset-2 hover:text-[#1FAE5B] whitespace-nowrap disabled:opacity-50"
      >
        {isLoading ? "Activating your access…" : "Get Your Early Access →"}
      </button>
      {error && <span className="text-xs text-[#C0392B]">{error}</span>}
    </div>
  )
}

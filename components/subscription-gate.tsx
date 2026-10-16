"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

const FIRST_CHECK_TIMEOUT_MS = 8000

/** No active plan → /pricing. Only the first check holds content back; a failed or slow check lets the user through. */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const brandId = useSearchParams().get("brandId")
  const [verified, setVerified] = useState(false)
  const latest = useRef(0)

  useEffect(() => {
    const run = ++latest.current
    const timeout = setTimeout(() => setVerified(true), FIRST_CHECK_TIMEOUT_MS)
    fetch(`/api/subscription/access${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ""}`)
      .then((res) => (res.ok ? res.json() : { allowed: null }))
      .catch(() => ({ allowed: null }))
      .then(({ allowed }: { allowed: boolean | null }) => {
        if (run !== latest.current) return
        if (allowed === false) router.replace("/pricing")
        else setVerified(true)
      })
      .finally(() => clearTimeout(timeout))
  }, [pathname, brandId, router])

  return verified ? <>{children}</> : null
}

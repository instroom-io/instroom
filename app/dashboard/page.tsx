"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

function DashboardRedirect() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (status === "loading") return

    if (status === "unauthenticated") {
      router.replace("/login")
      return
    }

    const brandId = searchParams.get("brandId")
    const target = brandId
      ? `/dashboard/influencer-discovery?brandId=${brandId}`
      : "/dashboard/influencer-discovery"

    router.replace(target)
  }, [status, router, searchParams])

  return null
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardRedirect />
    </Suspense>
  )
}

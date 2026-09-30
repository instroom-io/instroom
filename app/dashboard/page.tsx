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
      ? `/dashboard/manage-influencers?brandId=${brandId}`
      : "/dashboard/manage-influencers"

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

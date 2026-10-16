"use client"

import { Suspense } from "react"
import { SubscriptionGate } from "@/components/subscription-gate"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SubscriptionGate>{children}</SubscriptionGate>
    </Suspense>
  )
}

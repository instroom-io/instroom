"use client"

import { useRouter } from "next/navigation"
import { AlertCircle, X } from "lucide-react"
import { useState } from "react"

interface SubscriptionExpiringWarningProps {
  isVisible: boolean
  daysUntilExpiry: number | null
  renewUrl?: string
}

export function SubscriptionExpiringWarning({
  isVisible,
  daysUntilExpiry,
  renewUrl = "/pricing",
}: SubscriptionExpiringWarningProps) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)

  if (!isVisible || dismissed || daysUntilExpiry === null || daysUntilExpiry > 7) {
    return null
  }

  const dayText = daysUntilExpiry === 1 ? "day" : "days"

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-900">
          Your subscription expires in {daysUntilExpiry} {dayText}
        </p>
        <p className="text-xs text-amber-800 mt-1">
          Renew now to ensure uninterrupted access to your brands and influencers.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => router.push(renewUrl)}
          className="text-xs font-medium text-amber-600 hover:text-amber-700 underline"
        >
          Renew
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

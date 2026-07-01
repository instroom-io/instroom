"use client"

import { SubscriptionExpiredModal } from "@/components/subscription-expired-modal"
import { SubscriptionExpiringWarning } from "@/components/subscription-expiring-warning"
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus"

export function SubscriptionStatusProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const subscriptionStatus = useSubscriptionStatus()

  return (
    <>
      {subscriptionStatus.isExpiringSoon && !subscriptionStatus.isExpired && (
        <div className="px-4 py-2 bg-white border-b border-gray-200">
          <SubscriptionExpiringWarning
            isVisible={true}
            daysUntilExpiry={subscriptionStatus.daysUntilExpiry}
          />
        </div>
      )}

      <SubscriptionExpiredModal
        isOpen={subscriptionStatus.isExpired}
        endedAt={subscriptionStatus.subscription?.ended_at}
      />

      {children}
    </>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SubscriptionExpiredModalProps {
  isOpen: boolean
  endedAt?: string | null
}

export function SubscriptionExpiredModal({
  isOpen,
  endedAt,
}: SubscriptionExpiredModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Unknown"
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-2xl border border-red-200 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-400" />

        <CardHeader className="gap-2 pb-2 pt-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
            <CardTitle className="text-2xl font-bold text-gray-900">
              Subscription Expired
            </CardTitle>
          </div>
          <CardDescription className="text-sm text-gray-600">
            Your subscription has ended on {formatDate(endedAt)}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 pb-6">
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100">
            <p className="text-sm text-gray-700">
              To continue managing your brands and influencers, please renew your subscription.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/pricing")}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium gap-2"
            >
              Renew Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Need help? Contact our support team
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface LimitExceededDialogProps {
  isOpen: boolean
  onClose: () => void
  limitType: string
  current: number
  max: number | null
  message: string
  title?: string
  description?: string
  onUpgrade?: () => void
}

export function LimitExceededDialog({
  isOpen,
  onClose,
  limitType,
  current,
  max,
  message,
  title = "Limit Reached",
  description = `You cannot add more ${limitType}s at this time.`,
  onUpgrade,
}: LimitExceededDialogProps) {
  const router = useRouter()

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade()
    } else {
      router.push('/pricing')
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-900">
            {message}
          </p>
          {max !== null && (
            <p className="text-xs text-red-700 mt-2">
              Current usage: {current}/{max}
            </p>
          )}
        </div>

        <div className="flex justify-center gap-3">
          <Button
            onClick={handleUpgrade}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Upgrade Plan
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="border-gray-300"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

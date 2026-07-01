"use client"

import { useRouter } from "next/navigation"
import {
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface WorkspaceUnavailableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceName: string
  onClose?: () => void
}

export function WorkspaceUnavailableModal({
  open,
  onOpenChange,
  workspaceName,
  onClose,
}: WorkspaceUnavailableModalProps) {
  const router = useRouter()

  if (!open) return null

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenChange(false)
    if (onClose) {
      onClose()
    } else {
      router.push("/dashboard")
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose(e as any)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Workspace Unavailable
          </CardTitle>
          <CardDescription>
            This workspace has an inactive subscription.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">
            The workspace <span className="font-semibold">{workspaceName}</span> is currently unavailable because the subscription is inactive.
          </p>
          <p className="text-sm text-gray-600">
            Contact the workspace owner to renew the subscription or ask them to add you to an active workspace.
          </p>
          <div className="pt-2">
            <Button
              onClick={handleClose}
              className="w-full bg-[#1FAE5B] hover:bg-[#0F6B3E]"
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

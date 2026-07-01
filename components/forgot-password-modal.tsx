"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  className?: string
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  className,
}: ForgotPasswordModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError("Email is required")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to send reset email")
      }

      setSuccess(true)
      setEmail("")
      // Auto-close after 3 seconds
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className={cn("w-full max-w-md rounded-2xl shadow-lg p-8 border border-[#0F6B3E]/15 bg-gradient-to-b from-white via-white to-[#0F6B3E]/5 relative overflow-hidden")}>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#1FAE5B] to-transparent" />
        
        <CardHeader className="gap-2 pb-2 pt-4">
          <CardTitle className="text-2xl font-bold text-gray-900">Forgot Password?</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Enter your email and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          {success ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-800 font-medium">✓ Reset email sent!</p>
                <p className="text-xs text-green-700 mt-1">
                  Check your email for a link to reset your password. The link will expire in 1 hour.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                {error && (
                  <div className="mb-6 rounded-lg border border-[#F4B740]/40 bg-[#F4B740]/8 p-3 text-sm text-[#C87500]">
                    {error}
                  </div>
                )}
                <Field>
                  <FieldLabel htmlFor="reset-email" className="font-medium text-gray-700 text-sm">
                    Email
                  </FieldLabel>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError(null)
                    }}
                    disabled={isLoading}
                    required
                    className="rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0F6B3E] focus:ring-[#0F6B3E]/20 transition-colors"
                  />
                  <FieldDescription className="text-gray-600 text-xs mt-1">
                    We'll send a password reset link to this email address.
                  </FieldDescription>
                </Field>

                <Field className="space-y-2 pt-4">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-11 w-full bg-[#1FAE5B] text-white font-semibold rounded-lg shadow-md hover:bg-[#17a04e] hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <Button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="h-11 w-full border-2 border-gray-200 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition-all font-medium"
                  >
                    Cancel
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

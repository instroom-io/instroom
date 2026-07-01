"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import Link from "next/link"

// Password validation helper (same as signup)
const checkPasswordStrength = (password: string) => {
  return {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }
}

const getPasswordStrengthLevel = (requirements: ReturnType<typeof checkPasswordStrength>): 'weak' | 'medium' | 'strong' => {
  const met = Object.values(requirements).filter(Boolean).length
  if (met <= 2) return 'weak'
  if (met <= 4) return 'medium'
  return 'strong'
}

export function PasswordResetForm({ token, className = "" }: { token?: string; className?: string }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  })
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  })
  const [passwordStrengthLevel, setPasswordStrengthLevel] = useState<'weak' | 'medium' | 'strong'>('weak')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData((prev) => {
      const key = id === "confirm-password" ? "confirmPassword" : id
      return { ...prev, [key]: value }
    })

    if (id === "password") {
      const strength = checkPasswordStrength(value)
      setPasswordStrength(strength)
      setPasswordStrengthLevel(getPasswordStrengthLevel(strength))
    }

    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError("Invalid or expired reset link. Please request a new password reset.")
      return
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    const passwordRequirements = checkPasswordStrength(formData.password)
    if (!passwordRequirements.hasUppercase) {
      setError("Password must contain at least one uppercase letter")
      return
    }
    if (!passwordRequirements.hasLowercase) {
      setError("Password must contain at least one lowercase letter")
      return
    }
    if (!passwordRequirements.hasNumber) {
      setError("Password must contain at least one number")
      return
    }
    if (!passwordRequirements.hasSpecialChar) {
      setError("Password must contain at least one special character (!@#$%^&*)")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password")
      }

      setSuccess(true)
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }



  return (
    <div className="flex flex-col gap-6 w-full max-w-lg">
      <Card className={`rounded-2xl shadow-lg p-8 border border-[#0F6B3E]/15 bg-gradient-to-b from-white via-white to-[#0F6B3E]/5 relative overflow-hidden ${className}`}>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#1FAE5B] to-transparent" />
        <CardHeader className="gap-2 pb-2 pt-4">
          <CardTitle className="text-2xl font-bold text-gray-900">Reset Your Password</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Enter a new password to regain access to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {!token ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900 font-medium">
                  ⚠️ Missing Reset Link
                </p>
                <p className="text-sm text-amber-800 mt-2">
                  The password reset link appears to be invalid or missing. Please request a new password reset link from the login page.
                </p>
              </div>
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    window.location.href = "/login?showForgotPassword=true"
                  }}
                  className="w-full h-11 bg-[#1FAE5B] text-white font-semibold rounded-lg shadow-md hover:bg-[#17a04e] hover:shadow-lg transition-all"
                >
                  Request New Reset Link
                </Button>
                <Link href="/login">
                  <Button className="w-full h-11 border-2 border-gray-200 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition-all font-medium">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-800 font-medium text-center">
                  ✓ Password reset successfully!
                </p>
                <p className="text-xs text-green-700 mt-2 text-center">
                  You'll be redirected to login in a moment...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup className="space-y-1">
                {error && (
                  <div className="mb-6 rounded-lg border border-[#F4B740]/40 bg-[#F4B740]/8 p-3 text-sm text-[#C87500]">
                    {error}
                  </div>
                )}

                <Field>
                  <FieldLabel htmlFor="password" className="font-medium text-gray-700 text-sm">
                    New Password
                  </FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your new password"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                    className="rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0F6B3E] focus:ring-[#0F6B3E]/20 transition-colors"
                  />

                  {formData.password && (
                    <div className="mt-3 space-y-2">
                      {/* Strength Bar */}
                      <div className="flex gap-1">
                        <div className={`h-1 flex-1 rounded-full transition-colors ${passwordStrength.hasMinLength ? 'bg-green-500' : 'bg-gray-200'}`} />
                        <div className={`h-1 flex-1 rounded-full transition-colors ${passwordStrength.hasUppercase && passwordStrength.hasLowercase ? 'bg-green-500' : 'bg-gray-200'}`} />
                        <div className={`h-1 flex-1 rounded-full transition-colors ${passwordStrength.hasNumber && passwordStrength.hasSpecialChar ? 'bg-green-500' : 'bg-gray-200'}`} />
                      </div>

                      {/* Strength Label */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">Strength:</span>
                        <span className={cn(
                          "text-xs font-semibold",
                          passwordStrengthLevel === 'weak' && 'text-red-500',
                          passwordStrengthLevel === 'medium' && 'text-yellow-500',
                          passwordStrengthLevel === 'strong' && 'text-green-500'
                        )}>
                          {passwordStrengthLevel === 'weak' && 'Weak'}
                          {passwordStrengthLevel === 'medium' && 'Medium'}
                          {passwordStrengthLevel === 'strong' && 'Strong'}
                        </span>
                      </div>

                      {/* Requirements Checklist */}
                      <div className="text-xs space-y-1 mt-2">
                        <div className={`flex items-center gap-2 ${passwordStrength.hasMinLength ? 'text-green-600' : 'text-gray-500'}`}>
                          <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${passwordStrength.hasMinLength ? 'bg-green-500' : 'bg-gray-300'}`}>
                            {passwordStrength.hasMinLength && <span className="text-white text-xs">✓</span>}
                          </span>
                          At least 8 characters
                        </div>
                        <div className={`flex items-center gap-2 ${passwordStrength.hasUppercase ? 'text-green-600' : 'text-gray-500'}`}>
                          <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${passwordStrength.hasUppercase ? 'bg-green-500' : 'bg-gray-300'}`}>
                            {passwordStrength.hasUppercase && <span className="text-white text-xs">✓</span>}
                          </span>
                          One uppercase letter (A-Z)
                        </div>
                        <div className={`flex items-center gap-2 ${passwordStrength.hasLowercase ? 'text-green-600' : 'text-gray-500'}`}>
                          <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${passwordStrength.hasLowercase ? 'bg-green-500' : 'bg-gray-300'}`}>
                            {passwordStrength.hasLowercase && <span className="text-white text-xs">✓</span>}
                          </span>
                          One lowercase letter (a-z)
                        </div>
                        <div className={`flex items-center gap-2 ${passwordStrength.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                          <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${passwordStrength.hasNumber ? 'bg-green-500' : 'bg-gray-300'}`}>
                            {passwordStrength.hasNumber && <span className="text-white text-xs">✓</span>}
                          </span>
                          One number (0-9)
                        </div>
                        <div className={`flex items-center gap-2 ${passwordStrength.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}`}>
                          <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${passwordStrength.hasSpecialChar ? 'bg-green-500' : 'bg-gray-300'}`}>
                            {passwordStrength.hasSpecialChar && <span className="text-white text-xs">✓</span>}
                          </span>
                          One special character (!@#$%^&*)
                        </div>
                      </div>
                    </div>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="confirm-password" className="font-medium text-gray-700 text-sm">
                    Confirm Password
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                    className="rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0F6B3E] focus:ring-[#0F6B3E]/20 transition-colors"
                  />
                </Field>

                <Field className="space-y-2 pt-4">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-11 w-full bg-[#1FAE5B] text-white font-semibold rounded-lg shadow-md hover:bg-[#17a04e] hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                  <Link href="/login" className="block">
                    <Button
                      type="button"
                      className="h-11 w-full border-2 border-gray-200 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition-all font-medium"
                    >
                      Back to Login
                    </Button>
                  </Link>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

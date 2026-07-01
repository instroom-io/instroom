"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
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

import { cn } from "@/lib/utils"

// Validation helper functions
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

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

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationToken = searchParams.get("invitationToken")
  
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendTimer, setResendTimer] = useState(0)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [otpData, setOtpData] = useState({
    otp: "",
    signupToken: "",
  })
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  })
  const [passwordStrengthLevel, setPasswordStrengthLevel] = useState<'weak' | 'medium' | 'strong'>('weak')

  // Timer for resend button
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendTimer])

  // Pre-fill email if provided in URL (from invitation)
  useEffect(() => {
    const email = searchParams.get("email")
    if (email) {
      setFormData(prev => ({ ...prev, email: decodeURIComponent(email) }))
    }
  }, [searchParams])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData((prev) => {
      const key = id === "confirm-password" ? "confirmPassword" : id
      return { ...prev, [key]: value }
    })
    
    // Update password strength when password field changes
    if (id === "password") {
      const strength = checkPasswordStrength(value)
      setPasswordStrength(strength)
      setPasswordStrengthLevel(getPasswordStrengthLevel(strength))
    }
    
    setError(null)
  }

  const handleOtpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setOtpData((prev) => ({ ...prev, otp: value }))
    setError(null)
  }

  const handleBackToForm = () => {
    setStep('form')
    setOtpData({ otp: "", signupToken: "" })
    setError(null)
  }

  const handleGenerateOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError("Full name is required")
      return
    }

    if (!formData.email.trim()) {
      setError("Email is required")
      return
    }

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address")
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
      const response = await fetch("/api/auth/generate-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to generate OTP")
      }

      const data = await response.json()
      setOtpData((prev) => ({ ...prev, signupToken: data.signupToken }))
      setStep('otp')
      setResendTimer(30)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!otpData.otp || otpData.otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          otp: otpData.otp,
          name: formData.name,
          password: formData.password,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "OTP verification failed")
      }

      const data = await response.json()

      // Auto-login with NextAuth
      const signInResult = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (signInResult?.error) {
        setError("Account created, but login failed. Please try signing in.")
        return
      }

      // If invitation token exists, accept the invitation
      if (invitationToken) {
        try {
          const inviteResponse = await fetch("/api/auth/accept-invitation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: invitationToken }),
          })

          const inviteData = await inviteResponse.json()

          if (inviteResponse.ok && inviteData.brandId) {
            router.push(`/dashboard?brandId=${inviteData.brandId}`)
            return
          }
        } catch (inviteError) {
          // Continue to onboarding if invitation acceptance fails
        }
      }

      router.push("/onboarding")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to resend OTP")
      }

      setResendTimer(30)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // First, check if email already exists with email/password signup
      // We need to get the email from Google first or show an intermediate step
      // For now, proceed with Google signup and let the callback handle it
      await signIn("google", { callbackUrl: "/onboarding" })
    } catch (err) {
      setError("Google signup failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:gap-3 w-full max-w-sm sm:max-w-lg">
      <Card className={cn("rounded-2xl shadow-lg p-4 sm:p-5 border border-[#0F6B3E]/15 bg-gradient-to-b from-white via-white to-[#0F6B3E]/5 relative overflow-hidden")}>
        {/* Decorative accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#1FAE5B] to-transparent" />
        
        {step === 'form' ? (
          <>
            <CardHeader className="gap-0.5 pb-0 pt-1">
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">Create an account</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-gray-600">
                Enter your information below to create your account
              </CardDescription>
            </CardHeader>
        <CardContent className="pt-1">
          {error && (
            <div className="mb-2 rounded-lg border border-[#F4B740]/40 bg-[#F4B740]/8 p-1.5 text-xs sm:text-sm text-[#C87500]">
              {error}
            </div>
          )}
          <form onSubmit={handleGenerateOTP}>
            <FieldGroup className="space-y-0.5">
              <Field>
                <FieldLabel htmlFor="name" className="font-medium text-gray-700 text-xs sm:text-sm">
                  Full Name
                </FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                  className="rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0F6B3E] focus:ring-[#0F6B3E]/20 transition-colors"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email" className="font-medium text-gray-700 text-xs sm:text-sm">
                  Email
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                  className="rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0F6B3E] focus:ring-[#0F6B3E]/20 transition-colors text-sm"
                />
                <FieldDescription className="text-gray-600 text-xs mt-0.5">
                  We&apos;ll use this to contact you. We will not share your email
                  with anyone else.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="password" className="font-medium text-gray-700 text-xs sm:text-sm">
                  Password
                </FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="Must be at least 8 characters long."
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                  className="rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0F6B3E] focus:ring-[#0F6B3E]/20 transition-colors"
                />
                
                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="mt-1.5 space-y-1">
                    {/* Strength Bar */}
                    <div className="flex gap-1">
                      <div className={`h-1 flex-1 rounded-full transition-colors ${passwordStrength.hasMinLength ? 'bg-green-500' : 'bg-gray-200'}`} />
                      <div className={`h-1 flex-1 rounded-full transition-colors ${passwordStrength.hasUppercase && passwordStrength.hasLowercase ? 'bg-green-500' : 'bg-gray-200'}`} />
                      <div className={`h-1 flex-1 rounded-full transition-colors ${passwordStrength.hasNumber && passwordStrength.hasSpecialChar ? 'bg-green-500' : 'bg-gray-200'}`} />
                    </div>
                    
                    {/* Strength Label */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Strength:</span>
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
                    <div className="text-xs space-y-0.5 mt-1">
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
                <FieldLabel htmlFor="confirm-password" className="font-medium text-gray-700 text-xs sm:text-sm">
                  Confirm Password
                </FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Please confirm your password."
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                  className="rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0F6B3E] focus:ring-[#0F6B3E]/20 transition-colors"
                />
              </Field>
              <Field className="space-y-0.5 pt-0.5">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 sm:h-11 w-full text-sm sm:text-base bg-[#1FAE5B] text-white font-semibold rounded-lg shadow-md hover:bg-[#17a04e] hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isLoading ? "Sending OTP..." : "Continue"}
                </Button>
                <Button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={isLoading}
                  className="h-10 sm:h-11 w-full text-sm sm:text-base border-2 border-[#0F6B3E]/20 bg-[#0F6B3E]/5 text-[#0F6B3E] rounded-lg hover:bg-[#0F6B3E]/10 hover:border-[#0F6B3E]/40 transition-all font-medium"
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC02"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign up with Google
                </Button>
              </Field>
              <Field className="pt-0.5 border-t border-gray-100">
                <FieldDescription className="text-center text-xs sm:text-sm text-gray-600">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#0F6B3E] hover:text-[#1FAE5B] font-semibold">
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="gap-0.5 pb-0 pt-1">
              <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">Verify your email</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-gray-600">
                We sent a 6-digit code to <span className="font-medium text-gray-900">{formData.email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              {error && (
                <div className="mb-2 rounded-lg border border-[#F4B740]/40 bg-[#F4B740]/8 p-1.5 text-xs sm:text-sm text-[#C87500]">
                  {error}
                </div>
              )}
              <form onSubmit={handleVerifyOTP}>
                <FieldGroup className="space-y-0.5">
                  <Field>
                    <FieldLabel htmlFor="otp" className="font-medium text-gray-700 text-xs sm:text-sm">
                      Verification Code
                    </FieldLabel>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="000000"
                      value={otpData.otp}
                      onChange={handleOtpInputChange}
                      disabled={isLoading}
                      maxLength={6}
                      inputMode="numeric"
                      required
                      className="rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0F6B3E] focus:ring-[#0F6B3E]/20 transition-colors text-center text-2xl font-mono tracking-widest"
                    />
                    <FieldDescription className="text-gray-600 text-xs mt-0.5">
                      Enter the 6-digit code you received by email
                    </FieldDescription>
                  </Field>
                  <Field className="space-y-0.5 pt-0.5">
                    <Button
                      type="submit"
                      disabled={isLoading || otpData.otp.length !== 6}
                      className="h-10 sm:h-11 w-full text-sm sm:text-base bg-[#1FAE5B] text-white font-semibold rounded-lg shadow-md hover:bg-[#17a04e] hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {isLoading ? "Verifying..." : "Verify & Create Account"}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={resendTimer > 0 || isLoading}
                      className="h-10 sm:h-11 w-full text-sm sm:text-base border-2 border-[#0F6B3E]/20 bg-[#0F6B3E]/5 text-[#0F6B3E] rounded-lg hover:bg-[#0F6B3E]/10 hover:border-[#0F6B3E]/40 transition-all font-medium disabled:opacity-50"
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
                    </Button>
                  </Field>
                  <Field className="pt-0.5 border-t border-gray-100">
                    <FieldDescription className="text-center text-xs sm:text-sm text-gray-600">
                      <button
                        type="button"
                        onClick={handleBackToForm}
                        className="text-[#0F6B3E] hover:text-[#1FAE5B] font-semibold underline"
                      >
                        Change email address
                      </button>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </>
        )}
      </Card>
      <FieldDescription className="px-0 sm:px-6 text-center text-xs sm:text-sm text-[#1E1E1E]">
        By clicking continue, you agree to our{" "}
        <Link href="/terms-of-service" className="text-[#2C8EC4] hover:text-[#1FAE5B] font-medium">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-[#2C8EC4] hover:text-[#1FAE5B] font-medium">
          Privacy Policy
        </Link>
        .
      </FieldDescription>
    </div>
  )
}
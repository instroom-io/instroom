"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"

function AcceptInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<"loading" | "success" | "error" | "expired" | "invalid-email">("loading")
  const [message, setMessage] = useState<string>("")
  const [brandName, setBrandName] = useState<string>("")
  const [invitationEmail, setInvitationEmail] = useState<string>("")
  const [requiresLogin, setRequiresLogin] = useState(false)
  const [requiresLogout, setRequiresLogout] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setMessage("No invitation token provided")
      return
    }

    acceptInvitation()
  }, [token])

  const acceptInvitation = async () => {
    try {
      setStatus("loading")

      const response = await fetch("/api/auth/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      // Check if login is required (this returns 200 status but needs special handling)
      if (data.requiresLogin) {
        setStatus("error")
        setMessage("Please sign up to accept this invitation")
        setInvitationEmail(data.invitationEmail || "")
        setRequiresLogin(true)
        return
      }

      if (!response.ok) {
        if (data.requiresLogout) {
          setStatus("invalid-email")
          setMessage(data.error)
          setRequiresLogout(true)
          return
        }

        if (response.status === 410) {
          setStatus("expired")
          setMessage("This invitation has expired. Please ask the workspace owner to send a new invitation.")
          return
        }

        setStatus("error")
        setMessage(data.error || "Failed to accept invitation")
        return
      }

      setBrandName(data.brandName || "the workspace")
      setMessage(data.message)
      setStatus("success")

      setTimeout(() => {
        router.push(`/dashboard?brandId=${data.brandId}`)
      }, 2000)
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "An error occurred")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-white to-[#0F6B3E]/5 p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-lg border border-[#0F6B3E]/15">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl">Accept Invitation</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Loading State */}
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 text-[#1FAE5B] animate-spin" />
              <p className="text-center text-gray-600">Processing your invitation...</p>
            </div>
          )}

          {/* Success State */}
          {status === "success" && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <CheckCircle className="h-12 w-12 text-[#1FAE5B]" />
              <div className="text-center space-y-2">
                <p className="font-semibold text-[#0F6B3E]">{message}</p>
                <p className="text-sm text-gray-600">Redirecting to {brandName}...</p>
              </div>
            </div>
          )}

          {/* Error State - Expired */}
          {status === "expired" && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="h-12 w-12 text-yellow-600" />
              <div className="text-center space-y-3">
                <p className="font-semibold text-gray-800">{message}</p>
                <Button
                  onClick={() => router.push("/")}
                  className="w-full bg-[#1FAE5B] hover:bg-[#0F6B3E]"
                >
                  Return Home
                </Button>
              </div>
            </div>
          )}

          {/* Error State - Invalid Email */}
          {status === "invalid-email" && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-600" />
              <div className="text-center space-y-3">
                <p className="font-semibold text-gray-800">Email Mismatch</p>
                <p className="text-sm text-gray-600">{message}</p>
                <div className="space-y-2 pt-2">
                  {requiresLogout && (
                    <>
                      <Button
                        onClick={() => router.push("/auth/signout")}
                        variant="outline"
                        className="w-full"
                      >
                        Log Out
                      </Button>
                      <p className="text-xs text-gray-500">Then log in with the correct email</p>
                    </>
                  )}
                  <Button
                    onClick={() => router.push("/")}
                    className="w-full bg-[#1FAE5B] hover:bg-[#0F6B3E]"
                  >
                    Return Home
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Error State - General */}
          {status === "error" && !requiresLogin && !requiresLogout && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-600" />
              <div className="text-center space-y-3">
                <p className="font-semibold text-gray-800">Error</p>
                <p className="text-sm text-gray-600">{message}</p>
                <Button
                  onClick={() => router.push("/")}
                  className="w-full bg-[#1FAE5B] hover:bg-[#0F6B3E]"
                >
                  Return Home
                </Button>
              </div>
            </div>
          )}

          {/* Error State - Requires Login */}
          {status === "error" && requiresLogin && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="h-12 w-12 text-blue-600" />
              <div className="text-center space-y-3">
                <p className="font-semibold text-gray-800">Create Account to Join</p>
                <p className="text-sm text-gray-600">{message}</p>
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={() => {
                      const signupUrl = `/signup?invitationToken=${token}${invitationEmail ? `&email=${encodeURIComponent(invitationEmail)}` : ""}`
                      router.push(signupUrl)
                    }}
                    className="w-full bg-[#1FAE5B] hover:bg-[#0F6B3E]"
                  >
                    Sign Up to Accept Invitation
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-white to-[#0F6B3E]/5 p-4">
          <Card className="w-full max-w-md rounded-2xl shadow-lg border border-[#0F6B3E]/15">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl">Accept Invitation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 text-[#1FAE5B] animate-spin" />
                <p className="text-center text-gray-600">Loading...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  )
}

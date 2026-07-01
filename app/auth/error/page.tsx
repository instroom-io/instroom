'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  // Redirect to login with message if it's an auth method mismatch
  useEffect(() => {
    if (error === 'AccessDenied') {
      // Check if this came from signup or login based on referrer
      const referrer = document.referrer
      if (referrer?.includes('/signup')) {
        // This happens when trying to use Google to signup with an existing email/password account
        window.location.href = '/login?authError=account-exists-with-password'
      } else {
        // This happens when trying to use Google with an email/password account
        window.location.href = '/login?authError=use-email-password'
      }
    }
  }, [error])

  const errorMessages: Record<string, string> = {
    AccessDenied: 'Access was denied. Redirecting to login...',
    OAuthSignin: 'Error signing in with OAuth provider.',
    OAuthCallback: 'Error in OAuth callback.',
    EmailSigninEmail: 'Error sending email.',
    CredentialsSignin: 'Invalid email or password.',
    SessionCallback: 'Your session is invalid.',
    Configuration: 'Server configuration error.',
    Signin: 'This account was created with email and password. Please use your email and password to sign in.',
  }

  const message = errorMessages[error as string] || 'An authentication error occurred.'

  return (
    <div className="flex items-center justify-center min-h-screen bg-offwhite">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
        <p className="text-gray-700 mb-6">{message}</p>
        <p className="text-sm text-gray-500 mb-6">
          Error code: <code className="bg-gray-100 px-2 py-1 rounded">{error}</code>
        </p>
        <div className="flex gap-4">
          <Link href="/login" className="flex-1 text-center bg-primary-green text-white py-2 rounded hover:bg-deep-green transition">
            Back to Login
          </Link>
          <Link href="/signup" className="flex-1 text-center bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300 transition">
            Back to Signup
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-offwhite" />}>
      <AuthErrorContent />
    </Suspense>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { OnboardingForm } from '@/components/onboarding-form'
import Image from 'next/image'

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [step, setStep] = useState(1)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    operatorType: '',
    businessType: '',
    campaignGoal: '',
    influencerCount: '',
    acquisitionSource: [] as string[],
  })
  const [subscriptionChecked, setSubscriptionChecked] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/signup");
      return;
    }
    // Only redirect if explicitly marked as existing account from Google signup attempt
    const isNewUser = (session.user as any).isNewUser;
    if (isNewUser === false) {
      // Google OAuth detected existing account
      router.replace("/login?error=account-exists&message=Account%20already%20exists.%20Please%20log%20in%20with%20your%20email%20and%20password.");
      return;
    }
    // isNewUser === true: new Google signup (proceed to onboarding)
    // isNewUser === undefined: credentials login (proceed to check onboarding status)
    
    // Check if user has already completed onboarding
    checkOnboardingStatus();
    setIsSubscribed(true);
    setSubscriptionChecked(true);
  }, [status, session, router])

  const checkOnboardingStatus = async () => {
    try {
      if (!session?.user) return;
      
      const response = await fetch('/api/onboarding', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        // If onboarding is completed, redirect to dashboard
        if (data.onboarding?.completed_at) {
          router.replace('/dashboard');
        }
      }
    } catch (err) {
      // Silently continue on error
    }
  }

  const handleSkip = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!session?.user) {
        throw new Error("User session not found");
      }
      const userId = (session.user as any).id;
      if (!userId) {
        throw new Error("User ID not found in session");
      }
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          operator_type: null,
          business_type: null,
          campaign_goal: null,
          influencer_count: null,
          acquisition_source: null,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save onboarding data');
      }
      router.push('/pricing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    // Validation for each step (4-step flow)
    if (step === 1) {
      if (!formData.operatorType) {
        setError('Please select your account type to continue.')
        return
      }
    }
    if (step === 2) {
      if (!formData.businessType) {
        setError('Please select your business type to continue.')
        return
      }
    }
    if (step === 3) {
      if (!formData.campaignGoal) {
        setError('Please select your campaign goal to continue.')
        return
      }
    }
    if (step === 4) {
      if (!formData.influencerCount) {
        setError('Please select your influencer count to continue.')
        return
      }
    }
    setError(null)
    if (step < 4) {
      setStep(step + 1)
    } else {
      setShowWelcome(true)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!session?.user) {
        throw new Error("User session not found")
      }

      const userId = (session.user as any).id
      if (!userId) {
        throw new Error("User ID not found in session")
      }

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          operator_type: formData.operatorType || null,
          business_type: formData.businessType || null,
          campaign_goal: formData.campaignGoal || null,
          influencer_count: formData.influencerCount || null,
          acquisition_source: formData.acquisitionSource.length > 0 ? formData.acquisitionSource : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save onboarding data')
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormChange = (key: string, value: string | string[]) => {
    setFormData({ ...formData, [key]: value })
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#F7F9F8] text-[#1E1E1E]">
      <div className="fixed top-4 sm:top-6 left-4 sm:left-12 z-50">
        <Image
          src="/images/Instroom Logo 1.png"
          alt="Instroom Logo"
          width={140}
          height={140}
          priority
          quality={95}
          className="drop-shadow-sm w-32 sm:w-44 h-auto"
        />
      </div>

      <div className="pointer-events-none fixed top-0 left-0 w-64 sm:w-96 h-64 sm:h-96 rounded-full bg-[#1FAE5B]/8 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-56 sm:w-80 h-56 sm:h-80 rounded-full bg-[#0F6B3E]/6 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="pointer-events-none hidden sm:block fixed top-1/3 right-1/4 w-64 h-64 rounded-full bg-[#2C8EC4]/5 blur-3xl" />

      <div className="relative mx-auto flex min-h-svh w-full max-w-full sm:max-w-4xl items-center justify-center px-4 py-8 sm:py-10 z-20">
        {error && (
          <div className="fixed right-8 bottom-8 z-50 rounded-lg border border-red-500/50 bg-red-50 p-4 text-sm text-red-600 shadow-lg animate-fade-in">
            {error}
          </div>
        )}
        {/* Only show onboarding form if subscription is checked and user is subscribed */}
        {subscriptionChecked && isSubscribed && (
          <OnboardingForm
            step={step}
            showWelcome={showWelcome}
            formData={formData}
            onNext={handleNext}
            onBack={handleBack}
            onSubmit={handleSubmit}
            onFormChange={handleFormChange}
            onSkip={handleSkip}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  )
}

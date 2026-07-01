import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

interface OnboardingFormProps {
  step: number
  showWelcome: boolean
  formData: {
    operatorType: string
    businessType: string
    campaignGoal: string
    influencerCount: string
    acquisitionSource: string[]
  }
  onNext: () => void
  onBack: () => void
  onSubmit: () => void
  onFormChange: (key: string, value: string | string[]) => void
  onSkip: () => void
  isLoading?: boolean
  imageWidth?: number | string
  imageHeight?: number | string
}

const STEPS = [
  { number: 1, title: 'Who are you setting this up for?', description: "We'll configure the right workspace and account type for you." },
  { number: 2, title: 'What best describes your business?', description: 'Helps us tailor your dashboard and recommend the right tools.' },
  { number: 3, title: 'What is the main reason you run influencer campaigns?', description: "We'll build your dashboard and reporting around this. You can change this anytime in Settings." },
  { number: 4, title: 'How many influencers are you currently working with?', description: 'Helps us recommend the right plan and tools for your programme.' },
]

export function OnboardingForm({
  step,
  showWelcome,
  formData,
  onNext,
  onBack,
  onSubmit,
  onFormChange,
  onSkip,
  isLoading = false,
  imageWidth = '250px',
  imageHeight = '90%',
}: OnboardingFormProps) {
  const router = useRouter()
  const currentStep = STEPS[step - 1]

  const validateStep = (): string | null => {
    switch (step) {
      case 1:
        if (!formData.operatorType) return "Please select your account type to continue."
        return null
      case 2:
        if (!formData.businessType) return "Please select your business type to continue."
        return null
      case 3:
        if (!formData.campaignGoal) return "Please select your campaign goal to continue."
        return null
      case 4:
        if (!formData.influencerCount) return "Please select your influencer count to continue."
        return null
      default:
        return null
    }
  }

  const handleNext = () => {
    const error = validateStep()
    if (error) {
      alert(error)
      return
    }
    onNext()
  }

  if (showWelcome) {
    return (
      <div className="flex w-full max-w-sm sm:max-w-2xl rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl bg-gradient-to-b from-white via-white to-[#0F6B3E]/5 border border-[#0F6B3E]/15 relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#1FAE5B] to-transparent" />
        <div className="w-full px-6 sm:px-10 py-8 sm:py-12 flex flex-col items-center justify-center text-center">
          <div className="text-4xl sm:text-6xl mb-4"></div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">
            Your workspace is ready!
          </h1>
          <p className="text-xs sm:text-base text-gray-600 mb-8 max-w-xs sm:max-w-sm">
            Here's what we set up based on your answers
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 w-full text-left text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <span><strong>Account:</strong> {formData.operatorType}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🛒</span>
                <span><strong>Business:</strong> {formData.businessType}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <span><strong>Goal:</strong> {formData.campaignGoal}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">👥</span>
                <span><strong>Programme:</strong> {formData.influencerCount}</span>
              </div>
            </div>
          </div>

          {/* Attribution Question */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-600 mb-3">One last thing — how did you hear about us?</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Facebook', 'Instagram', 'TikTok', 'LinkedIn',
                'YouTube', 'Google Search', 'Referral', 'Blog / Article',
                'Chrome Web Store', 'Product Hunt', 'Podcast', 'Other'
              ].map((source) => (
                <button
                  key={source}
                  onClick={() => {
                    const current = formData.acquisitionSource || []
                    const updated = current.includes(source)
                      ? current.filter(s => s !== source)
                      : [...current, source]
                    onFormChange('acquisitionSource', updated)
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    (formData.acquisitionSource || []).includes(source)
                      ? 'bg-[#1FAE5B] text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={() => router.push("/pricing")}
              disabled={isLoading}
              className="h-10 sm:h-12 px-8 sm:px-12 text-sm sm:text-base bg-[#1FAE5B] text-white font-semibold hover:bg-[#17a04e] rounded-full"
            >
              {isLoading ? 'Taking you to pricing...' : 'View pricing plans →'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row w-full max-w-full sm:max-w-4xl min-h-[520px] sm:h-[480px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl bg-gradient-to-b from-white via-white to-[#0F6B3E]/5 border border-[#0F6B3E]/15 relative items-stretch">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#1FAE5B] to-transparent" />
      
      {/* Left Content Area */}
      <div className="flex-1 px-6 sm:px-10 py-4 sm:py-6 flex flex-col overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <Image 
            src="/images/instroomLogo.png" 
            alt="Instroom Logo" 
            width={24}
            height={24}
            className="rounded-lg w-6 h-6"
          />
          <span className="font-bold text-sm sm:text-base text-gray-900">Instroom</span>
        </div>

        {/* Step Indicator */}
        <div className="text-xs font-semibold text-gray-500 mb-1.5 tracking-wider">
          STEP {step} OF {STEPS.length}
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mb-3 sm:mb-4">
          <div
            className="h-full bg-[#1FAE5B] transition-all duration-300"
            style={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1.5 sm:mb-2">
          {currentStep.title}
        </h2>
        <p className="text-xs leading-tight text-gray-600 mb-3 sm:mb-4">
          {currentStep.description}
        </p>

        {/* Content */}
        <div className="flex-1 mb-4 sm:mb-6">
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '🛍️ My own brand', subtext: 'I manage my brand\'s influencer campaigns' },
                { label: '🏢 My brand + a team', subtext: 'We have an in-house marketing team' },
                { label: '🏬 An agency — multiple clients', subtext: 'I manage campaigns for other brands' },
                { label: '🧑‍💻 Freelancer / consultant', subtext: 'I work independently across brands' },
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => onFormChange('operatorType', option.label)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    formData.operatorType === option.label
                      ? 'border-[#1FAE5B] bg-green-50'
                      : 'border-gray-200 bg-white hover:border-[#1FAE5B]'
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-sm">{option.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{option.subtext}</p>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: '🛒', label: 'eCommerce / DTC', subtext: 'I sell physical products online' },
                { emoji: '📱', label: 'Mobile app', subtext: 'Installs, sign-ups, in-app actions' },
                { emoji: '💻', label: 'SaaS / digital product', subtext: 'Software, subscriptions, online tools' },
                { emoji: '🎨', label: 'Services / personal brand', subtext: 'Coaching, agency, creator, consultant' },
                { emoji: '🏪', label: 'Retail / physical store', subtext: 'Brick-and-mortar with online presence' },
                { emoji: '🌐', label: 'Other', subtext: 'None of the above' },
              ].map((option) => {
                const isDTC = option.label === 'eCommerce / DTC'
                return (
                <button
                  key={option.label}
                  disabled={!isDTC}
                  onClick={() => isDTC && onFormChange('businessType', option.label)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    formData.businessType === option.label
                      ? 'border-[#1FAE5B] bg-green-50'
                      : 'border-gray-200 bg-white hover:border-[#1FAE5B]'
                  } ${!isDTC ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <p className="font-semibold text-gray-900 text-sm">{option.emoji} {option.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{option.subtext}</p>
                </button>
              )})}
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: '🎯', label: 'Drive conversions', subtext: 'Sales, installs, sign-ups, leads' },
                { emoji: '📣', label: 'Build brand awareness', subtext: 'Reach new audiences at scale' },
                { emoji: '📸', label: 'Collect UGC content', subtext: 'Photos and videos to repurpose' },
                { emoji: '💪', label: 'Build an ambassador army', subtext: 'Long-term creator relationships' },
                { emoji: '⭐', label: 'Build social proof', subtext: 'Trust, credibility, reviews' },
                { emoji: '🌍', label: 'Expand to new markets', subtext: 'Enter new regions or demographics' },
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => onFormChange('campaignGoal', option.label)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    formData.campaignGoal === option.label
                      ? 'border-[#1FAE5B] bg-green-50'
                      : 'border-gray-200 bg-white hover:border-[#1FAE5B]'
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-sm">{option.emoji} {option.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{option.subtext}</p>
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: '🌱', label: 'None yet', subtext: 'Just getting started' },
                { emoji: '👤', label: '1 – 10', subtext: 'Small roster, early stage' },
                { emoji: '👥', label: '11 – 50', subtext: 'Growing programme' },
                { emoji: '🚀', label: '51 – 200', subtext: 'Active and scaling' },
                { emoji: '🏆', label: '200+', subtext: 'Large or agency-scale' },
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => onFormChange('influencerCount', option.label)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    formData.influencerCount === option.label
                      ? 'border-[#1FAE5B] bg-green-50'
                      : 'border-gray-200 bg-white hover:border-[#1FAE5B]'
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-sm">{option.emoji} {option.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{option.subtext}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
          <div className="flex gap-1 order-2 sm:order-1">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  index < step ? 'bg-[#1FAE5B]' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-3">
            {step === 1 ? (
              <button
                onClick={onSkip}
                className="text-sm text-gray-500 hover:text-[#1FAE5B]"
                disabled={isLoading}
              >
                Skip ≫
              </button>
            ) : (
              <button
                onClick={onBack}
                className="px-4 sm:px-6 py-2 border-2 border-gray-300 rounded-full text-xs sm:text-sm font-semibold text-gray-600 hover:border-gray-400 whitespace-nowrap"
                disabled={isLoading}
              >
                Back
              </button>
            )}
            <Button
              onClick={handleNext}
              disabled={isLoading}
              className="px-6 sm:px-8 h-9 sm:h-10 text-xs sm:text-sm bg-[#1FAE5B] text-white font-semibold hover:bg-[#17a04e] rounded-full whitespace-nowrap"
            >
              {step === STEPS.length ? (isLoading ? 'Completing...' : 'Complete Setup →') : 'Next Step →'}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Hidden on mobile */}
      <div className="hidden sm:block w-full sm:w-64 h-full relative overflow-hidden">
        
        {/* Images for each step */}
        <div className="w-full h-full relative">
          {step === 1 && (
            <Image
              src="/images/accountType.png"
              alt="Step 1: Account Type"
              fill
              className="object-cover"
              priority
            />
          )}
          {step === 2 && (
            <Image
              src="/images/businessType.png"
              alt="Step 2: Business Type"
              fill
              className="object-cover"
              priority
            />
          )}
          {step === 3 && (
            <Image
              src="/images/campaign.png"
              alt="Step 3: Campaign Goal"
              fill
              className="object-cover"
              priority
            />
          )}
          {step === 4 && (
            <Image
              src="/images/influencerCount.png"
              alt="Step 4: Influencer Count"
              fill
              className="object-cover"
              priority
            />
          )}
        </div>
      </div>
    </div>
  )
}
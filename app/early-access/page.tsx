import { Suspense } from "react"
import Image from "next/image"
import { EarlyAccessForm } from "@/components/early-access-form"

export const metadata = {
  title: "Get Early Access | Instroom",
  description: "Join the Instroom private beta. Request early access and we'll email you the moment your workspace is ready.",
}

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ notApproved?: string }>
}) {
  const params = await searchParams
  const notApproved = params?.notApproved === "1"

  return (
    <div className="min-h-svh w-full bg-[#F7F9F8] text-[#1E1E1E] relative overflow-hidden">
      <div className="fixed top-4 sm:top-6 left-4 sm:left-12 z-50">
        <Image
          src="/images/INSTROOM LOGO 1.png"
          alt="Instroom Logo"
          width={140}
          height={140}
          priority
          quality={95}
          className="drop-shadow-sm w-32 sm:w-44 h-auto"
        />
      </div>

      <div className="absolute top-0 left-0 w-64 sm:w-96 h-64 sm:h-96 rounded-full bg-[#1FAE5B]/8 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-56 sm:w-80 h-56 sm:h-80 rounded-full bg-[#0F6B3E]/6 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="hidden sm:block absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-[#2C8EC4]/5 blur-3xl" />

      <div className="min-h-svh flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-0 gap-4 sm:gap-0 relative z-20">
        {notApproved && (
          <div className="w-full max-w-sm sm:max-w-lg mb-4 rounded-lg border border-[#F4B740]/40 bg-[#F4B740]/8 px-4 py-2.5 text-xs sm:text-sm text-[#C87500] text-center">
            That email isn't approved for early access yet — join the list below and we'll email you when you're in.
          </div>
        )}
        <Suspense fallback={null}>
          <EarlyAccessForm className="w-full max-w-sm sm:max-w-lg rounded-2xl shadow-lg p-4 sm:p-6 border border-[#0F6B3E]/15 bg-gradient-to-b from-white via-white to-[#0F6B3E]/5 relative overflow-hidden" />
        </Suspense>
        <p className="mt-6 text-xs text-gray-400 text-center max-w-[380px]">
          Built by an agency that got tired of living in spreadsheets.
        </p>
      </div>
    </div>
  )
}

import { Suspense } from "react"
import { SignupForm } from "@/components/signup-form"
import Image from "next/image"

export default function SignupPage() {
  return (
    <div className="min-h-svh w-full bg-[#F7F9F8] text-[#1E1E1E] relative overflow-hidden">
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

      <div className="absolute top-0 left-0 w-64 sm:w-96 h-64 sm:h-96 rounded-full bg-[#1FAE5B]/8 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-56 sm:w-80 h-56 sm:h-80 rounded-full bg-[#0F6B3E]/6 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="hidden sm:block absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-[#2C8EC4]/5 blur-3xl" />

      <div className="min-h-svh flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-0 gap-4 sm:gap-0 relative z-20">
        <Suspense fallback={null}>
          <SignupForm className="rounded-2xl shadow-lg p-6 sm:p-8 border border-[#0F6B3E]/15 bg-gradient-to-b from-white via-white to-[#0F6B3E]/5 relative overflow-hidden" />
        </Suspense>
      </div>
    </div>
  )
}

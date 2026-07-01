import Image from "next/image"
import { PasswordResetForm } from "@/components/password-reset-form"

export default async function PasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  
  return (
    <div className="min-h-svh w-full bg-[#F7F9F8] text-[#1E1E1E] relative overflow-hidden">
      <div className="fixed top-6 left-12 z-50">
        <Image 
          src="/images/Instroom Logo 1.png" 
          alt="Instroom Logo" 
          width={180} 
          height={180}
          priority
          quality={95}
          className="drop-shadow-sm"
        />
      </div>

      <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-[#1FAE5B]/8 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[#0F6B3E]/6 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-[#2C8EC4]/5 blur-3xl" />

      <div className="min-h-svh flex items-center justify-center relative z-20">
        <PasswordResetForm token={params.token} className="rounded-2xl shadow-lg p-8 border border-[#0F6B3E]/15 bg-gradient-to-b from-white via-white to-[#0F6B3E]/5 relative overflow-hidden" />
      </div>
    </div>
  )
}

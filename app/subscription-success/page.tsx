"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2 } from "lucide-react";
import Image from "next/image";

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session === null) {
      router.push("/login");
      return;
    }

    if (!session?.user?.id) {
      return;
    }

    const timeout = setTimeout(() => {
      router.push("/dashboard");
    }, 3000);

    return () => clearTimeout(timeout);
  }, [router, session]);

  return (
    <div className="relative min-h-screen bg-[#F7F9F8] text-[#1E1E1E] overflow-hidden">
      <div className="pointer-events-none fixed top-0 left-0 w-64 sm:w-96 h-64 sm:h-96 rounded-full bg-[#1FAE5B]/8 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-56 sm:w-80 h-56 sm:h-80 rounded-full bg-[#0F6B3E]/6 blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="fixed top-4 sm:top-6 left-4 sm:left-12 z-50">
        <Image
          src="/images/INSTROOM LOGO 1.png"
          alt="Instroom Logo"
          width={180}
          height={180}
          priority
          quality={95}
          className="drop-shadow-sm w-32 sm:w-44 h-auto"
        />
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm sm:max-w-md bg-white border border-[#0F6B3E]/15 rounded-2xl shadow-2xl p-6 sm:p-8 text-center">
          <div className="flex justify-center mb-6 sm:mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-[#1FAE5B]/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#1FAE5B] to-[#0F6B3E] rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold mb-2 text-[#1E1E1E]">
            Payment Successful!
          </h1>

          <p className="text-[#666666] text-sm">
            Your subscription has been activated. Redirecting to your dashboard...
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { Logo } from "@/components/brand/logo"
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2 } from "lucide-react";

// How long to wait for the Lemon Squeezy webhook to actually land before
// giving up and sending the user on anyway. Webhook delivery isn't
// instant — a flat timer here would race it, so this polls the real
// subscription state instead of guessing.
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1500;

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

    // Honour a return target set before checkout (currently the Post Tracker
    // Add-on flow, which sends the user back to the influencer's Post tab).
    // Falls back to /dashboard exactly as before when nothing is stored, and
    // only same-origin relative paths are accepted so this can't be used as an
    // open redirect.
    let destination = "/dashboard";
    try {
      const returnTo = window.sessionStorage.getItem("ptAddonReturnTo");
      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        destination = returnTo;
      }
    } catch {
      /* storage unavailable — keep the default */
    }

    let cancelled = false;

    const pollForActivation = async (attempt: number) => {
      if (cancelled) return;

      try {
        const res = await fetch("/api/subscription/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: session.user.id }),
        });
        const data = await res.json();
        if (data.active) {
          if (!cancelled) router.push(destination);
          return;
        }
      } catch {
        /* transient fetch failure — just retry on the next attempt */
      }

      if (attempt >= MAX_POLL_ATTEMPTS) {
        // Webhook is taking unusually long — don't trap the user here
        // forever. Middleware will bounce them back to /pricing if the
        // subscription still isn't active by the time they land.
        if (!cancelled) router.push(destination);
        return;
      }

      setTimeout(() => pollForActivation(attempt + 1), POLL_INTERVAL_MS);
    };

    pollForActivation(1);

    return () => {
      cancelled = true;
    };
  }, [router, session]);

  return (
    <div className="relative min-h-screen bg-[#F7F9F8] text-[#1E1E1E] overflow-hidden">
      <div className="pointer-events-none fixed top-0 left-0 w-64 sm:w-96 h-64 sm:h-96 rounded-full bg-[#1FAE5B]/8 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-56 sm:w-80 h-56 sm:h-80 rounded-full bg-[#0F6B3E]/6 blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="fixed top-4 sm:top-6 left-4 sm:left-12 z-50">
        <Logo size="page" alt="Instroom" priority className="drop-shadow-sm" />
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

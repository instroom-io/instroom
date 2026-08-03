"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookDemoModal } from "@/components/shared/book-demo-modal"

const ROLE_OPTIONS = [
  "Solo brand / operator",
  "DTC / e-commerce brand",
  "Agency",
  "Freelancer / consultant",
  "Just exploring",
]

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function EarlyAccessForm({ className }: { className?: string }) {
  const [view, setView] = useState<"capture" | "confirm">("capture")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showBookDemo, setShowBookDemo] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validEmail(email)) {
      setError("Enter a valid email so we can reach you.")
      return
    }
    if (!name.trim()) {
      setError("Enter your name.")
      return
    }
    if (!role) {
      setError("Let us know what you're running.")
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.")
        return
      }
      setView("confirm")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (view === "confirm") {
    return (
      <Card className={className}>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#1FAE5B] to-transparent" />
        <CardHeader className="justify-items-center text-center gap-1 pt-1">
          <div className="w-14 h-14 rounded-full bg-[#EAF7F0] border border-[#1FAE5B]/35 flex items-center justify-center mb-2">
            <svg viewBox="0 0 24 24" className="w-7 h-7">
              <path d="M4 12.5l5 5L20 6.5" stroke="#1FAE5B" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">You&apos;re on the list.</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-gray-600 max-w-[380px]">
            We&apos;ll email <span className="font-semibold text-gray-900">{email}</span> the moment your Instroom
            workspace is ready. We activate beta users in small batches, so it won&apos;t be long.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex flex-col divide-y divide-gray-100">
            {[
              { title: "You're confirmed", desc: "Nothing more to do. Your spot is saved." },
              { title: "We open the next batch", desc: "We activate new workspaces in small groups so onboarding stays smooth for everyone." },
              { title: "You get the email", desc: "Your login goes live and you can set up your first campaign — 3 months, full platform, no card." },
            ].map((step, i) => (
              <div key={step.title} className="flex gap-3.5 py-3">
                <div className="flex-none w-[26px] h-[26px] rounded-full bg-[#EAF7F0] text-[#0F6B3E] text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">{step.title}</div>
                  <div className="text-xs text-gray-600 leading-relaxed">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">While you wait</div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Link
                href="https://chromewebstore.google.com/detail/instroomio/ehgceomekjhamiakclkpgadphbenlmmj"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-sm font-semibold px-4 py-2.5 rounded-lg bg-[#EAF7F0] border border-[#1FAE5B]/30 text-[#0F6B3E] hover:bg-[#dff2e7] transition-colors"
              >
                ⚡ Try the free extension
              </Link>
              <button
                onClick={() => setShowBookDemo(true)}
                className="flex-1 text-center text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:border-[#1FAE5B] hover:text-[#0F6B3E] transition-colors bg-white"
              >
                Book a demo
              </button>
            </div>
          </div>
        </CardContent>
        <BookDemoModal open={showBookDemo} onClose={() => setShowBookDemo(false)} />
      </Card>
    )
  }

  return (
    <Card className={className}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#1FAE5B] to-transparent" />
      <CardHeader className="gap-0.5 pb-0 pt-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#0F6B3E] bg-[#EAF7F0] border border-[#0F6B3E]/20 px-2.5 py-1 rounded-full w-fit mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1FAE5B] animate-pulse" />
          Private beta
        </span>
        <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">Get early access to Instroom.</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-gray-600">
          We&apos;re onboarding beta users in small batches while we finish building. Join the list and we&apos;ll
          email you the moment your workspace is ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        {error && (
          <div className="mb-3 rounded-lg border border-[#F4B740]/40 bg-[#F4B740]/8 p-2 text-xs sm:text-sm text-[#C87500]">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <FieldGroup className="space-y-0.5">
            <Field>
              <FieldLabel htmlFor="email" className="font-medium text-gray-700 text-xs sm:text-sm">
                Work email
              </FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="you@yourbrand.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                className="rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0F6B3E] focus:ring-[#0F6B3E]/20 transition-colors"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="name" className="font-medium text-gray-700 text-xs sm:text-sm">
                Name
              </FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                required
                className="rounded-lg border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0F6B3E] focus:ring-[#0F6B3E]/20 transition-colors"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="role" className="font-medium text-gray-700 text-xs sm:text-sm">
                What are you running?
              </FieldLabel>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role" className="w-full rounded-lg border border-gray-200 bg-gray-50/50">
                  <SelectValue placeholder="Select one" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="space-y-0.5 pt-0.5">
              <Button
                type="submit"
                disabled={isLoading}
                className="h-10 sm:h-11 w-full text-sm sm:text-base bg-[#1FAE5B] text-white font-semibold rounded-lg shadow-md hover:bg-[#17a04e] hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isLoading ? "Requesting access…" : "Request early access"}
              </Button>
              <FieldDescription className="text-center text-gray-500 text-xs">
                No spam. Just one email when it&apos;s your turn.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>

        <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3 items-start">
          <div className="flex-none w-8 h-8 rounded-lg bg-[#EAF7F0] flex items-center justify-center text-sm">⚡</div>
          <p className="text-xs text-gray-600 leading-relaxed">
            <strong className="text-gray-900 font-semibold">Don&apos;t want to wait?</strong> The Chrome Extension is
            free and live today — capture creator data while you browse Instagram and TikTok.{" "}
            <Link
              href="https://chromewebstore.google.com/detail/instroomio/ehgceomekjhamiakclkpgadphbenlmmj"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2C8EC4] font-medium hover:underline"
            >
              Get the free extension →
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

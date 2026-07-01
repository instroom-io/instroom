"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type BizType = "dtc" | "saas" | "service" | "digital"

interface PipeStage {
  color: string
  name: string
  desc: string
  isExit?: boolean
  dotShape?: "circle" | "square"
}

interface PipeGroup {
  label: string
  stages: PipeStage[]
  exitStage?: PipeStage
}

// ─── Static data ──────────────────────────────────────────────────────────────

const BIZ_OPTIONS: {
  id: BizType
  icon: string
  name: string
  desc: string
  badge: string
  badgeMain?: boolean
  locked?: boolean
}[] = [
  {
    id: "dtc",
    icon: "📦",
    name: "DTC / E-commerce",
    desc: "Physical products with shipping & gifting",
    badge: "Main market",
    badgeMain: true,
  },
  {
    id: "saas",
    icon: "💻",
    name: "SaaS / App",
    desc: "Software access, trials, digital onboarding",
    badge: "Coming soon",
    locked: true,
  },
  {
    id: "service",
    icon: "🤝",
    name: "Service business",
    desc: "Agency, coaching, or professional services",
    badge: "Coming soon",
    locked: true,
  },
  {
    id: "digital",
    icon: "🎓",
    name: "Digital product",
    desc: "Courses, templates, downloadable content",
    badge: "Coming soon",
    locked: true,
  },
]

const DTC_PIPELINE: PipeGroup[] = [
  {
    label: "Outreach",
    stages: [
      { color: "#B4B2A9", name: "For outreach", desc: "On list, not yet messaged" },
      { color: "#2C8EC4", name: "Contacted", desc: "DM or email sent, awaiting reply" },
      { color: "#F4B740", name: "In conversation", desc: "Replied — negotiating terms" },
    ],
    exitStage: {
      color: "#E24B4A",
      name: "Not interested",
      desc: "Declined or went silent",
      isExit: true,
      dotShape: "square",
    },
  },
  {
    label: "Closed collaboration",
    stages: [
      { color: "#1FAE5B", name: "Deal agreed", desc: "Terms confirmed — gifting, paid, or affiliate" },
      { color: "#2C8EC4", name: "Order placed", desc: "Product ordered or shipment initiated" },
      { color: "#F4B740", name: "In transit", desc: "Shipped — tracking shared with creator" },
      { color: "#1FAE5B", name: "Delivered", desc: "Creator confirmed receipt of product" },
      { color: "#E24B4A", name: "Delivery problem", desc: "Lost, returned, or wrong item" },
      { color: "#1FAE5B", name: "Posted", desc: "Content is live — tracking begins" },
    ],
    exitStage: {
      color: "#888780",
      name: "No post",
      desc: "Product received, no content posted yet",
      isExit: true,
      dotShape: "square",
    },
  },
]

const SUCCESS_STAGE_CHIPS: { label: string; bg: string; color: string; border: string }[] = [
  { label: "For outreach", bg: "#f5f5f5", color: "#666", border: "#eee" },
  { label: "Contacted", bg: "#E6F1FB", color: "#0C447C", border: "#B5D4F4" },
  { label: "In conversation", bg: "#FFF8EC", color: "#7a4c00", border: "#FAC775" },
  { label: "Not interested ✕", bg: "#FEF0F0", color: "#a32d2d", border: "#F7C1C1" },
  { label: "Deal agreed", bg: "#e0f7ec", color: "#0e7a42", border: "#9FE1CB" },
  { label: "Order placed", bg: "#E6F1FB", color: "#0C447C", border: "#B5D4F4" },
  { label: "In transit", bg: "#FFF8EC", color: "#7a4c00", border: "#FAC775" },
  { label: "Delivered", bg: "#e0f7ec", color: "#0e7a42", border: "#9FE1CB" },
  { label: "Delivery problem", bg: "#FEF0F0", color: "#a32d2d", border: "#F7C1C1" },
  { label: "Posted", bg: "#e0f7ec", color: "#0e7a42", border: "#9FE1CB" },
  { label: "No post ✕", bg: "#f5f5f5", color: "#555", border: "#eee" },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDot({ active }: { active: boolean }) {
  return (
    <div
      className="transition-all duration-200"
      style={{
        width: active ? 18 : 6,
        height: 6,
        borderRadius: active ? 3 : "50%",
        background: active ? "#1FAE5B" : "#e0e0e0",
      }}
    />
  )
}

function PipelineRow({ stage }: { stage: PipeStage }) {
  const isExit = stage.isExit
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
        isExit ? "border-red-100 bg-red-50/40 opacity-80" : "border-gray-100 bg-gray-50"
      }`}
    >
      <div
        className="shrink-0"
        style={{
          width: 8,
          height: 8,
          borderRadius: stage.dotShape === "square" ? 2 : "50%",
          background: stage.color,
        }}
      />
      <span className={`text-xs font-semibold flex-1 ${isExit ? "text-gray-400" : "text-gray-900"}`}>
        {stage.name}
      </span>
      <span className="text-[11px] text-gray-400">{stage.desc}</span>
      {isExit && (
        <span
          className="text-[9px] font-semibold px-1.5 py-px rounded uppercase tracking-wide shrink-0"
          style={{
            border: `1px solid ${stage.color === "#E24B4A" ? "#f7c1c1" : "#e0e0e0"}`,
            background: stage.color === "#E24B4A" ? "#fef0f0" : "#f5f5f5",
            color: stage.color === "#E24B4A" ? "#E24B4A" : "#888",
          }}
        >
          exit
        </span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateBrandPage() {
  const router = useRouter()
  const { data: session } = useSession()

  const [step, setStep] = useState(1)
  const TOTAL = 3

  const isMounted = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => { isMounted.current = true }, 100)
    return () => clearTimeout(t)
  }, [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [nameError, setNameError] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    website_url: "",
  })
  const [selectedBiz] = useState<BizType>("dtc") // only dtc selectable for now

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (name === "name" && value.trim()) setNameError(false)
  }

  const goNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        setNameError(true)
        return
      }
      setNameError(false)
    }
    if (step === 2) {
      handleConfirm()
      return
    }
    if (step < TOTAL) setStep((s) => s + 1)
  }

  const goBack = () => {
    if (step > 1 && step < TOTAL) setStep((s) => s - 1)
  }

  const handleConfirm = async () => {
    setError("")
    setLoading(true)
    try {
      const response = await fetch("/api/brand/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Failed to create brand")
        setLoading(false)
        return
      }
      setStep(3)
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // ── Not signed in guard ──────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl w-full max-w-[480px] overflow-hidden shadow-2xl">
          <div className="h-1 bg-gray-100">
            <div className="h-full bg-[#1FAE5B] rounded-r-sm" style={{ width: "25%" }} />
          </div>
          <div className="px-7 pt-7 pb-6">
            <div className="text-[11px] font-semibold text-[#1FAE5B] uppercase tracking-widest mb-1.5">
              Sign in required
            </div>
            <div className="text-xl font-bold text-gray-900 mb-1 leading-snug">Access restricted</div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              You need to be signed in to create a workspace.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const progressWidth = `${(step / TOTAL) * 100}%`

  const handleBackdropClose = () => {
    if (!isMounted.current) return
    if (step < 3) router.back()
  }

  const handleXClose = () => {
    if (step < 3) router.back()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70"
      onClick={handleBackdropClose}
    >
      <div
        className="relative bg-white rounded-2xl w-full max-w-[480px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* X button */}
        {step < 3 && (
          <button
            onClick={handleXClose}
            className="absolute top-3.5 right-3.5 z-10 text-gray-300 hover:text-gray-500 transition-colors p-1"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-[#1FAE5B] rounded-r-sm transition-[width] duration-300 ease-in-out"
            style={{ width: progressWidth }}
          />
        </div>

        {/* Body */}
        <div className="px-7 pt-7 pb-5">

          {/* ── Step 1: Workspace info ── */}
          {step === 1 && (
            <div>
              <div className="text-[11px] font-semibold text-[#1FAE5B] uppercase tracking-widest mb-1.5">
                Step 1 of 3
              </div>
              <div className="text-xl font-bold text-gray-900 mb-1 leading-snug">Set up your workspace</div>
              <p className="text-[13px] text-gray-400 mb-5 leading-relaxed">
                Tell us about your brand so we can configure your workspace correctly.
              </p>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-600 mb-3.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                  Brand name <span className="text-[#1FAE5B]">*</span>
                </div>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., My Fashion Brand"
                  autoComplete="off"
                  className={`w-full text-[13px] text-gray-900 bg-white rounded-lg border px-3 py-2.5 outline-none ${
                    nameError ? "border-[#E24B4A]" : "border-gray-200"
                  }`}
                  disabled={loading}
                />
                {nameError && (
                  <p className="text-[11px] text-[#E24B4A] mt-1">Brand name is required.</p>
                )}
              </div>

              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-700 mb-1.5">Description</div>
                <Input
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="What does your brand do?"
                  autoComplete="off"
                  className="w-full text-[13px] text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2.5 outline-none"
                  disabled={loading}
                />
              </div>

              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-700 mb-1.5">Website URL</div>
                <Input
                  name="website_url"
                  value={formData.website_url}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  type="url"
                  autoComplete="off"
                  className="w-full text-[13px] text-gray-900 bg-white rounded-lg border border-gray-200 px-3 py-2.5 outline-none"
                  disabled={loading}
                />
              </div>
            </div>
          )}


          {/* ── Step 2: Pipeline review ── */}
          {step === 2 && (
            <div>
              <div className="text-[11px] font-semibold text-[#1FAE5B] uppercase tracking-widest mb-1.5">
                Step 2 of 3
              </div>
              <div className="text-xl font-bold text-gray-900 mb-1 leading-snug">Your DTC pipeline stages</div>
              <p className="text-[13px] text-gray-400 mb-5 leading-relaxed">
                These will appear across your pipeline, campaign tracker, and analytics.
              </p>

              <div className="max-h-64 overflow-y-auto pr-0.5">
                {DTC_PIPELINE.map((group) => (
                  <div key={group.label} className="mb-3.5">
                    <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1.5 pl-0.5">
                      {group.label}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {group.stages.map((stage) => (
                        <PipelineRow key={stage.name} stage={stage} />
                      ))}
                    </div>
                    {group.exitStage && (
                      <>
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-300 uppercase tracking-wide my-2">
                          <span className="flex-1 h-px bg-gray-100 block" />
                          exit
                          <span className="flex-1 h-px bg-gray-100 block" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <PipelineRow stage={group.exitStage} />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-600 mt-3">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {step === 3 && (
            <div className="py-1 pb-2 text-center">
              <div className="w-[52px] h-[52px] rounded-full bg-[#e0f7ec] flex items-center justify-center mx-auto mb-4">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12l5 5L19 7"
                    stroke="#1FAE5B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="text-xl font-bold text-gray-900 mb-1 leading-snug">
                {formData.name ? `${formData.name} is ready!` : "Workspace ready!"}
              </div>
              <p className="text-[13px] text-gray-400 leading-relaxed">
                Your workspace is configured with 11 DTC pipeline stages. Every status now matches exactly how your
                fulfillment works.
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3.5 justify-center">
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[#9FE1CB] bg-[#f0fbf5] text-[#0e7a42]">
                  📦 DTC / E-commerce
                </span>
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-500">
                  11 stages configured
                </span>
              </div>

              <div className="mt-4 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-left">
                <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2.5">
                  Pipeline at a glance
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUCCESS_STAGE_CHIPS.map((c) => (
                    <span
                      key={c.label}
                      className="text-[10px] font-medium px-2.5 py-0.5 rounded-full border"
                      style={{ background: c.bg, color: c.color, borderColor: c.border }}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => router.push(`/dashboard/manage-influencers`)}
                className="mt-5 text-[13px] font-semibold text-white bg-[#1FAE5B] hover:bg-[#18a050] border-none rounded-lg px-7 py-2.5 cursor-pointer"
              >
                Go to my workspace →
              </Button>
            </div>
          )}
        </div>

        {/* Footer (hidden on step 3) */}
        {step < 3 && (
          <div className="flex items-center justify-between px-7 pt-3.5 pb-5 border-t border-gray-100 gap-2.5">
            <div className="flex gap-1.5 items-center">
              {Array.from({ length: TOTAL }).map((_, i) => (
                <StepDot key={i} active={i === step - 1} />
              ))}
            </div>

            {step > 1 && (
              <button
                onClick={goBack}
                disabled={loading}
                className="text-[13px] text-gray-400 bg-transparent border border-gray-200 rounded-lg px-4 py-2.5 cursor-pointer flex items-center gap-1.5 font-[inherit] hover:bg-gray-50 disabled:opacity-50"
              >
                ← Back
              </button>
            )}

            <button
              onClick={goNext}
              disabled={loading}
              className="text-[13px] font-semibold text-white bg-[#1FAE5B] border-none rounded-lg px-5 py-2.5 cursor-pointer font-[inherit] flex-1 hover:bg-[#18a050] transition-colors disabled:opacity-70"
            >
              {loading ? "Creating..." : step === 2 ? "Confirm & create workspace" : "Next →"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
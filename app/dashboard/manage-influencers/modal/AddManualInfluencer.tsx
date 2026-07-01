"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"

const getProfileUrl = (platform: string, handle: string): string => {
  if (!handle || handle === "@") return ""
  const urlMap: Record<string, (h: string) => string> = {
    instagram: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
    tiktok: (h) => `https://tiktok.com/@${h.replace(/^@/, "")}`,
    youtube: (h) => `https://youtube.com/@${h.replace(/^@/, "")}`,
    twitter: (h) => `https://x.com/${h.replace(/^@/, "")}`,
    other: () => ""
  }
  return urlMap[platform]?.(handle) ?? ""
}

type FormData = {
  platform: string
  username: string
  email: string
  name: string
  followers: string
  engagement: string
  location: string
  niche: string
  gender: string
  social_link: string
}

export default function AddManualInfluencer({ 
  onSave, 
  onBack 
}: { 
  onSave: (data: FormData) => void
  onBack: () => void
}) {

  const [form, setForm] = useState<FormData>({
    platform: "",
    username: "",
    email: "",
    name: "",
    followers: "",
    engagement: "",
    location: "",
    niche: "",
    gender: "",
    social_link: "",
  })

  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const updated = { ...form, [e.target.name]: e.target.value }
    if (e.target.name === "platform" || e.target.name === "username") {
      updated.social_link = getProfileUrl(updated.platform, updated.username)
    }
    setForm(updated)
  }

  const validate = () => {
    let newErrors: Record<string, boolean> = {}

    if (!form.platform) newErrors.platform = true
    if (!form.username) newErrors.username = true
    if (!form.followers) newErrors.followers = true
    if (!form.engagement) newErrors.engagement = true
    if (!form.location) newErrors.location = true
    if (!form.niche) newErrors.niche = true
    if (!form.gender) newErrors.gender = true

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSave(form)
  }

  return (
    <div className="w-full">

      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-[#1E1E1E]">
          Create New Influencer
        </h2>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:gap-4 text-xs sm:text-sm">

          <div className="flex flex-col gap-1">
            <label>
              Select Platform <span className="text-red-500">*</span>
            </label>

            <select
              name="platform"
              value={form.platform}
              onChange={handleChange}
              className={`h-10 border rounded-md px-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]
              ${errors.platform ? "border-red-500" : "border-gray-200"}`}
            >
              <option value="">Select Platform</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="twitter">Twitter</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label>
              Username <span className="text-red-500">*</span>
            </label>

            <Input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="@handle"
              className={errors.username ? "border-red-500" : ""}
            />
          </div>

        </div>

        {/* CONTACT INFO */}
        <div>
          <p className="text-sm font-medium text-[#1E1E1E] mb-3">
            Contact Information
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email Address"
            />

            <Input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Full Name"
            />
          </div>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="flex flex-col gap-1">
            <label className="text-sm">Followers <span className="text-red-500">*</span></label>
            <Input
              name="followers"
              value={form.followers}
              onChange={handleChange}
              placeholder="10000"
              className={errors.followers ? "border-red-500" : ""}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm">Engagement Rate <span className="text-red-500">*</span></label>
            <Input
              name="engagement"
              value={form.engagement}
              onChange={handleChange}
              placeholder="2.5"
              className={errors.engagement ? "border-red-500" : ""}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm">Location <span className="text-red-500">*</span></label>
            <Input
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="City, Country"
              className={errors.location ? "border-red-500" : ""}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm">Niche <span className="text-red-500">*</span></label>
            <Input
              name="niche"
              value={form.niche}
              onChange={handleChange}
              placeholder="Fashion, Tech, etc."
              className={errors.niche ? "border-red-500" : ""}
            />
          </div>

        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="flex flex-col gap-1">
            <label className="text-sm">Gender <span className="text-red-500">*</span></label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.gender ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm">Social Link</label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-600 truncate">
              {form.social_link || "Auto-generated"}
            </div>
          </div>

        </div>

      </div>


      <div className="flex items-center justify-end gap-3 sm:gap-4 pt-4 sm:pt-6 border-t">

        <button
          onClick={onBack}
          className="text-gray-500 hover:text-[#0F6B3E] font-medium"
        >
          Back
        </button>

        <button
          onClick={handleSubmit}
          className="bg-[#1FAE5B] text-white px-6 py-2 rounded-lg hover:bg-[#0F6B3E]"
        >
          Save Influencer
        </button>

      </div>

    </div>
  )
}
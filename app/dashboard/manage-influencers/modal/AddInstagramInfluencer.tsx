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

export default function AddInstagramInfluencer({ 
  onSave, 
  onBack 
}: { 
  onSave: (data: FormData) => void
  onBack: () => void
}) {

  const [form, setForm] = useState<FormData>({
    username: "",
    email: "",
    name: "",
    followers: "",
    engagement: "",
    location: "",
    niche: "",
    gender: "",
    social_link: getProfileUrl("instagram", ""),
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...form, [e.target.name]: e.target.value }
    if (e.target.name === "username") {
      updated.social_link = getProfileUrl("instagram", updated.username)
    }
    setForm(updated)
  }

  const handleSubmit = () => {
    if (!form.username || !form.followers || !form.engagement || !form.location || !form.niche || !form.gender) {
      alert("Please fill in all required fields")
      return
    }
    onSave(form)
  }

  const handleCancel = () => {
    const hasInput = Object.values(form).some((v) => v !== "")
    if (hasInput) {
      const confirmClose = window.confirm("Discard entered information?")
      if (!confirmClose) return
    }
    onBack()
  }

  return (
    <div className="w-full">

        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-[#1E1E1E]">
            Add Instagram Influencer
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
          Enter the influencer’s Instagram username. We’ll automatically pull their profile details and key metrics for you.
        </p>

        <div className="space-y-3 sm:space-y-4">

          <div className="flex flex-col gap-1">
            <label className="text-sm">
              Username <span className="text-red-500">*</span>
            </label>

            <Input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Enter Instagram Username"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm">
              Email address
            </label>

            <Input
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email Address"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm">
              Full name
            </label>

            <Input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Full Name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

            <div className="flex flex-col gap-1">
              <label className="text-sm">
                Followers <span className="text-red-500">*</span>
              </label>

              <Input
                name="followers"
                value={form.followers}
                onChange={handleChange}
                placeholder="6000"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm">
                Eng. Rate <span className="text-red-500">*</span>
              </label>

              <Input
                name="engagement"
                value={form.engagement}
                onChange={handleChange}
                placeholder="2.8"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

            <div className="flex flex-col gap-1">
              <label className="text-sm">
                Location <span className="text-red-500">*</span>
              </label>

              <Input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Location"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm">
                Niche <span className="text-red-500">*</span>
              </label>

              <Input
                name="niche"
                value={form.niche}
                onChange={handleChange}
                placeholder="Niche"
              />
            </div>

          </div>

        </div>


        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

          <div className="flex flex-col gap-1">
            <label className="text-sm">
              Gender <span className="text-red-500">*</span>
            </label>
            <select
              name="gender"
              value={form.gender}
              onChange={(e) => setForm({...form, gender: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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


        <div className="flex justify-end gap-3 sm:gap-4 pt-4 sm:pt-6 border-t">
          <button
            onClick={handleCancel}
            className="h-10 px-5 text-sm font-medium rounded-lg border border-gray-300 
                       text-gray-600 hover:bg-gray-100"
          >
            Back
          </button>

          <button
            onClick={handleSubmit}
            className="h-10 px-6 text-sm font-medium rounded-lg
                       bg-[#1FAE5B] text-white hover:bg-[#0F6B3E]"
          >
            Save
          </button>
        </div>

    </div>
  )
}
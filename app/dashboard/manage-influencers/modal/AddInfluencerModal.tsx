"use client"

type Props = {
  setType: (v: "manual" | "instagram" | "tiktok") => void
  onClose: () => void
}

export default function AddInfluencerModal({ setType, onClose }: Props) {
  return (
    <div className="relative flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1E1E1E]">
            Add Influencer
          </h2>
          <p className="text-sm text-gray-500">
            Choose how you want to add a new influencer
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setType("manual")}
          className="bg-[#1FAE5B] text-white py-3 rounded-lg font-medium hover:bg-[#0F6B3E] transition"
        >
          Enter Details Manually
        </button>

        <button
          onClick={() => setType("instagram")}
          className="bg-[#1FAE5B]/10 text-[#0F6B3E] py-3 rounded-lg font-medium border border-[#1FAE5B]/30 hover:bg-[#1FAE5B]/20 transition"
        >
          Add Instagram Influencer
        </button>

        <button
          onClick={() => setType("tiktok")}
          className="bg-[#1FAE5B]/10 text-[#0F6B3E] py-3 rounded-lg font-medium border border-[#1FAE5B]/30 hover:bg-[#1FAE5B]/20 transition"
        >
          Add TikTok Creator
        </button>
      </div>
    </div>
  )
}
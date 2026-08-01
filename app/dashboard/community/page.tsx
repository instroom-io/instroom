// app/dashboard/community/page.tsx
// Route: /dashboard/community?brandId=<cuid>
//
// Reads brandId from the URL search params and passes it as a prop, mirroring
// the brand-partners route shell so brand-switching behaves consistently.

"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import CommunityPage from "./CommunityPage"
import { ListSkeleton } from "@/components/shared/skeletons"

function CommunityContent() {
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId")

  if (!brandId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-5 max-w-sm w-full px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            <svg
              className="w-7 h-7 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-1M3 12V6a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H9l-4 4v-4H5a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold text-gray-900">No brand selected</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Choose a brand from the dropdown above to open its community.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <CommunityPage brandId={brandId} />
}

export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} label="Fetching data..." />}>
      <CommunityContent />
    </Suspense>
  )
}

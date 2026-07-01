// app/dashboard/brand-partners/page.tsx
// Route: /dashboard/brand-partners?brandId=<cuid>
//
// Reads brandId from the URL search params and passes it as a prop.
// Must be a Client Component to use useSearchParams().

"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import BrandPartnersPage from "./BrandPartnersPage"

function BrandPartnersContent() {
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
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold text-gray-900">No brand selected</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Choose a brand from the dropdown above to view and manage its brand partners.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <BrandPartnersPage brandId={brandId} />
}

export default function Page() {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "60vh",
        fontFamily: "'Inter', sans-serif",
        color: "#888",
      }}>
        Loading…
      </div>
    }>
      <BrandPartnersContent />
    </Suspense>
  )
}
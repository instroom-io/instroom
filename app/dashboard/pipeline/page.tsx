"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import KanbanBoard from "./kanban/kanban-board"
import { SubscriptionGate } from "@/components/ui/subscription-gate"
import { BoardSkeleton } from "@/components/shared/skeletons"
import { useSubscriptionGate } from "@/hooks/useSubscriptionGate"

function PipelineContent() {
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId")
  // ── Subscription gate ──────────────────────────────────────────────────────
  // null = still loading (no flash), true/false = resolved. Served from the
  // shared cache, so a revisit resolves immediately instead of re-gating the
  // board behind a skeleton.
  const { isSubscribed } = useSubscriptionGate(brandId)
  // ──────────────────────────────────────────────────────────────────────────

  // SubscriptionGate wraps everything so the lock modal always shows
  // regardless of whether a brand is selected or not
  return (
    <SubscriptionGate
      isSubscribed={isSubscribed}
      featureName="the pipeline"
      plans={["Solo", "Team"]}
    >
      {!brandId ? (
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
                Choose a brand from the dropdown above to view and manage its influencers.
              </p>
            </div>
          </div>
        </div>
      ) : isSubscribed ? (
        // Rendered directly, as the Post Tracker page renders its board: the
        // board's own root is already `flex flex-col gap-4 p-6`, so wrapping it
        // in another padded flex column added 16px on every side and a second
        // 16px gap — which is what made the toolbar row and the columns sit
        // looser than the Post Tracker's.
        <KanbanBoard brandId={brandId} />
      ) : (
        <BoardSkeleton label="Fetching data..." />
      )}
    </SubscriptionGate>
  )
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<BoardSkeleton label="Fetching data..." />}>
      <PipelineContent />
    </Suspense>
  )
}
"use client"

// components/stale-data-notice.tsx
//
// The "we could not refresh, but what you are looking at is still real" strip.
//
// Shown when a background read fails on a view that ALREADY has data. The rows
// on screen are the last good response, so replacing the page with an error
// screen would throw away working data to report a problem the user cannot act
// on — and which usually clears itself. This says so quietly instead, and
// leaves the data where it is.
//
// Deliberately not an alert dialog and not red: nothing is broken from the
// user's point of view, the figures are just not freshly confirmed. A hard
// failure with NOTHING cached still takes over the page, which is the one case
// where there is genuinely nothing else to show.

import { IconRefresh } from "@tabler/icons-react"

export function StaleDataNotice({
  message,
  onRetry,
  isRetrying = false,
}: {
  /** Already user-facing — see lib/user-facing-error.ts. Never a raw error. */
  message: string
  onRetry: () => void
  /** True while a retry is in flight, so the control cannot be double-fired. */
  isRetrying?: boolean
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900"
    >
      <IconRefresh
        size={14}
        className={`flex-shrink-0 text-amber-600 ${isRetrying ? "animate-spin" : ""}`}
      />
      <span className="min-w-0 flex-1 truncate">
        {message} Showing the most recent data.
      </span>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="flex-shrink-0 rounded-md px-2 py-0.5 font-medium text-amber-900 underline-offset-2 transition hover:bg-amber-100 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRetrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  )
}

// app/dashboard/community/page.tsx
// Route: /dashboard/community?brandId=<cuid>
//
// Reads brandId from the URL search params and passes it as a prop, mirroring
// the brand-partners route shell so brand-switching behaves consistently.

"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { DiscordClient } from "./DiscordClient"
import { CommunitySkeleton } from "./_discord/CommunitySkeleton"
import { useLastBrand } from "./_discord/ServerSwitcher"

function CommunityContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  // Split defensively: `brandId` feeds straight into the /api/brands/{brandId}/
  // path, so a value carrying a stray "?..." or "&..." would be encoded into
  // that path (%3F...) and answered with 403 rather than failing visibly. A
  // brand id is an opaque cuid and never contains either character, so anything
  // from the first one onwards is not part of it.
  //
  // The redirect that produced such a value is fixed at its source (the Discord
  // account callback's returnTo join). This is the backstop, so a hand-edited or
  // future malformed url degrades to "wrong brand" rather than a puzzling 403.
  const brandId = searchParams.get("brandId")?.split(/[?&]/)[0] || null

  // Arriving with no brand: reopen whichever server was last used here rather
  // than making the user pick one again every time. `replace`, not `push`, so
  // Back doesn't bounce off the brandless URL straight back into the redirect.
  const lastBrand = useLastBrand()
  useEffect(() => {
    if (!brandId && lastBrand) {
      // Existing params are carried over rather than dropped. A Discord
      // authorization tab can land here with ?discordLinked=1 / ?discordConnected=1
      // and no brandId; rebuilding the url from brandId alone threw that verdict
      // away, so the tab had nothing left to report and never closed itself.
      const next = new URLSearchParams(searchParams.toString())
      next.set("brandId", lastBrand)
      router.replace(`/dashboard/community?${next.toString()}`)
    }
  }, [brandId, lastBrand, router, searchParams])

  if (!brandId) {
    // A redirect is already in flight — show the shell rather than flashing an
    // empty state the user is about to be navigated away from.
    if (lastBrand) return <CommunitySkeleton />
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

  // The brand's Discord server IS the community. Instroom renders it through
  // the bot; there is no second messaging system.
  //
  // Keyed on brandId: switching server remounts the client instead of mutating
  // it in place. That is what guarantees no channel, message, member or unread
  // state from the previous brand can be visible under the new one, and it is
  // also what makes the switch show the skeleton rather than the old server's
  // content while the new one loads.
  return <DiscordClient key={brandId} brandId={brandId} />
}

export default function Page() {
  return (
    // Same skeleton the client itself uses while checking status, so reading the
    // search params and then checking the connection is ONE loading state to the
    // user rather than a fallback that gets replaced by a different one.
    <Suspense fallback={<CommunitySkeleton />}>
      <CommunityContent />
    </Suspense>
  )
}

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  IconHash,
  IconAt,
  IconLoader2,
  IconSparkles,
  IconLock,
  IconRadar2,
  IconRefresh,
} from "@tabler/icons-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { DetectedPostsList, type DetectedPost } from "./DetectedPostsList"

type Quota = {
  apiRequests: number
  apiLimit: number
  postsImported: number
  postLimit: number
  exhausted: boolean
  resetsAt: string
}

/** Display-only. Entitlement is decided server-side from the user's existing
 *  subscription — this card never handles payment. */
const ADDON_PRICE = 19

export default function AutoPostDetectionCard({
  brandId,
  biId,
  onDetectedPost,
}: {
  brandId: string
  biId: string
  /** Accepted for call-site compatibility; the gate is now the add-on, not the plan. */
  subscriptionStatus?: string
  /**
   * Called with the newest detected post whenever detection has one — on load
   * and after "Check now". The Post tab uses it to offer that URL to the Post
   * URL field. Purely a notification: this card performs no writes because of
   * it, and the detection flow is unchanged when no handler is passed.
   */
  onDetectedPost?: (post: DetectedPost) => void
}) {
  const [loading, setLoading] = useState(true)
  const [addonActive, setAddonActive] = useState<boolean | null>(null)
  /** Server-derived: subscription is paid but the entitlement isn't claimed yet. */
  const [canClaim, setCanClaim] = useState(false)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [hashtags, setHashtags] = useState("")
  const [mentions, setMentions] = useState("")
  const [posts, setPosts] = useState<DetectedPost[]>([])
  const [postsHasMore, setPostsHasMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  // Add-on unlock (no local checkout — the app's Pricing page owns payment)
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState("")

  // Manual "check now" run
  const [checking, setChecking] = useState(false)
  const [checkMsg, setCheckMsg] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/post-tracker/detection?brandId=${encodeURIComponent(brandId)}&biId=${encodeURIComponent(biId)}`)
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.enabled ?? false)
        setHashtags(data.hashtags ?? "")
        setMentions(data.mentions ?? "")
        setPosts(data.posts ?? [])
        setPostsHasMore(Boolean(data.postsHasMore))
        setAddonActive(Boolean(data.addonActive))
        setCanClaim(Boolean(data.canClaimAddon))
        setQuota(data.quota ?? null)
      })
      .catch(() => setAddonActive(false))
      .finally(() => setLoading(false))
  }, [brandId, biId])

  useEffect(() => {
    load()
  }, [load])

  // Hand the newest detected post up to the Post tab. `posts` is already
  // newest-first from the API, so [0] is the latest detection — no extra
  // request, no second source of truth. Keyed on the id so a poll that returns
  // the same post doesn't re-notify.
  const newest = posts[0]
  const notifiedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!newest || !onDetectedPost) return
    if (notifiedRef.current === newest.id) return
    notifiedRef.current = newest.id
    onDetectedPost(newest)
  }, [newest, onDetectedPost])

  /**
   * Leave for the app's existing Pricing page. `returnTo` carries the exact
   * Post tab URL so the user lands back where they started, and `ptAddon=1`
   * tells this card to claim the add-on on arrival.
   *
   * Declared before `patch` on purpose: `patch` lists it as a dependency, and a
   * dependency array is evaluated during render — referencing a `const`
   * declared further down would throw.
   */
  const goToPricing = useCallback(() => {
    const here = new URL(window.location.href)
    here.searchParams.set("ptAddon", "1")
    const returnTo = `${here.pathname}${here.search}`
    // NAVIGATION ONLY — no entitlement decision depends on this. It exists so
    // the success page can send the user back to the tab they started on. If it
    // is missing or storage is blocked, the add-on still unlocks itself from
    // server state (canClaimAddon) whenever the user reaches this card.
    try {
      window.sessionStorage.setItem("ptAddonReturnTo", returnTo)
    } catch {
      /* private mode — the query param still covers the direct path */
    }
    window.location.href = `/pricing?returnTo=${encodeURIComponent(returnTo)}`
  }, [])

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true)
      setSaveMsg("")
      try {
        const res = await fetch("/api/post-tracker/detection", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId, biId, ...body }),
        })
        const data = await res.json()
        if (!res.ok) {
          // 402 = the server rejected the enable because the add-on isn't
          // active. Send the user to the app's Pricing page rather than
          // surfacing a bare error.
          if (res.status === 402 || data.addonRequired) {
            setAddonActive(false)
            goToPricing()
            return
          }
          throw new Error(data.error || "Failed to save")
        }
        setEnabled(data.enabled)
        setHashtags(data.hashtags ?? "")
        setMentions(data.mentions ?? "")
        setSaveMsg("Saved")
        setTimeout(() => setSaveMsg(""), 2000)
      } catch {
        setSaveMsg("Failed to save")
      } finally {
        setSaving(false)
      }
    },
    [brandId, biId, goToPricing]
  )

  /**
   * Claim the add-on against the user's existing subscription, then switch
   * monitoring on. Used both after returning from checkout and when someone
   * already subscribed clicks unlock.
   */
  const claimAddon = useCallback(async (): Promise<boolean> => {
    setUnlocking(true)
    setUnlockError("")
    try {
      const res = await fetch("/api/post-tracker/addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      })
      const data = await res.json()
      if (!res.ok || !data.activated) {
        // Not subscribed yet — this is the signal to go pay, not an error.
        if (res.status === 402 || data.subscriptionRequired) return false
        throw new Error(data.error || "Failed to unlock the add-on")
      }
      setAddonActive(true)
      setCanClaim(false)
      await patch({ enabled: true })
      load()
      return true
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : "Failed to unlock the add-on")
      return true // handled — don't also redirect
    } finally {
      setUnlocking(false)
    }
  }, [brandId, patch, load])

  /** Unlock button / toggle-on: claim if already subscribed, else go pay. */
  const handleUnlock = useCallback(async () => {
    if (await claimAddon()) return
    goToPricing()
  }, [claimAddon, goToPricing])

  function handleToggle(next: boolean) {
    if (next && !addonActive) {
      void handleUnlock()
      return
    }
    patch({ enabled: next })
  }

  // Self-unlock, driven entirely by server state.
  //
  // `canClaimAddon` comes from the API: the subscription is paid but the
  // entitlement row isn't active yet. That is exactly the post-checkout
  // condition, so no query param, cookie or sessionStorage breadcrumb is needed
  // to detect "just paid" — and it also repairs any workspace whose entitlement
  // was never claimed, however the user got there.
  //
  // Guarded by a ref so it runs once per mount rather than on every poll.
  const claimedRef = useRef(false)
  useEffect(() => {
    if (claimedRef.current || loading || !canClaim) return
    claimedRef.current = true
    void claimAddon().finally(() => {
      // Tidy the return marker out of the URL if checkout left one behind.
      const params = new URLSearchParams(window.location.search)
      if (params.has("ptAddon")) {
        params.delete("ptAddon")
        const qs = params.toString()
        window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
      }
    })
  }, [loading, canClaim, claimAddon])

  /**
   * Trigger a detection pass now. This is currently the ONLY way a pass runs:
   * the scheduled Vercel Cron was withdrawn (Hobby plan permits one run per
   * day, so a five-minute schedule is rejected at deploy time). It was already
   * the only path in local development, where a cron never fires at all.
   */
  const runNow = useCallback(async () => {
    setChecking(true)
    setCheckMsg("")
    try {
      const res = await fetch("/api/post-tracker/detection/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setCheckMsg(data.error || "Detection failed")
        return
      }
      if (data.skipped) {
        setCheckMsg(data.reason || "A pass is already running")
        return
      }

      const s = data.summary ?? {}
      setCheckMsg(
        s.postsImported > 0
          ? `Imported ${s.postsImported} new post${s.postsImported === 1 ? "" : "s"}.`
          : s.apiCalls > 0
            ? `Checked ${s.apiCalls} source${s.apiCalls === 1 ? "" : "s"} — no new posts found.`
            : // Never leave the user with a silent success.
              `No requests were made. ${(s.skipped ?? []).concat(s.errors ?? []).join(" ") || "Nothing was due for polling."}`
      )
      if (data.quota) setQuota(data.quota)
      load()
    } catch {
      setCheckMsg("Detection failed — see server logs")
    } finally {
      setChecking(false)
    }
  }, [brandId, load])

  const quotaReached = Boolean(quota?.exhausted)

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-[#0F6B3E]/10 flex items-center justify-center flex-shrink-0">
          <IconRadar2 size={16} className="text-[#0F6B3E]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-gray-900">Automatic Post Detection</span>
            {/* Same badge geometry and colours as before — label only. */}
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide bg-[#fff8e1] text-[#854F0B] rounded-full px-1.5 py-0.5">
              <IconSparkles size={9} />
              Add-on
            </span>
          </div>
          <div className="text-[11px] text-gray-400">Detects posts via hashtag &amp; mention monitoring</div>
        </div>
        {/* Always rendered: flipping it on without the add-on sends the user to
            the Pricing page rather than hiding the control. */}
        <Switch
          checked={enabled}
          disabled={loading || saving || unlocking}
          onCheckedChange={handleToggle}
          aria-label="Enable automatic post detection"
        />
      </div>

      {loading && addonActive === null && (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
          <IconLoader2 size={14} className="animate-spin" />
          Checking access…
        </div>
      )}

      {!loading && addonActive === false && (
        <div className="flex flex-col items-center text-center gap-2 px-4 py-7">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <IconLock size={16} className="text-gray-400" />
          </div>
          <p className="text-xs font-medium text-gray-700">Add-on required</p>
          <p className="text-[11px] text-gray-400 max-w-[240px]">
            Automatic Post Detection is a Post Tracker add-on. Unlock it to monitor hashtags and mentions and pull
            matching posts into the tracker.
          </p>
          {unlockError && <p className="text-[11px] text-red-600 max-w-[240px]">{unlockError}</p>}
          <Button
            size="sm"
            onClick={() => void handleUnlock()}
            disabled={unlocking}
            className="mt-1 bg-[#0F6B3E] hover:bg-[#0a5a2f] text-xs h-8"
          >
            {unlocking ? (
              <>
                <IconLoader2 size={13} className="animate-spin mr-1" />
                Unlocking…
              </>
            ) : (
              <>Unlock add-on — ${ADDON_PRICE}</>
            )}
          </Button>
        </div>
      )}

      {addonActive === true && (
        <div className="p-4 flex flex-col gap-3.5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400">
              <IconLoader2 size={14} className="animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[11px] font-medium">
                <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-[#1FAE5B]" : "bg-gray-300"}`} />
                {/* Deliberately does NOT say "active"/"running": there is no
                    scheduled job behind this today (see
                    app/api/cron/post-detection/route.ts). "Enabled" describes
                    the saved config; detection only happens on "Check now". */}
                <span className={enabled ? "text-[#0F6B3E]" : "text-gray-400"}>
                  {enabled ? "Monitoring enabled" : "Monitoring off"}
                </span>
                {enabled && (
                  <button
                    type="button"
                    onClick={() => void runNow()}
                    disabled={checking || quotaReached}
                    className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    {checking ? <IconLoader2 size={11} className="animate-spin" /> : <IconRefresh size={11} />}
                    {checking ? "Checking…" : "Check now"}
                  </button>
                )}
              </div>

              {/* Background checks are live again — driven by server request
                  traffic rather than a cron schedule (lib/post-tracker/scheduler.ts),
                  so this no longer has to tell the user the system is asleep.
                  The wording avoids promising a guaranteed clock tick, because
                  the trigger is traffic-driven: "about every 5 minutes" is what
                  it does on an app in use, which is when detection matters. */}
              {enabled && (
                <div className="text-[10px] text-gray-400">
                  Automatic background checks are active — your hashtags and mentions are polled
                  about every 5 minutes, with no need to keep this page open. Use &ldquo;Check
                  now&rdquo; to run a pass immediately.
                </div>
              )}

              {checkMsg && <div className="text-[10px] text-gray-500">{checkMsg}</div>}

              {/* Testing quota. Replaced by real entitlements later; the shape
                  comes straight from the API so this needs no change then. */}
              {quota && (
                quotaReached ? (
                  <div className="rounded-lg bg-[#fff8e1] border border-[#f5e2b0] px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#854F0B]">Daily testing limit reached.</p>
                    <p className="text-[10px] text-[#8a6520]">
                      You can run another check after the quota resets
                      {quota.resetsAt ? ` at ${new Date(quota.resetsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400">
                    <span>
                      API usage:{" "}
                      <strong className="font-semibold text-gray-600 tabular-nums">
                        {quota.apiRequests} / {quota.apiLimit}
                      </strong>
                    </span>
                    <span>
                      Posts imported:{" "}
                      <strong className="font-semibold text-gray-600 tabular-nums">
                        {quota.postsImported} / {quota.postLimit}
                      </strong>
                    </span>
                  </div>
                )
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                    <IconHash size={12} />
                    Hashtags monitored
                  </label>
                  <input
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:border-[#0F6B3E]/40 focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="#brandname, #campaign2026"
                    value={hashtags}
                    disabled={!enabled}
                    onChange={(e) => setHashtags(e.target.value)}
                    onBlur={() => patch({ hashtags })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                    <IconAt size={12} />
                    Mentions monitored
                  </label>
                  <input
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:border-[#0F6B3E]/40 focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="@yourbrand"
                    value={mentions}
                    disabled={!enabled}
                    onChange={(e) => setMentions(e.target.value)}
                    onBlur={() => patch({ mentions })}
                  />
                </div>
              </div>
              {saveMsg && <div className="text-[10px] text-gray-400">{saveMsg}</div>}

              <div className="flex flex-col gap-1.5 pt-1">
                <div className="text-[11px] font-semibold text-gray-500">Recently detected posts</div>
                {/* Own component so its 45s poll re-renders the list alone —
                    the inputs above keep focus and the page keeps its scroll. */}
                <DetectedPostsList
                  brandId={brandId}
                  biId={biId}
                  enabled={enabled}
                  initialPosts={posts}
                  initialHasMore={postsHasMore}
                  loading={loading}
                />
              </div>
            </>
          )}
        </div>
      )}

    </div>
  )
}
